"use client";

import { useMemo } from "react";
import { useAppContext } from "@/lib/app-context";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  MapPin,
  ArrowLeft,
  DollarSign,
  BarChart3,
} from "lucide-react";
import { formatDollars } from "@/lib/utils";
import { HoverTip } from "@/components/shared/HoverTip";
import { getSeverityBadgeColor, getSeverityColorClass } from "@/components/shared/severity-colors";
import { CBPFClusterChart } from "./charts";

/** Full-page detail view for a single country. */
export function CountryDetail({
  iso3,
  onBack,
}: {
  iso3: string;
  onBack: () => void;
}) {
  const { data, getCountry, getAllCrisesForCountry, setActiveCrisis, setSidebarTab } = useAppContext();
  const country = getCountry(iso3);
  if (!country) return null;

  const sev = country.severity;
  const overall = country.overallFunding;
  const allCrises = getAllCrisesForCountry(country.iso3);

  return (
    <CountryDetailInner
      country={country}
      sev={sev}
      overall={overall}
      allCrises={allCrises}
      data={data}
      onBack={onBack}
      setActiveCrisis={setActiveCrisis}
      setSidebarTab={setSidebarTab}
    />
  );
}

/** Inner rendering — separated to keep hook rules satisfied. */
function CountryDetailInner({
  country,
  sev,
  overall,
  allCrises,
  data,
  onBack,
  setActiveCrisis,
  setSidebarTab,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  country: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sev: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  overall: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allCrises: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  onBack: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setActiveCrisis: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setSidebarTab: any;
}) {
  const rankings = useMemo(() => {
    if (!overall) return null;
    const allC = Object.values(data.countries).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any) => c.overallFunding && c.overallFunding.totalRequirements > 0,
    );
    const gapSorted = [...allC].sort(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a: any, b: any) =>
        (b.overallFunding!.totalRequirements - b.overallFunding!.totalFunding) -
        (a.overallFunding!.totalRequirements - a.overallFunding!.totalFunding),
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gapRank = gapSorted.findIndex((c: any) => c.iso3 === country.iso3) + 1;
    const absGap = Math.max(0, overall.totalRequirements - overall.totalFunding);
    const withNI = allC
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((c: any) => c.severity)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c: any) => ({
        iso3: c.iso3,
        ni:
          (c.severity!.severityIndex / 5) *
          (1 - c.overallFunding!.percentFunded / 100) *
          Math.log10(1 + c.overallFunding!.totalRequirements / 1_000_000),
      }))
      .sort((a, b) => b.ni - a.ni);
    const niSelf = sev
      ? (sev.severityIndex / 5) *
        (1 - overall.percentFunded / 100) *
        Math.log10(1 + overall.totalRequirements / 1_000_000)
      : 0;
    const niRank = withNI.findIndex((c) => c.iso3 === country.iso3) + 1;
    const niMax = withNI[0]?.ni ?? 1;
    return {
      absGap,
      gapRank: gapRank > 0 ? gapRank : null,
      gapTotal: gapSorted.length,
      neglectIndex: niSelf,
      niRank: niRank > 0 ? niRank : null,
      niTotal: withNI.length,
      niMax,
    };
  }, [country, data, overall, sev]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-cyan-500/15 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-400/60 hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Countries
        </button>
        <span className="text-cyan-500/30 text-xs">/</span>
        <span className="text-[11px] font-mono text-cyan-300/80 truncate">{country.name}</span>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-2.5">
            <MapPin className="h-5 w-5 text-cyan-400 shrink-0" />
            <div>
              <h2 className="text-base font-semibold text-foreground">{country.name}</h2>
              <p className="text-xs text-cyan-400/60 font-mono">{country.iso3}</p>
            </div>
          </div>

          {/* Severity */}
          {sev && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400/70" />
                <HoverTip tip="Severity score from 0 to 5. Higher means people face more intense, complex humanitarian conditions.">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
                    INFORM Severity
                  </span>
                </HoverTip>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={`text-sm px-2.5 py-0.5 font-bold font-mono ${getSeverityColorClass(sev.severityCategory)}`}
                >
                  {sev.severityIndex.toFixed(1)}
                  <span className="text-[10px] opacity-50 font-normal">/5</span>
                </Badge>
                <span className="text-sm text-muted-foreground">{sev.severityCategory}</span>
              </div>
            </div>
          )}

          {/* Funding Gap & Neglect */}
          {rankings && (
            <>
              <Separator className="opacity-20" />
              <div className="space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
                  Funding Gap &amp; Neglect
                </p>
                {overall &&
                  (() => {
                    const onAppealM = Math.round(overall.totalFunding / 1_000_000);
                    const offAppealM = Math.round(overall.offAppealFunding / 1_000_000);
                    const gapM = Math.round(
                      Math.max(0, overall.totalRequirements - overall.totalFundingAll) / 1_000_000,
                    );
                    const total = onAppealM + offAppealM + gapM;
                    if (total === 0) return null;
                    const onPct = (onAppealM / total) * 100;
                    const offPct = (offAppealM / total) * 100;
                    return (
                      <div className="rounded border border-red-500/15 bg-black/30 p-2.5 space-y-1.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono text-muted-foreground">
                            Req: {formatDollars(overall.totalRequirements)}
                          </span>
                          {rankings.gapRank && (
                            <span className="text-[9px] font-mono text-red-400/60">
                              Gap #{rankings.gapRank} / {rankings.gapTotal}
                            </span>
                          )}
                        </div>
                        <div className="h-3 rounded-full bg-muted/20 overflow-hidden flex">
                          {onPct > 0 && (
                            <div
                              className="h-full bg-cyan-500"
                              style={{ width: `${onPct}%` }}
                              title={`On-appeal: $${onAppealM}M`}
                            />
                          )}
                          {offPct > 0 && (
                            <div
                              className="h-full bg-cyan-800"
                              style={{ width: `${offPct}%` }}
                              title={`Off-appeal: $${offAppealM}M`}
                            />
                          )}
                          <div className="h-full bg-red-500 flex-1" title={`Gap: $${gapM}M`} />
                        </div>
                        <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-sm bg-cyan-500 inline-block" />
                            On-appeal: {formatDollars(overall.totalFunding)}
                          </span>
                          {overall.offAppealFunding > 0 && (
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-sm bg-cyan-800 inline-block" />
                              Off-appeal: {formatDollars(overall.offAppealFunding)}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-sm bg-red-500/75 inline-block" />
                            Gap: <strong className="text-red-400">{formatDollars(rankings.absGap)}</strong>
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                {rankings.neglectIndex > 0 && (
                  <div className="rounded border border-amber-500/15 bg-amber-500/5 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <HoverTip tip="Measures how overlooked this country's crisis is. Combines severity, % of funding still needed, and scale of the emergency. Higher = bigger gap between need and response.">
                        <span className="text-[10px] font-mono text-muted-foreground">Neglect Index</span>
                      </HoverTip>
                      {rankings.niRank && (
                        <span className="text-[9px] font-mono text-amber-400/60">
                          #{rankings.niRank} / {rankings.niTotal}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-muted/20 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500"
                          style={{
                            width: `${Math.min((rankings.neglectIndex / (rankings.niMax || 1)) * 100, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-amber-400">
                        {rankings.neglectIndex.toFixed(3)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Active Crises */}
          {allCrises.length > 0 && (
            <>
              <Separator className="opacity-20" />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-red-400/70">
                    Active Crises ({allCrises.length})
                  </span>
                </div>
                <div className="space-y-2">
                  {allCrises.map(({ crisis, entry }) => (
                    <button
                      key={crisis.crisisId}
                      onClick={() => {
                        setActiveCrisis(crisis);
                        setSidebarTab("crises");
                      }}
                      className="w-full rounded border border-red-500/15 bg-red-500/5 p-2.5 text-left hover:border-red-500/35 hover:bg-red-500/10 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="text-[11px] font-medium text-foreground leading-tight">
                          {crisis.crisisName}
                        </span>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-[9px] px-1.5 py-0 font-mono ${getSeverityBadgeColor(entry.severityCategory)}`}
                        >
                          {entry.severityIndex.toFixed(1)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {entry.severityCategory}
                        </span>
                        {crisis.categories.slice(0, 2).map((cat: string) => (
                          <span
                            key={cat}
                            className="text-[9px] font-mono text-red-400/60 border border-red-500/20 rounded-full px-1.5 py-0"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                      <div className="mt-1.5 h-1 rounded-full bg-muted/20 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-600"
                          style={{ width: `${(entry.severityIndex / 5) * 100}%` }}
                        />
                      </div>
                      {entry.crisisAllocation && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <DollarSign className="h-3 w-3 text-cyan-400/60" />
                          <span className="text-[10px] font-mono text-cyan-400">
                            CBPF: {formatDollars(entry.crisisAllocation.totalAllocations)}
                          </span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Appeal / Plan Line Breakdown */}
          {overall && overall.planLines && overall.planLines.length > 0 && (
            <>
              <Separator className="opacity-20" />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5 text-cyan-400/60" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
                    Appeal Breakdown ({overall.planLines.length} plan line
                    {overall.planLines.length !== 1 ? "s" : ""})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {[...overall.planLines]
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .sort((a: any, b: any) => b.requirements - a.requirements)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map((pl: any, idx: number) => {
                      const pct = pl.percentFunded;
                      const typeBadge = pl.typeName.toLowerCase().includes("flash")
                        ? "Flash"
                        : pl.typeName.toLowerCase().includes("refugee") ||
                            pl.typeName.toLowerCase().includes("regional")
                          ? "Regional"
                          : "HRP";
                      return (
                        <div key={idx} className="rounded border border-cyan-500/10 bg-black/30 p-2">
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <span className="text-[10px] font-medium leading-tight flex-1">
                              {pl.name}
                            </span>
                            <span className="text-[8px] font-mono px-1.5 py-0 rounded border border-cyan-500/20 text-cyan-400/60 shrink-0">
                              {typeBadge}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[9px] font-mono text-muted-foreground mb-1">
                            <span>Req: {formatDollars(pl.requirements)}</span>
                            <span>Funded: {formatDollars(pl.funding)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 rounded-full bg-muted/20 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct < 30 ? "bg-red-500" : pct < 50 ? "bg-amber-500" : "bg-cyan-500"}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span
                              className={`text-[9px] font-mono font-bold ${pct < 50 ? "text-red-400" : "text-cyan-400"}`}
                            >
                              {pct}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  {overall.offAppealFunding > 0 && (
                    <div className="rounded border border-cyan-500/10 bg-cyan-500/5 p-2">
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="text-[10px] font-medium leading-tight text-cyan-400/70">
                          Outside plan lines (off-appeal)
                        </span>
                      </div>
                      <span className="text-[9px] font-mono text-cyan-400">
                        {formatDollars(overall.offAppealFunding)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* CBPF by Cluster */}
          {allCrises[0]?.entry.crisisAllocation?.clusters &&
            allCrises[0].entry.crisisAllocation.clusters.length > 0 && (
              <>
                <Separator className="opacity-20" />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-3.5 w-3.5 text-cyan-400" />
                    <HoverTip tip="UN-managed pooled funds that provide fast, flexible humanitarian aid directly to local responders in-country.">
                      <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
                        CBPF by Cluster
                      </span>
                    </HoverTip>
                  </div>
                  <CBPFClusterChart clusters={allCrises[0].entry.crisisAllocation.clusters} />
                </div>
              </>
            )}

          {/* Drivers */}
          {sev && sev.drivers && sev.drivers.trim() && (
            <>
              <Separator className="opacity-20" />
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
                  Crisis Drivers
                </span>
                <div className="flex flex-wrap gap-1 items-center">
                  {sev.drivers
                    .trim()
                    .split(/[,/]+/)
                    .map((s: string) => s.trim())
                    .filter(Boolean)
                    .map((d: string, i: number) => (
                      <span
                        key={i}
                        className="text-[9px] font-mono bg-amber-500/10 border border-amber-500/20 text-amber-400/80 rounded px-1.5 py-0.5"
                      >
                        {d}
                      </span>
                    ))}
                </div>
              </div>
            </>
          )}

          {!sev && !overall && allCrises.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4 font-mono">
              No data available
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
