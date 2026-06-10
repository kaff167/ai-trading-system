"use client";

import { ChartIcon } from "./icons";

function fmtMoney(n: number, currency = "USD") {
  const sym = currency === "USD" ? "$" : "";
  return `${sym}${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function Header({
  balance,
  currency,
}: {
  balance: number | undefined;
  currency: string | undefined;
}) {
  return (
    <header className="flex items-center justify-between px-4 pt-4 pb-3">
      <div className="flex items-center gap-2">
        <ChartIcon className="h-6 w-6 text-accent" />
        <h1 className="text-xl font-bold tracking-tight text-accent">
          Trading Bots
        </h1>
      </div>
      <div className="text-right">
        <div className="text-[11px] uppercase tracking-wider text-muted">
          Balance
        </div>
        <div className="text-xl font-bold text-accent tabular-nums">
          {balance != null ? fmtMoney(balance, currency) : "—"}
        </div>
      </div>
    </header>
  );
}
