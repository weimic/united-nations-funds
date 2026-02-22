"use client";

import { useState, useMemo } from "react";
import { useAppContext } from "@/lib/app-context";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  ArrowLeft,
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
  BarChart,
} from "recharts";
import { formatDollars } from "@/lib/utils";
import { CHART_TOOLTIP_STYLE, CHART_LABEL_STYLE } from "@/lib/constants";
import { HoverTip } from "@/components/shared/HoverTip";
import { StatCard } from "@/components/shared/StatCard";

/** The "Overview" tab — global humanitarian stats, funding gaps, neglect rankings. */
export function OverviewTab() {
  const { data, setSelectedCountryIso3, setSidebarTab, setGlobeFocusIso3, setActiveCrisis, setNavigationSource, setCountryDetailSource } =
    useAppContext();
  const stats = data.globalStats;
  const [globalView, setGlobalView] = useState<
    "main" | "funding-gap-all" | "underlooked-crises-all" | "underlooked-countries-all"
  >("main");

  // ── Derived data ───────────────────────────────────────────────────────────

  const fundingGapAllData = useMemo(() => {
    return Object.values(data.countries)
      .filter((c) => c.overallFunding && c.overallFunding.totalRequirements > 0)
      .map((c) => {
        const of_ = c.overallFunding!;
        const gap = Math.max(0, of_.totalRequirements - of_.totalFundingAll);
        return {
          iso3: c.iso3,
          name: c.name.length > 14 ? c.name.slice(0, 14) + "…" : c.name,
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

  const neglectCountryAllRanking = useMemo(() => {
    return Object.values(data.countries)
      .filter(
        (c) => c.severity && c.overallFunding && c.overallFunding.totalRequirements > 0,
      )
      .map((c) => {
        const sev = c.severity!.severityIndex;
        const pctFunded = c.overallFunding!.percentFunded / 100;
        const reqM = c.overallFunding!.totalRequirements / 1_000_000;
        const neglectIndex = (sev / 5) * (1 - pctFunded) * Math.log10(1 + reqM);
        const gap = c.overallFunding!.totalRequirements - c.overallFunding!.totalFunding;
        const offAppealShare =
          c.overallFunding!.totalFundingAll > 0
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
      .sort((a, b) => b.neglectIndex - a.neglectIndex);
  }, [data.countries]);

  const neglectCountryRanking = neglectCountryAllRanking.slice(0, 10);

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
        const maxSeverity = crisis.countries.reduce(
          (m, c) => Math.max(m, c.severityIndex || 0),
          0,
        );
        const avgSeverity =
          crisis.countries.length > 0
            ? crisis.countries.reduce((s, c) => s + (c.severityIndex || 0), 0) /
              crisis.countries.length
            : 0;
        const percentFunded =
          totalRequirements > 0 ? (totalFunding / totalRequirements) * 100 : 0;
        const requirementsM = totalRequirements / 1_000_000;
        const neglectIndex =
          (maxSeverity / 5) * (1 - percentFunded / 100) * Math.log10(1 + requirementsM);
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
      .filter(
        (row) =>
          row.totalRequirements > 0 &&
          row.maxSeverity > 0 &&
          Number.isFinite(row.neglectIndex),
      )
      .sort((a, b) => b.neglectIndex - a.neglectIndex);
  }, [data.crises]);

  const neglectCrisisRanking = neglectCrisisAllRanking.slice(0, 10);

  // ── Sub-views ──────────────────────────────────────────────────────────────

  if (globalView === "funding-gap-all") {
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
          <span className="text-[11px] font-mono text-cyan-300/80 truncate">
            All Absolute Funding Gaps
          </span>
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
                    setCountryDetailSource("overview");
                    setSidebarTab("countries");
                  }}
                  className="w-full rounded border border-cyan-500/10 bg-black/30 p-2 text-left hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-mono text-cyan-400/40 w-5 shrink-0">
                      {idx + 1}.
                    </span>
                    <span className="text-[11px] font-medium flex-1 truncate">
                      {row.fullName}
                    </span>
                    <span className="text-[9px] font-mono text-red-400 font-bold shrink-0">
                      Gap:{" "}
                      {row.gap >= 1000
                        ? `$${(row.gap / 1000).toFixed(2)}B`
                        : `$${row.gap}M`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/20 overflow-hidden flex">
                    {onPct > 0 && (
                      <div className="h-full bg-cyan-500" style={{ width: `${onPct}%` }} />
                    )}
                    {offPct > 0 && (
                      <div className="h-full bg-cyan-800" style={{ width: `${offPct}%` }} />
                    )}
                    <div
                      className="h-full bg-red-500"
                      style={{ width: `${Math.max(0, 100 - onPct - offPct)}%` }}
                    />
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
          <span className="text-[11px] font-mono text-red-300/80 truncate">
            All Overlooked Crises
          </span>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 space-y-1">
            {neglectCrisisAllRanking.map((row, idx) => (
              <button
                key={row.crisisId}
                onClick={() => {
                  const crisis =
                    data.crises.find((c) => c.crisisId === row.crisisId) || null;
                  setActiveCrisis(crisis);
                  setNavigationSource("overview");
                  setSidebarTab("crises");
                }}
                className="w-full rounded border border-red-500/10 bg-black/30 p-2 text-left hover:border-red-500/30 hover:bg-red-500/5 transition-all"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-mono text-cyan-400/40 w-5 shrink-0">
                    {idx + 1}.
                  </span>
                  <span className="text-[11px] font-medium flex-1 truncate">
                    {row.crisisName}
                  </span>
                  <span className="text-[9px] font-mono text-red-400 font-bold shrink-0">
                    {row.neglectIndex.toFixed(2)}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-muted/30 overflow-hidden mb-1">
                  <div
                    className="h-full rounded-full bg-red-500"
                    style={{
                      width: `${neglectCrisisAllRanking[0]?.neglectIndex ? (row.neglectIndex / neglectCrisisAllRanking[0].neglectIndex) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground flex-wrap">
                  <span>
                    Severity:{" "}
                    <strong className="text-amber-400">
                      {row.maxSeverity.toFixed(1)}
                    </strong>
                  </span>
                  <span>
                    Funded:{" "}
                    <strong className="text-amber-400">
                      {row.percentFunded.toFixed(0)}%
                    </strong>
                  </span>
                  <span>
                    Gap: <strong className="text-amber-400">{formatDollars(row.gap)}</strong>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  if (globalView === "underlooked-countries-all") {
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
          <span className="text-[11px] font-mono text-red-300/80 truncate">
            All Overlooked Countries
          </span>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 space-y-1">
            {neglectCountryAllRanking.map((row, idx) => (
              <button
                key={row.iso3}
                onClick={() => {
                  setSelectedCountryIso3(row.iso3);
                  setGlobeFocusIso3(row.iso3);
                  setCountryDetailSource("overview");
                  setSidebarTab("countries");
                }}
                className="w-full rounded border border-cyan-500/10 bg-black/30 p-2 text-left hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-mono text-cyan-400/40 w-5 shrink-0">
                    {idx + 1}.
                  </span>
                  <span className="text-[11px] font-medium flex-1 truncate">
                    {row.name}
                  </span>
                  <span className="text-[9px] font-mono text-red-400 font-bold shrink-0">
                    {row.neglectIndex.toFixed(2)}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-muted/30 overflow-hidden mb-1">
                  <div
                    className="h-full rounded-full bg-red-500"
                    style={{
                      width: `${neglectCountryAllRanking[0]?.neglectIndex ? (row.neglectIndex / neglectCountryAllRanking[0].neglectIndex) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground">
                  <span>
                    Severity:{" "}
                    <strong className="text-amber-400">{row.severity.toFixed(1)}</strong>
                  </span>
                  <span>
                    Funded:{" "}
                    <strong className="text-amber-400">
                      {row.percentFunded}%
                    </strong>
                  </span>
                  <span>
                    Gap:{" "}
                    <strong className="text-amber-400">{formatDollars(row.gap)}</strong>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // ── Main overview ──────────────────────────────────────────────────────────

  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="p-3 space-y-3">
        {/* Overlooked Crises */}
        {neglectCrisisRanking.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                <HoverTip tip="Crises receiving the least global attention relative to their severity and scale. Higher score = greater mismatch between need and funding.">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-red-400/70">
                    Top 10 Overlooked Crises
                  </p>
                </HoverTip>
              </div>
              <button
                onClick={() => setGlobalView("underlooked-crises-all")}
                className="text-[10px] font-mono text-cyan-400/70 hover:text-cyan-300 underline underline-offset-2"
              >
                Show all
              </button>
            </div>
            <p className="text-[9px] font-mono text-muted-foreground px-1 leading-tight">
              Aggregated by crisis across affected countries. Click a row to open the crisis
              detail view.
            </p>
            <div className="space-y-1">
              {neglectCrisisRanking.map((row, idx) => {
                const barWidth =
                  neglectCrisisRanking[0].neglectIndex > 0
                    ? (row.neglectIndex / neglectCrisisRanking[0].neglectIndex) * 100
                    : 0;
                const cats = (row.categories || []).slice(0, 2);
                return (
                  <button
                    key={row.crisisId}
                    onClick={() => {
                      const crisis =
                        data.crises.find((c) => c.crisisId === row.crisisId) || null;
                      setActiveCrisis(crisis);
                      setNavigationSource("overview");
                      setSidebarTab("crises");
                    }}
                    className="w-full rounded border border-red-500/10 bg-black/30 p-2 text-left hover:border-red-500/30 hover:bg-red-500/5 transition-all"
                  >
                    <div className="flex items-start gap-2 mb-1">
                      <span className="text-[9px] font-mono text-cyan-400/40 w-4 shrink-0">
                        {idx + 1}.
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium leading-tight truncate">
                            {row.crisisName}
                          </span>
                          <span className="text-[9px] font-mono text-red-400 font-bold shrink-0">
                            {row.neglectIndex.toFixed(2)}
                          </span>
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
                    <div className="h-1 rounded-full bg-muted/30 overflow-hidden mb-1">
                      <div
                        className="h-full rounded-full bg-red-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground flex-wrap">
                      <span>
                        Severity:{" "}
                        <strong className="text-amber-400">
                          {row.maxSeverity.toFixed(1)}
                        </strong>
                      </span>
                      <span>
                        Funded:{" "}
                        <strong className="text-amber-400">
                          {row.percentFunded.toFixed(0)}%
                        </strong>
                      </span>
                      <span>
                        Gap: <strong className="text-amber-400">{formatDollars(row.gap)}</strong>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Top 10 Absolute Funding Gaps */}
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
                  className="text-[10px] font-mono text-cyan-400/70 hover:text-cyan-300 underline underline-offset-2"
                >
                  Show all
                </button>
              </div>
              <p className="text-[9px] font-mono text-muted-foreground px-1 leading-tight">
                Countries with the largest unmet need after all funding (on-appeal + off-appeal).
                Each bar shows funded on-appeal, off-appeal, and remaining gap.
              </p>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={fundingGapData}
                    layout="vertical"
                    margin={{ top: 4, right: 12, bottom: 4, left: 6 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(0,255,255,0.06)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tick={{
                        fontSize: 8,
                        fill: "rgba(0,200,255,0.5)",
                        fontFamily: "monospace",
                      }}
                      tickFormatter={(v: number) =>
                        v === 0 ? "$0" : v >= 1000 ? `$${(v / 1000).toFixed(0)}B` : `$${v}M`
                      }
                      tickLine={false}
                      axisLine={{ stroke: "rgba(0,200,255,0.15)" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{
                        fontSize: 8,
                        fill: "rgba(0,200,255,0.6)",
                        fontFamily: "monospace",
                      }}
                      tickLine={false}
                      axisLine={false}
                      width={78}
                    />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={CHART_LABEL_STYLE}
                      separator=": "
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      itemSorter={(item: any) => {
                        const order: Record<string, number> = {
                          "Funded (on-appeal)": 0,
                          "Funded (off-appeal)": 1,
                          "Unfunded Gap": 2,
                        };
                        return order[item.name as string] ?? 99;
                      }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any, name: any) => {
                        const v =
                          typeof value === "number"
                            ? value
                            : parseFloat(String(value ?? 0));
                        return [
                          v >= 1000 ? `$${(v / 1000).toFixed(2)}B` : `$${v}M`,
                          name,
                        ];
                      }}
                    />
                    <Legend
                      wrapperStyle={{
                        fontSize: 8,
                        fontFamily: "monospace",
                        color: "rgba(0,200,255,0.5)",
                        paddingTop: 4,
                      }}
                      iconSize={8}
                      content={() => {
                        const items: { label: string; color: string }[] = [
                          { label: "Funded (on-appeal)", color: "#22d3ee" },
                          { label: "Funded (off-appeal)", color: "#0e7490" },
                          { label: "Unfunded Gap", color: "#ef4444" },
                        ];
                        return (
                          <div className="flex items-center justify-center gap-3 pt-1">
                            {items.map((item) => (
                              <span key={item.label} className="flex items-center gap-1">
                                <span
                                  className="inline-block w-2 h-2 shrink-0"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span
                                  style={{
                                    fontSize: 8,
                                    fontFamily: "monospace",
                                    color: "rgba(0,200,255,0.5)",
                                  }}
                                >
                                  {item.label}
                                </span>
                              </span>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="onAppeal"
                      name="Funded (on-appeal)"
                      stackId="a"
                      fill="#22d3ee"
                      radius={0}
                      opacity={0.85}
                    />
                    <Bar
                      dataKey="offAppeal"
                      name="Funded (off-appeal)"
                      stackId="a"
                      fill="#0e7490"
                      radius={0}
                      opacity={0.7}
                    />
                    <Bar
                      dataKey="gap"
                      name="Unfunded Gap"
                      stackId="a"
                      fill="#ef4444"
                      radius={[0, 3, 3, 0]}
                      opacity={0.75}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {/* Overlooked Countries Table */}
        {neglectCountryRanking.length > 0 && (
          <>
            <Separator className="opacity-20 my-2" />
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                  <HoverTip tip="Countries where crisis severity is high but funding falls short. Ranked by a composite of severity, funding gap, and scale of need.">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-red-400/70">
                      Top 10 Overlooked Countries
                    </p>
                  </HoverTip>
                </div>
                <button
                  onClick={() => setGlobalView("underlooked-countries-all")}
                  className="text-[10px] font-mono text-cyan-400/70 hover:text-cyan-300 underline underline-offset-2"
                >
                  Show all
                </button>
              </div>
              <p className="text-[9px] font-mono text-muted-foreground px-1 leading-tight">
                Ranked by Neglect Index: combines severity, underfunding, and scale. Higher = more
                overlooked.
              </p>
              <div className="space-y-1">
                {neglectCountryRanking.map((row, idx) => {
                  const barWidth =
                    neglectCountryRanking[0].neglectIndex > 0
                      ? (row.neglectIndex / neglectCountryRanking[0].neglectIndex) * 100
                      : 0;
                  return (
                    <button
                      key={row.iso3}
                      onClick={() => {
                        setSelectedCountryIso3(row.iso3);
                        setGlobeFocusIso3(row.iso3);
                        setCountryDetailSource("overview");
                        setSidebarTab("countries");
                      }}
                      className="w-full rounded border border-cyan-500/10 bg-black/30 p-2 text-left hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-mono text-cyan-400/40 w-4 shrink-0">
                          {idx + 1}.
                        </span>
                        <span className="text-[11px] font-medium flex-1 truncate">
                          {row.name}
                        </span>
                        <span className="text-[9px] font-mono text-red-400 font-bold shrink-0">
                          {row.neglectIndex.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-muted/30 overflow-hidden mb-1">
                        <div
                          className="h-full rounded-full bg-red-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground">
                        <span>
                          Severity:{" "}
                          <strong className="text-amber-400">{row.severity.toFixed(1)}</strong>
                        </span>
                        <span>
                          Funded:{" "}
                          <strong className="text-amber-400">
                            {row.percentFunded}%
                          </strong>
                        </span>
                        <span>
                          Gap:{" "}
                          <strong className="text-amber-400">{formatDollars(row.gap)}</strong>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Global Humanitarian Overview */}
        <Separator className="opacity-20 my-2" />
        <div className="space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70 px-1">
            Global Humanitarian Overview
          </p>

          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label="Total Requirements"
              value={formatDollars(stats.totalRequirements)}
              className="text-foreground"
            />
            <StatCard
              label="Funded (On-appeal)"
              value={formatDollars(stats.totalFunding)}
              className="text-cyan-400"
            />
            <StatCard
              label="Funded (Off-appeal)"
              value={formatDollars(stats.totalOffAppealFunding)}
              className="text-cyan-400"
            />
            <StatCard
              label="CBPF Allocations"
              value={formatDollars(stats.totalCBPFAllocations)}
              className="text-cyan-400"
            />
            <StatCard
              label="% Funded (On-appeal)"
              value={`${stats.percentFunded}%`}
              className={stats.percentFunded < 50 ? "text-red-400" : "text-cyan-400"}
            />
            <StatCard
              label="% Funded (All)"
              value={`${stats.percentFundedAll}%`}
              className={stats.percentFundedAll < 50 ? "text-red-400" : "text-cyan-400"}
            />
            <StatCard
              label="Countries in Crisis"
              value={stats.countriesInCrisis.toString()}
              className="text-amber-400"
            />
            <StatCard
              label="Active Crises"
              value={stats.activeCrisisCount.toString()}
              className="text-red-400"
            />
          </div>

          <div className="rounded border border-red-500/20 bg-red-500/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              <p className="text-[10px] font-mono uppercase tracking-widest text-red-400/70">
                Global Funding Gap
              </p>
            </div>
            <p className="text-xl font-bold font-mono text-red-400">
              {formatDollars(stats.totalRequirements - stats.totalFunding)}
            </p>
            <Progress value={Math.min(stats.percentFunded, 100)} className="h-1.5" />
            <p className="text-[10px] font-mono text-muted-foreground">
              {stats.percentFunded}% of total requirements funded (on-appeal)
            </p>
            {stats.totalOffAppealFunding > 0 && (
              <p className="text-[10px] font-mono text-muted-foreground">
                + {formatDollars(stats.totalOffAppealFunding)} off-appeal (all:{" "}
                {stats.percentFundedAll}%)
              </p>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
