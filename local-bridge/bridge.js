#!/usr/bin/env node
/*
 * bridge.js — entry point for the Local Bridge.
 *
 * Run on the user's Windows PC alongside MetaTrader 5. It:
 *   1. Loads config + a persistent connection token.
 *   2. Connects to the cloud dashboard relay over Socket.IO (auto-reconnect).
 *   3. Either reads live data from MT5 via ZeroMQ (MODE=mt5) or generates
 *      realistic demo data (--simulate / MODE=simulate).
 *   4. Forwards state/trade/log to the cloud and relays commands back to MT5.
 *
 * Usage:
 *   node bridge.js              # MT5 mode (needs MT5 + Bridge.mq5 EA running)
 *   node bridge.js --simulate   # demo mode (no MT5 required)
 */
const config = require("./config");
const { CloudClient } = require("./websocket-client");

function banner() {
  const line = "═".repeat(54);
  console.log(`\n╔${line}╗`);
  console.log("║  AI Trading Bot — Local Bridge".padEnd(55) + "║");
  console.log(`╠${line}╣`);
  console.log(`║  Cloud URL : ${config.cloudUrl}`.padEnd(55) + "║");
  console.log(`║  Mode      : ${config.simulate ? "SIMULATE (no MT5)" : "MT5 (ZeroMQ)"}`.padEnd(55) + "║");
  console.log(`╠${line}╣`);
  console.log("║  Pair this token in the dashboard Settings screen:".padEnd(55) + "║");
  console.log(`║                                                      ║`);
  console.log(`║      >>>  ${config.token}  <<<`.padEnd(55) + "║");
  console.log(`║                                                      ║`);
  console.log(`╚${line}╝\n`);
}

async function main() {
  banner();

  const cloud = new CloudClient({
    url: config.cloudUrl,
    token: config.token,
    heartbeatMs: config.heartbeatMs,
  });

  const emit = (event, payload) => cloud.send(event, payload);

  if (config.simulate) {
    const { BotSimulator } = require("./simulator");
    const sim = new BotSimulator(emit, { intervalSeconds: 15 });
    sim.start();
    cloud.onCommand(({ action }) => {
      if (action === "pause") sim.setStatus("paused");
      else if (action === "start" || action === "resume") sim.setStatus("running");
      else if (action === "stop") sim.setStatus("stopped");
    });
    console.log("[bridge] simulator running — sending demo data to cloud.");
  } else {
    const { Mt5Connector } = require("./mt5-connector");
    const mt5 = new Mt5Connector({
      subAddr: config.zmqSubAddr,
      reqAddr: config.zmqReqAddr,
    });
    mt5.on("state", (s) => emit("state", s));
    mt5.on("trade", (t) => emit("trade", t));
    mt5.on("log", (l) => emit("log", l));

    cloud.onCommand(({ action }) => {
      const map = {
        pause: { cmd: "pause" },
        resume: { cmd: "resume" },
        start: { cmd: "start" },
        stop: { cmd: "stop" },
      };
      if (map[action]) mt5.sendCommand(map[action]);
    });

    try {
      await mt5.start();
    } catch (err) {
      console.error(
        "[bridge] Could not connect to MT5. Is MetaTrader 5 running with Bridge.mq5 attached?"
      );
      console.error("[bridge]", err.message);
      console.error(
        "[bridge] Tip: run `node bridge.js --simulate` to test the pipeline without MT5."
      );
    }

    const shutdown = () => {
      console.log("\n[bridge] shutting down…");
      mt5.stop();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }
}

main().catch((err) => {
  console.error("[bridge] fatal:", err);
  process.exit(1);
});
