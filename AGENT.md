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
	- Severity vs funding disparity scatter.
	- Global humanitarian overview cards and funding progress.
- **Countries tab controls**
	- Search by name/ISO3.
	- Sort popup with ascending/descending options for severity, funding gap, neglect index, and on-appeal funding.
	- Min/max filters for those same metrics.
- **Country detail**
	- Severity summary.
	- Funding gap + neglect index bars near the top.
	- Active crises list per country.
	- Plan-line funding breakdown and CBPF cluster analysis.
	- Crisis drivers listed near the bottom.
- **Globe interaction**
	- Crisis/funding spikes and severity glow overlays.
	- Hover details rendered inside the globe viewport.
	- Click-through from spike to country detail.

## Data Modeling Notes
- Aggregation joins data by ISO3 with alias handling for common country naming variants.
- INFORM parsing expands multi-ISO rows so crisis-country representation is complete for country pages.
- Neglect index is derived from severity, on-appeal funding shortfall, and requirement scale.

## Near-Term Engineering Priorities
- Add automated regression tests for key aggregations (especially crisis-country joins and ranking outputs).
- Introduce optional year parameterization for comparative views.
- Add data validation checks/warnings for malformed or multi-code source rows.
