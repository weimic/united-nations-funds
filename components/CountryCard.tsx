"use client";

import { useMemo } from "react";
import { useAppContext } from "@/lib/app-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { X, MapPin, AlertTriangle, DollarSign, BarChart3 } from "lucide-react";

function formatDollars(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function getSeverityColorClass(cat: string): string {
  switch (cat) {
    case "Very High":
      return "text-red-400 border-red-500/30 bg-red-500/10";
    case "High":
      return "text-orange-400 border-orange-500/30 bg-orange-500/10";
    case "Medium":
      return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    case "Low":
      return "text-blue-400 border-blue-500/30 bg-blue-500/10";
    default:
      return "text-slate-400 border-slate-500/30 bg-slate-500/10";
  }
}

export default function CountryCard() {
  const {
    selectedCountryIso3,
    setSelectedCountryIso3,
    getCountry,
    activeCrisis,
    getCrisisEntry,
  } = useAppContext();

  const country = useMemo(() => {
    if (!selectedCountryIso3) return null;
    return getCountry(selectedCountryIso3);
  }, [selectedCountryIso3, getCountry]);

  const crisisEntry = useMemo(() => {
    if (!selectedCountryIso3) return null;
    return getCrisisEntry(selectedCountryIso3);
  }, [selectedCountryIso3, getCrisisEntry]);

  if (!country || !selectedCountryIso3) return null;

  const sev = country.severity;
  const overall = country.overallFunding;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <Card className="w-[380px] bg-background/95 backdrop-blur-xl border-border/40 shadow-2xl shadow-black/30">
        <CardHeader className="px-5 pt-5 pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <MapPin className="h-5 w-5 text-primary shrink-0" />
              <div>
                <CardTitle className="text-base">{country.name}</CardTitle>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                  {country.iso3}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedCountryIso3(null)}
              className="rounded-md p-1 hover:bg-muted/50 transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </CardHeader>

        <CardContent className="px-5 pb-5 space-y-4">
          {/* INFORM Severity */}
          {sev && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  INFORM Severity
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={`text-sm px-2.5 py-0.5 font-bold ${getSeverityColorClass(
                    sev.severityCategory
                  )}`}
                >
                  {sev.severityIndex.toFixed(1)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {sev.severityCategory}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all bg-gradient-to-r from-blue-500 via-amber-500 to-red-500"
                  style={{ width: `${(sev.severityIndex / 5) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Active crisis CBPF data */}
          {crisisEntry?.crisisAllocation && crisisEntry.crisisAllocation.clusters.length > 0 && (
            <>
              <Separator className="opacity-30" />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    CBPF Allocations
                  </span>
                  {activeCrisis && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 text-cyan-400 border-cyan-500/30 bg-cyan-500/5"
                    >
                      {activeCrisis.crisisName}
                    </Badge>
                  )}
                </div>
                <div className="space-y-1.5">
                  {crisisEntry.crisisAllocation.clusters
                    .sort((a, b) => b.totalAllocations - a.totalAllocations)
                    .slice(0, 6)
                    .map((alloc, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {alloc.cluster}
                        </span>
                        <span className="text-xs font-medium text-cyan-400">
                          {formatDollars(alloc.totalAllocations)}
                        </span>
                      </div>
                    ))}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/20">
                  <span className="text-xs font-medium text-muted-foreground">
                    Total CBPF
                  </span>
                  <span className="text-sm font-bold text-cyan-400">
                    {formatDollars(
                      crisisEntry.crisisAllocation.totalAllocations
                    )}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Overall FTS Funding */}
          {overall && (
            <>
              <Separator className="opacity-30" />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Overall Funding (FTS)
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-xs text-muted-foreground">
                      Requirements
                    </span>
                    <span className="text-sm font-medium">
                      {formatDollars(overall.totalRequirements)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-xs text-muted-foreground">
                      Funded
                    </span>
                    <span className="text-sm font-medium text-green-400">
                      {formatDollars(overall.totalFunding)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Progress
                      value={Math.min(overall.percentFunded, 100)}
                      className="h-2 flex-1"
                    />
                    <span
                      className={`text-xs font-bold ${
                        overall.percentFunded < 50
                          ? "text-red-400"
                          : "text-green-400"
                      }`}
                    >
                      {overall.percentFunded.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* No data state */}
          {!sev && !overall && !crisisEntry && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No crisis or funding data available for this country.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
