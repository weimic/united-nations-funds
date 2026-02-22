// ── Core Data Types ──────────────────────────────────────────────────────────

/** INFORM severity record per crisis per country */
export interface InformSeverity {
  year?: number;
  crisisName: string;
  crisisId: string;
  country: string;
  iso3: string;
  drivers: string;
  severityIndex: number; // 0-5
  severityCategory: string; // "Very Low" | "Low" | "Medium" | "High" | "Very High"
  trend: string;
  region: string;
}

/** Overall country-level funding from FTS */
export interface OverallFunding {
  year?: number;
  countryCode: string; // ISO Alpha-3
  totalRequirements: number;
  /** On-appeal funding only (default lens used across the UI) */
  totalFunding: number;
  /** On-appeal % funded (default lens used across the UI) */
  percentFunded: number;
  /** Off-appeal funding, typically from rows like name = "Not specified" (requirements often 0) */
  offAppealFunding: number;
  /** On-appeal + off-appeal funding (for transparency; not comparable as a % funded lens) */
  totalFundingAll: number;
  /** % funded if off-appeal funding is included in the numerator */
  percentFundedAll: number;
  /** Individual plan/appeal lines for this country */
  planLines: PlanLine[];
}

/** Specific crisis allocation per country per cluster */
export interface CrisisAllocation {
  year?: number;
  cbpfName: string; // e.g. "Afghanistan", "Burkina Faso (RhPF-WCA)"
  parsedCountryName: string; // extracted country name
  iso3: string; // mapped ISO3
  cluster: string;
  totalAllocations: number;
  targetedPeople: number;
  reachedPeople: number;
}

/** Individual plan/appeal line within a country's FTS data */
export interface PlanLine {
  name: string;
  typeName: string; // e.g. "Humanitarian response plan", "Regional response plan", "Flash appeal"
  requirements: number;
  funding: number;
  percentFunded: number;
}

/** Aggregated crisis allocation per country (summed across clusters) */
export interface CrisisCountryAllocation {
  cbpfName: string;
  parsedCountryName: string;
  iso3: string;
  totalAllocations: number;
  totalTargetedPeople: number;
  totalReachedPeople: number;
  dollarPerPerson: number;
  clusters: CrisisAllocation[];
}

/** Unified country data joining all 3 datasets */
export interface UnifiedCountryData {
  name: string;
  iso3: string;
  severity: InformSeverity | null;
  overallFunding: OverallFunding | null;
  crisisAllocations: CrisisCountryAllocation | null;
}

/** A single event on a crisis timeline */
export interface CrisisTimelineEvent {
  date: string;
  name: string;
  description: string;
}

/** Crisis-level data grouping countries */
export interface CrisisData {
  crisisName: string;
  crisisId: string;
  countries: CrisisCountryEntry[];
  categories: string[];
  /** Narrative summary of the crisis (from crisisdetails.json) */
  summary?: string;
  /** Chronological timeline of key events (from crisisdetails.json) */
  timeline?: CrisisTimelineEvent[];
  /** External reference URLs for further reading (from crisisdetails.json) */
  relatedLinks?: string[];
}

/** Global aggregate statistics */
export interface GlobalStats {
  totalRequirements: number;
  /** On-appeal funding only (default lens used across the UI) */
  totalFunding: number;
  /** Off-appeal funding total (typically name = "Not specified") */
  totalOffAppealFunding: number;
  /** On-appeal + off-appeal funding */
  totalFundingAll: number;
  totalCBPFAllocations: number;
  /** On-appeal % funded (default lens used across the UI) */
  percentFunded: number;
  /** % funded if off-appeal funding is included in the numerator */
  percentFundedAll: number;
  countriesInCrisis: number;
  activeCrisisCount: number;
}

/** A statistical anomaly detected for a country within a crisis context */
export interface FundingAnomaly {
  /** Which metric triggered the anomaly */
  metric: "percentFunded" | "fundingGapPerCapita" | "severityFundingMismatch";
  /** Human-readable explanation of what was detected */
  description: string;
  /** Percentile rank (0–100) within global cohort */
  zScore: number;
  /** Critical (≤ P5 / ≥ P95) or warning (P5–P10 / P90–P95) */
  severity: "warning" | "critical";
}

/** A country entry within a crisis context */
export interface CrisisCountryEntry {
  iso3: string;
  countryName: string;
  severityIndex: number;
  severityCategory: string;
  drivers: string;
  overallFunding: OverallFunding | null;
  crisisAllocation: CrisisCountryAllocation | null;
  /** Ratio: severity vs funding -> higher = more underfunded */
  underfundedScore: number;
  /** Normalized score combining severity, funding gap, and magnitude of targeted people */
  neglectIndex: number;
  /** (Requirements - Funding) / Targeted People */
  fundingGapPerCapita: number;
  /** Reached People / Targeted People * 100 */
  reachRatio: number;
  /** CBPF Allocations / Total Funding * 100 */
  cbpfDependency: number;
  /** Statistical anomalies detected for this country within the crisis */
  anomalies: FundingAnomaly[];
}

/** GeoJSON feature from countries.geo.json */
export interface GeoFeature {
  type: string;
  id: string; // ISO3
  properties: {
    name: string;
  };
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
}

export interface GeoData {
  type: string;
  features: GeoFeature[];
}

/** Application state */
export interface AppState {
  activeCrisis: CrisisData | null;
  selectedCountry: string | null; // ISO3
  sidebarTab: "crises" | "countries" | "overview";
}

/** Serializable data for client components */
export interface SerializedData {
  countries: Record<string, UnifiedCountryData>;
  crises: CrisisData[];
  geoData: GeoData;
  globalStats: GlobalStats;
}
