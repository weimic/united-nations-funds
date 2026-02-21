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
  totalFunding: number;
  percentFunded: number;
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
  historicalData?: Record<number, {
    severity: InformSeverity | null;
    overallFunding: OverallFunding | null;
    crisisAllocations: CrisisCountryAllocation | null;
  }>;
}

/** Crisis-level data grouping countries */
export interface CrisisData {
  crisisName: string;
  crisisId: string;
  countries: CrisisCountryEntry[];
  categories: string[];
  historicalData?: Record<number, {
    countries: CrisisCountryEntry[];
  }>;
}

/** Global aggregate statistics */
export interface GlobalStats {
  totalRequirements: number;
  totalFunding: number;
  totalCBPFAllocations: number;
  percentFunded: number;
  countriesInCrisis: number;
  activeCrisisCount: number;
  historicalData?: Record<number, {
    totalRequirements: number;
    totalFunding: number;
    totalCBPFAllocations: number;
    percentFunded: number;
    countriesInCrisis: number;
    activeCrisisCount: number;
  }>;
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
  sidebarTab: "crises" | "countries" | "global";
}

/** Serializable data for client components */
export interface SerializedData {
  countries: Record<string, UnifiedCountryData>;
  crises: CrisisData[];
  geoData: GeoData;
  globalStats: GlobalStats;
}
