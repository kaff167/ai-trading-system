"use client";

import { useEffect } from "react";
import { getSocket, subscribe } from "./socket";
import { getBridgeToken } from "./auth";
import { useDashboardStore } from "./store";
import type { BotState, LogLine, Trade } from "./types";

/**
 * Connects to the relay, subscribes to the saved bridge token, and pipes all
 * realtime events into the zustand store. Safe to call once from a page.
 */
export function useBridge() {
  const { setState, pushLog, pushTrade, setBridgeOnline, setSimulated, reset } =
    useDashboardStore();

  useEffect(() => {
    const socket = getSocket();
    const token = getBridgeToken();

    const onState = (s: BotState) => setState(s);
    const onLog = (l: LogLine) => pushLog(l);
    const onTrade = (t: Trade) => pushTrade(t);
    const onBridgeOnline = ({ online }: { online: boolean }) =>
      setBridgeOnline(online);
    const onSubscribed = ({
      bridgeOnline,
      simulated,
    }: {
      bridgeOnline: boolean;
      simulated: boolean;
    }) => {
      setBridgeOnline(bridgeOnline);
      setSimulated(simulated);
    };
    const onConnect = () => subscribe(token);

    socket.on("connect", onConnect);
    socket.on("state", onState);
    socket.on("log", onLog);
    socket.on("trade", onTrade);
    socket.on("bridge:online", onBridgeOnline);
    socket.on("dashboard:subscribed", onSubscribed);

    if (socket.connected) subscribe(token);

    return () => {
      socket.off("connect", onConnect);
      socket.off("state", onState);
      socket.off("log", onLog);
      socket.off("trade", onTrade);
      socket.off("bridge:online", onBridgeOnline);
      socket.off("dashboard:subscribed", onSubscribed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // expose reset for logout flows
  return { reset };
}
