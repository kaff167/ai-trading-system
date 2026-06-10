/*
 * config.js — loads bridge configuration from environment / .env and manages a
 * persistent connection token.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

try {
  require("dotenv").config();
} catch {
  /* dotenv optional when running as a packaged .exe */
}

const TOKEN_FILE = path.join(__dirname, ".bridge-token");

function generateToken() {
  // Human-friendly token like "BR-9F3A-21C7".
  const part = () => crypto.randomBytes(2).toString("hex").toUpperCase();
  return `BR-${part()}-${part()}`;
}

function loadOrCreateToken() {
  if (process.env.BRIDGE_TOKEN && process.env.BRIDGE_TOKEN.trim()) {
    return process.env.BRIDGE_TOKEN.trim();
  }
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const saved = fs.readFileSync(TOKEN_FILE, "utf8").trim();
      if (saved) return saved;
    }
  } catch {
    /* ignore */
  }
  const token = generateToken();
  try {
    fs.writeFileSync(TOKEN_FILE, token, "utf8");
  } catch {
    /* read-only fs (packaged) — keep in-memory only */
  }
  return token;
}

const simulate =
  process.argv.includes("--simulate") ||
  (process.env.MODE || "mt5").toLowerCase() === "simulate";

module.exports = {
  cloudUrl: process.env.CLOUD_URL || "http://localhost:3000",
  token: loadOrCreateToken(),
  simulate,
  zmqSubAddr: process.env.ZMQ_SUB_ADDR || "tcp://127.0.0.1:5556",
  zmqReqAddr: process.env.ZMQ_REQ_ADDR || "tcp://127.0.0.1:5557",
  heartbeatMs: parseInt(process.env.HEARTBEAT_MS || "15000", 10),
};
