/*
 * server.js
 * -----------------------------------------------------------------------------
 * Combined Next.js + Socket.IO relay server.
 *
 * This single process can be deployed to any host that supports long-lived
 * WebSocket connections on the free tier (Railway / Render / Fly). It serves the
 * Next.js dashboard AND acts as the realtime relay between:
 *
 *   [ Local Bridge on user's Windows PC ]  --(socket.io)-->  [ this relay ]
 *   [ Dashboard browser (phone/laptop) ]   <--(socket.io)--  [ this relay ]
 *
 * Rooms are keyed by a connection token. A bridge registers a token; dashboards
 * subscribe to the same token to receive that account's live data. Commands
 * (start / pause / stop) flow back from the dashboard to the bridge.
 *
 * When SIMULATE=true, subscribing to DEMO_TOKEN starts a built-in BotSimulator
 * so the UI is fully live without any real MT5 connection.
 */

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const { BotSimulator } = require("./simulator");

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const SIMULATE = (process.env.SIMULATE || "false").toLowerCase() === "true";
const DEMO_TOKEN = process.env.DEMO_TOKEN || "DEMO-1234";
const SIM_INTERVAL = parseInt(process.env.SIM_INTERVAL_SECONDS || "15", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

/**
 * Per-token room registry.
 * token -> { bridgeSocketId: string|null, lastState: any, simulator: BotSimulator|null }
 */
const rooms = new Map();

function roomName(token) {
  return `room:${token}`;
}

function getRoom(token) {
  if (!rooms.has(token)) {
    rooms.set(token, { bridgeSocketId: null, lastState: null, simulator: null });
  }
  return rooms.get(token);
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    pingInterval: 20000,
    pingTimeout: 25000,
  });

  io.on("connection", (socket) => {
    let role = null; // "bridge" | "dashboard"
    let token = null;

    // ── Local bridge registers itself for a token ──────────────────────────
    socket.on("bridge:register", ({ token: t } = {}) => {
      if (!t) return socket.emit("error:msg", "Missing token");
      role = "bridge";
      token = String(t);
      const room = getRoom(token);
      room.bridgeSocketId = socket.id;
      // A real bridge takes over from the simulator for this token.
      if (room.simulator) {
        room.simulator.stop();
        room.simulator = null;
      }
      socket.join(roomName(token));
      socket.emit("bridge:registered", { token });
      io.to(roomName(token)).emit("bridge:online", { online: true });
      console.log(`[relay] bridge registered for token ${token}`);
    });

    // Bridge -> relay -> dashboards
    const relay = (event) => (payload) => {
      if (role !== "bridge" || !token) return;
      if (event === "state") getRoom(token).lastState = payload;
      io.to(roomName(token)).emit(event, payload);
    };
    socket.on("state", relay("state"));
    socket.on("trade", relay("trade"));
    socket.on("log", relay("log"));

    // ── Dashboard subscribes to a token ────────────────────────────────────
    socket.on("dashboard:subscribe", ({ token: t } = {}) => {
      if (!t) return socket.emit("error:msg", "Missing token");
      role = "dashboard";
      token = String(t);
      const room = getRoom(token);
      socket.join(roomName(token));

      const bridgeOnline = !!room.bridgeSocketId;

      // Start the simulator if no real bridge is present and this is the demo
      // token (or SIMULATE forces it on for any token).
      if (!bridgeOnline && SIMULATE && (token === DEMO_TOKEN || true)) {
        if (!room.simulator) {
          room.simulator = new BotSimulator(
            (event, payload) => {
              if (event === "state") room.lastState = payload;
              io.to(roomName(token)).emit(event, payload);
            },
            { intervalSeconds: SIM_INTERVAL }
          );
          room.simulator.start();
        }
      }

      socket.emit("dashboard:subscribed", {
        token,
        bridgeOnline,
        simulated: !!room.simulator,
      });
      if (room.lastState) socket.emit("state", room.lastState);
      socket.emit("bridge:online", {
        online: bridgeOnline || !!room.simulator,
      });
    });

    // Dashboard -> relay -> bridge (or simulator)
    socket.on("dashboard:command", ({ action, payload } = {}) => {
      if (role !== "dashboard" || !token) return;
      const room = getRoom(token);
      if (room.bridgeSocketId) {
        io.to(room.bridgeSocketId).emit("command", { action, payload });
      } else if (room.simulator) {
        if (action === "pause") room.simulator.setStatus("paused");
        else if (action === "start" || action === "resume")
          room.simulator.setStatus("running");
        else if (action === "stop") room.simulator.setStatus("stopped");
      }
    });

    socket.on("disconnect", () => {
      if (role === "bridge" && token) {
        const room = getRoom(token);
        if (room.bridgeSocketId === socket.id) {
          room.bridgeSocketId = null;
          io.to(roomName(token)).emit("bridge:online", { online: false });
          console.log(`[relay] bridge disconnected for token ${token}`);
        }
      }
    });
  });

  httpServer.listen(port, () => {
    console.log(
      `> Dashboard + relay ready on http://localhost:${port} (simulate=${SIMULATE})`
    );
  });
});
