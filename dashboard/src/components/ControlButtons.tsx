"use client";

import { PauseIcon, PlayIcon, StopIcon, TrashIcon } from "./icons";
import type { BotStatus, CommandAction } from "@/lib/types";

export function ControlButtons({
  status,
  onCommand,
}: {
  status: BotStatus;
  onCommand: (action: CommandAction) => void;
}) {
  const paused = status === "paused";
  return (
    <section className="mx-4 mt-3">
      <div className="flex gap-2">
        <button
          onClick={() => onCommand(paused ? "resume" : "pause")}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500/15 px-3 py-2.5 text-sm font-semibold text-amber-400 transition hover:bg-amber-500/25"
        >
          {paused ? <PlayIcon className="h-4 w-4" /> : <PauseIcon className="h-4 w-4" />}
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          onClick={() => onCommand("stop")}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-loss/40 px-3 py-2.5 text-sm font-semibold text-loss transition hover:bg-loss/10"
        >
          <StopIcon className="h-4 w-4" />
          Stop
        </button>
      </div>
      <button className="mt-2 flex items-center gap-2 px-1 py-1 text-[13px] font-medium text-muted transition hover:text-loss">
        <TrashIcon className="h-4 w-4" />
        Delete
      </button>
    </section>
  );
}
