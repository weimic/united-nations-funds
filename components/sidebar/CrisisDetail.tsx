"use client";

import { useAppContext } from "@/lib/app-context";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { formatDollars } from "@/lib/utils";
import { CrisisReachChart } from "./charts";
import type { CrisisData } from "@/lib/types";

/** Full-page detail view for a single crisis. */
export function CrisisDetail({
  crisis,
  onBack,
}: {
  crisis: CrisisData;
  onBack: () => void;
}) {
  const { setSelectedCountryIso3, setSidebarTab, setGlobeFocusIso3 } = useAppContext();

  const totalReq = crisis.countries.reduce(
    (s, c) => s + (c.overallFunding?.totalRequirements ?? 0),
    0,
  );
  const totalFund = crisis.countries.reduce(
    (s, c) => s + (c.overallFunding?.totalFunding ?? 0),
    0,
  );
  const totalCBPF = crisis.countries.reduce(
    (s, c) => s + (c.crisisAllocation?.totalAllocations ?? 0),
    0,
  );
  const gap = totalReq - totalFund;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-cyan-500/15 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-400/60 hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <span className="text-cyan-500/30 text-xs">/</span>
        <span className="text-[11px] font-mono text-cyan-300/80 truncate">
          {crisis.crisisName}
        </span>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-foreground">{crisis.crisisName}</h2>
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                {crisis.categories.map((cat) => (
                  <span
                    key={cat}
                    className="text-[9px] font-mono text-red-400/70 border border-red-500/25 rounded-full px-1.5 py-0.5"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-cyan-500/15 bg-black/40 p-2.5">
              <p className="text-[9px] font-mono uppercase tracking-widest text-cyan-400/60 mb-1">
                Requirements
              </p>
              <p className="text-sm font-bold font-mono text-foreground">
                {formatDollars(totalReq)}
              </p>
            </div>
            <div className="rounded border border-cyan-500/15 bg-black/40 p-2.5">
              <p className="text-[9px] font-mono uppercase tracking-widest text-cyan-400/60 mb-1">
                Funded
              </p>
              <p className="text-sm font-bold font-mono text-cyan-400">
                {formatDollars(totalFund)}
              </p>
            </div>
            <div className="rounded border border-cyan-500/15 bg-black/40 p-2.5">
              <p className="text-[9px] font-mono uppercase tracking-widest text-cyan-400/60 mb-1">
                CBPF
              </p>
              <p className="text-sm font-bold font-mono text-cyan-400">
                {formatDollars(totalCBPF)}
              </p>
            </div>
            <div className="rounded border border-red-500/20 bg-red-500/5 p-2.5">
              <p className="text-[9px] font-mono uppercase tracking-widest text-red-400/60 mb-1">
                Gap
              </p>
              <p className="text-sm font-bold font-mono text-red-400">{formatDollars(gap)}</p>
            </div>
          </div>

          <Separator className="opacity-20" />
          <CrisisReachChart crisis={crisis} />

          <Separator className="opacity-20" />
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
              Country
            </p>
            <div className="space-y-1.5">
              {crisis.countries.map((entry) => {
                const gap = entry.overallFunding
                  ? entry.overallFunding.totalRequirements - entry.overallFunding.totalFunding
                  : 0;
                const maxNeglect = Math.max(
                  ...crisis.countries.map((c) => c.neglectIndex),
                  1,
                );
                const barWidth =
                  maxNeglect > 0
                    ? (entry.neglectIndex / maxNeglect) * 100
                    : 0;
                return (
                  <button
                    key={entry.iso3}
                    onClick={() => {
                      setSelectedCountryIso3(entry.iso3);
                      setGlobeFocusIso3(entry.iso3);
                      setSidebarTab("countries");
                    }}
                    className="w-full rounded border border-cyan-500/10 bg-black/30 p-2 text-left hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-medium flex-1 truncate">
                        {entry.countryName}
                      </span>
                      <span className="text-[9px] font-mono text-red-400 font-bold shrink-0">
                        {entry.neglectIndex.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-muted/20 overflow-hidden mb-1">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground flex-wrap">
                      <span>
                        Sev:{" "}
                        <strong className="text-amber-400">
                          {entry.severityIndex.toFixed(1)}
                        </strong>
                      </span>
                      <span>
                        Funded:{" "}
                        <strong
                          className={
                            entry.overallFunding &&
                            entry.overallFunding.percentFunded < 50
                              ? "text-red-400"
                              : "text-cyan-400"
                          }
                        >
                          {entry.overallFunding
                            ? `${entry.overallFunding.percentFunded.toFixed(0)}%`
                            : "N/A"}
                        </strong>
                      </span>
                      <span>
                        Gap:{" "}
                        <strong className="text-red-400">
                          {formatDollars(gap)}
                        </strong>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
