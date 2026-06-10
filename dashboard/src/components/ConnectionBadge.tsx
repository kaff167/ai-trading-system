"use client";

import clsx from "clsx";

export function ConnectionBadge({
  online,
  simulated,
}: {
  online: boolean;
  simulated: boolean;
}) {
  const label = simulated
    ? "Simulated"
    : online
      ? "Bridge online"
      : "Bridge offline";
  return (
    <div className="flex items-center gap-2 px-4 pb-2">
      <span
        className={clsx(
          "h-2 w-2 rounded-full",
          online || simulated ? "bg-accent animate-pulse-dot" : "bg-loss"
        )}
      />
      <span
        className={clsx(
          "text-[11px] font-medium",
          simulated ? "text-amber-400" : online ? "text-accent" : "text-loss"
        )}
      >
        {label}
      </span>
    </div>
  );
}
