"use client";

const TOKEN_KEY = "atb.jwt";
const BRIDGE_KEY = "atb.bridgeToken";

export function saveSession(jwt: string) {
  localStorage.setItem(TOKEN_KEY, jwt);
}

export function getSession(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthed(): boolean {
  return !!getSession();
}

export function saveBridgeToken(token: string) {
  localStorage.setItem(BRIDGE_KEY, token);
}

export function getBridgeToken(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(BRIDGE_KEY) || "DEMO-1234";
}
