"use client";

import { useAppContext } from "@/lib/app-context";

/** Spike mode toggle — shown above tabs, always visible. */
export function SpikeSelector() {
  const { spikeMode, setSpikeMode } = useAppContext();

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-cyan-500/10 shrink-0 mt-2">
      <span className="text-[10px] font-mono text-cyan-400/60 uppercase tracking-widest">
        Spikes
      </span>
      <div className="flex rounded-md border border-cyan-500/20 overflow-hidden ml-auto">
        <button
          onClick={() => setSpikeMode("fundingGap")}
          className={`cursor-pointer px-2.5 py-1 text-[10px] font-mono transition-colors ${
            spikeMode === "fundingGap"
              ? "bg-cyan-500/20 text-cyan-300"
              : "text-cyan-400/50 hover:bg-cyan-500/10"
          }`}
        >
          Funding Gap
        </button>
        <button
          onClick={() => setSpikeMode("severity")}
          className={`cursor-pointer px-2.5 py-1 text-[10px] font-mono transition-colors ${
            spikeMode === "severity"
              ? "bg-red-500/20 text-red-300"
              : "text-cyan-400/50 hover:bg-cyan-500/10"
          }`}
        >
          Severity
        </button>
      </div>
    </div>
  );
}
