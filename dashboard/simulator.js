/*
 * simulator.js
 * -----------------------------------------------------------------------------
 * Built-in data generator that mimics the AI Trading Bot shown in the reference
 * video. When SIMULATE=true and a dashboard subscribes to the DEMO_TOKEN, the
 * relay server spins up one of these per room so the UI is fully live without a
 * real MT5 local bridge connected.
 *
 * It emits the exact same event shapes a real local bridge would emit:
 *   - "state" : full BotState snapshot (account, bot, stats, next-trade timer)
 *   - "trade" : a single closed trade for the Live Trade Log
 *   - "log"   : a single Bot Console Terminal line
 */

const INFO_LINES = [
  "MACD crossover detected",
  "Scanning market conditions...",
  "Moving averages showing strength",
  "Checking support/resistance levels...",
  "RSI divergence spotted",
  "Volume spike confirmed",
  "Trend continuation likely",
];

function pad(n, len = 2) {
  return String(n).padStart(len, "0");
}

function stamp(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(
    d.getMilliseconds(),
    3
  )}`;
}

let SEQ = 0;
function uid(prefix) {
  SEQ += 1;
  return `${prefix}-${Date.now()}-${SEQ}`;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

class BotSimulator {
  /**
   * @param {(event: string, payload: any) => void} emit  channel back to room
   * @param {{ intervalSeconds?: number }} [opts]
   */
  constructor(emit, opts = {}) {
    this.emit = emit;
    this.intervalSeconds = opts.intervalSeconds || 15;

    // Starting snapshot mirrors the numbers visible in the reference video.
    this.state = {
      connected: true,
      source: "simulator",
      account: { balance: 3712.91, equity: 3712.91, currency: "USD" },
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
      stats: {
        totalTrades: 13,
        wins: 11,
        losses: 2,
        winRate: 84.6,
        profit: 584.88,
      },
      nextTrade: {
        secondsLeft: 41,
        intervalSeconds: this.intervalSeconds,
      },
    };

    this._tick = this._tick.bind(this);
    this._timer = null;
  }

  start() {
    if (this._timer) return;
    // Seed the console with a couple of lines so it is never empty.
    this._log("info", "Bot engine started — connecting to market feed...");
    this._log("info", "Scanning market conditions...");
    this.emit("state", this.state);
    this._timer = setInterval(this._tick, 1000);
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  snapshot() {
    return this.state;
  }

  setStatus(status) {
    if (["running", "paused", "stopped"].includes(status)) {
      this.state.bot.status = status;
      this._log("info", `Bot ${status}`);
      this.emit("state", this.state);
    }
  }

  _log(level, text) {
    this.emit("log", { id: uid("log"), ts: stamp(), level, text });
  }

  _tick() {
    if (this.state.bot.status !== "running") {
      // Still push state so connection/heartbeat stays fresh.
      this.emit("state", this.state);
      return;
    }

    const nt = this.state.nextTrade;
    nt.secondsLeft -= 1;

    // Occasional analysis chatter while waiting.
    if (nt.secondsLeft > 0 && Math.random() < 0.18) {
      this._log("info", INFO_LINES[Math.floor(Math.random() * INFO_LINES.length)]);
    }

    if (nt.secondsLeft <= 0) {
      this._executeTrade();
      nt.secondsLeft = nt.intervalSeconds;
    }

    this.emit("state", this.state);
  }

  _executeTrade() {
    const s = this.state;
    const direction = Math.random() < 0.55 ? "buy" : "sell";
    // Fabricated small prices, matching the values shown in the video.
    const entry = round2(1 + Math.random() * 0.2);
    const win = Math.random() < 0.86; // ~ matches the 84-86% win rate in video
    const exit = round2(direction === "buy" ? entry - 0.03 : entry + 0.03);

    const pnl = win
      ? round2(45 + Math.random() * 15) // +$45..+$60
      : round2(-(5 + Math.random() * 10)); // -$5..-$15

    // Console lines, in the same order/colour scheme as the video.
    this._log(
      "buy",
      `✓✓ ${direction.toUpperCase()} ${s.bot.symbol} @ $${entry.toFixed(2)}`
    );
    this._log("position", "Position open - waiting for interval to close...");
    this._log("position", `Position closed @ $${exit.toFixed(2)}`);
    if (pnl >= 0) {
      this._log("profit", `✓ Profit: +$${pnl.toFixed(2)}`);
    } else {
      this._log("loss", `✗ Loss: -$${Math.abs(pnl).toFixed(2)}`);
    }

    // Update stats.
    s.stats.totalTrades += 1;
    if (pnl >= 0) s.stats.wins += 1;
    else s.stats.losses += 1;
    s.stats.winRate = round2((s.stats.wins / s.stats.totalTrades) * 100);
    s.stats.profit = round2(s.stats.profit + pnl);
    s.account.balance = round2(s.account.balance + pnl);
    s.account.equity = s.account.balance;

    // Live trade log entry.
    this.emit("trade", {
      id: uid("trade"),
      ts: stamp(),
      symbol: s.bot.symbol,
      displaySymbol: s.bot.displaySymbol,
      direction,
      price: entry,
      pnl,
    });
  }
}

module.exports = { BotSimulator };
