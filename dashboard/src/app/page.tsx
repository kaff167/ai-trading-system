"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { ConnectionBadge } from "@/components/ConnectionBadge";
import { BotCard } from "@/components/BotCard";
import { NextTradeCard } from "@/components/NextTradeCard";
import { StatsGrid } from "@/components/StatsGrid";
import { ControlButtons } from "@/components/ControlButtons";
import { ConsoleTerminal } from "@/components/ConsoleTerminal";
import { LiveTradeLog } from "@/components/LiveTradeLog";
import { BottomNav } from "@/components/BottomNav";
import { useBridge } from "@/lib/useBridge";
import { useDashboardStore } from "@/lib/store";
import { isAuthed } from "@/lib/auth";
import { sendCommand } from "@/lib/socket";
import type { CommandAction } from "@/lib/types";

export default function DashboardPage() {
  const router = useRouter();
  useBridge();
  const { state, logs, trades, bridgeOnline, simulated } = useDashboardStore();

  useEffect(() => {
    if (!isAuthed()) router.replace("/login");
  }, [router]);

  const handleCommand = (action: CommandAction) => sendCommand(action);

  return (
    <div className="flex min-h-screen flex-col">
      <Header balance={state?.account.balance} currency={state?.account.currency} />
      <ConnectionBadge online={bridgeOnline} simulated={simulated} />

      <main className="flex-1 pb-4">
        <div className="px-4 pb-1">
          <h3 className="text-base font-bold text-white">
            My Bots <span className="text-muted">(1)</span>
          </h3>
        </div>

        {state ? (
          <>
            <BotCard bot={state.bot} />
            <NextTradeCard nextTrade={state.nextTrade} bot={state.bot} />
            <StatsGrid stats={state.stats} />
            <ControlButtons status={state.bot.status} onCommand={handleCommand} />
          </>
        ) : (
          <div className="mx-4 mt-4 rounded-2xl border border-white/5 bg-bg-card p-6 text-center text-sm text-muted">
            Connecting to bridge…
          </div>
        )}

        <ConsoleTerminal logs={logs} />
        <LiveTradeLog trades={trades} />
      </main>

      <BottomNav />
    </div>
  );
}
