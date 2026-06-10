"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { BottomNav } from "@/components/BottomNav";
import {
  clearSession,
  getBridgeToken,
  isAuthed,
  saveBridgeToken,
} from "@/lib/auth";
import { useDashboardStore } from "@/lib/store";

export default function SettingsPage() {
  const router = useRouter();
  const { state } = useDashboardStore();
  const [token, setToken] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isAuthed()) router.replace("/login");
    setToken(getBridgeToken());
  }, [router]);

  function save() {
    saveBridgeToken(token.trim());
    setSaved(true);
    setTimeout(() => window.location.assign("/"), 600);
  }

  function logout() {
    clearSession();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header balance={state?.account.balance} currency={state?.account.currency} />
      <main className="flex-1 px-4 pb-6">
        <h3 className="mb-3 text-base font-bold text-white">Settings</h3>

        <Card title="Bridge Connection">
          <label className="block">
            <span className="mb-1.5 block text-[13px] text-muted">
              Connection Token
            </span>
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full rounded-xl border border-white/8 bg-bg-card px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-accent/50"
            />
            <span className="mt-1 block text-[11px] text-muted/70">
              Paste the token printed by your local bridge. Use DEMO-1234 for the
              simulated demo.
            </span>
          </label>
          <button
            onClick={save}
            className="mt-3 w-full rounded-xl bg-accent py-2.5 text-sm font-bold text-black transition hover:bg-accent-soft"
          >
            {saved ? "Saved — reconnecting…" : "Save & Reconnect"}
          </button>
        </Card>

        {state && (
          <Card title="Active Bot">
            <Row label="Name" value={`${state.bot.name} ${state.bot.version}`} />
            <Row label="Mode" value={state.bot.mode} />
            <Row label="Symbol" value={state.bot.displaySymbol} />
            <Row
              label="Per Trade"
              value={`$${state.bot.perTrade.toLocaleString("en-US")}`}
            />
            <Row label="Status" value={state.bot.status} />
            <Row label="Source" value={state.source} />
          </Card>
        )}

        <button
          onClick={logout}
          className="mt-2 w-full rounded-xl border border-loss/40 py-2.5 text-sm font-semibold text-loss transition hover:bg-loss/10"
        >
          Log Out
        </button>
      </main>
      <BottomNav />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-3 rounded-2xl border border-white/5 bg-bg-card p-4">
      <h4 className="mb-3 text-sm font-semibold text-white">{title}</h4>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted">{label}</span>
      <span className="font-medium capitalize text-white">{value}</span>
    </div>
  );
}
