import * as THREE from "three";
import { getFeatureCentroid, getSeverityColor } from "@/lib/geo-utils";
import { MAX_SPIKE_COUNTRIES } from "@/lib/constants";
import type { GeoFeature, OverallFunding } from "@/lib/types";

// ── Shared Types ───────────────────────────────────────────────────────────────

export type SeverityZone = {
  lat: number;
  lon: number;
  radius: number;
  intensity: number;
  color: THREE.Color;
};

export type ActiveThreat = {
  id: string; // iso3
  countryName: string;
  lat: number;
  lon: number;
  magnitude: number;
  totalFunding: number;
  offAppealFunding: number;
  totalFundingAll: number;
  percentFunded: number;
  percentFundedAll: number;
  severityIndex: number;
};

export type HoveredSpike = {
  x: number;
  y: number;
  iso3: string;
  countryName: string;
  totalFunding: number;
  offAppealFunding: number;
  totalFundingAll: number;
  percentFunded: number;
  percentFundedAll: number;
  severityIndex: number;
};

export type CountryHoverData = {
  x: number;
  y: number;
  iso3: string;
  countryName: string;
  hasData: boolean;
  totalFunding?: number;
  percentFunded?: number;
  severityIndex?: number;
};

// ── Coordinate Helpers ─────────────────────────────────────────────────────────

export function latLongToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const latRad = THREE.MathUtils.degToRad(lat);
  const lonRad = THREE.MathUtils.degToRad(lon);
  const cosLat = Math.cos(latRad);
  return new THREE.Vector3(
    radius * cosLat * Math.sin(lonRad),
    radius * Math.sin(latRad),
    radius * cosLat * Math.cos(lonRad),
  );
}

export function angularDistance(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
}

// ── Data Builders ──────────────────────────────────────────────────────────────

type CountryInput = Record<
  string,
  {
    name: string;
    overallFunding: OverallFunding | null;
    severity: { severityIndex: number } | null;
  }
>;

/** Build a centroid lookup from GeoJSON features. */
function buildCentroidMap(features: GeoFeature[]): Map<string, [number, number]> {
  const map = new Map<string, [number, number]>();
  for (const feature of features) {
    if (!feature.id) continue;
    const [lat, lon] = getFeatureCentroid(feature.geometry);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      map.set(feature.id, [lat, lon]);
    }
  }
  return map;
}

/**
 * Build spike data from country records.
 * "fundingGap" mode: top countries by largest funding gap.
 * "severity" mode: top countries by highest severity index.
 */
export function buildThreatsFromData(
  countries: CountryInput,
  features: GeoFeature[],
  mode: "fundingGap" | "severity" = "fundingGap",
): ActiveThreat[] {
  const centroidMap = buildCentroidMap(features);

  if (mode === "severity") {
    const entries = Object.entries(countries)
      .filter(([iso3, c]) => c.severity && c.severity.severityIndex > 0 && centroidMap.has(iso3))
      .map(([iso3, c]) => ({ iso3, country: c, centroid: centroidMap.get(iso3)! }))
      .sort((a, b) => (b.country.severity?.severityIndex ?? 0) - (a.country.severity?.severityIndex ?? 0))
      .slice(0, MAX_SPIKE_COUNTRIES);

    if (entries.length === 0) return [];
    const maxSev = Math.max(...entries.map((e) => e.country.severity?.severityIndex ?? 0), 1);

    return entries.map(({ iso3, country, centroid }) => ({
      id: iso3,
      countryName: country.name,
      lat: centroid[0],
      lon: centroid[1],
      magnitude: Math.max(0.05, (country.severity?.severityIndex ?? 0) / maxSev),
      totalFunding: country.overallFunding?.totalFunding ?? 0,
      offAppealFunding: country.overallFunding?.offAppealFunding ?? 0,
      totalFundingAll: country.overallFunding?.totalFundingAll ?? 0,
      percentFunded: country.overallFunding?.percentFunded ?? 0,
      percentFundedAll: country.overallFunding?.percentFundedAll ?? 0,
      severityIndex: country.severity?.severityIndex ?? 0,
    }));
  }

  // fundingGap mode
  const entries = Object.entries(countries)
    .filter(([iso3, c]) => c.overallFunding && c.overallFunding.totalRequirements > 0 && centroidMap.has(iso3))
    .map(([iso3, c]) => ({
      iso3,
      country: c,
      centroid: centroidMap.get(iso3)!,
      fundingGap: Math.max(0, c.overallFunding!.totalRequirements - c.overallFunding!.totalFunding),
    }))
    .sort((a, b) => b.fundingGap - a.fundingGap)
    .slice(0, MAX_SPIKE_COUNTRIES);

  if (entries.length === 0) return [];
  const maxGap = Math.max(...entries.map((e) => e.fundingGap), 1);

  return entries.map(({ iso3, country, centroid, fundingGap }) => ({
    id: iso3,
    countryName: country.name,
    lat: centroid[0],
    lon: centroid[1],
    magnitude: Math.max(0.05, fundingGap / maxGap),
    totalFunding: country.overallFunding!.totalFunding,
    offAppealFunding: country.overallFunding!.offAppealFunding,
    totalFundingAll: country.overallFunding!.totalFundingAll,
    percentFunded: country.overallFunding!.percentFunded,
    percentFundedAll: country.overallFunding!.percentFundedAll,
    severityIndex: country.severity?.severityIndex ?? 0,
  }));
}

/** Build severity heat zones for the dot-cloud color pass. */
export function buildSeverityZones(
  countries: Record<string, { severity: { severityIndex: number } | null }>,
  features: GeoFeature[],
): SeverityZone[] {
  const centroidMap = buildCentroidMap(features);

  return Object.entries(countries)
    .filter(([iso3, c]) => c.severity && centroidMap.has(iso3))
    .map(([iso3, c]) => ({ iso3, severity: c.severity!.severityIndex, centroid: centroidMap.get(iso3)! }))
    .sort((a, b) => b.severity - a.severity)
    .filter((d) => d.severity >= 3.0)
    .slice(0, 25)
    .map(({ severity, centroid }) => {
      const t = THREE.MathUtils.clamp(severity / 5, 0, 1);
      return {
        lat: centroid[0],
        lon: centroid[1],
        radius: 6 + t * 18,
        intensity: 0.25 + t * 0.75,
        color: getSeverityColor(severity),
      };
    });
}
