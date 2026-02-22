/**
 * Anomaly Detection Engine — Percentile-Based Outlier Flagging
 *
 * Detects statistical outliers by ranking each country against the global
 * population of all crisis-affected countries. Percentile ranking is used
 * instead of parametric z-scores because humanitarian funding data is
 * heavily right-skewed (std ≈ mean), making z-score thresholds ineffective
 * — a z ≤ −2 threshold would require negative dollar values, which are
 * impossible. Percentile ranking is distribution-agnostic and correctly
 * identifies tail extremes regardless of skew.
 *
 * Severity classification (percentile rank, 0–100 scale):
 *  - Critical: ≤ P5 (bottom 5 %) or ≥ P95 (top 5 %)
 *  - Warning:  P5–P10 band (bottom) or P90–P95 band (top)
 *
 * Only metrics with clear humanitarian relevance are checked:
 *  1. Percent Funded — genuinely underfunded appeals
 *  2. Funding Gap per Capita — shortfall per targeted person
 *  3. Severity-Funding Mismatch — high severity but low funding
 *
 * Methodology documented in STATISTICS.md §7.
 */

import type { CrisisData, CrisisCountryEntry, FundingAnomaly } from "./types";

// ── Percentile thresholds ──────────────────────────────────────────────────

const P_CRITICAL = 5; // ≤ 5th percentile
const P_WARNING = 10; // ≤ 10th percentile (but > 5th)

// ── Core helpers ───────────────────────────────────────────────────────────

/**
 * Compute the percentile rank of a value at position `index` within
 * `total` sorted observations (0-indexed ascending).
 * Returns 0–100 scale.
 */
function percentileRank(index: number, total: number): number {
  if (total <= 1) return 50; // Single value → median by definition
  return (index / (total - 1)) * 100;
}

/** Classify severity from a percentile rank and the direction of concern. */
function classifyFromPercentile(
  pRank: number,
  direction: "low" | "high",
): "critical" | "warning" | null {
  if (direction === "low") {
    if (pRank <= P_CRITICAL) return "critical";
    if (pRank <= P_WARNING) return "warning";
  } else {
    if (pRank >= 100 - P_CRITICAL) return "critical";
    if (pRank >= 100 - P_WARNING) return "warning";
  }
  return null;
}

// ── Generic percentile detector ────────────────────────────────────────────

/**
 * Run percentile-based anomaly detection for a single metric.
 *
 * 1. Extracts numeric values from candidate entries via `getValue`
 * 2. Sorts ascending and computes percentile ranks
 * 3. Flags bottom/top percentiles as critical/warning
 * 4. Calls `buildAnomaly` to generate the human-readable description
 */
function detectPercentile(
  entryMap: Map<string, CrisisCountryEntry[]>,
  candidates: CrisisCountryEntry[],
  getValue: (c: CrisisCountryEntry) => number,
  direction: "low" | "high",
  buildAnomaly: (
    value: number,
    pRank: number,
    sev: "critical" | "warning",
    cohort: { median: number; n: number },
  ) => FundingAnomaly,
  minCohort: number = 5,
): void {
  if (candidates.length < minCohort) return;

  const indexed = candidates
    .map((c) => ({ entry: c, value: getValue(c) }))
    .sort((a, b) => a.value - b.value);

  const n = indexed.length;
  const median = indexed[Math.floor(n / 2)].value;

  for (let i = 0; i < n; i++) {
    const pRank = percentileRank(i, n);
    const sev = classifyFromPercentile(pRank, direction);
    if (sev) {
      const anomaly = buildAnomaly(indexed[i].value, pRank, sev, {
        median,
        n,
      });
      pushToAllEntries(entryMap, indexed[i].entry.iso3, anomaly);
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Detect anomalies across ALL crises, mutating each country entry's
 * `anomalies` array in place. Countries are deduplicated by ISO3 so
 * metrics are evaluated once; results propagate to every crisis entry
 * that references the same country.
 */
export function detectAllAnomalies(crises: CrisisData[]): void {
  // Build ISO3 → CrisisCountryEntry[] map
  const entryMap = new Map<string, CrisisCountryEntry[]>();
  for (const crisis of crises) {
    for (const c of crisis.countries) {
      c.anomalies = [];
      if (!entryMap.has(c.iso3)) entryMap.set(c.iso3, []);
      entryMap.get(c.iso3)!.push(c);
    }
  }

  // Canonical entry per ISO3 for metric extraction
  const uniqueEntries: CrisisCountryEntry[] = [];
  for (const [, entries] of entryMap) {
    uniqueEntries.push(entries[0]);
  }

  // ── 1. Percent funded — genuinely underfunded appeals ───────────────────
  const pfCandidates = uniqueEntries.filter(
    (c) => c.overallFunding && c.overallFunding.totalRequirements > 0,
  );
  detectPercentile(
    entryMap,
    pfCandidates,
    (c) => c.overallFunding!.percentFunded,
    "low",
    (value, pRank, sev, cohort) => ({
      metric: "percentFunded",
      description: `Funded at ${value.toFixed(1)}% of appeal — bottom ${pRank < 1 ? "<1" : Math.round(pRank)}th percentile of ${cohort.n} countries (median ${cohort.median.toFixed(1)}%)`,
      zScore: pRank,
      severity: sev,
    }),
  );

  // ── 2. Funding gap per capita — shortfall per targeted person ───────────
  const fgCandidates = uniqueEntries.filter(
    (c) =>
      c.overallFunding &&
      c.overallFunding.totalRequirements > 0 &&
      c.crisisAllocation &&
      c.crisisAllocation.totalTargetedPeople > 0 &&
      c.fundingGapPerCapita > 0,
  );
  detectPercentile(
    entryMap,
    fgCandidates,
    (c) => c.fundingGapPerCapita,
    "high",
    (value, pRank, sev, cohort) => ({
      metric: "fundingGapPerCapita",
      description: `$${value.toFixed(0)} unfunded per targeted person — top ${100 - pRank < 1 ? "<1" : Math.round(100 - pRank)}th percentile (median $${cohort.median.toFixed(0)})`,
      zScore: pRank,
      severity: sev,
    }),
  );

  // ── 3. Severity-funding mismatch — high severity but poorly funded ─────
  // Ratio = severityIndex / percentFunded. High severity (numerator) with
  // low funding (denominator) produces a large ratio. Countries in the top
  // percentiles of this ratio are disproportionately neglected.
  const sfCandidates = uniqueEntries.filter(
    (c) =>
      c.severityIndex > 0 &&
      c.overallFunding &&
      c.overallFunding.percentFunded > 0,
  );
  detectPercentile(
    entryMap,
    sfCandidates,
    (c) => c.severityIndex / c.overallFunding!.percentFunded,
    "high",
    (_value, pRank, sev, cohort) => {
      // Recover original components for the description
      const entry = sfCandidates.find(
        (c) =>
          Math.abs(
            c.severityIndex / c.overallFunding!.percentFunded - _value,
          ) < 0.0001,
      );
      const sevIdx = entry?.severityIndex ?? 0;
      const pctFunded = entry?.overallFunding?.percentFunded ?? 0;
      return {
        metric: "severityFundingMismatch",
        description: `Severity ${sevIdx.toFixed(1)} but only ${pctFunded.toFixed(1)}% funded — disproportionately neglected (top ${100 - pRank < 1 ? "<1" : Math.round(100 - pRank)}th percentile of ${cohort.n} countries)`,
        zScore: pRank,
        severity: sev,
      };
    },
  );

  // ── Sort: critical first, then by percentile rank (lower = more extreme)
  for (const [, entries] of entryMap) {
    const sorted = [...entries[0].anomalies].sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
      return a.zScore - b.zScore;
    });
    for (const e of entries) {
      e.anomalies = sorted;
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Push an anomaly to the canonical (first) entry for an ISO3. */
function pushToAllEntries(
  entryMap: Map<string, CrisisCountryEntry[]>,
  iso3: string,
  anomaly: FundingAnomaly,
): void {
  const entries = entryMap.get(iso3);
  if (!entries) return;
  entries[0].anomalies.push(anomaly);
}
