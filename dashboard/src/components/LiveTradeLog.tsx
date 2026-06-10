"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { CoinIcon, PulseIcon, TrendDownIcon, TrendUpIcon } from "./icons";
import type { Trade } from "@/lib/types";

export function LiveTradeLog({ trades }: { trades: Trade[] }) {
  return (
    <section className="mx-4 mb-6 mt-4">
      <div className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-white">
        <PulseIcon className="h-4 w-4 text-accent" />
        Live Trade Log
      </div>
      <div className="scroll-thin max-h-72 space-y-2 overflow-y-auto">
        <AnimatePresence initial={false}>
          {trades.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-bg-card p-4 text-center text-[13px] text-muted">
              No trades yet — waiting for the next signal…
            </div>
          ) : (
            trades.map((t) => {
              const win = t.pnl >= 0;
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center justify-between rounded-xl border border-white/5 bg-bg-card px-3 py-2.5"
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
                    <span className="text-sm font-semibold text-white">
                      {t.displaySymbol}
                    </span>
                  </div>
                  <span
                    className={clsx(
                      "text-sm font-bold tabular-nums",
                      win ? "text-accent" : "text-loss"
                    )}
                  >
                    {win ? "+" : "-"}${Math.abs(t.pnl).toFixed(2)}
                  </span>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
