"use client";

import { useMemo } from "react";
import { useAppContext } from "@/lib/app-context";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { formatDollars } from "@/lib/utils";
import { getSeverityBadgeColor } from "@/components/shared/severity-colors";

/** Full-page detail view for a crisis category. */
export function CategoryDetail({
  category,
  onBack,
}: {
  category: string;
  onBack: () => void;
}) {
  const { data, setActiveCrisis } = useAppContext();

  const crises = useMemo(
    () => data.crises.filter((c) => c.categories.includes(category)),
    [data.crises, category],
  );

  const stats = useMemo(() => {
    const uniqueCountries = new Set<string>();
    let totalReq = 0,
      totalFund = 0,
      totalCBPF = 0;
    let totalSeverity = 0,
      severityCount = 0;

    for (const crisis of crises) {
      for (const c of crisis.countries) {
        uniqueCountries.add(c.iso3);
        totalReq += c.overallFunding?.totalRequirements ?? 0;
        totalFund += c.overallFunding?.totalFunding ?? 0;
        totalCBPF += c.crisisAllocation?.totalAllocations ?? 0;
        totalSeverity += c.severityIndex;
        severityCount++;
      }
    }

    const pct = totalReq > 0 ? (totalFund / totalReq) * 100 : 0;

    return {
      crisisCount: crises.length,
      countryCount: uniqueCountries.size,
      totalReq,
      totalFund,
      totalCBPF,
      gap: totalReq - totalFund,
      pct,
      avgSeverity: severityCount > 0 ? totalSeverity / severityCount : 0,
    };
  }, [crises]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-cyan-500/15 shrink-0">
        <button
          onClick={onBack}
          className="cursor-pointer flex items-center gap-1.5 text-[11px] font-mono text-cyan-400/60 hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Categories
        </button>
        <span className="text-cyan-500/30 text-xs">/</span>
        <span className="text-[11px] font-mono text-red-300/80 truncate">{category}</span>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">{category}</h2>
            <p className="text-[11px] font-mono text-cyan-400/50">
              {stats.crisisCount} Cris{stats.crisisCount !== 1 ? "es" : "is"} ·{" "}
              {stats.countryCount} countr{stats.countryCount !== 1 ? "ies" : "y"} affected
            </p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-cyan-500/15 bg-black/40 p-2.5">
              <p className="text-[9px] font-mono uppercase tracking-widest text-cyan-400/60 mb-1">
                Requirements
              </p>
              <p className="text-sm font-bold font-mono text-foreground">
                {formatDollars(stats.totalReq)}
              </p>
            </div>
            <div className="rounded border border-cyan-500/15 bg-black/40 p-2.5">
              <p className="text-[9px] font-mono uppercase tracking-widest text-cyan-400/60 mb-1">
                Funded
              </p>
              <p className="text-sm font-bold font-mono text-cyan-400">
                {formatDollars(stats.totalFund)}
              </p>
            </div>
            <div className="rounded border border-cyan-500/15 bg-black/40 p-2.5">
              <p className="text-[9px] font-mono uppercase tracking-widest text-cyan-400/60 mb-1">
                CBPF
              </p>
              <p className="text-sm font-bold font-mono text-cyan-400">
                {formatDollars(stats.totalCBPF)}
              </p>
            </div>
            <div className="rounded border border-red-500/20 bg-red-500/5 p-2.5">
              <p className="text-[9px] font-mono uppercase tracking-widest text-red-400/60 mb-1">
                Gap
              </p>
              <p className="text-sm font-bold font-mono text-red-400">
                {formatDollars(stats.gap)}
              </p>
            </div>
          </div>

          {/* Avg severity + funding progress */}
          <div className="space-y-2 rounded border border-cyan-500/10 bg-black/30 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground">Avg. severity</span>
              <span className="text-[10px] font-bold font-mono text-amber-400">
                {stats.avgSeverity.toFixed(2)}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-muted-foreground">Overall funded</span>
                <span
                  className={`text-[10px] font-bold font-mono ${stats.pct < 50 ? "text-red-400" : "text-cyan-400"}`}
                >
                  {stats.pct.toFixed(1)}%
                </span>
              </div>
              <Progress value={Math.min(stats.pct, 100)} className="h-1.5" />
            </div>
          </div>

          {/* Crisis list */}
          <Separator className="opacity-20" />
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
              Crises in this Category
            </p>
            <div className="space-y-1.5">
              {crises.map((crisis) => {
                const maxSev = Math.max(...crisis.countries.map((c) => c.severityIndex));
                const topCat =
                  crisis.countries.find((c) => c.severityIndex === maxSev)?.severityCategory ?? "";
                return (
                  <button
                    key={crisis.crisisId}
                    onClick={() => setActiveCrisis(crisis)}
                    className="cursor-pointer group w-full flex items-start justify-between gap-2 rounded-lg p-3 text-left transition-all border border-red-500/10 hover:border-red-500/30 hover:bg-red-500/5"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-[12px] font-medium leading-tight text-foreground block truncate">
                        {crisis.crisisName}
                      </span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge
                          variant="outline"
                          className={`text-[9px] px-1.5 py-0 font-mono ${getSeverityBadgeColor(topCat)}`}
                        >
                          {maxSev.toFixed(1)}
                        </Badge>
                        <span className="text-[10px] font-mono text-cyan-400/50">
                          {crisis.countries.length} countr
                          {crisis.countries.length === 1 ? "y" : "ies"}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-cyan-400/30 group-hover:text-cyan-400/60 mt-0.5 transition-colors" />
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
