"use client";

import type { ReactNode } from "react";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info } from "lucide-react";

/** Inline tooltip for acronyms and concept explanations. */
export function HoverTip({ children, tip }: { children: ReactNode; tip: string }) {
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
