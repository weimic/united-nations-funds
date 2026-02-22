"use client";

import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, AlertOctagon } from "lucide-react";
import type { FundingAnomaly } from "@/lib/types";

/**
 * Compact anomaly indicator badge with hover tooltip.
 *
 * Renders an icon + count badge colored by worst severity (amber = warning,
 * red = critical). On hover, a tooltip lists each detected anomaly with its
 * human-readable description so analysts understand *why* the flag exists.
 *
 * Props:
 *  - anomalies: array of FundingAnomaly objects for this country-in-crisis
 *  - compact: when true, renders a smaller inline badge (for country rows)
 */
export function AnomalyBadge({
  anomalies,
  compact = false,
}: {
  anomalies: FundingAnomaly[];
  compact?: boolean;
}) {
  if (anomalies.length === 0) return null;

  const hasCritical = anomalies.some((a) => a.severity === "critical");
  const Icon = hasCritical ? AlertOctagon : AlertTriangle;

  const iconSize = compact ? "h-3 w-3" : "h-3.5 w-3.5";
  const textSize = compact ? "text-[8px]" : "text-[9px]";
  const padding = compact ? "px-1 py-0.5" : "px-1.5 py-0.5";

  const colorClasses = hasCritical
    ? "text-red-400 border-red-500/30 bg-red-500/10"
    : "text-amber-400 border-amber-500/30 bg-amber-500/10";

  return (
    <TooltipProvider delayDuration={200}>
      <UITooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-0.5 rounded-full border font-mono shrink-0 cursor-default ${padding} ${colorClasses}`}
          >
            <Icon className={iconSize} />
            <span className={textSize}>{anomalies.length}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="left"
          align="center"
          sideOffset={8}
          className="max-w-[320px] bg-black/95 border-cyan-500/30 text-cyan-100/90 z-[100] p-3 rounded-md shadow-[0_0_14px_rgba(0,200,255,0.14)]"
        >
          <p className="text-[10px] font-mono font-semibold text-amber-300/90 mb-2 uppercase tracking-wider">
            {anomalies.length} Anomal{anomalies.length === 1 ? "y" : "ies"} Detected
          </p>
          <ul className="space-y-1.5">
            {anomalies.map((a, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span
                  className={`mt-[3px] h-1.5 w-1.5 rounded-full shrink-0 ${
                    a.severity === "critical" ? "bg-red-400" : "bg-amber-400"
                  }`}
                />
                <span className="text-[11px] leading-snug text-foreground/80">
                  {a.description}
                </span>
              </li>
            ))}
          </ul>
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
  );
}
