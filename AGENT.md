# UN Crisis Monitor - Current Project State

## What This App Does
UN Crisis Monitor is an analytics and exploration tool for humanitarian funding and crisis severity. It combines INFORM severity, FTS funding, and CBPF allocation datasets to surface where needs and funding are most mismatched.

## Current Data Scope
- **Primary analysis year**: **2025** (FTS and CBPF are filtered to 2025 in aggregation).
- **Severity source**: INFORM severity workbook with two sheets: "INFORM Severity - country" for official per-country overall severity, and "INFORM Severity - all crises" for per-crisis-per-country severity.
- **Funding source**: `fts_requirements_funding_global.csv` with explicit split between on-appeal and off-appeal funding.
- **CBPF source**: `specificcrisis.csv` for allocation, targeted people, and reached people metrics.
- **Geo source**: `countries.geo.json` for globe rendering and ISO3 mapping.
- **Crisis details source**: `crisisdetails.json` for per-crisis narrative summary, timeline of key events, and related external links. Matched to INFORM crises by `crisis_name` ↔ `crisisName` (case-insensitive).

## Current Product Capabilities
- **Overview tab analytics** (formerly "Global" tab)
	- Overlooked crises ranking (titled "Top 10 Overlooked Crises") with **Show all** drilldown. Substats: Severity, Funded %, Gap — all substat values in amber-400. Score bar is solid red (`bg-red-500`) on a lighter muted track (`bg-muted/30`).
	- Absolute funding gap ranking (top 10 by default) with **Show all** drilldown. Chart legend order: Funded (on-appeal), Funded (off-appeal), Unfunded Gap. X-axis starts at "$0" (not "$0M"). Tooltip uses `separator=": "` (no space before colon), correctly maps bar names from the Bar `name` prop, and enforces top-to-bottom order: Funded (on-appeal), Funded (off-appeal), Unfunded Gap via `itemSorter`.
	- Overlooked countries ranking (titled "Top 10 Overlooked Countries") with **Show all** drilldown. Substats: Severity, Funded %, Gap — all substat values in amber-400. Off-appeal substat removed.
	- Clicking an overlooked crisis navigates to crisis detail with back-button returning to Overview tab (not Crises tab). Clicking an overlooked country navigates to country detail with back-button returning to Overview tab (not Countries tab). Uses dual navigation sources: `navigationSource` for crisis detail back and `countryDetailSource` for country detail back.
	- All three **Show all** buttons are underlined (`underline underline-offset-2`) for discoverability.
	- Global humanitarian overview cards and funding progress (at bottom of page).
- **Countries tab controls**
	- Search by name/ISO3.
	- Sort/filter popup (icon button next to search bar) with ascending/descending sort for severity, funding gap, neglect index, and on-appeal funding.
	- Min/max filters for all of those metrics.
	- Clicking a country in the list focuses the globe on it and highlights its borders.
- **Country detail**
	- Back button reads "Back" (not "Countries") and always navigates to the page the user came from — Overview tab, Crises tab (crisis detail), or Countries list — via `countryDetailSource`.
	- Severity summary at top.
	- Funding gap stacked bar + neglect index bar directly beneath severity.
	- Active crises list per country (all INFORM crises, including multi-ISO expanded). Clicking a crisis sets `navigationSource` to "countries" so back from crisis detail returns to the country detail.
	- Plan-line funding breakdown (appeal breakdown) and CBPF cluster analysis.
	- Crisis drivers listed at the bottom.
- **Crisis detail**
	- Aggregate stats (requirements, funded, CBPF, gap).
	- CBPF Funding bar chart (standalone, no cost-per-person overlay). X-axis labels are horizontal and wrap to a second line when long; if the second line still exceeds the character budget it is truncated with "…". Hovering a bar brightens its fill instead of showing a white cursor rectangle.
	- Targeted vs Reached line chart (straight lines) showing targeted (green) and reached (red) people per cluster, displayed beneath the CBPF chart. Same horizontal wrapping tick style as the CBPF chart.
	- All chart tooltips use `labelFormatter` to show the full cluster name (never truncated). Tooltip label text wraps to a second line if needed (`whiteSpace: normal`, `maxWidth: 240px`).
	- Country cards styled identically to the Underlooked Countries cards in the Overview tab: rank number, solid red neglect-index bar on `bg-muted/30` track, full stat row (Severity, Funded %, Gap, Off-appeal %). Heading reads "Country".
	- Clicking a country card focuses globe and highlights that country's borders.
	- **Crisis summary**: narrative paragraph sourced from `crisisdetails.json`, rendered below the country list with the section heading "Summary". Matches the app's `text-[12px] leading-relaxed text-foreground/75` style.
	- **Crisis timeline & learn more**: two-equal-column grid layout (`grid-cols-2`) — left column contains centered "Timeline" heading and vertical timeline events; right column contains centered "Learn More" heading and compact link cards. Both headings are centered within their respective halves. Timeline uses cyan dot nodes connected by a `bg-cyan-500/20` vertical line. Each node shows a short date (e.g. "Aug 2017") and event name. Tooltip uses a controlled `open` state on the parent row so hovering anywhere on an event shows the tooltip, but the `TooltipTrigger` wraps only the dot element — this anchors the tooltip diamond (arrow) to the dot. Tooltip appears to the **left** of the timeline (`side="left"`, `align="center"`, `sideOffset={6}`) so the card floats left with its diamond pointing at the dot. Only the dot itself has CSS `:hover` styles (`hover:bg-cyan-400/50 hover:border-cyan-300`); hovering the text area shows the tooltip but produces no visual highlight. Tooltip matches app styling (`bg-black/95`, `border-cyan-500/30`, cyan shadow) showing full date, event name, and description. Related links rendered as compact cards with `ExternalLink` icon and domain label (opens in new tab). Each link card individually highlights on hover (`hover:border-cyan-500/25 hover:bg-cyan-500/5`); only the hovered link changes — icon and text do not use `group-hover` so no unintended multi-link highlighting occurs. When only one section exists (timeline or links), the other column renders as an empty placeholder.
	- Crisis detail data (summary, timeline, related links) is loaded from `public/data/crisisdetails.json` at build time via `data-aggregator.ts` and merged into `CrisisData` by matching `crisis_name` to `crisisName` (case-insensitive). Types: `CrisisTimelineEvent` interface in `types.ts`.
	- **Anomaly detection badges**: Percentile-based statistical anomaly detection flags outlier countries across the global cohort. Three metrics analyzed: percent funded (low), funding gap per capita (high), and severity-funding mismatch (high). Severity: ≤P5/≥P95 → critical (red), P5–P10/P90–P95 → warning (amber). Crisis-level summary banner shows total anomaly count with severity breakdown and number of affected countries. Per-country compact badges with hover tooltip listing each anomaly's human-readable explanation. Detection runs at build time via `lib/anomalies.ts`; results stored in `CrisisCountryEntry.anomalies: FundingAnomaly[]`. Full statistical methodology documented in STATISTICS.md §7.
- **Crises tab**
	- Category-based crisis browsing with per-category stats.
- **Globe interaction**
	- Correct geographic orientation (east = right, west = left, prime meridian facing camera).
	- Crisis/funding spikes and severity glow overlays.
	- **Country hover detection**: hovering anywhere on a country's territory (not just spike) shows borders and tooltip. Countries without data display "No funding or crisis data" with no click action.
	- **Selected country borders**: clicking a country (via sidebar or globe) persistently highlights its borders on the globe.
	- **Hover tooltip**: left-aligned with dark background (`bg-black/90`), backdrop blur, and cyan border. Shows country name, severity, funding, and click prompt.
	- Click-through from spike or country surface to country detail. Globe clicks set `countryDetailSource` to the current sidebar tab so back navigation returns the user to the tab they were on.
	- **Globe controls** (bottom-right, stacked vertically): two labeled switch bars using consistent pill style with cyan color scheme.
		- **View switch** (top): "View: Dots [toggle] Countries" — switches between dot-cloud and solid country-fill map styles.
		- **Spikes switch** (bottom): "Spikes: Funding [toggle] Severity" — switches spike data between funding gap and severity modes. Uses cyan colors matching the View switch.
	- **Spike color mode** (context state only, no UI toggle): `spikeColorMode` still exists in context for programmatic use; spectrum mode colors each spike yellow-to-red by magnitude. Spike material uses `MeshBasicMaterial` with white base color so instance colors render correctly.
	- **Map style: solid fill**: severity-based colors for crisis countries, base blue for data countries without severity, and white for neutral countries with no data. Ocean color is preserved.
	- **Solid country map**: aligned to match dot map via −π/2 Y-axis rotation on the texture sphere. Rendered at 8192×4096 resolution with anisotropic filtering (16×), mipmap generation, subtle country border strokes, and 128-segment sphere geometry for crisp rendering.
- **About / Methodology dialog** (`AboutDialog`, triggered from `AppSidebar` footer)
	- Circular Info (ℹ) button in the sidebar footer, styled identically to the chat toggle button (black/80, cyan border, glow shadow).
	- Opens a two-tab dialog:
		- **About tab**: project purpose, data sources (FTS, INFORM, CBPF, crisis details), key capabilities summary, and important caveats (on-appeal vs off-appeal behavior, crisis overlap, CBPF 0% reach interpretation).
		- **Methodology tab**: Neglect Index formula with term-by-term breakdown, on-appeal vs off-appeal statistical rationale (Spearman correlation figures), percentile-based anomaly detection methodology with severity thresholds (P5/P10/P90/P95), CBPF delivery rate explanation, and data processing notes.
	- Dialog has scanline overlay matching sidebar aesthetic, cyan-tinted styling, and scrollable content via `ScrollArea`.
- **AI chat panel** (`ChatWindow`, `ChatToggleButton`, embedded in `AppSidebar`)
	- Triggered by a circular Bot-icon button in the sidebar footer. The footer uses a `justify-between` flex layout: data-source links left-aligned, Info (About dialog) and Bot (chat toggle) buttons right-aligned.
	- When open, the sidebar splits: top 55% shows the normal stats/tabs, bottom 45% shows the chat panel. Both sections scroll independently — users can read crisis data while chatting.
	- `ChatWindow` has an `embedded` prop: when true it renders as an inline flex column (no fixed overlay, no z-index competition); when false it renders as the classic full-height slide-in overlay (preserved for potential standalone use).
	- Scroll is implemented with a plain `<div ref={scrollRef} className="overflow-y-auto">` so `scrollTop` manipulation works directly (replaces `ScrollArea` which wrapped the viewport, making direct `scrollTop` writes ineffective).
	- Suggested questions shown on empty state. When `focusIso3` is returned the globe focuses that country and the sidebar switches to the Countries tab.
	- Chat state (`chatOpen`) lives in `ClientShell` and flows down into `AppSidebar` as `chatOpen` / `onChatToggle` props.

## Data Modeling Notes
- Aggregation joins data by ISO3 with alias handling for common country naming variants.
- INFORM parsing expands multi-ISO rows (e.g. "ECU, PER") so crisis-country representation is complete for country pages.
- **Country severity** uses the "INFORM Severity - country" sheet (official aggregate across all crises for that country). This differs from the per-crisis severity and ensures Overlooked Countries and Overlooked Crises rankings are distinct. Falls back to the max per-crisis severity only for countries missing from the country sheet.
- **Crisis-level severity** (`CrisisCountryEntry.severityIndex`) uses the "INFORM Severity - all crises" sheet, preserving individual crisis scores.
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
- `navigationSource`: `string | null` — tracks which tab initiated a crisis detail navigation (e.g. `"overview"`, `"countries"`). Used by CrisesTab to route the crisis detail back button to the originating tab.
- `countryDetailSource`: `string | null` — tracks which tab initiated a country detail navigation (e.g. `"overview"`, `"crises"`). Used by CountriesTab to route the country detail back button to the originating tab. Both sources are cleared when the user manually switches tabs via the tab bar.

## AI / LLM Architecture
- **RAG pipeline**: LangChain LCEL — Pinecone vector retrieval → system prompt injection → OpenRouter/Llama-3 primary with HuggingFace/Mistral-7B automatic fallback → `StringOutputParser`.
- **Response extraction pipeline** (route `app/api/chat/route.ts`):
	1. Strip leading/trailing ` ```json ``` ` code fences.
	2. **Plain-text key-value detection** (`isPlainTextKeyValueFormat`): if stripped text starts with `Message:` and not `{`, route to `extractPlainTextResponse`.
	3. `extractPlainTextResponse`: section-based parsing for `Message` and `FocusIso3` keys; multi-paragraph messages captured intact.
	4. **Inline section detection** (`extractInlineCitationsResponse`): handles freeform responses with an inline `Citations:` header — checked before brace extraction. *(Functions retained, citations disabled in active pipeline.)*
	5. If no plain-text format: find outermost `{…}` braces to isolate JSON.
	6. `JSON.parse` the slice; on failure fall back to `extractFallbackResponse` (boundary extraction → plain-text → inline section → raw text).
	7. Post-parse normalization: ensure `message` is a non-empty string, **force `citations: []`** (pipeline disabled), drop `focusIso3` if not exactly 3 chars.
	8. `stripJsonEnvelope` final safeguard: extract inner message if the field still contains a JSON envelope or protocol keys.
- **Citation helpers** (`parseLooseCitationObjects`, `extractFallbackCitations`, `extractPlainTextResponse`, `extractInlineCitationsResponse`) — **preserved in `route.ts` for future re-enablement** but not active; `parsed.citations` is always overwritten to `[]` before responding.
- **`_CitationChip`** component in `ChatMessageBubble.tsx` — **preserved, not rendered**. `ChatCitation` type and `onCitationClick?` prop retained in interfaces for future use.
- **Input guards**: history capped at 20 messages; individual messages capped at 2,000 characters to prevent token-exhaustion.
- **`ChatResponse` type** (`lib/chat-types.ts`): `{ message: string; focusIso3?: string; citations: ChatCitation[] }` — type unchanged; `citations` is always `[]` at runtime until re-enabled.

## Removed Components
- **Severity vs Funding scatter chart** (was on overview tab) — removed for clarity.
- **Overall Funding (FTS) radial circles** (was on country detail) — redundant with the funding gap bar and appeal breakdown.
- **Active crisis banner** (was above tabs in sidebar) — removed for cleaner UX; crisis context is visible in the Crises tab detail view.
- **Spike selector** (was above tabs in sidebar) — moved to globe overlay as a switch bar in the bottom-right control group.
- **Spike color mode toggle** (was bottom-left of globe) — removed from UI; spectrum mode still exists in context state for programmatic use.
- **Spike mode label** (was bottom-left of globe, "Spikes: Funding Gap") — replaced by the labeled switch bar in the bottom-right control group.
- **Spectrum legend** (was top-left of globe) — removed along with the spectrum toggle UI.
- **Chat overlay panel** (was `fixed top-0 right-0 bottom-0` full-height slide-in) — replaced by inline embedded split-panel inside the sidebar.
- **Citation chips** (were clickable `_CitationChip` buttons in `ChatMessageBubble`) — removed from pipeline and UI. System prompt no longer requests citations; `parsed.citations` is always `[]`. All extraction helpers and `_CitationChip` component are preserved (prefixed `_`) for future re-enablement.

## Near-Term Engineering Priorities
- Add automated regression tests for key aggregations (especially crisis-country joins and ranking outputs).
- Introduce optional year parameterization for comparative views.
- Add data validation checks/warnings for malformed or multi-code source rows.
- Resolve ESLint 10 + Next.js 16 FlatCompat incompatibility (currently using direct TypeScript-eslint config as workaround).
