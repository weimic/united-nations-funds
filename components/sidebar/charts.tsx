"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  BarChart,
  LineChart,
  ReferenceLine,
} from "recharts";
import type { CrisisAllocation, CrisisData } from "@/lib/types";
import { useAppContext } from "@/lib/app-context";
import { CHART_TOOLTIP_STYLE, CHART_LABEL_STYLE } from "@/lib/constants";

// ── CBPF Cluster Chart (for country detail) — dual charts ───────────────────

type CountryClusterRow = {
  name: string;
  fullName: string;
  cbpf: number;
  targeted: number;
  reached: number;
};

export function CBPFClusterChart({ clusters }: { clusters: CrisisAllocation[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const handleMouseMove = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (state: any) => {
      if (state && state.activeTooltipIndex != null) {
        setActiveIndex(state.activeTooltipIndex);
      }
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  if (!clusters || clusters.length === 0) return null;

  const sortedClusters = [...clusters].sort(
    (a, b) => b.totalAllocations - a.totalAllocations,
  );

  const chartData: CountryClusterRow[] = sortedClusters.slice(0, 8).map((c) => ({
    name: c.cluster.length > 14 ? c.cluster.slice(0, 14) + "…" : c.cluster,
    fullName: c.cluster,
    cbpf: Math.round(c.totalAllocations),
    targeted: c.targetedPeople,
    reached: c.reachedPeople,
  }));

  const activeLabel = activeIndex != null && activeIndex < chartData.length
    ? chartData[activeIndex].name
    : null;

  return (
    <div className="space-y-4">
      {/* CBPF Funding bar chart */}
      <div className="space-y-2">
        <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
          CBPF Funding
        </p>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 12, bottom: 44, left: 52 }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,255,0.07)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={<WrappingTick data={chartData} />}
                interval={0}
                tickLine={false}
                axisLine={{ stroke: "rgba(0,200,255,0.15)" }}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "rgba(0,200,255,0.55)", fontFamily: "monospace" }}
                tickFormatter={(v: number) => {
                  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
                  return `$${v.toLocaleString()}`;
                }}
                tickLine={false}
                axisLine={false}
                width={56}
                label={{
                  value: "CBPF ($)",
                  angle: 0,
                  position: "insideTopLeft",
                  offset: 0,
                  dy: -14,
                  style: { fontSize: 8, fill: "rgba(34,211,238,0.5)", fontFamily: "monospace" },
                }}
              />
              {activeLabel && (
                <ReferenceLine x={activeLabel} stroke="rgba(255,255,255,0.5)" strokeWidth={1} strokeDasharray="3 3" />
              )}
              <Tooltip
                cursor={false}
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={CHART_LABEL_STYLE}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(_label: any, payload: any) =>
                  payload?.[0]?.payload?.fullName ?? _label
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [`$${Number(value ?? 0).toLocaleString()}`, "CBPF"]}
              />
              <Bar
                dataKey="cbpf"
                name="CBPF"
                fill="#22d3ee"
                radius={[3, 3, 0, 0]}
                opacity={0.85}
                activeBar={{ fill: "#67e8f9", opacity: 1 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Targeted vs Reached line chart */}
      <div className="space-y-2">
        <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
          Targeted vs Reached
        </p>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 36, bottom: 44, left: 52 }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,255,0.07)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={<WrappingTick data={chartData} />}
                interval={0}
                tickLine={false}
                axisLine={{ stroke: "rgba(0,200,255,0.15)" }}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "rgba(0,200,255,0.55)", fontFamily: "monospace" }}
                tickFormatter={(v: number) => {
                  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
                  return String(v);
                }}
                tickLine={false}
                axisLine={false}
                width={48}
                label={{
                  value: "People",
                  angle: 0,
                  position: "insideTopLeft",
                  offset: 0,
                  dy: -14,
                  style: { fontSize: 8, fill: "rgba(34,211,238,0.5)", fontFamily: "monospace" },
                }}
              />
              {activeLabel && (
                <ReferenceLine x={activeLabel} stroke="rgba(255,255,255,0.5)" strokeWidth={1} strokeDasharray="3 3" />
              )}
              <Tooltip
                cursor={false}
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={CHART_LABEL_STYLE}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                itemSorter={(item: any) => (String(item.name).toLowerCase() === "targeted" ? -1 : 1)}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(_label: any, payload: any) =>
                  payload?.[0]?.payload?.fullName ?? _label
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => {
                  const v = Number(value ?? 0);
                  const label = String(name).toLowerCase() === "targeted" ? "Targeted" : "Reached";
                  return [v.toLocaleString(), label];
                }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: 9,
                  fontFamily: "monospace",
                  color: "rgba(0,200,255,0.5)",
                  paddingTop: 4,
                }}
                iconSize={8}
              />
              <Line
                type="linear"
                dataKey="targeted"
                name="Targeted"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 3, fill: "#22c55e" }}
              />
              <Line
                type="linear"
                dataKey="reached"
                name="Reached"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 3, fill: "#ef4444" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

}

// ── Crisis Reach Chart (for crisis detail) ──────────────────────────────────

type CrisisClusterRow = {
  name: string;
  fullName: string;
  cbpf: number;
  targeted: number;
  reached: number;
};

/**
 * Wrapping X-axis tick for CBPF-related charts.
 * Renders labels horizontally, splitting into up to 2 lines.
 * If the second line exceeds the character budget, it is truncated with "…".
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function WrappingTick({ x, y, payload, data }: any) {
  const full =
    (data as CrisisClusterRow[]).find((d) => d.name === payload?.value)?.fullName ??
    payload?.value ??
    "";

  const MAX_LINE_CHARS = 12;
  const words = full.split(/[\s/]+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (currentLine.length + (currentLine ? 1 : 0) + word.length <= MAX_LINE_CHARS) {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  // Collapse to at most 2 lines
  let displayLines: string[];
  if (lines.length <= 2) {
    displayLines = lines;
  } else {
    displayLines = [lines[0], lines.slice(1).join(" ")];
  }

  // Truncate second line if too long
  if (displayLines[1] && displayLines[1].length > MAX_LINE_CHARS) {
    displayLines[1] = displayLines[1].slice(0, MAX_LINE_CHARS - 1) + "…";
  }

  return (
    <g transform={`translate(${x},${y})`}>
      <title>{full}</title>
      {displayLines.map((line, i) => (
        <text
          key={i}
          x={0}
          y={0}
          dy={10 + i * 11}
          textAnchor="middle"
          fontSize={8}
          fill="rgba(0,200,255,0.55)"
          fontFamily="monospace"
        >
          {line}
        </text>
      ))}
    </g>
  );
}

export function CrisisReachChart({ crisis }: { crisis: CrisisData }) {
  const { data } = useAppContext();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const handleMouseMove = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (state: any) => {
      if (state && state.activeTooltipIndex != null) {
        setActiveIndex(state.activeTooltipIndex);
      }
    },
    [],
  );

  const handleMouseLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  const chartData: CrisisClusterRow[] = useMemo(() => {
    const clusterMap = new Map<
      string,
      { allocations: number; reached: number; targetedPeople: number }
    >();
    for (const entry of crisis.countries) {
      const country = data.countries[entry.iso3];
      if (!country?.crisisAllocations) continue;
      for (const cluster of country.crisisAllocations.clusters) {
        const key = cluster.cluster;
        const existing = clusterMap.get(key) ?? {
          allocations: 0,
          reached: 0,
          targetedPeople: 0,
        };
        existing.allocations += cluster.totalAllocations;
        existing.reached += cluster.reachedPeople;
        existing.targetedPeople += cluster.targetedPeople;
        clusterMap.set(key, existing);
      }
    }
    return [...clusterMap.entries()]
      .sort((a, b) => b[1].allocations - a[1].allocations)
      .map(([k, v]) => {
        const name = k.length > 14 ? k.slice(0, 14) + "…" : k;
        return {
          name,
          fullName: k,
          cbpf: Math.round(v.allocations),
          targeted: v.targetedPeople,
          reached: v.reached,
        };
      });
  }, [crisis, data.countries]);

  if (chartData.length === 0) return null;

  const activeLabel = activeIndex != null && activeIndex < chartData.length
    ? chartData[activeIndex].name
    : null;

  return (
    <div className="space-y-4">
      {/* CBPF Funding bar chart */}
      <div className="space-y-2">
        <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
          CBPF Funding
        </p>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 8, right: 12, bottom: 44, left: 52 }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,255,0.07)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={<WrappingTick data={chartData} />}
                interval={0}
                tickLine={false}
                axisLine={{ stroke: "rgba(0,200,255,0.15)" }}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "rgba(0,200,255,0.55)", fontFamily: "monospace" }}
                tickFormatter={(v: number) => {
                  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
                  return `$${v.toLocaleString()}`;
                }}
                tickLine={false}
                axisLine={false}
                width={56}
                label={{
                  value: "CBPF ($)",
                  angle: 0,
                  position: "insideTopLeft",
                  offset: 0,
                  dy: -14,
                  style: { fontSize: 8, fill: "rgba(34,211,238,0.5)", fontFamily: "monospace" },
                }}
              />
              {activeLabel && (
                <ReferenceLine x={activeLabel} stroke="rgba(255,255,255,0.5)" strokeWidth={1} strokeDasharray="3 3" />
              )}
              <Tooltip
                cursor={false}
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={CHART_LABEL_STYLE}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(_label: any, payload: any) =>
                  payload?.[0]?.payload?.fullName ?? _label
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [`$${Number(value ?? 0).toLocaleString()}`, "CBPF"]}
              />
              <Bar
                dataKey="cbpf"
                name="CBPF"
                fill="#22d3ee"
                radius={[3, 3, 0, 0]}
                opacity={0.85}
                activeBar={{ fill: "#67e8f9", opacity: 1 }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Targeted vs Reached line chart */}
      <div className="space-y-2">
        <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
          Targeted vs Reached
        </p>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 8, right: 36, bottom: 44, left: 52 }}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,255,0.07)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={<WrappingTick data={chartData} />}
                interval={0}
                tickLine={false}
                axisLine={{ stroke: "rgba(0,200,255,0.15)" }}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "rgba(0,200,255,0.55)", fontFamily: "monospace" }}
                tickFormatter={(v: number) => {
                  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
                  return String(v);
                }}
                tickLine={false}
                axisLine={false}
                width={48}
                label={{
                  value: "People",
                  angle: 0,
                  position: "insideTopLeft",
                  offset: 0,
                  dy: -14,
                  style: { fontSize: 8, fill: "rgba(34,211,238,0.5)", fontFamily: "monospace" },
                }}
              />
              {activeLabel && (
                <ReferenceLine x={activeLabel} stroke="rgba(255,255,255,0.5)" strokeWidth={1} strokeDasharray="3 3" />
              )}
              <Tooltip
                cursor={false}
                contentStyle={CHART_TOOLTIP_STYLE}
                labelStyle={CHART_LABEL_STYLE}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                itemSorter={(item: any) => (String(item.name).toLowerCase() === "targeted" ? -1 : 1)}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                labelFormatter={(_label: any, payload: any) =>
                  payload?.[0]?.payload?.fullName ?? _label
                }
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => {
                  const v = Number(value ?? 0);
                  const label = String(name).toLowerCase() === "targeted" ? "Targeted" : "Reached";
                  return [v.toLocaleString(), label];
                }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: 9,
                  fontFamily: "monospace",
                  color: "rgba(0,200,255,0.5)",
                  paddingTop: 4,
                }}
                iconSize={8}
              />
              <Line
                type="linear"
                dataKey="targeted"
                name="Targeted"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 3, fill: "#22c55e" }}
              />
              <Line
                type="linear"
                dataKey="reached"
                name="Reached"
                stroke="#ef4444"
                strokeWidth={2}
                dot={{ r: 3, fill: "#ef4444" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
