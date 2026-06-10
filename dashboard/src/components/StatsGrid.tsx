"use client";

import clsx from "clsx";
import type { Stats } from "@/lib/types";

function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="text-center">
      <div className="text-[11px] uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className={clsx("text-xl font-bold tabular-nums", className)}>
        {value}
      </div>
    </div>
  );
}

export function StatsGrid({ stats }: { stats: Stats }) {
  const profitPositive = stats.profit >= 0;
  return (
    <section className="mx-4 mt-3 rounded-2xl border border-white/5 bg-bg-card p-4">
      <div className="grid grid-cols-2 gap-y-4">
        <Stat label="Total Trades" value={String(stats.totalTrades)} className="text-white" />
        <Stat label="Wins" value={String(stats.wins)} className="text-accent" />
        <Stat label="Losses" value={String(stats.losses)} className="text-loss" />
        <Stat
          label="Win Rate"
          value={`${stats.winRate.toFixed(1)}%`}
          className="text-accent"
        />
      </div>
      <div className="mt-4 border-t border-white/5 pt-3 text-center">
        <div className="text-[11px] uppercase tracking-wide text-muted">Profit</div>
        <div
          className={clsx(
            "text-2xl font-extrabold tabular-nums",
            profitPositive ? "text-accent" : "text-loss"
          )}
        >
          {profitPositive ? "+" : "-"}$
          {Math.abs(stats.profit).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
      </div>
    </section>
  );
}
