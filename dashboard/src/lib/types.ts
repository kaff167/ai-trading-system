export type BotStatus = "running" | "paused" | "stopped";
export type BotMode = "balanced" | "aggressive" | "conservative";
export type LogLevel = "profit" | "loss" | "buy" | "sell" | "position" | "info";
export type TradeDirection = "buy" | "sell";

export interface Account {
  balance: number;
  equity: number;
  currency: string;
}

export interface BotInfo {
  id: string;
  name: string;
  version: string;
  mode: BotMode;
  status: BotStatus;
  description: string;
  symbol: string;
  displaySymbol: string;
  perTrade: number;
}

export interface Stats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profit: number;
}

export interface NextTrade {
  secondsLeft: number;
  intervalSeconds: number;
}

export interface BotState {
  connected: boolean;
  source: "simulator" | "bridge";
  account: Account;
  bot: BotInfo;
  stats: Stats;
  nextTrade: NextTrade;
}

export interface LogLine {
  id: string;
  ts: string;
  level: LogLevel;
  text: string;
}

export interface Trade {
  id: string;
  ts: string;
  symbol: string;
  displaySymbol: string;
  direction: TradeDirection;
  price: number;
  pnl: number;
}

export type CommandAction = "start" | "pause" | "resume" | "stop";
