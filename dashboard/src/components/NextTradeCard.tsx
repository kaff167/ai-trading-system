"use client";

import { ClockIcon, CoinIcon } from "./icons";
import type { BotInfo, NextTrade } from "@/lib/types";

export function NextTradeCard({
  nextTrade,
  bot,
}: {
  nextTrade: NextTrade;
  bot: BotInfo;
}) {
  const total = Math.max(1, nextTrade.intervalSeconds);
  const left = Math.max(0, nextTrade.secondsLeft);
  const progress = Math.min(100, Math.max(0, ((total - left) / total) * 100));

  return (
    <section className="mx-4 mt-3 rounded-2xl border border-accent/40 bg-accent/5 p-4 shadow-glow">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative grid h-12 w-12 place-items-center rounded-full border-2 border-accent/40 text-accent">
            <ClockIcon className="h-6 w-6" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-accent animate-pulse-dot" />
          </div>
          <div>
            <div className="text-[12px] font-medium text-accent/90">
              Next Trade in
            </div>
            <div className="text-3xl font-extrabold leading-none text-white tabular-nums">
              {left}s
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-muted">Trading</div>
          <div className="flex items-center justify-end gap-1 text-sm font-bold text-white">
            <CoinIcon className="h-4 w-4" />
            {bot.displaySymbol}
          </div>
          <div className="text-[11px] text-muted">
            @ ${bot.perTrade.toLocaleString("en-US")}/trade
          </div>
        </div>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </section>
  );
}
