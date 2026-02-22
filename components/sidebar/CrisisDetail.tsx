"use client";

import { useState } from "react";
import { useAppContext } from "@/lib/app-context";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, ArrowLeft, ExternalLink } from "lucide-react";
import { formatDollars } from "@/lib/utils";
import { CrisisReachChart } from "./charts";
import { AnomalyBadge } from "./AnomalyBadge";
import type { CrisisData, CrisisTimelineEvent } from "@/lib/types";

/* ── Helper: extract a readable domain label from a URL ─────────────────── */
function domainLabel(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return url;
  }
}

/* ── Helper: format an ISO date string into a short readable label ──────── */
function formatTimelineDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatTimelineDateLong(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/* ── Timeline event node with hover tooltip ─────────────────────────────── */
function TimelineNode({ event }: { event: CrisisTimelineEvent }) {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={150}>
      <UITooltip open={open} onOpenChange={setOpen}>
        <div
          className="relative flex items-start gap-3 cursor-default"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {/* Dot — sole tooltip anchor so the diamond points here */}
          <div className="relative flex flex-col items-center">
            <TooltipTrigger asChild>
              <div className="h-2.5 w-2.5 rounded-full border-2 border-cyan-400/70 bg-cyan-400/20 hover:bg-cyan-400/50 hover:border-cyan-300 transition-colors shrink-0 z-10" />
            </TooltipTrigger>
          </div>

          {/* Compact label */}
          <div className="pb-6 -mt-0.5 min-w-0">
            <p className="text-[10px] font-mono text-cyan-400/60 leading-none mb-0.5">
              {formatTimelineDate(event.date)}
            </p>
            <p className="text-[11px] text-foreground/80 leading-snug line-clamp-2">
              {event.name}
            </p>
          </div>
        </div>
        <TooltipContent
          side="left"
          align="center"
          sideOffset={6}
          className="max-w-[280px] bg-black/95 border-cyan-500/30 text-cyan-100/90 z-[100] p-3 rounded-md shadow-[0_0_14px_rgba(0,200,255,0.14)]"
        >
          <p className="text-[10px] font-mono text-cyan-400/70 mb-1">
            {formatTimelineDateLong(event.date)}
          </p>
          <p className="text-[12px] font-semibold text-foreground mb-1.5 leading-snug">
            {event.name}
          </p>
          <p className="text-[11px] text-foreground/70 leading-relaxed">
            {event.description}
          </p>
        </TooltipContent>
      </UITooltip>
    </TooltipProvider>
  );
}

/** Full-page detail view for a single crisis. */
export function CrisisDetail({
  crisis,
  onBack,
}: {
  crisis: CrisisData;
  onBack: () => void;
}) {
  const { setSelectedCountryIso3, setSidebarTab, setGlobeFocusIso3 } = useAppContext();

  const totalReq = crisis.countries.reduce(
    (s, c) => s + (c.overallFunding?.totalRequirements ?? 0),
    0,
  );
  const totalFund = crisis.countries.reduce(
    (s, c) => s + (c.overallFunding?.totalFunding ?? 0),
    0,
  );
  const totalCBPF = crisis.countries.reduce(
    (s, c) => s + (c.crisisAllocation?.totalAllocations ?? 0),
    0,
  );
  const gap = totalReq - totalFund;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-cyan-500/15 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-400/60 hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <span className="text-cyan-500/30 text-xs">/</span>
        <span className="text-[11px] font-mono text-cyan-300/80 truncate">
          {crisis.crisisName}
        </span>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-foreground">{crisis.crisisName}</h2>
              <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                {crisis.categories.map((cat) => (
                  <span
                    key={cat}
                    className="text-[9px] font-mono text-red-400/70 border border-red-500/25 rounded-full px-1.5 py-0.5"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── Anomaly summary banner ────────────────────────── */}
          {(() => {
            const allAnomalies = crisis.countries.flatMap((c) => c.anomalies ?? []);
            if (allAnomalies.length === 0) return null;
            const criticalCount = allAnomalies.filter((a) => a.severity === "critical").length;
            const warningCount = allAnomalies.filter((a) => a.severity === "warning").length;
            return (
              <TooltipProvider delayDuration={200}>
                <UITooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/20 bg-amber-500/5 cursor-default">
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                      <span className="text-[11px] font-mono text-amber-200/80">
                        {allAnomalies.length} anomal{allAnomalies.length === 1 ? "y" : "ies"} detected
                        {criticalCount > 0 && (
                          <span className="text-red-300"> · {criticalCount} critical</span>
                        )}
                        {warningCount > 0 && (
                          <span className="text-amber-300"> · {warningCount} warning</span>
                        )}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="bottom"
                    align="start"
                    sideOffset={6}
                    className="max-w-[340px] bg-black/95 border-cyan-500/30 text-cyan-100/90 z-[100] p-3 rounded-md shadow-[0_0_14px_rgba(0,200,255,0.14)]"
                  >
                    <p className="text-[10px] font-mono font-semibold text-amber-300/90 mb-2 uppercase tracking-wider">
                      {allAnomalies.length} Anomal{allAnomalies.length === 1 ? "y" : "ies"} Detected
                    </p>
                    <ul className="space-y-1.5">
                      {allAnomalies.map((a, i) => (
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
          })()}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-cyan-500/15 bg-black/40 p-2.5">
              <p className="text-[9px] font-mono uppercase tracking-widest text-cyan-400/60 mb-1">
                Requirements
              </p>
              <p className="text-sm font-bold font-mono text-foreground">
                {formatDollars(totalReq)}
              </p>
            </div>
            <div className="rounded border border-cyan-500/15 bg-black/40 p-2.5">
              <p className="text-[9px] font-mono uppercase tracking-widest text-cyan-400/60 mb-1">
                Funded
              </p>
              <p className="text-sm font-bold font-mono text-cyan-400">
                {formatDollars(totalFund)}
              </p>
            </div>
            <div className="rounded border border-cyan-500/15 bg-black/40 p-2.5">
              <p className="text-[9px] font-mono uppercase tracking-widest text-cyan-400/60 mb-1">
                CBPF
              </p>
              <p className="text-sm font-bold font-mono text-cyan-400">
                {formatDollars(totalCBPF)}
              </p>
            </div>
            <div className="rounded border border-red-500/20 bg-red-500/5 p-2.5">
              <p className="text-[9px] font-mono uppercase tracking-widest text-red-400/60 mb-1">
                Gap
              </p>
              <p className="text-sm font-bold font-mono text-red-400">{formatDollars(gap)}</p>
            </div>
          </div>

          <Separator className="opacity-20" />
          <CrisisReachChart crisis={crisis} />

          <Separator className="opacity-20" />
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
              Country
            </p>
            <div className="space-y-1">
              {crisis.countries.map((entry, _idx) => {
                const gap = entry.overallFunding
                  ? entry.overallFunding.totalRequirements - entry.overallFunding.totalFunding
                  : 0;
                const maxNeglect = Math.max(
                  ...crisis.countries.map((c) => c.neglectIndex),
                  1,
                );
                const barWidth =
                  maxNeglect > 0
                    ? (entry.neglectIndex / maxNeglect) * 100
                    : 0;
                const offAppealShare =
                  entry.overallFunding && entry.overallFunding.totalFundingAll > 0
                    ? (entry.overallFunding.offAppealFunding / entry.overallFunding.totalFundingAll) * 100
                    : 0;
                return (
                  <button
                    key={entry.iso3}
                    onClick={() => {
                      setSelectedCountryIso3(entry.iso3);
                      setGlobeFocusIso3(entry.iso3);
                      setSidebarTab("countries");
                    }}
                    className="w-full rounded border border-cyan-500/10 bg-black/30 p-2 text-left hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {/* <span className="text-[9px] font-mono text-cyan-400/40 w-4 shrink-0">
                        {_idx + 1}.
                      </span> */}
                      <span className="text-[11px] font-medium flex-1 truncate">
                        {entry.countryName}
                      </span>
                      {entry.anomalies && entry.anomalies.length > 0 && (
                        <AnomalyBadge anomalies={entry.anomalies} compact />
                      )}
                      <span className="text-[9px] font-mono text-red-400 font-bold shrink-0">
                        {entry.neglectIndex.toFixed(2)}
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
                        <strong className="text-amber-400">
                          {entry.severityIndex.toFixed(1)}
                        </strong>
                      </span>
                      <span>
                        Funded:{" "}
                        <strong
                          className={
                            entry.overallFunding &&
                            entry.overallFunding.percentFunded < 50
                              ? "text-red-400"
                              : "text-cyan-400"
                          }
                        >
                          {entry.overallFunding
                            ? `${entry.overallFunding.percentFunded.toFixed(0)}%`
                            : "N/A"}
                        </strong>
                      </span>
                      <span>
                        Gap:{" "}
                        <strong className="text-red-400">
                          {formatDollars(gap)}
                        </strong>
                      </span>
                      {offAppealShare > 5 && (
                        <span>
                          Off-appeal:{" "}
                          <strong className="text-cyan-400/60">
                            {offAppealShare.toFixed(0)}%
                          </strong>
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Summary ────────────────────────────────────────── */}
          {crisis.summary && (
            <>
              <Separator className="opacity-20" />
              <div className="space-y-2">
                <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
                  Summary
                </p>
                <p className="text-[12px] leading-relaxed text-foreground/75">
                  {crisis.summary}
                </p>
              </div>
            </>
          )}

          {/* ── Timeline & Learn More ──────────────────────────── */}
          {((crisis.timeline && crisis.timeline.length > 0) ||
            (crisis.relatedLinks && crisis.relatedLinks.length > 0)) && (
            <>
              <Separator className="opacity-20" />
              <div className="grid grid-cols-2 gap-x-4 items-start">
                {/* Timeline column */}
                {crisis.timeline && crisis.timeline.length > 0 ? (
                  <div className="flex flex-col items-center min-w-0">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70 mb-2">
                      Timeline
                    </p>
                    <div className="relative ml-[4px] w-full">
                      <div className="absolute left-[4px] top-[5px] bottom-5 w-px bg-cyan-500/20" />
                      {crisis.timeline.map((event) => (
                        <TimelineNode key={event.date + event.name} event={event} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div />
                )}

                {/* Learn More column */}
                {crisis.relatedLinks && crisis.relatedLinks.length > 0 ? (
                  <div className="flex flex-col items-center min-w-0">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70 mb-2">
                      Learn More
                    </p>
                    <div className="space-y-1.5 w-full">
                      {crisis.relatedLinks.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 rounded border border-cyan-500/10 bg-black/30 px-2 py-1.5 text-left transition-colors hover:border-cyan-500/25 hover:bg-cyan-500/5"
                        >
                          <ExternalLink className="h-3 w-3 text-cyan-400/40 transition-colors shrink-0" />
                          <span className="text-[10px] text-cyan-300/70 transition-colors truncate">
                            {domainLabel(url)}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div />
                )}
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
