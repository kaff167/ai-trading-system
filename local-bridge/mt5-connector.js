/*
 * mt5-connector.js — talks to a running MetaTrader 5 terminal through the
 * companion MQL5 Expert Advisor (mt5-bridge-ea/Bridge.mq5) over ZeroMQ.
 *
 *   EA  PUB  tcp://127.0.0.1:5556  --->  bridge SUB   (account / stats / trades / logs)
 *   EA  REP  tcp://127.0.0.1:5557  <---  bridge REQ   (pause / resume / stop / buy / sell / close)
 *
 * Incoming PUB frames are single JSON objects with a `type` field. The connector
 * aggregates them into a BotState (identical shape to the simulator) and re-emits
 * `state`, `trade` and `log` events that the bridge forwards to the cloud.
 *
 * `zeromq` is loaded lazily so the bridge can run in --simulate mode on machines
 * without the native bindings installed.
 */
const EventEmitter = require("events");

function pad(n, len = 2) {
  return String(n).padStart(len, "0");
}
function stamp(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(
    d.getSeconds()
  )}.${pad(d.getMilliseconds(), 3)}`;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}

class Mt5Connector extends EventEmitter {
  constructor({ subAddr, reqAddr }) {
    super();
    this.subAddr = subAddr;
    this.reqAddr = reqAddr;
    this._sub = null;
    this._req = null;
    this._running = false;

    this.state = {
      connected: false,
      source: "bridge",
      account: { balance: 0, equity: 0, currency: "USD" },
      bot: {
        id: "pro-trading-bot",
        name: "Pro Trading Bot",
        version: "v2.1",
        mode: "balanced",
        status: "running",
        description:
          "Professional algorithmic trading bot with advanced market analysis",
        symbol: "XAUUSD",
        displaySymbol: "XAU/USD",
        perTrade: 5000,
      },
      stats: { totalTrades: 0, wins: 0, losses: 0, winRate: 0, profit: 0 },
      nextTrade: { secondsLeft: 60, intervalSeconds: 60 },
    };
  }

  async start() {
    let zmq;
    try {
      zmq = require("zeromq");
    } catch (err) {
      this.emit("log", {
        id: `log-${Date.now()}`,
        ts: stamp(),
        level: "loss",
        text:
          "ZeroMQ native module not installed. Run `npm install` in /local-bridge.",
      });
      throw err;
    }

    this._sub = new zmq.Subscriber();
    this._sub.connect(this.subAddr);
    this._sub.subscribe(""); // all topics
    this._req = new zmq.Request();
    this._req.connect(this.reqAddr);

    this._running = true;
    this.state.connected = true;
    console.log(`[mt5] SUB ${this.subAddr} | REQ ${this.reqAddr}`);
    this.emit("log", {
      id: `log-${Date.now()}`,
      ts: stamp(),
      level: "info",
      text: "Connected to MT5 EA over ZeroMQ",
    });

    this._receiveLoop();
    this._tickLoop();
  }

  async _receiveLoop() {
    try {
      for await (const [frame] of this._sub) {
        if (!this._running) break;
        let msg;
        try {
          msg = JSON.parse(frame.toString());
        } catch {
          continue;
        }
        this._handleMessage(msg);
      }
    } catch (err) {
      if (this._running) console.error("[mt5] receive loop error:", err.message);
    }
  }

  _tickLoop() {
    this._timer = setInterval(() => {
      if (!this._running) return;
      if (this.state.bot.status === "running" && this.state.nextTrade.secondsLeft > 0) {
        this.state.nextTrade.secondsLeft -= 1;
      }
      this.emit("state", this.state);
    }, 1000);
  }

  _handleMessage(msg) {
    const s = this.state;
    switch (msg.type) {
      case "account":
        if (typeof msg.balance === "number") s.account.balance = round2(msg.balance);
        if (typeof msg.equity === "number") s.account.equity = round2(msg.equity);
        if (msg.currency) s.account.currency = msg.currency;
        break;
      case "bot":
        Object.assign(s.bot, {
          name: msg.name ?? s.bot.name,
          version: msg.version ?? s.bot.version,
          mode: msg.mode ?? s.bot.mode,
          status: msg.status ?? s.bot.status,
          symbol: msg.symbol ?? s.bot.symbol,
          displaySymbol: msg.displaySymbol ?? s.bot.displaySymbol,
          perTrade: msg.perTrade ?? s.bot.perTrade,
        });
        if (typeof msg.intervalSeconds === "number") {
          s.nextTrade.intervalSeconds = msg.intervalSeconds;
        }
        if (typeof msg.nextTradeSeconds === "number") {
          s.nextTrade.secondsLeft = msg.nextTradeSeconds;
        }
        break;
      case "stats":
        Object.assign(s.stats, {
          totalTrades: msg.totalTrades ?? s.stats.totalTrades,
          wins: msg.wins ?? s.stats.wins,
          losses: msg.losses ?? s.stats.losses,
          winRate:
            msg.winRate ??
            (msg.totalTrades
              ? round2((msg.wins / msg.totalTrades) * 100)
              : s.stats.winRate),
          profit: msg.profit ?? s.stats.profit,
        });
        break;
      case "trade": {
        const win = (msg.profit ?? 0) >= 0;
        this.emit("trade", {
          id: msg.ticket ? `t-${msg.ticket}` : `t-${Date.now()}`,
          ts: stamp(),
          symbol: msg.symbol || s.bot.symbol,
          displaySymbol: msg.displaySymbol || s.bot.displaySymbol,
          direction: msg.direction || "buy",
          price: msg.price ?? 0,
          pnl: round2(msg.profit ?? 0),
        });
        // reset countdown after a trade closes
        s.nextTrade.secondsLeft = s.nextTrade.intervalSeconds;
        this.emit("log", {
          id: `log-${Date.now()}`,
          ts: stamp(),
          level: win ? "profit" : "loss",
          text: win
            ? `✓ Profit: +$${Math.abs(msg.profit ?? 0).toFixed(2)}`
            : `✗ Loss: -$${Math.abs(msg.profit ?? 0).toFixed(2)}`,
        });
        break;
      }
      case "log":
        this.emit("log", {
          id: `log-${Date.now()}`,
          ts: msg.time || stamp(),
          level: msg.level || "info",
          text: msg.text || "",
        });
        break;
      default:
        break;
    }
  }

  async sendCommand(cmd) {
    if (!this._req) return;
    try {
      await this._req.send(JSON.stringify(cmd));
      const [reply] = await this._req.receive();
      const r = reply.toString();
      console.log(`[mt5] command ${JSON.stringify(cmd)} -> ${r}`);
      // Reflect status changes locally for snappy UI.
      if (cmd.cmd === "pause") this.state.bot.status = "paused";
      if (cmd.cmd === "resume" || cmd.cmd === "start") this.state.bot.status = "running";
      if (cmd.cmd === "stop") this.state.bot.status = "stopped";
      return r;
    } catch (err) {
      console.error("[mt5] command error:", err.message);
    }
  }

  stop() {
    this._running = false;
    if (this._timer) clearInterval(this._timer);
    try {
      this._sub && this._sub.close();
      this._req && this._req.close();
    } catch {
      /* ignore */
    }
  }
}

module.exports = { Mt5Connector };
