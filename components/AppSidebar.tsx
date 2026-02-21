"use client";

import { useState, useMemo, type ReactNode } from "react";
import { useAppContext } from "@/lib/app-context";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  Globe2,
  Search,
  SlidersHorizontal,
  MapPin,
  ArrowLeft,
  DollarSign,
  BarChart3,
  ChevronRight,
  TrendingDown,
  Info,
} from "lucide-react";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Line,
  BarChart,
} from "recharts";
import type {
  UnifiedCountryData,
  CrisisData,
  CrisisAllocation,
} from "@/lib/types";
import { formatDollars } from "@/lib/utils";

// ── Helpers ────────────────────────────────────────────────────────────────────

// ── HoverTip (acronym / concept tooltip) ──────────────────────────────────────
function HoverTip({ children, tip }: { children: ReactNode; tip: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <UITooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-0.5 cursor-help">
            {children}
            <Info className="h-2.5 w-2.5 text-cyan-400/30 hover:text-cyan-400/70 transition-colors" />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[260px] text-[11px] bg-black/95 border-cyan-500/30 text-cyan-100/90 leading-snug z-[100] p-2.5 rounded-md shadow-[0_0_14px_rgba(0,200,255,0.14)]"
        >
          {tip}
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
  );
}

function getSeverityBadgeColor(category: string): string {
  switch (category) {
    case "Very High": return "bg-red-600/90 text-white border-red-500/50";
    case "High":      return "bg-red-500/80 text-white border-red-400/50";
    case "Medium":    return "bg-amber-500/80 text-white border-amber-400/50";
    case "Low":       return "bg-blue-500/70 text-white border-blue-400/50";
    case "Very Low":  return "bg-slate-500/70 text-white border-slate-400/50";
    default:          return "bg-zinc-600/70 text-white border-zinc-500/50";
  }
}

function getSeverityColorClass(cat: string): string {
  switch (cat) {
    case "Very High": return "text-red-400 border-red-500/30 bg-red-500/10";
    case "High":      return "text-orange-400 border-orange-500/30 bg-orange-500/10";
    case "Medium":    return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    case "Low":       return "text-blue-400 border-blue-500/30 bg-blue-500/10";
    default:          return "text-slate-400 border-slate-500/30 bg-slate-500/10";
  }
}

function getCategoryIcon(_cat: string): string {
  return "";
}

// ── Chart Tooltip ──────────────────────────────────────────────────────────────
const chartTooltipStyle = {
  background: "rgba(2, 8, 20, 0.97)",
  border: "1px solid rgba(0,200,255,0.25)",
  borderRadius: "8px",
  fontSize: "11px",
  fontFamily: "monospace",
  padding: "8px 12px",
};
const chartLabelStyle = { color: "rgba(0,200,255,0.85)", fontWeight: 600 };

// ── CBPF Cluster Chart ─────────────────────────────────────────────────────────
function CBPFClusterChart({ clusters }: { clusters: CrisisAllocation[] }) {
  if (!clusters || clusters.length === 0) return null;

  const sortedClusters = [...clusters].sort((a, b) => b.totalAllocations - a.totalAllocations);

  const chartData = sortedClusters
    .slice(0, 8)
    .map((c) => {
      const costPerTargeted = c.targetedPeople > 0 ? c.totalAllocations / c.targetedPeople : 0;
      const costPerReached = c.reachedPeople > 0 ? c.totalAllocations / c.reachedPeople : 0;
      const reachPct = c.targetedPeople > 0 ? Math.round((c.reachedPeople / c.targetedPeople) * 100) : 0;
      return {
        name: c.cluster.length > 10 ? c.cluster.slice(0, 10) + "…" : c.cluster,
        fullName: c.cluster,
        cbpf: Math.round(c.totalAllocations / 1_000),
        costPerTargeted: Math.round(costPerTargeted * 10) / 10,
        costPerReached: Math.round(costPerReached * 10) / 10,
        reachPct,
      };
    });

  // Delivery summary: show % reached per cluster with 0-reached badges
  const deliverySummary = sortedClusters.filter(c => c.targetedPeople > 0).map(c => {
    const reachPct = Math.round((c.reachedPeople / c.targetedPeople) * 100);
    return { cluster: c.cluster, targeted: c.targetedPeople, reached: c.reachedPeople, reachPct, alloc: c.totalAllocations };
  });

  return (
    <div className="space-y-2 pt-1">
      <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
        CBPF Funding vs Cost Per Person
      </p>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 12, right: 52, bottom: 24, left: 58 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,255,0.07)" vertical={false} />
            <XAxis
              dataKey="name"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              tick={(props: any) => {
                const full = chartData.find((d) => d.name === props.payload?.value)?.fullName ?? props.payload?.value ?? "";
                return (
                  <g transform={`translate(${props.x},${props.y})`}>
                    <title>{full}</title>
                    <text x={0} y={0} dy={12} textAnchor="middle" fontSize={8} fill="rgba(0,200,255,0.55)" fontFamily="monospace">
                      {props.payload?.value}
                    </text>
                  </g>
                );
              }}
              textAnchor="end"
              interval={0}
              tickLine={false}
              axisLine={{ stroke: "rgba(0,200,255,0.15)" }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 9, fill: "rgba(0,200,255,0.55)", fontFamily: "monospace" }}
              tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}M` : `${v}K`}`}
              tickLine={false}
              axisLine={false}
              width={52}
              label={{ value: "CBPF ($K)", angle: -90, position: "insideLeft", offset: -40, style: { fontSize: 8, fill: "rgba(34,211,238,0.5)", fontFamily: "monospace" } }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 9, fill: "rgba(248,113,113,0.6)", fontFamily: "monospace" }}
              tickFormatter={(v: number) => `$${v}`}
              tickLine={false}
              axisLine={false}
              width={46}
              label={{ value: "$ / Person", angle: 90, position: "insideRight", offset: -30, style: { fontSize: 8, fill: "rgba(248,113,113,0.5)", fontFamily: "monospace" } }}
            />
            <Tooltip
              contentStyle={chartTooltipStyle}
              labelStyle={chartLabelStyle}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => {
                const v = value ?? 0;
                if (name === "cbpf") return [`$${Number(v).toLocaleString()}K`, "CBPF"];
                if (name === "costPerTargeted") return [`$${Number(v).toLocaleString()}`, "Cost / Targeted"];
                if (name === "costPerReached") return [`$${Number(v).toLocaleString()}`, "Cost / Reached"];
                return [v, name];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 9, fontFamily: "monospace", color: "rgba(0,200,255,0.5)", paddingTop: 4 }}
              iconSize={8}
            />
            <Bar yAxisId="left" dataKey="cbpf" name="CBPF ($K)" fill="#12626e" radius={[3, 3, 0, 0]} opacity={0.85} />
            <Line yAxisId="right" type="monotone" dataKey="costPerReached" name="Cost / Reached" stroke="#f87171" strokeWidth={1.8} dot={{ r: 2.5, fill: "#f87171" }} />
            <Line yAxisId="right" type="monotone" dataKey="costPerTargeted" name="Cost / Targeted" stroke="#00b11b" strokeWidth={1.5} strokeDasharray="4 2" dot={{ r: 2, fill: "#94a3b8" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Delivery rate summary with 0-reached badges */}
      {deliverySummary.length > 0 && (
        <div className="space-y-1 pt-1">
          <p className="text-[9px] font-mono uppercase tracking-widest text-cyan-400/50">
            <HoverTip tip="Percentage of targeted people actually reached by CBPF-funded aid. Lower rates may indicate delivery challenges.">
              Delivery Rate by Cluster
            </HoverTip>
          </p>
          {deliverySummary
            .sort((a, b) => a.reachPct - b.reachPct)
            .slice(0, 6)
            .map((d, idx) => (
              <div key={idx} className="flex items-center gap-2 text-[9px] font-mono">
                <span className="text-muted-foreground truncate flex-1 min-w-0">
                  {d.cluster.length > 18 ? d.cluster.slice(0, 18) + "…" : d.cluster}
                </span>
                {d.reached === 0 && d.alloc > 0 && (
                  <span className="text-[8px] px-1 py-0 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-bold shrink-0">
                    0 REACHED
                  </span>
                )}
                <div className="w-16 h-1 rounded-full bg-muted/20 overflow-hidden shrink-0">
                  <div
                    className={`h-full rounded-full ${d.reachPct === 0 ? "bg-red-500" : d.reachPct < 20 ? "bg-orange-500" : "bg-cyan-500"}`}
                    style={{ width: `${Math.min(d.reachPct, 100)}%` }}
                  />
                </div>
                <span className={`w-8 text-right shrink-0 ${d.reachPct === 0 ? "text-red-400 font-bold" : d.reachPct < 20 ? "text-orange-400" : "text-cyan-400/60"}`}>
                  {d.reachPct}%
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ── Country Detail View ────────────────────────────────────────────────────────
function CountryDetailView({
  country,
  onBack,
}: {
  country: UnifiedCountryData;
  onBack: () => void;
}) {
  const { data, getAllCrisesForCountry, setActiveCrisis, setSidebarTab } = useAppContext();
  const sev = country.severity;
  const overall = country.overallFunding;
  const allCrises = getAllCrisesForCountry(country.iso3);

  const rankings = useMemo(() => {
    if (!overall) return null;
    const allC = Object.values(data.countries).filter(
      c => c.overallFunding && c.overallFunding.totalRequirements > 0
    );
    // Absolute gap rank (on-appeal)
    const gapSorted = [...allC].sort(
      (a, b) =>
        (b.overallFunding!.totalRequirements - b.overallFunding!.totalFunding) -
        (a.overallFunding!.totalRequirements - a.overallFunding!.totalFunding)
    );
    const gapRank = gapSorted.findIndex(c => c.iso3 === country.iso3) + 1;
    const absGap = Math.max(0, overall.totalRequirements - overall.totalFunding);
    // Neglect index rank
    const withNI = allC
      .filter(c => c.severity)
      .map(c => ({
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
    const niRank = withNI.findIndex(c => c.iso3 === country.iso3) + 1;
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

          {/* ── Severity (no drivers here — moved to bottom) ──────────────── */}
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
                <Badge variant="outline" className={`text-sm px-2.5 py-0.5 font-bold font-mono ${getSeverityColorClass(sev.severityCategory)}`}>
                  {sev.severityIndex.toFixed(1)}<span className="text-[10px] opacity-50 font-normal">/5</span>
                </Badge>
                <span className="text-sm text-muted-foreground">{sev.severityCategory}</span>
              </div>
            </div>
          )}

          {/* ── Funding Gap & Neglect (moved up, beneath severity) ─────── */}
          {rankings && (
            <>
              <Separator className="opacity-20" />
              <div className="space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">Funding Gap &amp; Neglect</p>
                {/* Stacked bar matching global page style */}
                {overall && (() => {
                  const onAppealM = Math.round(overall.totalFunding / 1_000_000);
                  const offAppealM = Math.round(overall.offAppealFunding / 1_000_000);
                  const gapM = Math.round(Math.max(0, overall.totalRequirements - overall.totalFundingAll) / 1_000_000);
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
                          <div className="h-full bg-cyan-500" style={{ width: `${onPct}%` }} title={`On-appeal: $${onAppealM}M`} />
                        )}
                        {offPct > 0 && (
                          <div className="h-full bg-cyan-800" style={{ width: `${offPct}%` }} title={`Off-appeal: $${offAppealM}M`} />
                        )}
                        <div className="h-full bg-red-500 flex-1" title={`Gap: $${gapM}M`} />
                      </div>
                      <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-cyan-500 inline-block" /> On-appeal: {formatDollars(overall.totalFunding)}</span>
                        {overall.offAppealFunding > 0 && (
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-cyan-800 inline-block" /> Off-appeal: {formatDollars(overall.offAppealFunding)}</span>
                        )}
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/75 inline-block" /> Gap: <strong className="text-red-400">{formatDollars(rankings.absGap)}</strong></span>
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
                          style={{ width: `${Math.min((rankings.neglectIndex / (rankings.niMax || 1)) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono font-bold text-amber-400">{rankings.neglectIndex.toFixed(3)}</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Active Crises ─────────────────────────────────────────── */}
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
                        <span className="text-[11px] font-medium text-foreground leading-tight">{crisis.crisisName}</span>
                        <Badge variant="outline" className={`shrink-0 text-[9px] px-1.5 py-0 font-mono ${getSeverityBadgeColor(entry.severityCategory)}`}>
                          {entry.severityIndex.toFixed(1)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono text-muted-foreground">{entry.severityCategory}</span>
                        {crisis.categories.slice(0, 2).map((cat) => (
                          <span key={cat} className="text-[9px] font-mono text-red-400/60 border border-red-500/20 rounded-full px-1.5 py-0">
                            {getCategoryIcon(cat)} {cat}
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
                    Appeal Breakdown ({overall.planLines.length} plan line{overall.planLines.length !== 1 ? "s" : ""})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {[...overall.planLines]
                    .sort((a, b) => b.requirements - a.requirements)
                    .map((pl, idx) => {
                      const pct = pl.percentFunded;
                      const typeBadge = pl.typeName.toLowerCase().includes("flash")
                        ? "Flash"
                        : pl.typeName.toLowerCase().includes("refugee") || pl.typeName.toLowerCase().includes("regional")
                        ? "Regional"
                        : "HRP";
                      return (
                        <div key={idx} className="rounded border border-cyan-500/10 bg-black/30 p-2">
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <span className="text-[10px] font-medium leading-tight flex-1">{pl.name}</span>
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
                            <span className={`text-[9px] font-mono font-bold ${pct < 50 ? "text-red-400" : "text-cyan-400"}`}>
                              {pct}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  {/* Off-appeal row */}
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

          {/* ── CBPF by Cluster ───────────────────────────────────────── */}
          {allCrises[0]?.entry.crisisAllocation?.clusters && allCrises[0].entry.crisisAllocation.clusters.length > 0 && (
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

          {/* ── Drivers (moved to bottom) ─────────────────────────────── */}
          {sev && sev.drivers && sev.drivers.trim() && (
            <>
              <Separator className="opacity-20" />
              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">Crisis Drivers</span>
                <div className="flex flex-wrap gap-1 items-center">
                  {sev.drivers.trim().split(/[,/]+/).map(s => s.trim()).filter(Boolean).map((d, i) => (
                    <span key={i} className="text-[9px] font-mono bg-amber-500/10 border border-amber-500/20 text-amber-400/80 rounded px-1.5 py-0.5">
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

// ── Crisis Cluster Chart ────────────────────────────────────────────────────────
function CrisisReachChart({ crisis }: { crisis: CrisisData }) {
  const { data } = useAppContext();

  const chartData = useMemo(() => {
    const clusterMap = new Map<string, { allocations: number; reached: number; targetedPeople: number }>();
    for (const entry of crisis.countries) {
      const country = data.countries[entry.iso3];
      if (!country?.crisisAllocations) continue;
      for (const cluster of country.crisisAllocations.clusters) {
        const key = cluster.cluster;
        const existing = clusterMap.get(key) ?? { allocations: 0, reached: 0, targetedPeople: 0 };
        existing.allocations += cluster.totalAllocations;
        existing.reached += cluster.reachedPeople;
        existing.targetedPeople += cluster.targetedPeople;
        clusterMap.set(key, existing);
      }
    }
    return [...clusterMap.entries()].map(([k, v]) => {
      const costPerTargeted = v.targetedPeople > 0 ? v.allocations / v.targetedPeople : 0;
      const costPerReached = v.reached > 0 ? v.allocations / v.reached : 0;
      const name = k.length > 10 ? k.slice(0, 10) + "…" : k;
      return {
        name,
        fullName: k,
        cbpf: Math.round(v.allocations / 1_000),
        costPerTargeted: Math.round(costPerTargeted * 10) / 10,
        costPerReached: Math.round(costPerReached * 10) / 10,
      };
    });
  }, [crisis, data.countries]);

  if (chartData.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
        CBPF Funding vs Cost Per Person
      </p>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 12, right: 52, bottom: 24, left: 58 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,255,0.07)" vertical={false} />
            <XAxis
              dataKey="name"
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              tick={(props: any) => {
                const full = chartData.find((d) => d.name === props.payload?.value)?.fullName ?? props.payload?.value ?? "";
                return (
                  <g transform={`translate(${props.x},${props.y})`}>
                    <title>{full}</title>
                    <text x={0} y={0} dy={12} textAnchor="middle" fontSize={8} fill="rgba(0,200,255,0.55)" fontFamily="monospace">
                      {props.payload?.value}
                    </text>
                  </g>
                );
              }}
              interval={0}
              tickLine={false}
              axisLine={{ stroke: "rgba(0,200,255,0.15)" }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 9, fill: "rgba(0,200,255,0.55)", fontFamily: "monospace" }}
              tickFormatter={(v: number) =>
                v >= 1_000 ? `$${(v / 1_000).toFixed(0)}M` : `$${v}K`
              }
              tickLine={false}
              axisLine={false}
              width={52}
              label={{ value: "CBPF ($K)", angle: -90, position: "insideLeft", offset: -40, style: { fontSize: 8, fill: "rgba(34,211,238,0.5)", fontFamily: "monospace" } }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 9, fill: "rgba(248,113,113,0.6)", fontFamily: "monospace" }}
              tickFormatter={(v: number) => `$${v}`}
              tickLine={false}
              axisLine={false}
              width={46}
              label={{ value: "$ / Person", angle: 90, position: "insideRight", offset: -30, style: { fontSize: 8, fill: "rgba(248,113,113,0.5)", fontFamily: "monospace" } }}
            />
            <Tooltip
              contentStyle={chartTooltipStyle}
              labelStyle={chartLabelStyle}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => {
                const v = value ?? 0;
                if (name === "cbpf")     return [`$${Number(v).toLocaleString()}K`, "CBPF"];
                if (name === "costPerTargeted") return [`$${Number(v).toLocaleString()}`, "Cost / Targeted"];
                if (name === "costPerReached") return [`$${Number(v).toLocaleString()}`, "Cost / Reached"];
                return [v, name];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 9, fontFamily: "monospace", color: "rgba(0,200,255,0.5)", paddingTop: 4 }}
              iconSize={8}
            />
            <Bar yAxisId="left" dataKey="cbpf" name="CBPF ($K)" fill="#22d3ee" radius={[3, 3, 0, 0]} opacity={0.85} />
            <Line yAxisId="right" type="monotone" dataKey="costPerReached" name="Cost / Reached" stroke="#f87171" strokeWidth={1.8} dot={{ r: 2.5, fill: "#f87171" }} />
            <Line yAxisId="right" type="monotone" dataKey="costPerTargeted" name="Cost / Targeted" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 2" dot={{ r: 2, fill: "#94a3b8" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Crisis Detail View ─────────────────────────────────────────────────────────
function CrisisDetailView({ crisis, onBack }: { crisis: CrisisData; onBack: () => void }) {
  const { setSelectedCountryIso3, setSidebarTab, setGlobeFocusIso3 } = useAppContext();

  const totalReq  = crisis.countries.reduce((s, c) => s + (c.overallFunding?.totalRequirements ?? 0), 0);
  const totalFund = crisis.countries.reduce((s, c) => s + (c.overallFunding?.totalFunding ?? 0), 0);
  const totalCBPF = crisis.countries.reduce((s, c) => s + (c.crisisAllocation?.totalAllocations ?? 0), 0);
  const gap = totalReq - totalFund;
  const pct = totalReq > 0 ? (totalFund / totalReq) * 100 : 0;

  function getNeglectColor(score: number): string {
    if (score >= 5) return "bg-red-500";
    if (score >= 3) return "bg-orange-500";
    if (score >= 1.5) return "bg-amber-500";
    return "bg-blue-500";
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-cyan-500/15 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-400/60 hover:text-cyan-400 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <span className="text-cyan-500/30 text-xs">/</span>
        <span className="text-[11px] font-mono text-cyan-300/80 truncate">{crisis.crisisName}</span>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-foreground">{crisis.crisisName}</h2>
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                {crisis.countries.length} countr{crisis.countries.length === 1 ? "y" : "ies"} · ranked by Neglect Index
              </p>
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                {crisis.categories.map((cat) => (
                  <span key={cat} className="text-[9px] font-mono text-red-400/70 border border-red-500/25 rounded-full px-1.5 py-0.5">
                    {getCategoryIcon(cat)} {cat}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-cyan-500/15 bg-black/40 p-2.5">
              <p className="text-[9px] font-mono uppercase tracking-widest text-cyan-400/60 mb-1">Requirements</p>
              <p className="text-sm font-bold font-mono text-foreground">{formatDollars(totalReq)}</p>
            </div>
            <div className="rounded border border-cyan-500/15 bg-black/40 p-2.5">
              <p className="text-[9px] font-mono uppercase tracking-widest text-cyan-400/60 mb-1">Funded</p>
              <p className="text-sm font-bold font-mono text-cyan-400">{formatDollars(totalFund)}</p>
            </div>
            <div className="rounded border border-cyan-500/15 bg-black/40 p-2.5">
              <p className="text-[9px] font-mono uppercase tracking-widest text-cyan-400/60 mb-1">CBPF</p>
              <p className="text-sm font-bold font-mono text-cyan-400">{formatDollars(totalCBPF)}</p>
            </div>
            <div className="rounded border border-red-500/20 bg-red-500/5 p-2.5">
              <p className="text-[9px] font-mono uppercase tracking-widest text-red-400/60 mb-1">Gap</p>
              <p className="text-sm font-bold font-mono text-red-400">{formatDollars(gap)}</p>
            </div>
          </div>

          {/* Funding progress */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground">Funding coverage</span>
              <span className={`text-[10px] font-bold font-mono ${pct < 50 ? "text-red-400" : "text-cyan-400"}`}>{pct.toFixed(1)}%</span>
            </div>
            <Progress value={Math.min(pct, 100)} className="h-1.5" />
          </div>

          <Separator className="opacity-20" />
          <CrisisReachChart crisis={crisis} />

          <Separator className="opacity-20" />
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">Country Rankings</p>
            <div className="space-y-1.5">
              {crisis.countries.map((entry, idx) => (
                <button
                  key={entry.iso3}
                  onClick={() => {
                    setSelectedCountryIso3(entry.iso3);
                    setGlobeFocusIso3(entry.iso3);
                    setSidebarTab("countries");
                  }}
                  className="w-full rounded border border-cyan-500/10 bg-black/30 p-2.5 text-left hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-cyan-400/50 w-5 shrink-0">{idx + 1}.</span>
                    <span className="text-[12px] font-medium flex-1 truncate">{entry.countryName}</span>
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-mono ${getSeverityBadgeColor(entry.severityCategory)}`}>
                      {entry.severityIndex.toFixed(1)}
                    </Badge>
                    {entry.overallFunding && (
                      <span className={`text-[10px] font-mono ${entry.overallFunding.percentFunded < 50 ? "text-red-400" : "text-cyan-400"}`}>
                        {entry.overallFunding.percentFunded.toFixed(0)}%
                      </span>
                    )}
                    <ChevronRight className="h-3 w-3 text-cyan-400/30 shrink-0" />
                  </div>
                  {entry.neglectIndex > 0 && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-muted/20 overflow-hidden">
                        <div className={`h-full rounded-full ${getNeglectColor(entry.neglectIndex)}`} style={{ width: `${(entry.neglectIndex / 8) * 100}%` }} />
                      </div>
                      <span className="text-[9px] font-mono text-muted-foreground shrink-0">{entry.neglectIndex.toFixed(2)}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Category Detail View ───────────────────────────────────────────────────────
function CategoryDetailView({
  category,
  onBack,
}: {
  category: string;
  onBack: () => void;
}) {
  const { data, setActiveCrisis } = useAppContext();

  const crises = useMemo(
    () => data.crises.filter((c) => c.categories.includes(category)),
    [data.crises, category]
  );

  const stats = useMemo(() => {
    const uniqueCountries = new Set<string>();
    let totalReq = 0, totalFund = 0, totalCBPF = 0;
    let totalSeverity = 0, severityCount = 0;

    for (const crisis of crises) {
      for (const c of crisis.countries) {
        uniqueCountries.add(c.iso3);
        totalReq  += c.overallFunding?.totalRequirements ?? 0;
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
      {/* Back nav */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-cyan-500/15 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-400/60 hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Categories
        </button>
        <span className="text-cyan-500/30 text-xs">/</span>
        <span className="text-[11px] font-mono text-red-300/80 truncate">
          {getCategoryIcon(category)} {category}
        </span>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {/* Category header */}
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="text-2xl">{getCategoryIcon(category)}</span>
              <h2 className="text-base font-semibold text-foreground">{category}</h2>
            </div>
            <p className="text-[11px] font-mono text-cyan-400/50">
              {stats.crisisCount} crisis{stats.crisisCount !== 1 ? "es" : ""} · {stats.countryCount} countr{stats.countryCount !== 1 ? "ies" : "y"} affected
            </p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-cyan-500/15 bg-black/40 p-2.5">
              <p className="text-[9px] font-mono uppercase tracking-widest text-cyan-400/60 mb-1">Requirements</p>
              <p className="text-sm font-bold font-mono text-foreground">{formatDollars(stats.totalReq)}</p>
            </div>
            <div className="rounded border border-cyan-500/15 bg-black/40 p-2.5">
              <p className="text-[9px] font-mono uppercase tracking-widest text-cyan-400/60 mb-1">Funded</p>
              <p className="text-sm font-bold font-mono text-cyan-400">{formatDollars(stats.totalFund)}</p>
            </div>
            <div className="rounded border border-cyan-500/15 bg-black/40 p-2.5">
              <p className="text-[9px] font-mono uppercase tracking-widest text-cyan-400/60 mb-1">CBPF</p>
              <p className="text-sm font-bold font-mono text-cyan-400">{formatDollars(stats.totalCBPF)}</p>
            </div>
            <div className="rounded border border-red-500/20 bg-red-500/5 p-2.5">
              <p className="text-[9px] font-mono uppercase tracking-widest text-red-400/60 mb-1">Gap</p>
              <p className="text-sm font-bold font-mono text-red-400">{formatDollars(stats.gap)}</p>
            </div>
          </div>

          {/* Avg severity + funding progress */}
          <div className="space-y-2 rounded border border-cyan-500/10 bg-black/30 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground">Avg. severity</span>
              <span className="text-[10px] font-bold font-mono text-amber-400">{stats.avgSeverity.toFixed(2)}</span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-muted-foreground">Overall funded</span>
                <span className={`text-[10px] font-bold font-mono ${stats.pct < 50 ? "text-red-400" : "text-cyan-400"}`}>
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
                const topCat = crisis.countries.find((c) => c.severityIndex === maxSev)?.severityCategory ?? "";
                return (
                  <button
                    key={crisis.crisisId}
                    onClick={() => setActiveCrisis(crisis)}
                    className="group w-full flex items-start justify-between gap-2 rounded-lg p-3 text-left transition-all border border-red-500/10 hover:border-red-500/30 hover:bg-red-500/5"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-[12px] font-medium leading-tight text-foreground block truncate">
                        {crisis.crisisName}
                      </span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 font-mono ${getSeverityBadgeColor(topCat)}`}>
                          {maxSev.toFixed(1)}
                        </Badge>
                        <span className="text-[10px] font-mono text-cyan-400/50">
                          {crisis.countries.length} countr{crisis.countries.length === 1 ? "y" : "ies"}
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

// ── Crises Tab ─────────────────────────────────────────────────────────────────
function CrisesTab() {
  const { data, activeCrisis, setActiveCrisis, spikeMode, setSpikeMode } = useAppContext();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Build category list sorted by crisis count desc — must be before any early returns
  const categoriesWithCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of data.crises) {
      for (const cat of c.categories) {
        map.set(cat, (map.get(cat) ?? 0) + 1);
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => ({ cat, count }));
  }, [data.crises]);

  // Spike mode toggle — always visible at top
  const spikeModeToggle = (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-cyan-500/10 shrink-0">
      <span className="text-[10px] font-mono text-cyan-400/60 uppercase tracking-widest">Spikes</span>
      <div className="flex rounded-md border border-cyan-500/20 overflow-hidden ml-auto">
        <button
          onClick={() => setSpikeMode("fundingGap")}
          className={`px-2.5 py-1 text-[10px] font-mono transition-colors ${
            spikeMode === "fundingGap"
              ? "bg-cyan-500/20 text-cyan-300"
              : "text-cyan-400/50 hover:bg-cyan-500/10"
          }`}
        >
          Funding Gap
        </button>
        <button
          onClick={() => setSpikeMode("severity")}
          className={`px-2.5 py-1 text-[10px] font-mono transition-colors ${
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

  // If a crisis is active, show its detail
  if (activeCrisis) {
    return (
      <div className="flex flex-col h-full min-h-0">
        {spikeModeToggle}
        <div className="flex-1 min-h-0">
          <CrisisDetailView
            crisis={activeCrisis}
            onBack={() => setActiveCrisis(null)}
          />
        </div>
      </div>
    );
  }

  // If a category is selected, show category detail
  if (selectedCategory) {
    return (
      <div className="flex flex-col h-full min-h-0">
        {spikeModeToggle}
        <div className="flex-1 min-h-0">
          <CategoryDetailView
            category={selectedCategory}
            onBack={() => setSelectedCategory(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {spikeModeToggle}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-1 px-2 pb-4 pt-1">
          <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/40 px-1 pb-1">
            Crisis Categories
          </p>
          {categoriesWithCounts.map(({ cat, count }) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="group flex items-center justify-between gap-3 rounded-lg px-3 py-3 text-left transition-all border border-red-500/10 hover:border-red-500/28 hover:bg-red-500/5 hover:shadow-[0_0_10px_rgba(255,30,30,0.07)]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl leading-none shrink-0">{getCategoryIcon(cat)}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{cat}</p>
                  <p className="text-[10px] font-mono text-cyan-400/45 mt-0.5">
                    {count} crisis{count !== 1 ? "es" : ""}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-cyan-400/25 group-hover:text-cyan-400/55 transition-colors" />
            </button>
          ))}
          {categoriesWithCounts.length === 0 && (
            <p className="text-center text-sm text-cyan-400/40 font-mono py-8">No crises found</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Countries Tab ──────────────────────────────────────────────────────────────
function CountriesTab() {
  const { data, setSelectedCountryIso3, selectedCountryIso3, getCountry, setGlobeFocusIso3 } = useAppContext();
  const [search, setSearch] = useState("");
  const [showSortFilter, setShowSortFilter] = useState(false);
  const [sortBy, setSortBy] = useState<
    "name-asc"
    | "severity-asc"
    | "severity-desc"
    | "gap-asc"
    | "gap-desc"
    | "neglect-asc"
    | "neglect-desc"
    | "on-appeal-asc"
    | "on-appeal-desc"
  >("name-asc");
  const [severityMin, setSeverityMin] = useState("");
  const [severityMax, setSeverityMax] = useState("");
  const [gapMin, setGapMin] = useState("");
  const [gapMax, setGapMax] = useState("");
  const [neglectMin, setNeglectMin] = useState("");
  const [neglectMax, setNeglectMax] = useState("");
  const [onAppealMin, setOnAppealMin] = useState("");
  const [onAppealMax, setOnAppealMax] = useState("");

  const parseBound = (value: string): number | null => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const inRange = (value: number | null, min: number | null, max: number | null) => {
    if (value === null) return min === null && max === null;
    if (min !== null && value < min) return false;
    if (max !== null && value > max) return false;
    return true;
  };

  const countryList = useMemo(() => {
    const entries = Object.values(data.countries)
      .filter((c) => c.name && c.iso3 && (c.severity || c.overallFunding || c.crisisAllocations))
      .map((country) => {
        const severity = country.severity?.severityIndex ?? null;
        const onAppealFunding = country.overallFunding?.totalFunding ?? null;
        const fundingGap = country.overallFunding
          ? Math.max(0, country.overallFunding.totalRequirements - country.overallFunding.totalFundingAll)
          : null;
        const neglectIndex = country.severity && country.overallFunding
          ? (country.severity.severityIndex / 5) *
            (1 - country.overallFunding.percentFunded / 100) *
            Math.log10(1 + country.overallFunding.totalRequirements / 1_000_000)
          : null;

        return {
          country,
          severity,
          fundingGap,
          neglectIndex,
          onAppealFunding,
        };
      });

    const q = search.toLowerCase();
    const searched = q
      ? entries.filter(({ country }) =>
          country.name.toLowerCase().includes(q) || country.iso3.toLowerCase().includes(q)
        )
      : entries;

    const filtered = searched.filter((row) =>
      inRange(row.severity, parseBound(severityMin), parseBound(severityMax)) &&
      inRange(row.fundingGap, parseBound(gapMin), parseBound(gapMax)) &&
      inRange(row.neglectIndex, parseBound(neglectMin), parseBound(neglectMax)) &&
      inRange(row.onAppealFunding, parseBound(onAppealMin), parseBound(onAppealMax))
    );

    const sortable = [...filtered];
    const nullLast = (value: number | null, asc: boolean) => {
      if (value === null) return asc ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      return value;
    };

    sortable.sort((a, b) => {
      switch (sortBy) {
        case "severity-asc":
          return nullLast(a.severity, true) - nullLast(b.severity, true);
        case "severity-desc":
          return nullLast(b.severity, false) - nullLast(a.severity, false);
        case "gap-asc":
          return nullLast(a.fundingGap, true) - nullLast(b.fundingGap, true);
        case "gap-desc":
          return nullLast(b.fundingGap, false) - nullLast(a.fundingGap, false);
        case "neglect-asc":
          return nullLast(a.neglectIndex, true) - nullLast(b.neglectIndex, true);
        case "neglect-desc":
          return nullLast(b.neglectIndex, false) - nullLast(a.neglectIndex, false);
        case "on-appeal-asc":
          return nullLast(a.onAppealFunding, true) - nullLast(b.onAppealFunding, true);
        case "on-appeal-desc":
          return nullLast(b.onAppealFunding, false) - nullLast(a.onAppealFunding, false);
        default:
          return a.country.name.localeCompare(b.country.name);
      }
    });

    return sortable.map((row) => row.country);
  }, [
    data.countries,
    search,
    sortBy,
    severityMin,
    severityMax,
    gapMin,
    gapMax,
    neglectMin,
    neglectMax,
    onAppealMin,
    onAppealMax,
  ]);

  if (selectedCountryIso3) {
    const country = getCountry(selectedCountryIso3);
    if (country) {
      return (
        <CountryDetailView
          country={country}
          onBack={() => setSelectedCountryIso3(null)}
        />
      );
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="relative px-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cyan-400/40" />
            <Input
              placeholder="Search countries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 bg-black/40 border-cyan-500/20 text-sm h-9 font-mono placeholder:text-cyan-400/30 focus:border-cyan-500/50"
            />
          </div>
          <button
            onClick={() => setShowSortFilter((prev) => !prev)}
            className={`h-9 w-9 shrink-0 rounded-md border transition-colors flex items-center justify-center ${
              showSortFilter
                ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
                : "border-cyan-500/20 bg-black/40 text-cyan-400/60 hover:border-cyan-500/40 hover:text-cyan-300"
            }`}
            aria-label="Open sort and filter"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        {showSortFilter && (
          <div className="absolute right-2 top-11 z-50 w-[320px] rounded-md border border-cyan-500/25 bg-black/95 p-3 shadow-[0_0_16px_rgba(0,200,255,0.15)] space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="w-full h-8 rounded border border-cyan-500/20 bg-black/50 text-[11px] font-mono text-cyan-100 px-2"
              >
                <option value="name-asc">Name (A → Z)</option>
                <option value="severity-asc">Severity (low → high)</option>
                <option value="severity-desc">Severity (high → low)</option>
                <option value="gap-asc">Funding gap (low → high)</option>
                <option value="gap-desc">Funding gap (high → low)</option>
                <option value="neglect-asc">Neglect index (low → high)</option>
                <option value="neglect-desc">Neglect index (high → low)</option>
                <option value="on-appeal-asc">On-appeal funding (low → high)</option>
                <option value="on-appeal-desc">On-appeal funding (high → low)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 text-[10px] font-mono uppercase tracking-widest text-cyan-400/60">Severity (0-5)</div>
              <Input placeholder="Min" value={severityMin} onChange={(e) => setSeverityMin(e.target.value)} className="h-8 bg-black/40 border-cyan-500/20 text-[11px] font-mono" />
              <Input placeholder="Max" value={severityMax} onChange={(e) => setSeverityMax(e.target.value)} className="h-8 bg-black/40 border-cyan-500/20 text-[11px] font-mono" />

              <div className="col-span-2 text-[10px] font-mono uppercase tracking-widest text-cyan-400/60">Funding Gap (USD)</div>
              <Input placeholder="Min" value={gapMin} onChange={(e) => setGapMin(e.target.value)} className="h-8 bg-black/40 border-cyan-500/20 text-[11px] font-mono" />
              <Input placeholder="Max" value={gapMax} onChange={(e) => setGapMax(e.target.value)} className="h-8 bg-black/40 border-cyan-500/20 text-[11px] font-mono" />

              <div className="col-span-2 text-[10px] font-mono uppercase tracking-widest text-cyan-400/60">Neglect Index</div>
              <Input placeholder="Min" value={neglectMin} onChange={(e) => setNeglectMin(e.target.value)} className="h-8 bg-black/40 border-cyan-500/20 text-[11px] font-mono" />
              <Input placeholder="Max" value={neglectMax} onChange={(e) => setNeglectMax(e.target.value)} className="h-8 bg-black/40 border-cyan-500/20 text-[11px] font-mono" />

              <div className="col-span-2 text-[10px] font-mono uppercase tracking-widest text-cyan-400/60">On-Appeal Funding (USD)</div>
              <Input placeholder="Min" value={onAppealMin} onChange={(e) => setOnAppealMin(e.target.value)} className="h-8 bg-black/40 border-cyan-500/20 text-[11px] font-mono" />
              <Input placeholder="Max" value={onAppealMax} onChange={(e) => setOnAppealMax(e.target.value)} className="h-8 bg-black/40 border-cyan-500/20 text-[11px] font-mono" />
            </div>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-0.5 px-2 pb-4">
          {countryList.map((country) => {
            const isSelected = selectedCountryIso3 === country.iso3;
            return (
              <button
                key={country.iso3}
                onClick={() => {
                  setSelectedCountryIso3(country.iso3);
                  setGlobeFocusIso3(country.iso3);
                }}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-left transition-all ${
                  isSelected
                    ? "bg-cyan-500/10 border border-cyan-500/30 shadow-[0_0_10px_rgba(0,200,255,0.1)]"
                    : "hover:bg-cyan-500/5 border border-transparent hover:border-cyan-500/15"
                }`}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-400/40" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{country.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-cyan-400/50 font-mono">{country.iso3}</span>
                    {country.severity && (
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-mono ${getSeverityBadgeColor(country.severity.severityCategory)}`}>
                        {country.severity.severityIndex.toFixed(1)}
                      </Badge>
                    )}
                    {country.overallFunding && (
                      <span className={`text-[10px] font-mono ${country.overallFunding.percentFunded < 50 ? "text-red-400/70" : "text-cyan-400/40"}`}>
                        {country.overallFunding.percentFunded}% funded
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          {countryList.length === 0 && (
            <p className="text-center text-sm text-cyan-400/40 font-mono py-8">No countries found</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Global Tab ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, className, tip }: { label: string; value: string; className?: string; tip?: string }) {
  return (
    <div className="rounded border border-cyan-500/15 bg-black/40 p-3">
      <p className="text-[9px] font-mono uppercase tracking-widest text-cyan-400/60 mb-1.5">
        {tip ? <HoverTip tip={tip}>{label}</HoverTip> : label}
      </p>
      <p className={`text-sm font-bold font-mono ${className}`}>{value}</p>
    </div>
  );
}

function GlobalTab() {
  const { data, setSelectedCountryIso3, setSidebarTab, setGlobeFocusIso3, setActiveCrisis } = useAppContext();
  const stats = data.globalStats;
  const [globalView, setGlobalView] = useState<"main" | "funding-gap-all" | "underlooked-crises-all">("main");

  const fundingGapAllData = useMemo(() => {
    return Object.values(data.countries)
      .filter(c => c.overallFunding && c.overallFunding.totalRequirements > 0)
      .map(c => {
        const of_ = c.overallFunding!;
        const gap = Math.max(0, of_.totalRequirements - of_.totalFundingAll);
        return {
          iso3: c.iso3,
          name: c.name.length > 10 ? c.name.slice(0, 10) + "…" : c.name,
          fullName: c.name,
          onAppeal: Math.round(of_.totalFunding / 1_000_000),
          offAppeal: Math.round(of_.offAppealFunding / 1_000_000),
          gap: Math.round(gap / 1_000_000),
          totalGap: Math.round((of_.totalRequirements - of_.totalFundingAll) / 1_000_000),
        };
      })
        .sort((a, b) => b.totalGap - a.totalGap);
  }, [data.countries]);

      const fundingGapData = fundingGapAllData.slice(0, 10);

  // Underlooked countries table: Neglect Index v2 ranking
  const neglectCountryRanking = useMemo(() => {
    return Object.values(data.countries)
      .filter(c => c.severity && c.overallFunding && c.overallFunding.totalRequirements > 0)
      .map(c => {
        const sev = c.severity!.severityIndex;
        const pctFunded = c.overallFunding!.percentFunded / 100;
        const reqM = c.overallFunding!.totalRequirements / 1_000_000;
        const neglectIndex = (sev / 5) * (1 - pctFunded) * Math.log10(1 + reqM);
        const gap = c.overallFunding!.totalRequirements - c.overallFunding!.totalFunding;
        const offAppealShare = c.overallFunding!.totalFundingAll > 0
          ? (c.overallFunding!.offAppealFunding / c.overallFunding!.totalFundingAll) * 100
          : 0;
        return {
          iso3: c.iso3,
          name: c.name,
          severity: sev,
          percentFunded: c.overallFunding!.percentFunded,
          requirements: c.overallFunding!.totalRequirements,
          gap,
          offAppealShare,
          neglectIndex,
        };
      })
      .sort((a, b) => b.neglectIndex - a.neglectIndex)
      .slice(0, 15);
  }, [data.countries]);

  // Underlooked crises (crisis-level aggregation): compute Neglect Index across countries
  // Neglect Index = (MaxSeverity/5) * (1 - %Funded) * log10(1 + TotalRequirements/$1M)
  const neglectCrisisAllRanking = useMemo(() => {
    return data.crises
      .map((crisis) => {
        const totalRequirements = crisis.countries.reduce((s, c) => {
          const r = c.overallFunding?.totalRequirements ?? 0;
          return s + (Number.isFinite(r) ? r : 0);
        }, 0);
        const totalFunding = crisis.countries.reduce((s, c) => {
          const f = c.overallFunding?.totalFunding ?? 0;
          return s + (Number.isFinite(f) ? f : 0);
        }, 0);
        const maxSeverity = crisis.countries.reduce((m, c) => Math.max(m, c.severityIndex || 0), 0);
        const avgSeverity = crisis.countries.length > 0
          ? crisis.countries.reduce((s, c) => s + (c.severityIndex || 0), 0) / crisis.countries.length
          : 0;
        const percentFunded = totalRequirements > 0 ? (totalFunding / totalRequirements) * 100 : 0;
        const requirementsM = totalRequirements / 1_000_000;
        const neglectIndex = (maxSeverity / 5) * (1 - percentFunded / 100) * Math.log10(1 + requirementsM);
        const gap = Math.max(0, totalRequirements - totalFunding);

        return {
          crisisId: crisis.crisisId,
          crisisName: crisis.crisisName,
          categories: crisis.categories,
          countriesCount: crisis.countries.length,
          maxSeverity,
          avgSeverity,
          percentFunded,
          totalRequirements,
          gap,
          neglectIndex,
        };
      })
      .filter((row) => row.totalRequirements > 0 && row.maxSeverity > 0 && Number.isFinite(row.neglectIndex))
      .sort((a, b) => b.neglectIndex - a.neglectIndex);
  }, [data.crises]);

  const neglectCrisisRanking = neglectCrisisAllRanking.slice(0, 10);

  if (globalView === "funding-gap-all") {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-cyan-500/15 shrink-0">
          <button
            onClick={() => setGlobalView("main")}
            className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-400/60 hover:text-cyan-400 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Global
          </button>
          <span className="text-cyan-500/30 text-xs">/</span>
          <span className="text-[11px] font-mono text-cyan-300/80 truncate">All Absolute Funding Gaps</span>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 space-y-2">
            {fundingGapAllData.map((row, idx) => {
              const total = row.onAppeal + row.offAppeal + row.gap;
              const onPct = total > 0 ? (row.onAppeal / total) * 100 : 0;
              const offPct = total > 0 ? (row.offAppeal / total) * 100 : 0;
              return (
                <button
                  key={row.iso3}
                  onClick={() => {
                    setSelectedCountryIso3(row.iso3);
                    setGlobeFocusIso3(row.iso3);
                    setSidebarTab("countries");
                  }}
                  className="w-full rounded border border-cyan-500/10 bg-black/30 p-2 text-left hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-mono text-cyan-400/40 w-5 shrink-0">{idx + 1}.</span>
                    <span className="text-[11px] font-medium flex-1 truncate">{row.fullName}</span>
                    <span className="text-[9px] font-mono text-red-400 font-bold shrink-0">
                      Gap: {row.gap >= 1000 ? `$${(row.gap / 1000).toFixed(2)}B` : `$${row.gap}M`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/20 overflow-hidden flex">
                    {onPct > 0 && <div className="h-full bg-cyan-500" style={{ width: `${onPct}%` }} />}
                    {offPct > 0 && <div className="h-full bg-cyan-800" style={{ width: `${offPct}%` }} />}
                    <div className="h-full bg-red-500" style={{ width: `${Math.max(0, 100 - onPct - offPct)}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (globalView === "underlooked-crises-all") {
    return (
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-cyan-500/15 shrink-0">
          <button
            onClick={() => setGlobalView("main")}
            className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-400/60 hover:text-cyan-400 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Overview
          </button>
          <span className="text-cyan-500/30 text-xs">/</span>
          <span className="text-[11px] font-mono text-red-300/80 truncate">All Underlooked Crises</span>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 space-y-1">
            {neglectCrisisAllRanking.map((row, idx) => (
              <button
                key={row.crisisId}
                onClick={() => {
                  const crisis = data.crises.find((c) => c.crisisId === row.crisisId) || null;
                  setActiveCrisis(crisis);
                  setSidebarTab("crises");
                }}
                className="w-full rounded border border-red-500/10 bg-black/30 p-2 text-left hover:border-red-500/30 hover:bg-red-500/5 transition-all"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-mono text-cyan-400/40 w-5 shrink-0">{idx + 1}.</span>
                  <span className="text-[11px] font-medium flex-1 truncate">{row.crisisName}</span>
                  <span className="text-[9px] font-mono text-red-400 font-bold shrink-0">{row.neglectIndex.toFixed(2)}</span>
                </div>
                <div className="h-1 rounded-full bg-muted/20 overflow-hidden mb-1">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500"
                    style={{ width: `${neglectCrisisAllRanking[0]?.neglectIndex ? (row.neglectIndex / neglectCrisisAllRanking[0].neglectIndex) * 100 : 0}%` }}
                  />
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-3 space-y-3">
        {/* ── Underlooked Crises (Crisis-Level) ───────────────────────────── */}
        {neglectCrisisRanking.length > 0 && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                  <HoverTip tip="Crises receiving the least global attention relative to their severity and scale. Higher score = greater mismatch between need and funding.">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-red-400/70">
                      Underlooked Crises (Top 10)
                    </p>
                  </HoverTip>
                </div>
                <button
                  onClick={() => setGlobalView("underlooked-crises-all")}
                  className="text-[10px] font-mono text-cyan-400/70 hover:text-cyan-300"
                >
                  Show all
                </button>
              </div>
              <p className="text-[9px] font-mono text-muted-foreground px-1 leading-tight">
                Aggregated by crisis across affected countries. Click a row to open the crisis detail view.
              </p>
              <div className="space-y-1">
                {neglectCrisisRanking.map((row, idx) => {
                  const barWidth = neglectCrisisRanking[0].neglectIndex > 0
                    ? (row.neglectIndex / neglectCrisisRanking[0].neglectIndex) * 100
                    : 0;
                  const cats = (row.categories || []).slice(0, 2);
                  return (
                    <button
                      key={row.crisisId}
                      onClick={() => {
                        const crisis = data.crises.find((c) => c.crisisId === row.crisisId) || null;
                        setActiveCrisis(crisis);
                        setSidebarTab("crises");
                      }}
                      className="w-full rounded border border-red-500/10 bg-black/30 p-2 text-left hover:border-red-500/30 hover:bg-red-500/5 transition-all"
                    >
                      <div className="flex items-start gap-2 mb-1">
                        <span className="text-[9px] font-mono text-cyan-400/40 w-4 shrink-0">{idx + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-medium leading-tight truncate">{row.crisisName}</span>
                            <span className="text-[9px] font-mono text-red-400 font-bold shrink-0">{row.neglectIndex.toFixed(2)}</span>
                          </div>
                          {cats.length > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              {cats.map((c) => (
                                <Badge
                                  key={c}
                                  variant="outline"
                                  className="text-[9px] px-1.5 py-0 font-mono border-red-500/20 text-red-300/70"
                                >
                                  {c}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="h-1 rounded-full bg-muted/20 overflow-hidden mb-1">
                        <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500" style={{ width: `${barWidth}%` }} />
                      </div>
                      <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground flex-wrap">
                        <span>Countries: <strong className="text-cyan-400/70">{row.countriesCount}</strong></span>
                        <span>Max Sev: <strong className="text-amber-400">{row.maxSeverity.toFixed(1)}</strong></span>
                        <span>Funded: <strong className={row.percentFunded < 50 ? "text-red-400" : "text-cyan-400"}>{row.percentFunded.toFixed(0)}%</strong></span>
                        <span>Gap: <strong className="text-red-400">{formatDollars(row.gap)}</strong></span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── Top 10 Absolute Funding Gaps ─────────────────────────────────── */}
        {fundingGapData.length > 0 && (
          <>
            <Separator className="opacity-20 my-2" />
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
                  Top 10 Absolute Funding Gaps
                </p>
                <button
                  onClick={() => setGlobalView("funding-gap-all")}
                  className="text-[10px] font-mono text-cyan-400/70 hover:text-cyan-300"
                >
                  Show all
                </button>
              </div>
              <p className="text-[9px] font-mono text-muted-foreground px-1 leading-tight">
                Countries with the largest unmet need after all funding (on-appeal + off-appeal). Each bar shows funded on-appeal, off-appeal, and remaining gap.
              </p>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={fundingGapData}
                    layout="vertical"
                    margin={{ top: 4, right: 12, bottom: 4, left: 6 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,255,0.06)" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 8, fill: "rgba(0,200,255,0.5)", fontFamily: "monospace" }}
                      tickFormatter={(v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}B` : `$${v}M`}
                      tickLine={false}
                      axisLine={{ stroke: "rgba(0,200,255,0.15)" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 8, fill: "rgba(0,200,255,0.6)", fontFamily: "monospace" }}
                      tickLine={false}
                      axisLine={false}
                      width={62}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      labelStyle={chartLabelStyle}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any, name: any) => {
                        const v = typeof value === "number" ? value : parseFloat(String(value ?? 0));
                        const label = name === "onAppeal" ? "Funded (on-appeal)"
                          : name === "offAppeal" ? "Funded (off-appeal)"
                          : "Unfunded Gap";
                        return [v >= 1000 ? `$${(v / 1000).toFixed(2)}B` : `$${v}M`, label];
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 8, fontFamily: "monospace", color: "rgba(0,200,255,0.5)", paddingTop: 4 }}
                      iconSize={8}
                    />
                    <Bar dataKey="onAppeal" name="Funded (on-appeal)" stackId="a" fill="#22d3ee" radius={0} opacity={0.85} />
                    <Bar dataKey="offAppeal" name="Funded (off-appeal)" stackId="a" fill="#0e7490" radius={0} opacity={0.7} />
                    <Bar dataKey="gap" name="Unfunded Gap" stackId="a" fill="#ef4444" radius={[0, 3, 3, 0]} opacity={0.75} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {/* ── Underlooked Countries Table ──────────────────────────────────── */}
        {neglectCountryRanking.length > 0 && (
          <>
            <Separator className="opacity-20 my-2" />
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                <HoverTip tip="Countries where crisis severity is high but funding falls short. Ranked by a composite of severity, funding gap, and scale of need.">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-red-400/70">
                    Underlooked Countries (Severity-Adjusted)
                  </p>
                </HoverTip>
              </div>
              <p className="text-[9px] font-mono text-muted-foreground px-1 leading-tight">
                Ranked by Neglect Index: combines severity, underfunding, and scale. Higher = more underlooked.
              </p>
              <div className="space-y-1">
                {neglectCountryRanking.map((row, idx) => {
                  const barWidth = neglectCountryRanking[0].neglectIndex > 0
                    ? (row.neglectIndex / neglectCountryRanking[0].neglectIndex) * 100
                    : 0;
                  return (
                    <button
                      key={row.iso3}
                      onClick={() => {
                        setSelectedCountryIso3(row.iso3);
                        setGlobeFocusIso3(row.iso3);
                        setSidebarTab("countries");
                      }}
                      className="w-full rounded border border-cyan-500/10 bg-black/30 p-2 text-left hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-mono text-cyan-400/40 w-4 shrink-0">{idx + 1}.</span>
                        <span className="text-[11px] font-medium flex-1 truncate">{row.name}</span>
                        <span className="text-[9px] font-mono text-red-400 font-bold shrink-0">
                          {row.neglectIndex.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-muted/20 overflow-hidden mb-1">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground">
                        <span>Sev: <strong className="text-amber-400">{row.severity.toFixed(1)}</strong></span>
                        <span>Funded: <strong className={row.percentFunded < 50 ? "text-red-400" : "text-cyan-400"}>{row.percentFunded}%</strong></span>
                        <span>Gap: <strong className="text-red-400">{formatDollars(row.gap)}</strong></span>
                        {row.offAppealShare > 5 && (
                          <span>Off-appeal: <strong className="text-cyan-400/60">{row.offAppealShare.toFixed(0)}%</strong></span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <Separator className="opacity-20 my-2" />
        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70 px-1">
            Global Humanitarian Overview
          </p>

          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Total Requirements" value={formatDollars(stats.totalRequirements)} className="text-foreground" />
            <StatCard label="Funded (On-appeal)" value={formatDollars(stats.totalFunding)} className="text-cyan-400" />
            <StatCard label="Funded (Off-appeal)" value={formatDollars(stats.totalOffAppealFunding)} className="text-cyan-400" />
            <StatCard label="CBPF Allocations" value={formatDollars(stats.totalCBPFAllocations)} className="text-cyan-400" />
            <StatCard label="% Funded (On-appeal)" value={`${stats.percentFunded}%`} className={stats.percentFunded < 50 ? "text-red-400" : "text-cyan-400"} />
            <StatCard label="% Funded (All)" value={`${stats.percentFundedAll}%`} className={stats.percentFundedAll < 50 ? "text-red-400" : "text-cyan-400"} />
            <StatCard label="Countries in Crisis" value={stats.countriesInCrisis.toString()} className="text-amber-400" />
            <StatCard label="Active Crises" value={stats.activeCrisisCount.toString()} className="text-red-400" />
          </div>

          <div className="rounded border border-red-500/20 bg-red-500/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              <p className="text-[10px] font-mono uppercase tracking-widest text-red-400/70">Global Funding Gap</p>
            </div>
            <p className="text-xl font-bold font-mono text-red-400">{formatDollars(stats.totalRequirements - stats.totalFunding)}</p>
            <Progress value={Math.min(stats.percentFunded, 100)} className="h-1.5" />
            <p className="text-[10px] font-mono text-muted-foreground">
              {stats.percentFunded}% of total requirements funded (on-appeal)
            </p>
            {stats.totalOffAppealFunding > 0 && (
              <p className="text-[10px] font-mono text-muted-foreground">
                + {formatDollars(stats.totalOffAppealFunding)} off-appeal (all: {stats.percentFundedAll}%)
              </p>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

// ── Main App Sidebar ───────────────────────────────────────────────────────────
export default function AppSidebar() {
  const { sidebarTab, setSidebarTab, activeCrisis } = useAppContext();

  return (
    <Sidebar
      side="right"
      collapsible="icon"
      className="border-l border-cyan-500/20 bg-black/90 backdrop-blur-xl"
    >
      {/* Scanline overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-40"
        style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.015) 2px, rgba(0,255,255,0.015) 4px)" }}
      />

      <SidebarHeader className="relative z-10 border-b border-cyan-500/20 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 to-red-800 shadow-[0_0_12px_rgba(220,40,40,0.4)]">
            <Globe2 className="h-4 w-4 text-white" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <h1 className="text-sm font-bold tracking-tight font-mono text-cyan-100">UN Crisis Monitor</h1>
            <p className="text-[10px] font-mono tracking-widest text-cyan-400/50 uppercase">Global Analysis</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="relative z-10 p-0 overflow-hidden flex flex-col">
        {activeCrisis && (
          <div className="mx-3 mt-3 rounded border border-red-500/30 bg-red-500/5 p-2.5 shadow-[0_0_15px_rgba(255,30,30,0.1)] group-data-[collapsible=icon]:hidden shrink-0">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
              <span className="text-[11px] font-mono font-medium text-red-400 truncate">{activeCrisis.crisisName}</span>
            </div>
          </div>
        )}

        <div className="group-data-[collapsible=icon]:hidden flex flex-col flex-1 min-h-0 px-2 pb-2">
          <Tabs
            value={sidebarTab}
            onValueChange={(v) => setSidebarTab(v as "crises" | "countries" | "global")}
            className="flex flex-col flex-1 min-h-0"
          >
            <TabsList className="w-full grid grid-cols-3 h-9 mt-2 bg-black/60 border border-cyan-500/15 shrink-0">
              <TabsTrigger
                value="global"
                className="text-xs font-mono data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300 data-[state=active]:shadow-[0_0_8px_rgba(0,200,255,0.2)] text-cyan-400/50"
              >
                <Globe2 className="h-3.5 w-3.5 mr-1.5" />
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="crises"
                className="text-xs font-mono data-[state=active]:bg-red-500/15 data-[state=active]:text-red-300 data-[state=active]:shadow-[0_0_8px_rgba(255,60,60,0.2)] text-cyan-400/50"
              >
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                Crises
              </TabsTrigger>
              <TabsTrigger
                value="countries"
                className="text-xs font-mono data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300 data-[state=active]:shadow-[0_0_8px_rgba(0,200,255,0.2)] text-cyan-400/50"
              >
                <MapPin className="h-3.5 w-3.5 mr-1.5" />
                Countries
              </TabsTrigger>
            </TabsList>

            <TabsContent value="global" className="flex-1 min-h-0 mt-2 data-[state=inactive]:hidden flex flex-col">
              <GlobalTab />
            </TabsContent>
            <TabsContent value="crises" className="flex-1 min-h-0 mt-2 data-[state=inactive]:hidden flex flex-col">
              <CrisesTab />
            </TabsContent>
            <TabsContent value="countries" className="flex-1 min-h-0 mt-2 data-[state=inactive]:hidden">
              <CountriesTab />
            </TabsContent>
          </Tabs>
        </div>
      </SidebarContent>

      <SidebarFooter className="relative z-10 border-t border-cyan-500/15 p-3 group-data-[collapsible=icon]:hidden shrink-0">
        <p className="text-[10px] font-mono text-cyan-400/30 text-center tracking-widest uppercase">
          OCHA FTS · INFORM · CBPF
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
