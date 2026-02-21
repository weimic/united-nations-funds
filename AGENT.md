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
- **Overview tab analytics** (formerly "Global" tab)
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
	- Category-based crisis browsing with per-category stats.
- **Spike selector** (above tabs, always visible)
	- Toggle spikes between **Funding Gap** and **Severity** from any tab (Overview, Crises, or Countries).
- **Globe interaction**
	- Correct geographic orientation (east = right, west = left, prime meridian facing camera).
	- Crisis/funding spikes and severity glow overlays.
	- **Country hover detection**: hovering anywhere on a country's territory (not just spike) shows borders and tooltip. Countries without data display "No funding or crisis data" with no click action.
	- **Selected country borders**: clicking a country (via sidebar or globe) persistently highlights its borders on the globe.
	- **Hover tooltip**: left-aligned with dark background (`bg-black/90`), backdrop blur, and cyan border. Shows country name, severity, funding, and click prompt.
	- Click-through from spike or country surface to country detail.
	- **Spike mode label**: bottom-left overlay shows what the spikes currently represent (Funding Gap or Severity).
	- **Spike color mode toggle**: bottom-left toggle switches between default coloring and spectrum mode. Spectrum mode colors each spike as a solid yellow-to-red gradient based on magnitude — makes relative spike heights visually distinct. Spike material uses `MeshBasicMaterial` with white base color so instance colors (set via `setColorAt`) render correctly in both modes.
	- **Spectrum legend**: when spectrum mode is active, a top-left legend shows the yellow-to-red scale with "Low" and "High" labels and a description of what the values represent.
	- **Map style toggle**: bottom-right toggle switches between dot cloud and solid country fill. Solid fill uses severity-based colors for crisis countries, base blue for data countries without severity, and white for neutral countries with no data. Ocean color is preserved.
	- **Solid country map**: aligned to match dot map via −π/2 Y-axis rotation on the texture sphere. Rendered at 8192×4096 resolution with anisotropic filtering (16×), mipmap generation, subtle country border strokes, and 128-segment sphere geometry for crisp rendering.

## Data Modeling Notes
- Aggregation joins data by ISO3 with alias handling for common country naming variants.
- INFORM parsing expands multi-ISO rows (e.g. "ECU, PER") so crisis-country representation is complete for country pages.
- Neglect index = (severity/5) × (1 − %funded) × log₁₀(1 + requirements/$1M). Higher = more overlooked.
- Globe coordinate mapping: `x = cos(lat)·sin(lon)`, `y = sin(lat)`, `z = cos(lat)·cos(lon)` — puts prime meridian at +z (camera front).

## Geo-Utils Architecture
- **Point-in-polygon**: `pointInRing` (ray-casting algorithm) + `pointInFeature` (with hole handling for Polygon/MultiPolygon).
- **Spatial indexing**: `buildFeatureBBoxes` pre-computes axis-aligned bounding boxes per feature; `findCountryAtPoint` filters by bbox before polygon test for fast per-frame lookups.
- **Solid country texture**: `buildSolidCountryTexture` renders equirectangular canvas (8192×4096) with filled country polygons and subtle cyan border strokes. Texture uses `LinearMipmapLinearFilter`, 16× anisotropy, and mipmap generation for crisp rendering at all zoom levels.
- **Land mask / severity glow**: existing utilities for dot-cloud generation and country outline textures.

## App Context State
- `sidebarTab`: `"crises" | "countries" | "overview"` (renamed from `"global"` to `"overview"`).
- `spikeMode`: `"fundingGap" | "severity"` — controls what the spikes represent.
- `spikeColorMode`: `"default" | "spectrum"` — controls spike coloring. Default uses mode-specific colors; spectrum uses yellow-to-red gradient based on magnitude.
- `mapStyle`: `"dots" | "solid"` — controls globe visualization style.

## Removed Components
- **Severity vs Funding scatter chart** (was on overview tab) — removed for clarity.
- **Overall Funding (FTS) radial circles** (was on country detail) — redundant with the funding gap bar and appeal breakdown.
- **Active crisis banner** (was above tabs in sidebar) — removed for cleaner UX; crisis context is visible in the Crises tab detail view.

## Near-Term Engineering Priorities
- Add automated regression tests for key aggregations (especially crisis-country joins and ranking outputs).
- Introduce optional year parameterization for comparative views.
- Add data validation checks/warnings for malformed or multi-code source rows.
- Resolve ESLint 10 + Next.js 16 FlatCompat incompatibility (currently using direct TypeScript-eslint config as workaround).
