import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import type {
  InformSeverity,
  OverallFunding,
  PlanLine,
  CrisisAllocation,
  CrisisCountryAllocation,
  CrisisData,
  CrisisCountryEntry,
  CrisisTimelineEvent,
  UnifiedCountryData,
  GeoData,
  GlobalStats,
  SerializedData,
} from "./types";
import { detectAllAnomalies } from "./anomalies";

/** Raw shape of entries in crisisdetails.json */
interface RawCrisisDetail {
  crisis_name: string;
  summary: string;
  timeline: { date: string; name: string; description: string }[];
  related_links: string[];
}

const TARGET_YEAR = 2025;

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Load GeoJSON and build lookup maps */
function loadGeoData(): {
  geoData: GeoData;
  nameToIso3: Map<string, string>;
  iso3ToName: Map<string, string>;
} {
  const raw = fs.readFileSync(
    path.join(process.cwd(), "public", "data", "countries.geo.json"),
    "utf-8"
  );
  const geoData: GeoData = JSON.parse(raw);
  const nameToIso3 = new Map<string, string>();
  const iso3ToName = new Map<string, string>();

  for (const feature of geoData.features) {
    const iso3 = feature.id;
    const name = feature.properties.name;
    nameToIso3.set(name.toLowerCase(), iso3);
    iso3ToName.set(iso3, name);
  }

  // Add common aliases
  const aliases: Record<string, string> = {
    "democratic republic of the congo": "COD",
    drc: "COD",
    congo: "COD",
    "central african republic": "CAF",
    car: "CAF",
    "south sudan": "SSD",
    "occupied palestinian territory": "PSE",
    opt: "PSE",
    palestine: "PSE",
    "syria cross border": "SYR",
    venezuela: "VEN",
    myanmar: "MMR",
    burma: "MMR",
    "burkina faso": "BFA",
    niger: "NER",
    nigeria: "NGA",
    chad: "TCD",
    mali: "MLI",
    haiti: "HTI",
    lebanon: "LBN",
    mozambique: "MOZ",
    pakistan: "PAK",
    somalia: "SOM",
    ethiopia: "ETH",
    yemen: "YEM",
    ukraine: "UKR",
    sudan: "SDN",
    syria: "SYR",
    afghanistan: "AFG",
  };

  for (const [alias, iso3] of Object.entries(aliases)) {
    nameToIso3.set(alias, iso3);
    if (!iso3ToName.has(iso3)) {
      iso3ToName.set(
        iso3,
        alias.charAt(0).toUpperCase() + alias.slice(1)
      );
    }
  }

  return { geoData, nameToIso3, iso3ToName };
}

/**
 * Parse country name from CBPF name.
 * Examples:
 *  "Afghanistan" -> "Afghanistan"
 *  "Burkina Faso (RhPF-WCA)" -> "Burkina Faso"
 *  "Haiti (RhPF-LAC)" -> "Haiti"
 *  "Pakistan (AP-RHPF)" -> "Pakistan"
 *  "oPt" -> "oPt"
 *  "Syria Cross border" -> "Syria Cross border"
 */
function parseCBPFCountryName(cbpfName: string): string {
  // Remove parenthetical suffixes like (RhPF-WCA)
  const cleaned = cbpfName.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return cleaned;
}

function resolveIso3(
  name: string,
  nameToIso3: Map<string, string>
): string {
  const lower = name.toLowerCase().trim();
  if (nameToIso3.has(lower)) return nameToIso3.get(lower)!;
  // Try partial match
  for (const [key, iso3] of nameToIso3.entries()) {
    if (key.includes(lower) || lower.includes(key)) return iso3;
  }
  return "";
}

// ── INFORM Severity ────────────────────────────────────────────────────────────

function parseInformSeverity(): InformSeverity[] {
  const filePath = path.join(process.cwd(), "public", "data");
  const files = fs.readdirSync(filePath);
  const xlsxFile = files.find(
    (f) => f.endsWith(".xlsx") && f.includes("inform-severity")
  );
  if (!xlsxFile) {
    console.warn("INFORM severity xlsx not found");
    return [];
  }

  const buf = fs.readFileSync(path.join(filePath, xlsxFile));
  const wb = XLSX.read(buf);

  // Use "INFORM Severity - all crises" sheet for individual crisis-level data
  // (The "country" sheet aggregates multiple crises into one row, losing detail)
  const sheetName = "INFORM Severity - all crises";
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    console.warn(`Sheet "${sheetName}" not found`);
    return [];
  }

  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });

  // Find the header row (contains "CRISIS", "ISO3", etc.)
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (row && row[0] === "CRISIS" && row[3] === "ISO3") {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return [];

  const results: InformSeverity[] = [];
  // Data starts after header + weights row + units row
  for (let i = headerIdx + 3; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0] || !row[3]) continue;

    const severityIndex = typeof row[5] === "number" ? row[5] : parseFloat(String(row[5]));
    if (isNaN(severityIndex)) continue;

    const iso3Raw = String(row[3] || "").trim().toUpperCase();
    if (!iso3Raw || iso3Raw.length < 2) continue;

    // Some INFORM rows contain multi-country ISO fields (e.g. "ECU, PER").
    // Expand to one entry per ISO3 so country-level crisis lists are complete.
    const iso3Codes = (iso3Raw.match(/[A-Z]{3}/g) || []).filter(Boolean);
    if (iso3Codes.length === 0) continue;

    for (const iso3 of iso3Codes) {
      results.push({
        crisisName: String(row[0]),
        crisisId: String(row[1]),
        country: String(row[2]),
        iso3,
        drivers: String(row[4] || ""),
        severityIndex,
        severityCategory: String(row[7] || row[6] || ""),
        trend: String(row[8] || "Stable"),
        region: String(row[19] || ""),
      });
    }
  }

  return results;
}

/**
 * Parse the "INFORM Severity - country" sheet which contains the official
 * overall INFORM severity score per country (an aggregate across all crises
 * affecting that country).  This is different from the per-crisis scores in
 * "INFORM Severity - all crises" and must be used for country-level displays.
 */
function parseInformSeverityCountry(): Map<string, InformSeverity> {
  const dir = path.join(process.cwd(), "public", "data");
  const files = fs.readdirSync(dir);
  const xlsxFile = files.find(
    (f) => f.endsWith(".xlsx") && f.includes("inform-severity")
  );
  if (!xlsxFile) {
    console.warn("INFORM severity xlsx not found (country sheet)");
    return new Map();
  }

  const buf = fs.readFileSync(path.join(dir, xlsxFile));
  const wb = XLSX.read(buf);

  const sheetName = "INFORM Severity - country";
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    console.warn(`Sheet "${sheetName}" not found`);
    return new Map();
  }

  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: true });

  // Header is at row index 1 (row 0 is the title).  Data starts at row 4.
  // Columns mirror the crisis sheet:
  //   0=CRISIS  1=CRISIS_ID  2=COUNTRY  3=ISO3  4=DRIVERS
  //   5=INFORM Severity Index  6=category(num)  7=category(text)  8=Trend
  //   19=Regions
  const result = new Map<string, InformSeverity>();

  for (let i = 4; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[3]) continue;

    const iso3 = String(row[3]).trim().toUpperCase();
    if (!iso3 || iso3.length !== 3) continue;

    const severityIndex =
      typeof row[5] === "number" ? row[5] : parseFloat(String(row[5]));
    if (!Number.isFinite(severityIndex)) continue;

    result.set(iso3, {
      crisisName: String(row[0] || ""),
      crisisId: String(row[1] || ""),
      country: String(row[2] || ""),
      iso3,
      drivers: String(row[4] || ""),
      severityIndex,
      severityCategory: String(row[7] || row[6] || ""),
      trend: String(row[8] || "Stable"),
      region: String(row[19] || ""),
    });
  }

  return result;
}

// ── Overall Funding ────────────────────────────────────────────────────────────

function parseOverallFunding(): OverallFunding[] {
  const csvPath = path.join(
    process.cwd(),
    "public",
    "data",
    "fts_requirements_funding_global.csv"
  );
  const raw = fs.readFileSync(csvPath, "utf-8");
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });

  // Group by countryCode and aggregate.
  // IMPORTANT: the FTS file contains both on-appeal rows (with comparable requirements)
  // and off-appeal rows (commonly name = "Not specified" with requirements = 0).
  // The default lens across the app is on-appeal only; off-appeal is reported separately.
  const byCountry = new Map<
    string,
    { requirements: number; onAppealFunding: number; offAppealFunding: number; planLines: Map<string, PlanLine> }
  >();

  for (const row of parsed.data as Record<string, string>[]) {
    // Filter for target year
    if (row.year && parseInt(row.year) !== TARGET_YEAR) continue;

    // Skip the HXL tag row
    if (
      row.countryCode?.startsWith("#") ||
      !row.countryCode ||
      row.countryCode.length !== 3
    )
      continue;

    const code = row.countryCode.toUpperCase();
    const req = parseFloat(row.requirements) || 0;
    const fund = parseFloat(row.funding) || 0;
    const name = (row.name || "").trim();
    const nameLower = name.toLowerCase();
    const isOffAppeal = nameLower === "not specified";
    const typeName = (row.typeName || "").trim();

    if (!byCountry.has(code)) {
      byCountry.set(code, { requirements: 0, onAppealFunding: 0, offAppealFunding: 0, planLines: new Map() });
    }
    const entry = byCountry.get(code)!;

    if (isOffAppeal) {
      entry.offAppealFunding += fund;
      continue;
    }

    entry.requirements += req;
    entry.onAppealFunding += fund;

    // Track individual plan lines for appeal breakdown
    if (name) {
      const existing = entry.planLines.get(name);
      if (existing) {
        existing.requirements += req;
        existing.funding += fund;
      } else {
        entry.planLines.set(name, { name, typeName, requirements: req, funding: fund, percentFunded: 0 });
      }
    }
  }

  return Array.from(byCountry.entries()).map(([code, data]) => {
    const totalFundingAll = data.onAppealFunding + data.offAppealFunding;
    const percentFunded =
      data.requirements > 0
        ? Math.round((data.onAppealFunding / data.requirements) * 100)
        : 0;
    const percentFundedAll =
      data.requirements > 0
        ? Math.round((totalFundingAll / data.requirements) * 100)
        : 0;

    const planLines = Array.from(data.planLines.values()).map(pl => ({
      ...pl,
      percentFunded: pl.requirements > 0 ? Math.round((pl.funding / pl.requirements) * 100) : 0,
    }));

    return {
      countryCode: code,
      totalRequirements: data.requirements,
      totalFunding: data.onAppealFunding,
      percentFunded,
      offAppealFunding: data.offAppealFunding,
      totalFundingAll,
      percentFundedAll,
      planLines,
    };
  });
}

// ── Specific Crisis ────────────────────────────────────────────────────────────

function parseCrisisAllocations(
  nameToIso3: Map<string, string>
): CrisisCountryAllocation[] {
  const csvPath = path.join(process.cwd(), "public", "data", "specificcrisis.csv");
  const raw = fs.readFileSync(csvPath, "utf-8");
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });

  const allocations: CrisisAllocation[] = [];

  for (const row of parsed.data as Record<string, string>[]) {
    // Filter for target year
    if (row.Year && parseInt(row.Year) !== TARGET_YEAR) continue;

    const cbpfName = row["CBPF Name"];
    if (!cbpfName) continue;

    const parsedCountryName = parseCBPFCountryName(cbpfName);
    const iso3 = resolveIso3(parsedCountryName, nameToIso3);

    allocations.push({
      cbpfName,
      parsedCountryName,
      iso3,
      cluster: row["Cluster"] || "",
      totalAllocations: parseFloat(row["Total Allocations"]) || 0,
      targetedPeople: parseInt(row["Targeted People"]) || 0,
      reachedPeople: parseInt(row["Reached People"]) || 0,
    });
  }

  // Group by cbpfName (country)
  const grouped = new Map<string, CrisisAllocation[]>();
  for (const a of allocations) {
    const key = a.cbpfName;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(a);
  }

  const results: CrisisCountryAllocation[] = [];
  for (const [cbpfName, clusters] of grouped) {
    const totalAllocations = clusters.reduce(
      (sum, c) => sum + c.totalAllocations,
      0
    );
    const totalTargetedPeople = clusters.reduce(
      (sum, c) => sum + c.targetedPeople,
      0
    );
    const totalReachedPeople = clusters.reduce(
      (sum, c) => sum + c.reachedPeople,
      0
    );

    results.push({
      cbpfName,
      parsedCountryName: clusters[0].parsedCountryName,
      iso3: clusters[0].iso3,
      totalAllocations,
      totalTargetedPeople,
      totalReachedPeople,
      dollarPerPerson:
        totalTargetedPeople > 0
          ? Math.round((totalAllocations / totalTargetedPeople) * 100) / 100
          : 0,
      clusters,
    });
  }

  return results;
}

// ── Data Joining ───────────────────────────────────────────────────────────────

export interface AggregatedData {
  countries: Map<string, UnifiedCountryData>;
  crises: CrisisData[];
  geoData: GeoData;
  globalStats: GlobalStats;
}

export function aggregateAllData(): AggregatedData {
  const { geoData, nameToIso3, iso3ToName } = loadGeoData();
  const severity = parseInformSeverity();
  const countrySeverity = parseInformSeverityCountry();
  const funding = parseOverallFunding();
  const crisisAllocations = parseCrisisAllocations(nameToIso3);

  // Build unified country map
  const countries = new Map<string, UnifiedCountryData>();

  // Initialize from geoData
  for (const feature of geoData.features) {
    const iso3 = feature.id;
    countries.set(iso3, {
      name: feature.properties.name,
      iso3,
      severity: null,
      overallFunding: null,
      crisisAllocations: null,
    });
  }

  // Add country-level INFORM severity data.
  // Prefer the official "INFORM Severity - country" sheet which provides the
  // overall severity for each country (accounting for all its crises).
  // Fall back to the highest per-crisis severity only when a country appears in
  // the crisis sheet but not in the country sheet.
  const fallbackSeverityByCountry = new Map<string, InformSeverity>();
  for (const s of severity) {
    const existing = fallbackSeverityByCountry.get(s.iso3);
    if (!existing || s.severityIndex > existing.severityIndex) {
      fallbackSeverityByCountry.set(s.iso3, s);
    }
  }

  // Merge: country sheet takes precedence, then fallback
  const allSeverityIso3 = new Set([
    ...countrySeverity.keys(),
    ...fallbackSeverityByCountry.keys(),
  ]);
  for (const iso3 of allSeverityIso3) {
    const s = countrySeverity.get(iso3) ?? fallbackSeverityByCountry.get(iso3)!;
    const country = countries.get(iso3);
    if (country) {
      country.severity = s;
    } else {
      countries.set(iso3, {
        name: iso3ToName.get(iso3) || s.country,
        iso3,
        severity: s,
        overallFunding: null,
        crisisAllocations: null,
      });
    }
  }

  // Add funding data
  for (const f of funding) {
    const country = countries.get(f.countryCode);
    if (country) {
      country.overallFunding = f;
    }
  }

  // Add crisis allocations
  for (const ca of crisisAllocations) {
    if (!ca.iso3) continue;
    const country = countries.get(ca.iso3);
    if (country) {
      country.crisisAllocations = ca;
    }
  }

  // Build crisis data - group severity entries by crisis
  const crisisMap = new Map<string, InformSeverity[]>();
  for (const s of severity) {
    if (!crisisMap.has(s.crisisId)) crisisMap.set(s.crisisId, []);
    crisisMap.get(s.crisisId)!.push(s);
  }

  const crises: CrisisData[] = [];
  for (const [crisisId, entries] of crisisMap) {
    const crisisName = entries[0].crisisName;
    const crisisCountries: CrisisCountryEntry[] = entries.map((entry) => {
      const country = countries.get(entry.iso3);
      const overallFundingData = country?.overallFunding || null;
      const crisisAllocation = country?.crisisAllocations || null;

      // Calculate underfunded score: higher severity + lower funding = higher score
      let underfundedScore = 0;
      let percentFunded = 0;
      let fundingGap = 0;
      let totalFunding = 0;
      
      if (overallFundingData) {
        percentFunded = overallFundingData.percentFunded / 100; // 0-1
        totalFunding = overallFundingData.totalFunding;
        fundingGap = Math.max(0, overallFundingData.totalRequirements - overallFundingData.totalFunding);
      }

      if (overallFundingData && overallFundingData.percentFunded > 0) {
        // Normalize: severity (0-5) * (1 - percentFunded/100)
        underfundedScore =
          entry.severityIndex * (1 - percentFunded);
      } else {
        // No funding data = assume max underfunding at this severity
        underfundedScore = entry.severityIndex;
      }

      // New Metrics
      const targetedPeople = crisisAllocation?.totalTargetedPeople || 0;
      const reachedPeople = crisisAllocation?.totalReachedPeople || 0;
      const cbpfAllocations = crisisAllocation?.totalAllocations || 0;

      // Neglect Index v2: (Severity/5) * (1 - %Funded) * log10(1 + Requirements/$1M)
      // Uses FTS requirements (available for all countries) instead of CBPF targeted people
      // (only 23 CBPFs). This prevents non-CBPF countries like Lebanon from scoring 0.
      const severityNorm = entry.severityIndex / 5;
      const requirementsInMillions = (overallFundingData?.totalRequirements ?? 0) / 1_000_000;
      const neglectIndex =
        severityNorm * (1 - percentFunded) * Math.log10(1 + requirementsInMillions);

      // Funding Gap Per Capita
      const fundingGapPerCapita =
        targetedPeople > 0 ? fundingGap / targetedPeople : 0;

      // Reach Ratio
      const reachRatio =
        targetedPeople > 0 ? (reachedPeople / targetedPeople) * 100 : 0;

      // CBPF Dependency
      const cbpfDependency =
        totalFunding > 0 ? (cbpfAllocations / totalFunding) * 100 : 0;

      return {
        iso3: entry.iso3,
        countryName: country?.name || entry.country,
        severityIndex: entry.severityIndex,
        severityCategory: entry.severityCategory,
        drivers: entry.drivers,
        overallFunding: overallFundingData,
        crisisAllocation,
        underfundedScore,
        neglectIndex,
        fundingGapPerCapita,
        reachRatio,
        cbpfDependency,
        anomalies: [],
      };
    });

    // Sort by neglect index descending (most neglected first)
    crisisCountries.sort((a, b) => b.neglectIndex - a.neglectIndex);

    // Derive normalized categories from crisis name + drivers fields
    const categorySet = new Set<string>();
    const nameAndDrivers = [crisisName, ...crisisCountries.map(e => e.drivers)].join(" ");
    const lower = nameAndDrivers.toLowerCase();

    if (/conflict|armed|war|violence|attack|militant|rebel|coup|fighting|hostil/.test(lower)) categorySet.add("Conflict");
    if (/food|hunger|famine|malnutrit|starv|food insecurity/.test(lower)) categorySet.add("Food Crisis");
    if (/drought|dry/.test(lower)) categorySet.add("Drought");
    if (/flood|cyclone|typhoon|hurricane|storm|tsunami/.test(lower)) categorySet.add("Natural Disaster");
    if (/earthquake|volcanic|eruption|landslide/.test(lower)) categorySet.add("Natural Disaster");
    if (/displace|refugee|idp|migration|forced movement/.test(lower)) categorySet.add("Displacement");
    if (/disease|epidemic|pandemic|health|cholera|malaria|ebola|outbreak/.test(lower)) categorySet.add("Disease");
    if (/economic|financial|poverty|inflation|livelihood/.test(lower)) categorySet.add("Economic Crisis");
    if (/political|governance|instability|crisis governance/.test(lower)) categorySet.add("Political Crisis");
    if (/climate|climatic|environment|deforestation/.test(lower)) categorySet.add("Climate");

    // Fallback: use raw driver tokens if nothing matched
    if (categorySet.size === 0) {
      for (const entry of crisisCountries) {
        if (entry.drivers) {
          entry.drivers.split(/[;,]/).map((t) => t.trim()).filter(Boolean).forEach(t => categorySet.add(t));
        }
      }
    }
    const categories = [...categorySet];

    crises.push({
      crisisName,
      crisisId,
      countries: crisisCountries,
      categories,
    });
  }

  // ── Merge crisis details (summary, timeline, related links) ──────────────
  const detailsRaw = fs.readFileSync(
    path.join(process.cwd(), "public", "data", "crisisdetails.json"),
    "utf-8",
  );
  const crisisDetails: RawCrisisDetail[] = JSON.parse(detailsRaw);

  // Build a lookup keyed on lowercase crisis_name for fuzzy matching
  const detailMap = new Map<string, RawCrisisDetail>();
  for (const d of crisisDetails) {
    detailMap.set(d.crisis_name.toLowerCase().trim(), d);
  }

  for (const crisis of crises) {
    const detail = detailMap.get(crisis.crisisName.toLowerCase().trim());
    if (detail) {
      crisis.summary = detail.summary;
      crisis.timeline = detail.timeline.map(
        (t): CrisisTimelineEvent => ({
          date: t.date,
          name: t.name,
          description: t.description,
        }),
      );
      crisis.relatedLinks = detail.related_links;
    }
  }

  // Sort crises by name
  crises.sort((a, b) => a.crisisName.localeCompare(b.crisisName));

  // Detect statistical anomalies within each crisis cohort
  detectAllAnomalies(crises);

  // Compute global stats
  const globalStats: GlobalStats = {
    totalRequirements: 0,
    totalFunding: 0,
    totalOffAppealFunding: 0,
    totalFundingAll: 0,
    totalCBPFAllocations: 0,
    percentFunded: 0,
    percentFundedAll: 0,
    countriesInCrisis: new Set(severity.map((s) => s.iso3)).size,
    activeCrisisCount: crises.length,
  };
  for (const [, c] of countries) {
    if (c.overallFunding) {
      globalStats.totalRequirements += c.overallFunding.totalRequirements;
      globalStats.totalFunding += c.overallFunding.totalFunding;
      globalStats.totalOffAppealFunding += c.overallFunding.offAppealFunding;
      globalStats.totalFundingAll += c.overallFunding.totalFundingAll;
    }
    if (c.crisisAllocations) {
      globalStats.totalCBPFAllocations += c.crisisAllocations.totalAllocations;
    }
  }
  globalStats.percentFunded =
    globalStats.totalRequirements > 0
      ? Math.round((globalStats.totalFunding / globalStats.totalRequirements) * 100)
      : 0;
  globalStats.percentFundedAll =
    globalStats.totalRequirements > 0
      ? Math.round((globalStats.totalFundingAll / globalStats.totalRequirements) * 100)
      : 0;

  return { countries, geoData, crises, globalStats };
}

export function serializeData(data: AggregatedData): SerializedData {
  const countries: Record<string, UnifiedCountryData> = {};
  for (const [key, value] of data.countries) {
    countries[key] = value;
  }
  return {
    countries,
    crises: data.crises,
    geoData: data.geoData,
    globalStats: data.globalStats,
  };
}
