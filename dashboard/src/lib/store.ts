import { create } from "zustand";
import type { BotState, LogLine, Trade } from "./types";

interface DashboardStore {
  bridgeOnline: boolean;
  simulated: boolean;
  state: BotState | null;
  logs: LogLine[];
  trades: Trade[];
  setBridgeOnline: (online: boolean) => void;
  setSimulated: (sim: boolean) => void;
  setState: (s: BotState) => void;
  pushLog: (line: LogLine) => void;
  pushTrade: (trade: Trade) => void;
  reset: () => void;
}

const MAX_LOGS = 100;
const MAX_TRADES = 50;

export const useDashboardStore = create<DashboardStore>((set) => ({
  bridgeOnline: false,
  simulated: false,
  state: null,
  logs: [],
  trades: [],
  setBridgeOnline: (online) => set({ bridgeOnline: online }),
  setSimulated: (sim) => set({ simulated: sim }),
  setState: (s) => set({ state: s }),
  pushLog: (line) =>
    set((prev) => ({ logs: [...prev.logs, line].slice(-MAX_LOGS) })),
  pushTrade: (trade) =>
    set((prev) => ({ trades: [trade, ...prev.trades].slice(0, MAX_TRADES) })),
  reset: () => set({ state: null, logs: [], trades: [], bridgeOnline: false }),
}));
