"use client";

import { useMemo } from "react";
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
} from "recharts";
import type { CrisisAllocation, CrisisData } from "@/lib/types";
import { useAppContext } from "@/lib/app-context";
import { CHART_TOOLTIP_STYLE, CHART_LABEL_STYLE } from "@/lib/constants";
import { HoverTip } from "@/components/shared/HoverTip";

// ── Shared chart rendering ──────────────────────────────────────────────────

type ClusterChartRow = {
  name: string;
  fullName: string;
  cbpf: number;
  costPerTargeted: number;
  costPerReached: number;
  reachPct?: number;
};

function ClusterChart({
  data,
  barColor = "#12626e",
}: {
  data: ClusterChartRow[];
  barColor?: string;
}) {
  if (data.length === 0) return null;

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 12, right: 52, bottom: 24, left: 58 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,255,0.07)" vertical={false} />
          <XAxis
            dataKey="name"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tick={(props: any) => {
              const full =
                data.find((d) => d.name === props.payload?.value)?.fullName ??
                props.payload?.value ??
                "";
              return (
                <g transform={`translate(${props.x},${props.y})`}>
                  <title>{full}</title>
                  <text
                    x={0}
                    y={0}
                    dy={12}
                    textAnchor="middle"
                    fontSize={8}
                    fill="rgba(0,200,255,0.55)"
                    fontFamily="monospace"
                  >
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
              `$${v >= 1000 ? `${(v / 1000).toFixed(0)}M` : `${v}K`}`
            }
            tickLine={false}
            axisLine={false}
            width={52}
            label={{
              value: "CBPF ($K)",
              angle: -90,
              position: "insideLeft",
              offset: -40,
              style: { fontSize: 8, fill: "rgba(34,211,238,0.5)", fontFamily: "monospace" },
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 9, fill: "rgba(248,113,113,0.6)", fontFamily: "monospace" }}
            tickFormatter={(v: number) => `$${v}`}
            tickLine={false}
            axisLine={false}
            width={46}
            label={{
              value: "$ / Person",
              angle: 90,
              position: "insideRight",
              offset: -30,
              style: { fontSize: 8, fill: "rgba(248,113,113,0.5)", fontFamily: "monospace" },
            }}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            labelStyle={CHART_LABEL_STYLE}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any, name: any) => {
              const v = value ?? 0;
              if (name === "cbpf") return [`$${Number(v).toLocaleString()}K`, "CBPF"];
              if (name === "costPerTargeted")
                return [`$${Number(v).toLocaleString()}`, "Cost / Targeted"];
              if (name === "costPerReached")
                return [`$${Number(v).toLocaleString()}`, "Cost / Reached"];
              return [v, name];
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
          <Bar
            yAxisId="left"
            dataKey="cbpf"
            name="CBPF ($K)"
            fill={barColor}
            radius={[3, 3, 0, 0]}
            opacity={0.85}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="costPerReached"
            name="Cost / Reached"
            stroke="#f87171"
            strokeWidth={1.8}
            dot={{ r: 2.5, fill: "#f87171" }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="costPerTargeted"
            name="Cost / Targeted"
            stroke="#00b11b"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={{ r: 2, fill: "#94a3b8" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── CBPF Cluster Chart (for country detail) ─────────────────────────────────

export function CBPFClusterChart({ clusters }: { clusters: CrisisAllocation[] }) {
  if (!clusters || clusters.length === 0) return null;

  const sortedClusters = [...clusters].sort(
    (a, b) => b.totalAllocations - a.totalAllocations,
  );

  const chartData: ClusterChartRow[] = sortedClusters.slice(0, 8).map((c) => {
    const costPerTargeted =
      c.targetedPeople > 0 ? c.totalAllocations / c.targetedPeople : 0;
    const costPerReached =
      c.reachedPeople > 0 ? c.totalAllocations / c.reachedPeople : 0;
    const reachPct =
      c.targetedPeople > 0
        ? Math.round((c.reachedPeople / c.targetedPeople) * 100)
        : 0;
    return {
      name: c.cluster.length > 14 ? c.cluster.slice(0, 14) + "…" : c.cluster,
      fullName: c.cluster,
      cbpf: Math.round(c.totalAllocations / 1_000),
      costPerTargeted: Math.round(costPerTargeted * 10) / 10,
      costPerReached: Math.round(costPerReached * 10) / 10,
      reachPct,
    };
  });

  const deliverySummary = sortedClusters
    .filter((c) => c.targetedPeople > 0)
    .map((c) => {
      const reachPct = Math.round((c.reachedPeople / c.targetedPeople) * 100);
      return {
        cluster: c.cluster,
        targeted: c.targetedPeople,
        reached: c.reachedPeople,
        reachPct,
        alloc: c.totalAllocations,
      };
    });

  return (
    <div className="space-y-2 pt-1">
      <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
        CBPF Funding vs Cost Per Person
      </p>
      <ClusterChart data={chartData} barColor="#12626e" />

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
                <span className="text-muted-foreground flex-1 min-w-0 break-words leading-tight">
                  {d.cluster}
                </span>
                {d.reached === 0 && d.alloc > 0 && (
                  <span className="text-[8px] px-1 py-0 rounded bg-red-500/20 text-red-400 border border-red-500/30 font-bold shrink-0">
                    0 REACHED
                  </span>
                )}
                <div className="w-16 h-1 rounded-full bg-muted/20 overflow-hidden shrink-0">
                  <div
                    className={`h-full rounded-full ${
                      d.reachPct === 0
                        ? "bg-red-500"
                        : d.reachPct < 20
                          ? "bg-orange-500"
                          : "bg-cyan-500"
                    }`}
                    style={{ width: `${Math.min(d.reachPct, 100)}%` }}
                  />
                </div>
                <span
                  className={`w-8 text-right shrink-0 ${
                    d.reachPct === 0
                      ? "text-red-400 font-bold"
                      : d.reachPct < 20
                        ? "text-orange-400"
                        : "text-cyan-400/60"
                  }`}
                >
                  {d.reachPct}%
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ── Crisis Reach Chart (for crisis detail) ──────────────────────────────────

export function CrisisReachChart({ crisis }: { crisis: CrisisData }) {
  const { data } = useAppContext();

  const chartData: ClusterChartRow[] = useMemo(() => {
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
    return [...clusterMap.entries()].map(([k, v]) => {
      const costPerTargeted =
        v.targetedPeople > 0 ? v.allocations / v.targetedPeople : 0;
      const costPerReached = v.reached > 0 ? v.allocations / v.reached : 0;
      const name = k.length > 14 ? k.slice(0, 14) + "…" : k;
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
      <ClusterChart data={chartData} barColor="#22d3ee" />
    </div>
  );
}
