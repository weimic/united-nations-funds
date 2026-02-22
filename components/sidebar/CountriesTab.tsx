"use client";

import { useState, useMemo } from "react";
import { useAppContext } from "@/lib/app-context";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, SlidersHorizontal, MapPin } from "lucide-react";
import { getSeverityBadgeColor } from "@/components/shared/severity-colors";
import { CountryDetail } from "./CountryDetail";

/** The "Countries" tab — search/sort/filter list → country detail. */
export function CountriesTab() {
  const {
    data,
    setSelectedCountryIso3,
    selectedCountryIso3,
    getCountry,
    setGlobeFocusIso3,
    countryDetailSource,
    setCountryDetailSource,
    setSidebarTab,
  } = useAppContext();

  const [search, setSearch] = useState("");
  const [showSortFilter, setShowSortFilter] = useState(false);
  const [sortBy, setSortBy] = useState<
    | "name-asc"
    | "severity-asc"
    | "severity-desc"
    | "gap-asc"
    | "gap-desc"
    | "neglect-asc"
    | "neglect-desc"
    | "on-appeal-asc"
    | "on-appeal-desc"
  >("name-asc");
  const [severityMin, setSeverityMin] = useState("");
  const [severityMax, setSeverityMax] = useState("");
  const [gapMin, setGapMin] = useState("");
  const [gapMax, setGapMax] = useState("");
  const [neglectMin, setNeglectMin] = useState("");
  const [neglectMax, setNeglectMax] = useState("");
  const [onAppealMin, setOnAppealMin] = useState("");
  const [onAppealMax, setOnAppealMax] = useState("");

  const parseBound = (value: string): number | null => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const inRange = (value: number | null, min: number | null, max: number | null) => {
    if (value === null) return min === null && max === null;
    if (min !== null && value < min) return false;
    if (max !== null && value > max) return false;
    return true;
  };

  const countryList = useMemo(() => {
    const entries = Object.values(data.countries)
      .filter((c) => c.name && c.iso3 && (c.severity || c.overallFunding || c.crisisAllocations))
      .map((country) => {
        const severity = country.severity?.severityIndex ?? null;
        const onAppealFunding = country.overallFunding?.totalFunding ?? null;
        const fundingGap = country.overallFunding
          ? Math.max(0, country.overallFunding.totalRequirements - country.overallFunding.totalFundingAll)
          : null;
        const neglectIndex =
          country.severity && country.overallFunding
            ? (country.severity.severityIndex / 5) *
              (1 - country.overallFunding.percentFunded / 100) *
              Math.log10(1 + country.overallFunding.totalRequirements / 1_000_000)
            : null;

        return { country, severity, fundingGap, neglectIndex, onAppealFunding };
      });

    const q = search.toLowerCase();
    const searched = q
      ? entries.filter(
          ({ country }) =>
            country.name.toLowerCase().includes(q) || country.iso3.toLowerCase().includes(q),
        )
      : entries;

    const filtered = searched.filter(
      (row) =>
        inRange(row.severity, parseBound(severityMin), parseBound(severityMax)) &&
        inRange(row.fundingGap, parseBound(gapMin), parseBound(gapMax)) &&
        inRange(row.neglectIndex, parseBound(neglectMin), parseBound(neglectMax)) &&
        inRange(row.onAppealFunding, parseBound(onAppealMin), parseBound(onAppealMax)),
    );

    const sortable = [...filtered];
    const nullLast = (value: number | null, asc: boolean) => {
      if (value === null) return asc ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      return value;
    };

    sortable.sort((a, b) => {
      switch (sortBy) {
        case "severity-asc":
          return nullLast(a.severity, true) - nullLast(b.severity, true);
        case "severity-desc":
          return nullLast(b.severity, false) - nullLast(a.severity, false);
        case "gap-asc":
          return nullLast(a.fundingGap, true) - nullLast(b.fundingGap, true);
        case "gap-desc":
          return nullLast(b.fundingGap, false) - nullLast(a.fundingGap, false);
        case "neglect-asc":
          return nullLast(a.neglectIndex, true) - nullLast(b.neglectIndex, true);
        case "neglect-desc":
          return nullLast(b.neglectIndex, false) - nullLast(a.neglectIndex, false);
        case "on-appeal-asc":
          return nullLast(a.onAppealFunding, true) - nullLast(b.onAppealFunding, true);
        case "on-appeal-desc":
          return nullLast(b.onAppealFunding, false) - nullLast(a.onAppealFunding, false);
        default:
          return a.country.name.localeCompare(b.country.name);
      }
    });

    return sortable.map((row) => row.country);
  }, [
    data.countries,
    search,
    sortBy,
    severityMin,
    severityMax,
    gapMin,
    gapMax,
    neglectMin,
    neglectMax,
    onAppealMin,
    onAppealMax,
  ]);

  // Show detail view when a country is selected
  if (selectedCountryIso3) {
    const country = getCountry(selectedCountryIso3);
    if (country) {
      return (
        <CountryDetail
          iso3={selectedCountryIso3}
          onBack={() => {
            const source = countryDetailSource;
            setSelectedCountryIso3(null);
            setCountryDetailSource(null);
            if (source && source !== "countries") {
              setSidebarTab(source as "crises" | "countries" | "overview");
            }
          }}
        />
      );
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="relative px-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-cyan-400/40" />
            <Input
              placeholder="Search countries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 bg-black/40 border-cyan-500/20 text-sm h-9 font-mono placeholder:text-cyan-400/30 focus:border-cyan-500/50"
            />
          </div>
          <button
            onClick={() => setShowSortFilter((prev) => !prev)}
            className={`h-9 w-9 shrink-0 rounded-md border transition-colors flex items-center justify-center ${
              showSortFilter
                ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-300"
                : "border-cyan-500/20 bg-black/40 text-cyan-400/60 hover:border-cyan-500/40 hover:text-cyan-300"
            }`}
            aria-label="Open sort and filter"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        {showSortFilter && (
          <div className="absolute right-2 top-11 z-50 w-[320px] rounded-md border border-cyan-500/25 bg-black/95 p-3 shadow-[0_0_16px_rgba(0,200,255,0.15)] space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/70">
                Sort by
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="w-full h-8 rounded border border-cyan-500/20 bg-black/50 text-[11px] font-mono text-cyan-100 px-2"
              >
                <option value="name-asc">Name (A → Z)</option>
                <option value="severity-asc">Severity (low → high)</option>
                <option value="severity-desc">Severity (high → low)</option>
                <option value="gap-asc">Funding gap (low → high)</option>
                <option value="gap-desc">Funding gap (high → low)</option>
                <option value="neglect-asc">Neglect index (low → high)</option>
                <option value="neglect-desc">Neglect index (high → low)</option>
                <option value="on-appeal-asc">On-appeal funding (low → high)</option>
                <option value="on-appeal-desc">On-appeal funding (high → low)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2 text-[10px] font-mono uppercase tracking-widest text-cyan-400/60">
                Severity (0-5)
              </div>
              <Input
                placeholder="Min"
                value={severityMin}
                onChange={(e) => setSeverityMin(e.target.value)}
                className="h-8 bg-black/40 border-cyan-500/20 text-[11px] font-mono"
              />
              <Input
                placeholder="Max"
                value={severityMax}
                onChange={(e) => setSeverityMax(e.target.value)}
                className="h-8 bg-black/40 border-cyan-500/20 text-[11px] font-mono"
              />

              <div className="col-span-2 text-[10px] font-mono uppercase tracking-widest text-cyan-400/60">
                Funding Gap (USD)
              </div>
              <Input
                placeholder="Min"
                value={gapMin}
                onChange={(e) => setGapMin(e.target.value)}
                className="h-8 bg-black/40 border-cyan-500/20 text-[11px] font-mono"
              />
              <Input
                placeholder="Max"
                value={gapMax}
                onChange={(e) => setGapMax(e.target.value)}
                className="h-8 bg-black/40 border-cyan-500/20 text-[11px] font-mono"
              />

              <div className="col-span-2 text-[10px] font-mono uppercase tracking-widest text-cyan-400/60">
                Neglect Index
              </div>
              <Input
                placeholder="Min"
                value={neglectMin}
                onChange={(e) => setNeglectMin(e.target.value)}
                className="h-8 bg-black/40 border-cyan-500/20 text-[11px] font-mono"
              />
              <Input
                placeholder="Max"
                value={neglectMax}
                onChange={(e) => setNeglectMax(e.target.value)}
                className="h-8 bg-black/40 border-cyan-500/20 text-[11px] font-mono"
              />

              <div className="col-span-2 text-[10px] font-mono uppercase tracking-widest text-cyan-400/60">
                On-Appeal Funding (USD)
              </div>
              <Input
                placeholder="Min"
                value={onAppealMin}
                onChange={(e) => setOnAppealMin(e.target.value)}
                className="h-8 bg-black/40 border-cyan-500/20 text-[11px] font-mono"
              />
              <Input
                placeholder="Max"
                value={onAppealMax}
                onChange={(e) => setOnAppealMax(e.target.value)}
                className="h-8 bg-black/40 border-cyan-500/20 text-[11px] font-mono"
              />
            </div>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-0.5 px-2 pb-4">
          {countryList.map((country) => {
            const isSelected = selectedCountryIso3 === country.iso3;
            return (
              <button
                key={country.iso3}
                onClick={() => {
                  setSelectedCountryIso3(country.iso3);
                  setGlobeFocusIso3(country.iso3);
                }}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-left transition-all ${
                  isSelected
                    ? "bg-cyan-500/10 border border-cyan-500/30 shadow-[0_0_10px_rgba(0,200,255,0.1)]"
                    : "hover:bg-cyan-500/5 border border-transparent hover:border-cyan-500/15"
                }`}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-400/40" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{country.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-cyan-400/50 font-mono">{country.iso3}</span>
                    {country.severity && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 font-mono ${getSeverityBadgeColor(country.severity.severityCategory)}`}
                      >
                        {country.severity.severityIndex.toFixed(1)}
                      </Badge>
                    )}
                    {country.overallFunding && (
                      <span
                        className={`text-[10px] font-mono ${country.overallFunding.percentFunded < 50 ? "text-red-400/70" : "text-cyan-400/40"}`}
                      >
                        {country.overallFunding.percentFunded}% funded
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          {countryList.length === 0 && (
            <p className="text-center text-sm text-cyan-400/40 font-mono py-8">
              No countries found
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
