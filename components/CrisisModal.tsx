"use client";

import { useMemo } from "react";
import { useAppContext } from "@/lib/app-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, TrendingDown, TrendingUp, DollarSign } from "lucide-react";
import { formatDollars } from "@/lib/utils";

function getSeverityColorClass(index: number): string {
  if (index >= 4) return "text-red-400";
  if (index >= 3) return "text-orange-400";
  if (index >= 2) return "text-amber-400";
  if (index >= 1) return "text-blue-400";
  return "text-slate-400";
}

function getNeglectColor(score: number): string {
  if (score >= 5) return "bg-red-500";
  if (score >= 3) return "bg-orange-500";
  if (score >= 1.5) return "bg-amber-500";
  return "bg-blue-500";
}

export default function CrisisModal() {
  const {
    activeCrisis,
    crisisModalOpen,
    setCrisisModalOpen,
    setSelectedCountryIso3,
  } = useAppContext();

  // Sort countries: most neglected first
  const sortedCountries = useMemo(() => {
    if (!activeCrisis) return [];
    return [...activeCrisis.countries].sort(
      (a, b) => b.neglectIndex - a.neglectIndex
    );
  }, [activeCrisis]);


  // Aggregate stats
  const stats = useMemo(() => {
    if (!activeCrisis || sortedCountries.length === 0) return null;
    const totalRequirements = sortedCountries.reduce(
      (s, c) => s + (c.overallFunding?.totalRequirements || 0),
      0
    );
    const totalFunding = sortedCountries.reduce(
      (s, c) => s + (c.overallFunding?.totalFunding || 0),
      0
    );
    const totalCBPF = sortedCountries.reduce(
      (s, c) => s + (c.crisisAllocation?.totalAllocations || 0),
      0
    );
    const avgSeverity =
      sortedCountries.reduce((s, c) => s + c.severityIndex, 0) /
      sortedCountries.length;
    const maxNeglect = sortedCountries[0]?.neglectIndex || 0;
    const percentFunded =
      totalRequirements > 0 ? (totalFunding / totalRequirements) * 100 : 0;

    return {
      totalRequirements,
      totalFunding,
      totalCBPF,
      avgSeverity,
      maxNeglect,
      percentFunded,
      gap: totalRequirements - totalFunding,
    };
  }, [activeCrisis, sortedCountries]);

  if (!activeCrisis) return null;

  return (
    <Dialog open={crisisModalOpen} onOpenChange={setCrisisModalOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 bg-background/95 backdrop-blur-xl border-border/40 shadow-2xl">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-red-400" />
            {activeCrisis.crisisName}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {sortedCountries.length} affected countr
            {sortedCountries.length === 1 ? "y" : "ies"} — ranked by
            Neglect Index
          </DialogDescription>
        </DialogHeader>

        {/* Aggregate stats row */}
        {stats && (
          <div className="grid grid-cols-4 gap-3 px-6 pb-4">
            <div className="rounded-lg border border-border/30 bg-muted/30 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Required
              </p>
              <p className="text-sm font-bold text-foreground">
                {formatDollars(stats.totalRequirements)}
              </p>
            </div>
            <div className="rounded-lg border border-border/30 bg-muted/30 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Funded
              </p>
              <p className="text-sm font-bold text-green-400">
                {formatDollars(stats.totalFunding)}
              </p>
            </div>
            <div className="rounded-lg border border-border/30 bg-muted/30 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                CBPF
              </p>
              <p className="text-sm font-bold text-cyan-400">
                {formatDollars(stats.totalCBPF)}
              </p>
            </div>
            <div className="rounded-lg border border-border/30 bg-muted/30 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Gap
              </p>
              <p className="text-sm font-bold text-red-400">
                {formatDollars(stats.gap)}
              </p>
            </div>
          </div>
        )}

        <Separator className="opacity-30" />

        {/* Country ranking list */}
        <ScrollArea className="max-h-[50vh] px-6 py-4">
          <div className="flex flex-col gap-2">
            {sortedCountries.map((country, idx) => {
              const percentFunded =
                country.overallFunding?.percentFunded ?? null;
              // Neglect index scale roughly 0-8, so divide by 8 for bar width
              const neglectPct = Math.min(
                (country.neglectIndex / 8) * 100,
                100
              );

              return (
                <button
                  key={country.iso3}
                  onClick={() => {
                    setSelectedCountryIso3(country.iso3);
                    setCrisisModalOpen(false);
                  }}
                  className="group flex items-start gap-3 rounded-lg p-3 text-left transition-all hover:bg-accent/50 border border-transparent hover:border-border/30"
                >
                  {/* Rank */}
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/50 text-xs font-bold text-muted-foreground">
                    {idx + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-sm font-medium truncate">
                        {country.countryName}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {country.neglectIndex >= 4.0 ? (
                          <TrendingDown className="h-3.5 w-3.5 text-red-400" />
                        ) : (
                          <TrendingUp className="h-3.5 w-3.5 text-green-400" />
                        )}
                        <span
                          className={`text-xs font-bold`}
                        >
                          Index: {country.neglectIndex.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Neglect bar */}
                    <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden mb-1.5">
                      <div
                        className={`h-full rounded-full transition-all ${getNeglectColor(
                          country.neglectIndex
                        )}`}
                        style={{ width: `${neglectPct}%` }}
                      />
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>
                        Gap/Capita:{" "}
                        <strong className="text-foreground">
                           ${country.fundingGapPerCapita.toFixed(1)}
                        </strong>
                      </span>
                      {percentFunded !== null && (
                        <span>
                          Funded:{" "}
                          <strong
                            className={
                              percentFunded < 50
                                ? "text-red-400"
                                : "text-green-400"
                            }
                          >
                            {percentFunded.toFixed(0)}%
                          </strong>
                        </span>
                      )}
                      {country.reachRatio > 0 && (
                        <span className="flex items-center gap-0.5">
                          Reach:{" "}
                          <strong className={country.reachRatio < 50 ? "text-orange-400" : "text-cyan-400"}>
                            {country.reachRatio.toFixed(0)}%
                          </strong>
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
