/*
 * websocket-client.js — Socket.IO client that connects the local bridge to the
 * cloud relay. Handles registration, auto-reconnect with exponential backoff
 * (built into socket.io), heartbeat, and inbound trade commands.
 */
const { io } = require("socket.io-client");

class CloudClient {
  /**
   * @param {{ url: string, token: string, heartbeatMs?: number }} opts
   */
  constructor(opts) {
    this.url = opts.url;
    this.token = opts.token;
    this.heartbeatMs = opts.heartbeatMs || 15000;
    this._commandHandler = null;
    this._heartbeat = null;

    this.socket = io(this.url, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5,
    });

    this.socket.on("connect", () => {
      console.log(`[ws] connected to ${this.url} (id=${this.socket.id})`);
      this.socket.emit("bridge:register", { token: this.token });
    });

    this.socket.on("bridge:registered", ({ token }) => {
      console.log(`[ws] registered with token ${token}`);
      this._startHeartbeat();
    });

    this.socket.on("command", (cmd) => {
      console.log(`[ws] command received:`, cmd);
      if (this._commandHandler) this._commandHandler(cmd);
    });

    this.socket.io.on("reconnect_attempt", (n) =>
      console.log(`[ws] reconnect attempt #${n}…`)
    );
    this.socket.on("disconnect", (reason) => {
      console.log(`[ws] disconnected: ${reason}`);
      this._stopHeartbeat();
    });
    this.socket.on("connect_error", (err) =>
      console.log(`[ws] connect error: ${err.message}`)
    );
  }

  send(event, payload) {
    if (this.socket.connected) this.socket.emit(event, payload);
  }

  onCommand(handler) {
    this._commandHandler = handler;
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    // Socket.IO already does protocol-level ping/pong; this app-level ping keeps
    // the relay's room state warm and lets us log liveness.
    this._heartbeat = setInterval(() => {
      if (this.socket.connected) this.socket.emit("bridge:ping", { t: Date.now() });
    }, this.heartbeatMs);
  }

  _stopHeartbeat() {
    if (this._heartbeat) clearInterval(this._heartbeat);
    this._heartbeat = null;
  }
}

module.exports = { CloudClient };
