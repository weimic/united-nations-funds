"use client";

import { useState, useMemo } from "react";
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
  MapPin,
  ArrowLeft,
  DollarSign,
  BarChart3,
  ChevronRight,
  TrendingDown,
} from "lucide-react";
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
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
  BarChart,
} from "recharts";
import type {
  UnifiedCountryData,
  CrisisData,
  CrisisAllocation,
} from "@/lib/types";
import { formatDollars } from "@/lib/utils";

// ── Helpers ────────────────────────────────────────────────────────────────────

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
        name: c.cluster.length > 14 ? c.cluster.slice(0, 14) + "…" : c.cluster,
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
            margin={{ top: 12, right: 52, bottom: 72, left: 58 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,255,0.07)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: "rgba(0,200,255,0.55)", fontFamily: "monospace" }}
              angle={-42}
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
            Delivery Rate by Cluster
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
  const { getAllCrisesForCountry, setActiveCrisis, setSidebarTab } = useAppContext();
  const sev = country.severity;
  const overall = country.overallFunding;
  const allCrises = getAllCrisesForCountry(country.iso3);

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

          {sev && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400/70" />
                <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
                  INFORM Severity
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className={`text-sm px-2.5 py-0.5 font-bold font-mono ${getSeverityColorClass(sev.severityCategory)}`}>
                  {sev.severityIndex.toFixed(1)}
                </Badge>
                <span className="text-sm text-muted-foreground">{sev.severityCategory}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all bg-gradient-to-r from-blue-500 via-amber-500 to-red-500"
                  style={{ width: `${(sev.severityIndex / 5) * 100}%` }}
                />
              </div>
              {sev.drivers && (
                <p className="text-[10px] text-muted-foreground font-mono">
                  Drivers: {sev.drivers}
                </p>
              )}
            </div>
          )}

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

          {overall && (
            <>
              <Separator className="opacity-20" />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5 text-cyan-400/60" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
                    Overall Funding (FTS)
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Requirements</span>
                    <span className="text-[11px] font-medium font-mono">{formatDollars(overall.totalRequirements)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Funded</span>
                    <span className={`text-[11px] font-medium font-mono ${overall.percentFunded < 50 ? "text-red-400" : "text-cyan-400"}`}>
                      {formatDollars(overall.totalFunding)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Progress value={Math.min(overall.percentFunded, 100)} className="h-1.5 flex-1" />
                    <span className={`text-xs font-bold font-mono ${overall.percentFunded < 50 ? "text-red-400" : "text-cyan-400"}`}>
                      {overall.percentFunded.toFixed(0)}%
                    </span>
                  </div>
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

          {allCrises[0]?.entry.crisisAllocation?.clusters && allCrises[0].entry.crisisAllocation.clusters.length > 0 && (
            <>
              <Separator className="opacity-20" />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
                    CBPF by Cluster
                  </span>
                </div>
                <CBPFClusterChart clusters={allCrises[0].entry.crisisAllocation.clusters} />
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
    const clusterMap = new Map<string, { allocations: number; reached: number; targeted: number }>();
    for (const entry of crisis.countries) {
      const country = data.countries[entry.iso3];
      if (!country?.crisisAllocations) continue;
      for (const cluster of country.crisisAllocations.clusters) {
        const key = cluster.cluster;
        const existing = clusterMap.get(key) ?? { allocations: 0, reached: 0, targeted: 0 };
        existing.allocations += cluster.totalAllocations;
        existing.reached += cluster.reachedPeople;
        existing.targeted += cluster.targetedPeople;
        clusterMap.set(key, existing);
      }
    }
    return [...clusterMap.entries()]
      .sort((a, b) => b[1].allocations - a[1].allocations)
      .slice(0, 8)
      .map(([name, v]) => {
        const costPerTargeted = v.targeted > 0 ? v.allocations / v.targeted : 0;
        const costPerReached = v.reached > 0 ? v.allocations / v.reached : 0;
        return {
          name: name.length > 14 ? name.slice(0, 14) + "…" : name,
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
            margin={{ top: 12, right: 52, bottom: 72, left: 58 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,255,0.07)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: "rgba(0,200,255,0.55)", fontFamily: "monospace" }}
              angle={-42}
              textAnchor="end"
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

// ── Crisis Funding Gap Chart ───────────────────────────────────────────────────
function CrisisFundingGapChart({ crisis }: { crisis: CrisisData }) {
  const chartData = useMemo(() => {
    return crisis.countries
      .filter(c => c.overallFunding && c.overallFunding.totalRequirements > 0)
      .map(c => ({
        name: c.countryName.length > 12 ? c.countryName.slice(0, 12) + "…" : c.countryName,
        percentFunded: Math.round(c.overallFunding!.percentFunded),
        severity: c.severityIndex,
        requirements: Math.round((c.overallFunding?.totalRequirements ?? 0) / 1_000_000),
      }))
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 8);
  }, [crisis]);

  if (chartData.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
        Funding % vs Severity
      </p>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 12, right: 46, bottom: 72, left: 12 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,255,0.07)" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: "rgba(0,200,255,0.55)", fontFamily: "monospace" }}
              angle={-42}
              textAnchor="end"
              interval={0}
              tickLine={false}
              axisLine={{ stroke: "rgba(0,200,255,0.15)" }}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 9, fill: "rgba(0,200,255,0.55)", fontFamily: "monospace" }}
              tickFormatter={(v: number) => `${v}%`}
              tickLine={false}
              axisLine={false}
              width={40}
              domain={[0, 100]}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 9, fill: "rgba(248,113,113,0.6)", fontFamily: "monospace" }}
              tickLine={false}
              axisLine={false}
              width={40}
              domain={[0, 5]}
              label={{ value: "Severity", angle: 90, position: "insideRight", offset: -20, style: { fontSize: 8, fill: "rgba(248,113,113,0.5)", fontFamily: "monospace" } }}
            />
            <Tooltip
              contentStyle={chartTooltipStyle}
              labelStyle={chartLabelStyle}
              formatter={(value: number | string | undefined, name: string | undefined) => {
                if (value === undefined || name === undefined) return ["", name || ""];
                if (name === "percentFunded") return [`${value}%`, "% Funded"];
                if (name === "severity" && typeof value === "number") return [value.toFixed(1), "Severity"];
                if (name === "requirements") return [`$${value}M`, "Requirements"];
                return [value, name];
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 9, fontFamily: "monospace", color: "rgba(0,200,255,0.5)", paddingTop: 4 }}
              iconSize={8}
            />
            <Bar yAxisId="left" dataKey="percentFunded" name="% Funded" fill="#12626e" radius={[3, 3, 0, 0]} opacity={0.85} />
            <Line yAxisId="right" type="monotone" dataKey="severity" name="Severity" stroke="#f87171" strokeWidth={2} dot={{ r: 3, fill: "#f87171" }} />
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
          <CrisisFundingGapChart crisis={crisis} />

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

  // Chart: funding % per crisis in this category
  const crisisChartData = useMemo(() => {
    return crises
      .map((crisis) => {
        const req  = crisis.countries.reduce((s, c) => s + (c.overallFunding?.totalRequirements ?? 0), 0);
        const fund = crisis.countries.reduce((s, c) => s + (c.overallFunding?.totalFunding ?? 0), 0);
        const pct  = req > 0 ? Math.min((fund / req) * 100, 100) : 0;
        const name = crisis.crisisName.length > 16 ? crisis.crisisName.slice(0, 16) + "…" : crisis.crisisName;
        const maxSev = Math.max(...crisis.countries.map((c) => c.severityIndex));
        return { name, pct: Math.round(pct), req: Math.round(req / 1_000_000), fund: Math.round(fund / 1_000_000), severity: maxSev };
      })
      .sort((a, b) => a.pct - b.pct);
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

          {/* Funding % per crisis chart */}
          {crisisChartData.length > 1 && (
            <>
              <Separator className="opacity-20" />
              <div className="space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
                  % Funded vs Max Severity
                </p>
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={crisisChartData}
                      layout="vertical"
                      margin={{ top: 4, right: 48, bottom: 4, left: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,255,0.06)" horizontal={false} />
                      <XAxis
                        type="number"
                        xAxisId="bottom"
                        domain={[0, 100]}
                        tick={{ fontSize: 9, fill: "rgba(0,200,255,0.5)", fontFamily: "monospace" }}
                        tickFormatter={(v) => `${v}%`}
                        tickLine={false}
                        axisLine={{ stroke: "rgba(0,200,255,0.15)" }}
                      />
                      <XAxis
                        type="number"
                        xAxisId="top"
                        orientation="top"
                        domain={[0, 5]}
                        tick={{ fontSize: 9, fill: "rgba(248,113,113,0.6)", fontFamily: "monospace" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 8, fill: "rgba(0,200,255,0.55)", fontFamily: "monospace" }}
                        tickLine={false}
                        axisLine={false}
                        width={70}
                      />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        labelStyle={chartLabelStyle}
                        formatter={(value: number | string | undefined, name: string | undefined) => {
                          if (value === undefined || name === undefined) return ["", name || ""];
                          if (name === "pct") return [`${value}%`, "% Funded"];
                          if (name === "severity" && typeof value === "number") return [value.toFixed(1), "Max Severity"];
                          return [value, name];
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 9, fontFamily: "monospace", color: "rgba(0,200,255,0.5)", paddingTop: 4 }}
                        iconSize={8}
                      />
                      <Bar
                        xAxisId="bottom"
                        dataKey="pct"
                        name="% Funded"
                        radius={[0, 3, 3, 0]}
                        fill="#22d3ee"
                        opacity={0.82}
                      />
                      <Line
                        xAxisId="top"
                        dataKey="severity"
                        name="Severity"
                        type="monotone"
                        stroke="#f87171"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#f87171" }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

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
  const { data, activeCrisis, setActiveCrisis } = useAppContext();
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

  // If a crisis is active, show its detail
  if (activeCrisis) {
    return (
      <CrisisDetailView
        crisis={activeCrisis}
        onBack={() => setActiveCrisis(null)}
      />
    );
  }

  // If a category is selected, show category detail
  if (selectedCategory) {
    return (
      <CategoryDetailView
        category={selectedCategory}
        onBack={() => setSelectedCategory(null)}
      />
    );
  }

  return (
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
  );
}

// ── Countries Tab ──────────────────────────────────────────────────────────────
function CountriesTab() {
  const { data, setSelectedCountryIso3, selectedCountryIso3, getCountry, setGlobeFocusIso3 } = useAppContext();
  const [search, setSearch] = useState("");

  const countryList = useMemo(() => {
    const entries = Object.values(data.countries)
      .filter((c) => c.name && c.iso3 && (c.severity || c.overallFunding || c.crisisAllocations))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter((c) => c.name.toLowerCase().includes(q) || c.iso3.toLowerCase().includes(q));
  }, [data.countries, search]);

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
        <Search className="absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cyan-400/40" />
        <Input
          placeholder="Search countries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 bg-black/40 border-cyan-500/20 text-sm h-9 font-mono placeholder:text-cyan-400/30 focus:border-cyan-500/50"
        />
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

// ── Scatter Tooltip ──────────────────────────────────────────────────────────
function ScatterTooltip({ active, payload }: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as {
    name: string;
    severity: number;
    percentFunded: number;
    percentFundedAll: number;
    requirements: number;
    fundedOnAppeal: number;
    fundedOffAppeal: number;
    planLineCount: number;
  } | undefined;
  if (!d) return null;
  return (
    <div style={chartTooltipStyle}>
      <p style={{ color: "rgba(0,220,255,0.95)", fontWeight: 700, marginBottom: 4 }}>{d.name}</p>
      <p style={{ color: "rgba(0,200,255,0.75)", fontSize: 10, fontFamily: "monospace" }}>
        Severity: {d.severity.toFixed(1)}
      </p>
      <p style={{ color: "rgba(248,113,113,0.9)", fontSize: 10, fontFamily: "monospace" }}>
        % Funded (on-appeal): {d.percentFunded}%
      </p>
      {d.fundedOffAppeal > 0 && (
        <p style={{ color: "rgba(0,200,255,0.6)", fontSize: 10, fontFamily: "monospace" }}>
          Off-appeal: ${d.fundedOffAppeal}M (all-rows: {d.percentFundedAll}%)
        </p>
      )}
      <p style={{ color: "rgba(0,200,255,0.55)", fontSize: 10, fontFamily: "monospace" }}>
        Requirements: ${d.requirements}M
      </p>
      <p style={{ color: "rgba(0,200,255,0.4)", fontSize: 10, fontFamily: "monospace" }}>
        Funded (on-appeal): ${d.fundedOnAppeal}M
      </p>
      {d.planLineCount > 0 && (
        <p style={{ color: "rgba(0,200,255,0.35)", fontSize: 9, fontFamily: "monospace" }}>
          {d.planLineCount} plan line{d.planLineCount !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

// ── Global Tab ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded border border-cyan-500/15 bg-black/40 p-3">
      <p className="text-[9px] font-mono uppercase tracking-widest text-cyan-400/60 mb-1.5">{label}</p>
      <p className={`text-sm font-bold font-mono ${className}`}>{value}</p>
    </div>
  );
}

function GlobalTab() {
  const { data, setSelectedCountryIso3, setSidebarTab, setGlobeFocusIso3 } = useAppContext();
  const stats = data.globalStats;

  // Top 10 funding gaps stacked bar data
  const fundingGapData = useMemo(() => {
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
          totalGap: Math.round((of_.totalRequirements - of_.totalFunding) / 1_000_000),
        };
      })
      .sort((a, b) => b.totalGap - a.totalGap)
      .slice(0, 10);
  }, [data.countries]);

  const scatterData = useMemo(() => {
    return Object.values(data.countries)
      .filter(c => c.severity && c.overallFunding && c.overallFunding.totalRequirements > 0)
      .map(c => {
        const reqM = c.overallFunding!.totalRequirements / 1_000_000;
        return {
          name: c.name,
          severity: c.severity!.severityIndex,
          percentFunded: Math.round(c.overallFunding!.percentFunded),
          percentFundedAll: Math.round(c.overallFunding!.percentFundedAll),
          requirements: Math.round(reqM),
          // Log-scale for bubble sizing so small/medium crises remain visible
          logRequirements: Math.log10(1 + reqM),
          fundedOnAppeal: Math.round(c.overallFunding!.totalFunding / 1_000_000),
          fundedOffAppeal: Math.round(c.overallFunding!.offAppealFunding / 1_000_000),
          planLineCount: c.overallFunding!.planLines?.length ?? 0,
        };
      });
  }, [data.countries]);

  // Underlooked crises table: Neglect Index v2 ranking
  const neglectRanking = useMemo(() => {
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

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-3 space-y-3">
        <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70 px-1">
          Global Humanitarian Overview
        </p>

        <div className="grid grid-cols-2 gap-2">
          <StatCard label="Total Requirements" value={formatDollars(stats.totalRequirements)} className="text-foreground" />
          <StatCard label="Funded (On-appeal)" value={formatDollars(stats.totalFunding)} className="text-cyan-400" />
          <StatCard label="Funded (Off-appeal)" value={formatDollars(stats.totalOffAppealFunding)} className="text-cyan-400" />
          <StatCard label="CBPF Allocations" value={formatDollars(stats.totalCBPFAllocations)} className="text-cyan-400" />
          <StatCard label="% Funded (On-appeal)" value={`${stats.percentFunded}%`} className={stats.percentFunded < 50 ? "text-red-400" : "text-cyan-400"} />
          <StatCard label="% Funded (All rows)" value={`${stats.percentFundedAll}%`} className={stats.percentFundedAll < 50 ? "text-red-400" : "text-cyan-400"} />
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
              + {formatDollars(stats.totalOffAppealFunding)} off-appeal (all-rows: {stats.percentFundedAll}%)
            </p>
          )}
        </div>

        {/* ── Top 10 Absolute Funding Gaps ─────────────────────────────────── */}
        {fundingGapData.length > 0 && (
          <>
            <Separator className="opacity-20 my-2" />
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70 px-1">
                Top 10 Absolute Funding Gaps
              </p>
              <p className="text-[9px] font-mono text-muted-foreground px-1 leading-tight">
                Where the most money is missing. Each bar shows funded (on-appeal), funded (off-appeal), and the remaining gap.
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

        {/* ── Severity vs Funding Scatter ──────────────────────────────────── */}
        {scatterData.length > 0 && (
          <>
            <Separator className="opacity-20 my-2" />
            <div className="space-y-2">
              <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70 px-1">
                Severity vs Funding Disparity
              </p>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 12, right: 16, bottom: 36, left: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,255,0.07)" />
                    <XAxis
                      type="number"
                      dataKey="severity"
                      name="Severity"
                      domain={[0, 5]}
                      tick={{ fontSize: 9, fill: "rgba(0,200,255,0.55)", fontFamily: "monospace" }}
                      tickLine={false}
                      axisLine={{ stroke: "rgba(0,200,255,0.15)" }}
                      label={{
                        value: "INFORM Severity →",
                        position: "insideBottom",
                        offset: -22,
                        style: { fontSize: 9, fill: "rgba(0,200,255,0.5)", fontFamily: "monospace" },
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="percentFunded"
                      name="% Funded"
                      domain={[0, 100]}
                      width={48}
                      tick={{ fontSize: 9, fill: "rgba(0,200,255,0.55)", fontFamily: "monospace" }}
                      tickFormatter={(v) => `${v}%`}
                      tickLine={false}
                      axisLine={false}
                      label={{
                        value: "% Funded (on-appeal)",
                        angle: -90,
                        position: "insideLeft",
                        offset: 8,
                        style: { fontSize: 8, fill: "rgba(0,200,255,0.5)", fontFamily: "monospace", textAnchor: "middle" },
                      }}
                    />
                    {/* Log-scale bubble size so small/medium crises remain visible */}
                    <ZAxis type="number" dataKey="logRequirements" range={[30, 450]} name="Requirements (log scale)" />
                    {/* Reference lines for decision-grade reading */}
                    <ReferenceLine x={3.5} stroke="rgba(248,113,113,0.3)" strokeDasharray="4 3" label={{ value: "High Severity", position: "top", style: { fontSize: 7, fill: "rgba(248,113,113,0.5)", fontFamily: "monospace" } }} />
                    <ReferenceLine y={50} stroke="rgba(34,211,238,0.3)" strokeDasharray="4 3" label={{ value: "50% Funded", position: "right", style: { fontSize: 7, fill: "rgba(34,211,238,0.5)", fontFamily: "monospace" } }} />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3", stroke: "rgba(0,200,255,0.25)" }}
                      content={<ScatterTooltip />}
                    />
                    <Scatter
                      data={scatterData}
                      fill="#f87171"
                      fillOpacity={0.65}
                      stroke="#b91c1c"
                      strokeWidth={1}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[9px] font-mono text-muted-foreground px-1 leading-tight">
                Bubble size = requirements (log scale). Bottom-right quadrant = high severity, low funding — the most neglected crises.
              </p>
            </div>
          </>
        )}

        {/* ── Underlooked Crises Table ─────────────────────────────────────── */}
        {neglectRanking.length > 0 && (
          <>
            <Separator className="opacity-20 my-2" />
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                <p className="text-[10px] font-mono uppercase tracking-widest text-red-400/70">
                  Underlooked Crises (Severity-Adjusted)
                </p>
              </div>
              <p className="text-[9px] font-mono text-muted-foreground px-1 leading-tight">
                Ranked by Neglect Index: combines severity, funding gap, and crisis scale. Higher = more underlooked.
              </p>
              <div className="space-y-1">
                {neglectRanking.map((row, idx) => {
                  const barWidth = neglectRanking[0].neglectIndex > 0
                    ? (row.neglectIndex / neglectRanking[0].neglectIndex) * 100
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
              <TabsTrigger
                value="global"
                className="text-xs font-mono data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300 data-[state=active]:shadow-[0_0_8px_rgba(0,200,255,0.2)] text-cyan-400/50"
              >
                <Globe2 className="h-3.5 w-3.5 mr-1.5" />
                Global
              </TabsTrigger>
            </TabsList>

            <TabsContent value="crises" className="flex-1 min-h-0 mt-2 data-[state=inactive]:hidden flex flex-col">
              <CrisesTab />
            </TabsContent>
            <TabsContent value="countries" className="flex-1 min-h-0 mt-2 data-[state=inactive]:hidden">
              <CountriesTab />
            </TabsContent>
            <TabsContent value="global" className="flex-1 min-h-0 mt-2 data-[state=inactive]:hidden flex flex-col">
              <GlobalTab />
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
