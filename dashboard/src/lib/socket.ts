"use client";

import { io, Socket } from "socket.io-client";
import type { CommandAction } from "./types";

let socket: Socket | null = null;

/**
 * Returns a singleton Socket.IO client connected to the relay (same origin in
 * production; falls back to NEXT_PUBLIC_RELAY_URL when the relay is hosted
 * separately).
 */
export function getSocket(): Socket {
  if (socket) return socket;
  const url = process.env.NEXT_PUBLIC_RELAY_URL || undefined;
  socket = io(url, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  });
  return socket;
}

export function subscribe(token: string) {
  getSocket().emit("dashboard:subscribe", { token });
}

export function sendCommand(action: CommandAction, payload?: unknown) {
  getSocket().emit("dashboard:command", { action, payload });
}
