# UN Crisis Monitor - Current Project State

## What This App Does
UN Crisis Monitor is an analytics and exploration tool for humanitarian funding and crisis severity. It combines INFORM severity, FTS funding, and CBPF allocation datasets to surface where needs and funding are most mismatched.

## Current Data Scope
- **Primary analysis year**: **2025** (FTS and CBPF are filtered to 2025 in aggregation).
- **Severity source**: INFORM severity workbook, crisis-country granularity.
- **Funding source**: `fts_requirements_funding_global.csv` with explicit split between on-appeal and off-appeal funding.
- **CBPF source**: `specificcrisis.csv` for allocation, targeted people, and reached people metrics.
- **Geo source**: `countries.geo.json` for globe rendering and ISO3 mapping.

## Current Product Capabilities
- **Global tab analytics**
	- Underlooked crises ranking (top 10 by default) with **Show all** drilldown.
	- Absolute funding gap ranking (top 10 by default) with **Show all** drilldown.
	- Underlooked countries table (severity-adjusted neglect index).
	- Global humanitarian overview cards and funding progress (at bottom of page).
- **Countries tab controls**
	- Search by name/ISO3.
	- Sort/filter popup (icon button next to search bar) with ascending/descending sort for severity, funding gap, neglect index, and on-appeal funding.
	- Min/max filters for all of those metrics.
	- Clicking a country in the list focuses the globe on it and highlights its borders.
- **Country detail**
	- Severity summary at top.
	- Funding gap stacked bar + neglect index bar directly beneath severity.
	- Active crises list per country (all INFORM crises, including multi-ISO expanded).
	- Plan-line funding breakdown (appeal breakdown) and CBPF cluster analysis.
	- Crisis drivers listed at the bottom.
- **Crisis detail**
	- Aggregate stats (requirements, funded, CBPF, gap).
	- CBPF funding vs cost-per-person chart.
	- Country rankings by neglect index.
	- Clicking a country in crisis detail focuses globe and highlights that country's borders.
- **Crises tab**
	- Spike mode toggle at top of tab: switch spikes between **Funding Gap** and **Severity**.
	- Category-based crisis browsing with per-category stats.
- **Globe interaction**
	- Correct geographic orientation (east = right, west = left, prime meridian facing camera).
	- Crisis/funding spikes and severity glow overlays.
	- **Country hover detection**: hovering anywhere on a country's territory (not just spike) shows borders and tooltip. Countries without data display "No funding or crisis data" with no click action.
	- **Selected country borders**: clicking a country (via sidebar or globe) persistently highlights its borders on the globe.
	- Minimal hover tooltip (no background, text-shadow for contrast) with severity inline.
	- Click-through from spike or country surface to country detail.
	- **Spike mode label**: bottom-left overlay shows what the spikes currently represent (Funding Gap or Severity).
	- **Map style toggle**: bottom-right toggle switches between dot cloud and solid country fill. Solid fill uses severity-based colors for crisis countries, base blue for data countries without severity, and white for neutral countries with no data. Ocean color is preserved.

## Data Modeling Notes
- Aggregation joins data by ISO3 with alias handling for common country naming variants.
- INFORM parsing expands multi-ISO rows (e.g. "ECU, PER") so crisis-country representation is complete for country pages.
- Neglect index = (severity/5) × (1 − %funded) × log₁₀(1 + requirements/$1M). Higher = more overlooked.
- Globe coordinate mapping: `x = cos(lat)·sin(lon)`, `y = sin(lat)`, `z = cos(lat)·cos(lon)` — puts prime meridian at +z (camera front).

## Geo-Utils Architecture
- **Point-in-polygon**: `pointInRing` (ray-casting algorithm) + `pointInFeature` (with hole handling for Polygon/MultiPolygon).
- **Spatial indexing**: `buildFeatureBBoxes` pre-computes axis-aligned bounding boxes per feature; `findCountryAtPoint` filters by bbox before polygon test for fast per-frame lookups.
- **Solid country texture**: `buildSolidCountryTexture` renders equirectangular canvas with filled country polygons for the solid map style toggle.
- **Land mask / severity glow**: existing utilities for dot-cloud generation and country outline textures.

## Removed Components
- **Severity vs Funding scatter chart** (was on global tab) — removed for clarity.
- **Overall Funding (FTS) radial circles** (was on country detail) — redundant with the funding gap bar and appeal breakdown.
- **FundingCircle component** — no longer used after removing the Overall Funding section.

## Near-Term Engineering Priorities
- Add automated regression tests for key aggregations (especially crisis-country joins and ranking outputs).
- Introduce optional year parameterization for comparative views.
- Add data validation checks/warnings for malformed or multi-code source rows.
- Resolve ESLint 10 + Next.js 16 FlatCompat incompatibility (currently using direct TypeScript-eslint config as workaround).
