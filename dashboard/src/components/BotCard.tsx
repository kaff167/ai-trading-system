"use client";

import clsx from "clsx";
import { RobotIcon } from "./icons";
import type { BotInfo } from "@/lib/types";

function StatusPill({ status }: { status: BotInfo["status"] }) {
  const map: Record<BotInfo["status"], string> = {
    running: "bg-accent/15 text-accent border-accent/30",
    paused: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    stopped: "bg-loss/15 text-loss border-loss/30",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize",
        map[status]
      )}
    >
      {status === "running" && (
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-dot" />
      )}
      {status}
    </span>
  );
}

export function BotCard({ bot }: { bot: BotInfo }) {
  return (
    <section className="mx-4 rounded-2xl border border-white/5 bg-bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
          <RobotIcon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold leading-tight text-white">
              {bot.name}
            </h2>
            <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-muted">
              {bot.version}
            </span>
            <span className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] font-medium capitalize text-muted">
              {bot.mode}
            </span>
            <StatusPill status={bot.status} />
          </div>
          <p className="mt-1.5 text-[13px] leading-snug text-muted">
            {bot.description}
          </p>
        </div>
      </div>
    </section>
  );
}
