/** Severity badge color utilities shared across sidebar and modal views. */

export function getSeverityBadgeColor(category: string): string {
  switch (category) {
    case "Very High": return "bg-red-600/90 text-white border-red-500/50";
    case "High":      return "bg-red-500/80 text-white border-red-400/50";
    case "Medium":    return "bg-amber-500/80 text-white border-amber-400/50";
    case "Low":       return "bg-blue-500/70 text-white border-blue-400/50";
    case "Very Low":  return "bg-slate-500/70 text-white border-slate-400/50";
    default:          return "bg-zinc-600/70 text-white border-zinc-500/50";
  }
}

export function getSeverityColorClass(category: string): string {
  switch (category) {
    case "Very High": return "text-red-400 border-red-500/30 bg-red-500/10";
    case "High":      return "text-orange-400 border-orange-500/30 bg-orange-500/10";
    case "Medium":    return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    case "Low":       return "text-blue-400 border-blue-500/30 bg-blue-500/10";
    default:          return "text-slate-400 border-slate-500/30 bg-slate-500/10";
  }
}

export function getSeverityColorByIndex(index: number): string {
  if (index >= 4) return "text-red-400";
  if (index >= 3) return "text-orange-400";
  if (index >= 2) return "text-amber-400";
  if (index >= 1) return "text-blue-400";
  return "text-slate-400";
}

export function getNeglectColor(score: number): string {
  if (score >= 5) return "bg-red-500";
  if (score >= 3) return "bg-orange-500";
  if (score >= 1.5) return "bg-amber-500";
  return "bg-blue-500";
}
