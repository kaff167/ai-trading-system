"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";
import { PulseIcon } from "./icons";
import type { LogLevel, LogLine } from "@/lib/types";

const LEVEL_CLASS: Record<LogLevel, string> = {
  profit: "text-accent",
  loss: "text-loss",
  buy: "text-accent",
  sell: "text-orange-400",
  position: "text-info",
  info: "text-muted",
};

export function ConsoleTerminal({ logs }: { logs: LogLine[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  return (
    <section className="mx-4 mt-4 rounded-2xl border border-white/5 bg-bg-soft">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <PulseIcon className="h-4 w-4 text-accent" />
          Bot Console Terminal
        </div>
        <span className="text-[11px] text-muted">{logs.length} entries</span>
      </div>
      <div
        ref={scrollRef}
        className="scroll-thin terminal-grid mx-3 mb-3 h-56 overflow-y-auto rounded-lg border border-white/5 bg-black/40 p-3 font-mono text-[11px] leading-relaxed"
      >
        {logs.length === 0 ? (
          <div className="text-muted">Waiting for bot activity…</div>
        ) : (
          logs.map((line) => (
            <div key={line.id} className="flex gap-2">
              <span className="shrink-0 text-white/30">[{line.ts}]</span>
              <span className={clsx("break-words", LEVEL_CLASS[line.level])}>
                {line.text}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
