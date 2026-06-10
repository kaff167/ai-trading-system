"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import { CoinIcon, TrendDownIcon, TrendUpIcon } from "@/components/icons";
import { useBridge } from "@/lib/useBridge";
import { useDashboardStore } from "@/lib/store";
import { isAuthed } from "@/lib/auth";

export default function HistoryPage() {
  const router = useRouter();
  useBridge();
  const { trades, state } = useDashboardStore();

  useEffect(() => {
    if (!isAuthed()) router.replace("/login");
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header balance={state?.account.balance} currency={state?.account.currency} />
      <main className="flex-1 px-4 pb-6">
        <h3 className="mb-3 text-base font-bold text-white">Trade History</h3>
        {trades.length === 0 ? (
          <div className="rounded-2xl border border-white/5 bg-bg-card p-6 text-center text-sm text-muted">
            No trades recorded yet in this session.
          </div>
        ) : (
          <div className="space-y-2">
            {trades.map((t) => {
              const win = t.pnl >= 0;
              return (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-bg-card px-3 py-3"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={win ? "text-accent" : "text-loss"}>
                      {win ? (
                        <TrendUpIcon className="h-4 w-4" />
                      ) : (
                        <TrendDownIcon className="h-4 w-4" />
                      )}
                    </span>
                    <CoinIcon className="h-5 w-5" />
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {t.displaySymbol}
                      </div>
                      <div className="text-[11px] uppercase text-muted">
                        {t.direction} · {t.ts}
                      </div>
                    </div>
                  </div>
                  <span
                    className={clsx(
                      "text-sm font-bold tabular-nums",
                      win ? "text-accent" : "text-loss"
                    )}
                  >
                    {win ? "+" : "-"}${Math.abs(t.pnl).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
