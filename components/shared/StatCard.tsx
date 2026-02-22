"use client";

import { HoverTip } from "./HoverTip";

/** Small stat card used across overview and detail views. */
export function StatCard({
  label,
  value,
  className,
  tip,
}: {
  label: string;
  value: string;
  className?: string;
  tip?: string;
}) {
  return (
    <div className="rounded border border-cyan-500/15 bg-black/40 p-3">
      <p className="text-[9px] font-mono uppercase tracking-widest text-cyan-400/60 mb-1.5">
        {tip ? <HoverTip tip={tip}>{label}</HoverTip> : label}
      </p>
      <p className={`text-sm font-bold font-mono ${className}`}>{value}</p>
    </div>
  );
}
