# Statistical Analysis & Data Strategy Report

*Last revised: 2026-02-21. Findings based on direct analysis of the datasets in `/public/data/`.*

This report is written for a general audience. When it uses an acronym or a humanitarian-program term, it defines it on first use and in the glossary below.

## Quick glossary (plain language)
- **Requirements**: the amount of money requested/needed for a humanitarian plan in a given year.
- **Funding**: money reported as received.
- **% funded**: funding divided by requirements.
- **Appeal / plan line**: a formal humanitarian funding request tracked as a named plan (for example, a country plan or a regional plan).
- **FTS**: the UN Office for the Coordination of Humanitarian Affairs (**OCHA**) **Financial Tracking Service** dataset (funding and requirements).
- **CBPF**: **Country-Based Pooled Funds** (a specific pooled-funding mechanism; dataset includes allocations and “people targeted/reached”).
- **INFORM Severity Index**: a 0–5 score (higher means more severe/higher risk) used here as a consistent severity signal.
- **ISO3**: a three-letter country code (for example, USA, LBN, COD) used to join datasets.
- **Cluster / sector**: a humanitarian “sector” such as Health, Food, Shelter, Water/Sanitation, etc.
- **HRP**: **Humanitarian Response Plan** (a country-level plan line).
- **RRP**: **Refugee Response Plan** (a refugee-focused plan line).
- **3RP**: **Regional Refugee and Resilience Plan** (a multi-country refugee response plan line).
- **RMRP**: **Regional Migrant Response Plan** (a multi-country migration response plan line).
- **Flash Appeal**: an urgent, short-notice funding request after a shock event.
- **On-appeal vs off-appeal (in the FTS CSV)**:
	- **On-appeal**: rows tied to a specific plan line that has non-zero requirements (these have a clear denominator).
	- **Off-appeal**: rows labeled `"Not specified"` that often have funding but no requirements (real dollars, but not directly comparable as “% funded”).

---

## 1. Dataset Audit — 2025 Ground Truth

### Temporal Aggregation — Status: Already Fixed
The previously noted multi-year summing error has been corrected. `lib/data-aggregator.ts` already applies `TARGET_YEAR = 2025` to both the FTS and CBPF datasets. This section is no longer a blocker; it is documented here for traceability.

### Dataset Alignment (Current State)
| Dataset | Content | Year Coverage | Status |
|---------|---------|---------------|--------|
| **INFORM Severity** | Severity index snapshot per crisis-country (0–5 scale) | Jan 2026 | ✅ Used as current severity context |
| **FTS (Financial Tracking Service)** (`fts_requirements_funding_global.csv`) | Requirements + funding by country/plan | 2023–2028 (multi-year rows) | ✅ Filtered to 2025 |
| **CBPF (Country-Based Pooled Funds)** (`specificcrisis.csv`) | Allocations by sector/cluster; people targeted and reached | 2025 only | ✅ In use |

### 2025 Global Numbers — Two Funding Lenses (Computed from `/public/data`)
The 2025 FTS CSV contains two *different kinds of rows*, and mixing them changes the headline statistics:
- **On-appeal rows**: tied to a specific plan line that has non-zero requirements. These are the rows where “% funded” is meaningful and comparable across countries.
- **Off-appeal rows**: labeled `name = "Not specified"` and often have funding but no requirements. These are real dollars, but they are not cleanly attributable to a plan line with a denominator.

Because of that structure, we report two views side-by-side:
- **On-appeal only**: best for comparing shortfalls fairly (“who is most underfunded relative to what they asked for?”).
- **All rows**: shows total reported funding, including money not linked to a plan line.

| Metric | On-appeal only (appeal rows) | All FTS rows (incl. `Not specified`) |
|--------|------------------------------|--------------------------------------|
| Countries with non-zero requirements | 66 | 66 |
| Country codes present in the 2025 file | 103 | 103 |
| Total Requirements | $45.19B | $45.19B |
| Total Funding | $15.23B | $22.39B |
| Global % Funded | **33.7%** | **49.5%** |
| “Not specified” funding (req = 0) | — | **$7.16B** (99 rows) |

CBPF (specific crisis allocations) for 2025:

| Metric | Value |
|--------|-------|
| CBPF countries covered | 23 |
| Total CBPF Allocations | $917.1M (~2% of requirements) |
| People targeted (CBPF) | 55.68M |
| People reached (CBPF) | 10.16M |
| System-wide CBPF Reach Ratio | **18.2%** |


---

## 2. Real Findings: What the Data Actually Shows

### Finding 1: Lebanon is the Most Neglected Large Crisis
Lebanon is the single largest underfunding story when measured by absolute shortfall (how many dollars are missing relative to what was requested):
- **Requirements (on-appeal):** $3.36B
- **Funded (on-appeal):** $0.575B (**17.1%**)
- **Off-appeal (“Not specified”) funding:** $0.092B
- **Funded (all rows):** $0.667B (19.8%)
- **Funding gap (vs on-appeal requirements):** $2.70B

Lebanon also illustrates why a **plan-line breakdown** matters. In 2025 it includes multiple plan lines with very different funding coverage. When those are collapsed into one country-level “% funded”, a real within-country imbalance gets hidden.

Despite one of the highest-severity contexts in the Middle East and a collapsed economy, Lebanon trails far behind Palestine and Syria in absolute funding. It represents a case where media salience correlates poorly with funding need.

### Finding 2: DRC is Systematically Starved of Funds
- **Requirements (on-appeal):** $2.54B
- **Funded (on-appeal):** $0.670B (**26.4%**)
- **Off-appeal (“Not specified”) funding:** $0.093B
- **Funded (all rows):** $0.763B (30.1%)
- **Gap (vs on-appeal requirements):** $1.77B

Africa's largest active displacement crisis gets less than a third of its requirements funded. Chad (38.6%) and Somalia (37.4%) follow the same pattern — all large Sahelian/Sub-Saharan crises are consistently underfunded as a group.

### Finding 3: The CBPF Delivery System Has Broken-Down Countries
Three CBPFs in the 2025 dataset report **0 people reached** despite having money allocated:

| CBPF | Allocated | Targeted | Reached | Reach Ratio |
|------|-----------|----------|---------|-------------|
| Haiti (RhPF-LAC) | $2.2M | 49,267 | 0 | **0%** |
| Chad (RhPF-WCA) | $10.6M | 579,280 | 0 | **0%** |
| Niger (RhPF-WCA) | $5M | 184,167 | 0 | **0%** |
| Burkina Faso (RhPF-WCA) | $9M | 250,575 | 1,500 | **0.6%** |
| CAR | $7.1M | 805,178 | 6,761 | **0.8%** |

This is a critical signal: money was spent, zero or near-zero aid reached people. The cause is almost certainly conflict-related access denial, not misappropriation — but the data cannot distinguish these. Syria Cross-Border ($49M allocated, 3.5% reach) is the same pattern at far greater scale.

### Finding 4: Palestine is an Outlier That Can Skew Global Statistics
Palestine is *only* “overfunded” under the **all-rows** lens:
- **Requirements (on-appeal):** $4.07B
- **Funded (on-appeal):** $2.53B (**62.1% funded**)
- **Off-appeal (“Not specified”) funding:** $1.74B
- **Funded (all rows):** $4.27B (**104.8% funded**)

Interpretation:
- The on-appeal view indicates a still-substantial gap inside the formal appeal system.
- The all-rows view indicates large volumes of funding that do not tie cleanly to appeal requirements (likely extraordinary bilateral/other channels).

This is not unique to Palestine. **Ethiopia** is another example where off-appeal funding dominates (on-appeal 24.9% funded; all-rows 178% funded). Any dashboard that uses *all-rows* `% funded` as the default will systematically mis-rank countries and obscure true appeal shortfalls.

Quantitatively, the difference shows up when we ask a simple question: “Do more severe crises tend to be less funded?”

Using a rank-based correlation (Spearman; a way to measure how similarly two rankings move), the relationship between severity and “% funded” is:
- **0.452** when using **on-appeal** funding
- **0.257** when using **all rows**

That gap is a strong signal that off-appeal dollars behave differently, and should not be mixed into the default “fairness / neglect” comparisons.

### Finding 5: The "Low % Funded" Tail is Dominated by Regional Response Plans
At the very bottom of on-appeal “% funded”, the dataset is dominated by **regional plans** (multi-country refugee/migration responses) where requirements can be recorded per host country but funding can be recorded unevenly.

Concrete 2025 examples (on-appeal):
- **Turkey** (3RP 2025 — Regional Refugee and Resilience Plan): **4.4% funded** on $740.9M required
- **Ecuador** (RMRP 2025 — Regional Migrant Response Plan): **7.3% funded** on $229.7M required
- **Iran** (RRP 2025 — Refugee Response Plan): **7.9% funded** on $263.2M required
- **Chile** (RMRP 2025 — Regional Migrant Response Plan): **3.4% funded** on $80.3M required

These are real humanitarian programs (refugees/migrants), but they behave differently from single-country country plans (HRPs). For dashboards, this argues for a view that can group data by **plan line** (country plan vs regional plan vs flash appeal), not only by country.

---

## 3. Codebase Achievement Assessment

The stated goal (AGENT.md) is to *"help the UN analyze, compare, and revise budget allocations"* and *"highlight discrepancies between required funding and actual funding."*

### What the Codebase Does Well
| Feature | Status | Notes |
|---------|-------|-------|
| Data unification (3 datasets) | ✅ Done | All joined per country in aggregator |
| Year-filtered 2025 view | ✅ Done | `TARGET_YEAR = 2025` applied correctly |
| Funding lens split (on-appeal vs off-appeal) | ✅ Done | Default UI uses on-appeal; off-appeal totals are shown separately |
| Funding gap display in sidebar | ✅ Working | Progress bars, stat cards, gap metric |
| CBPF cluster breakdown | ✅ Working | Per-cluster chart for country/crisis views |
| Scatter plot (severity vs. % funded) | ✅ Working | Country name in tooltip (fixed); margin clipping fixed |
| Neglect Index v2 (requirements-based) | ✅ Done | Uses FTS requirements so non-CBPF countries are scored credibly |
| Underlooked rankings (countries + crises) | ✅ Done | Global tab includes country-level and crisis-level underlooked sections |
| Globe spikes (real data) | ✅ Fixed | Height now proportional to absolute funding received |
| Globe land dots | ✅ Fixed | `vertexColors` root cause resolved |
| Globe severity glows (real data) | ✅ Done | INFORM severity drives centroid-based glow zones (top severity countries) |

### Critical Gaps Between Goal and Current State

**0. Funding is now split into on-appeal vs off-appeal, but there is no “lens toggle” yet.**
The app now defaults to **on-appeal** “% funded” (the comparable denominator) and separately reports **off-appeal** funding totals. If analysts need to switch lenses depending on the question (gap analysis vs “total money in”), add a simple toggle to make “on-appeal vs all rows” explicit.

**1. Globe severity glows are now INFORM-driven, but should be treated as a hotspot overlay, not a full heatmap.**
The glow zones are now computed from country centroids and INFORM severity (top severity countries), which fixes the credibility issue. Remaining improvements would be to (a) expose the severity threshold/top-N as a UI control and (b) add legend/scale so the glow intensity is interpretable.

**2. Appeal-level structure is not visualized.**
Some countries have multiple simultaneous plan lines (for example, an urgent “flash appeal” plus a separate regional refugee plan line). Regional plans (multi-country refugee/migration plans) also behave differently than single-country plans. Collapsing everything into a single country-level “% funded” can hide within-country imbalances that matter for revision decisions.

**3. Crisis-level aggregation can overlap across crises.**
The INFORM dataset is structured as **(crisis × country)** entries, and a single country can appear in multiple crises. Any crisis-level totals that sum country requirements/funding will therefore **overlap across crises**. This is acceptable for ranking/triage, but it matters if a future view tries to interpret crisis totals as globally additive.

---

## 4. Corrected Neglect Index Proposal

To fix the coverage gap in metric #3 above, replace the CBPF-dependent “people targeted” count with FTS requirements (requested dollars), which is available for all countries in the FTS file:

$$\text{Neglect Index (v2)} = \frac{\text{Severity}}{5} \times (1 - \text{\%Funded}) \times \log_{10}\!\left(1 + \frac{\text{Requirements}}{10^6}\right)$$

Why the log term? Without it, very large crises would dominate the score completely. The logarithm grows slowly, so it rewards scale without letting it overwhelm everything.

Using requirements in millions keeps the log values in a readable 0–4 range (for example, $3B → log₁₀(3001) ≈ 3.48), and every country with FTS data gets a non-zero score. Under this formula the current dataset would rank:
1. **Sudan** — severity 4.4, 42% funded, $4.16B req
2. **DRC** — severity 4.2, 30% funded, $2.54B req
3. **Lebanon** — severity 3.8, 20% funded, $3.36B req
4. **Chad / Somalia** — high severity, ~37–39% funded

This aligns with expert humanitarian consensus on which crises are structurally under-resourced.

---

## 5. Verified “Underlooked” Countries (Data-Backed)

| Country | Req ($B) | % Funded | CBPF Reach | Key Finding |
|---------|---------|----------|------------|-------------|
| Lebanon | 3.36 | 19.8% | 10.2% | Largest underfunded crisis outside Africa |
| DRC | 2.54 | 30.1% | 15.1% | Africa's largest displacement crisis, chronically underfunded |
| Chad | 1.45 | 38.6% | 0% CBPF reached | Sahel overlap crisis; CBPF allocation completely undelivered |
| Syria Cross-Border | — | — | 3.5% | Large CBPF ($49M) but access denial means near-zero delivery |
| Haiti | — | — | 0% CBPF reached | $2.2M allocated, zero people reached |
| CAR | — | — | 0.8% | 805K targeted, 6.7K reached |

---

## 6. Recommended Next Steps (Prioritized)


1. **Split FTS funding into two explicit streams: on-appeal vs off-appeal.** ✅ Implemented
	- On-appeal: rows with appeal identity + non-zero requirements (comparable denominators)
	- Off-appeal: `name = "Not specified"` rows with funding but zero requirements
	Update global stats, the sidebar “% funded” badges, the globe tooltips, and the severity scatter plot to default to **on-appeal**.

2. **Replace mock severity zones** with real INFORM data. ✅ Implemented
	Compute centroid per country from geoData, look up severity index, and drive the epicenter glow radius/intensity from it.

3. **Add an appeal-level breakdown view (per country).**
	For each country, list all 2025 plan lines (for example: Humanitarian Response Plan, regional refugee/migration plans, flash appeals) with requirements, funded, “% funded”, and whether funding is on-appeal or off-appeal. This is necessary to support “revise allocations” decisions.

4. **Show delivery rate directly in the CBPF sector chart.** Add a visible “% reached” (people reached divided by people targeted). The dataset contains multiple “0 reached” situations with meaningful allocations (for example, allocations in Health/Water/Sanitation sectors with zero reported reach), and the UI should make these easy to spot.

5. **Use a log-scale bubble size in the severity scatter plot.** ✅ Implemented
	Requirements vary by orders of magnitude, so a linear bubble size hides most countries. The Global scatter now uses a log-scale bubble sizing so both large and medium crises remain visible.

6. **Add a “Delivery” tab for CBPF performance.** Rank CBPFs by reach ratio and by allocations with “0 reached” flags, and add a cluster-level view to identify systemic delivery bottlenecks.

---

## 7. Anomaly Detection — Percentile-Based Outlier Flagging

*Implemented in `lib/anomalies.ts`. Surfaced in Crisis Detail via `AnomalyBadge.tsx`.*

### Motivation

Humanitarian funding distributions are inherently noisy. A country may receive only 1% of its appeal requirements while the median is ~25%, or a high-severity crisis may be disproportionately underfunded. These statistical outliers often indicate **structural neglect, reporting gaps, or pipeline failures** that merit analyst attention. Rather than requiring manual inspection of every data point, we surface them automatically as inline anomaly badges with hover explanations.

### Why Not Z-Scores?

The initial implementation used parametric z-scores ($z = (x_i - \bar{x}) / \sigma$) with thresholds at $|z| \geq 2$ (warning) and $|z| \geq 3$ (critical). This approach **produced zero anomalies** across all metrics because:

1. **Heavy right skew**: humanitarian funding data has $\sigma \approx \bar{x}$ for most metrics (e.g., % funded: mean 25.8%, std 26.0%). A $z \leq -2$ threshold would require a value of $\bar{x} - 2\sigma = -26.2\%$, which is impossible for a percentage.
2. **Long right tails**: a few well-funded countries inflate both mean and variance, making the entire left tail appear "normal" under parametric assumptions.
3. **Same issue across all metrics**: dollar-per-person ($z = -2$ requires $-\$34.85$), reach ratio ($z = -2$ requires $-10.4\%$) — all impossible.

### Method: Percentile-Based Outlier Detection

Instead, we use **percentile ranking**, which is distribution-agnostic. Each country is ranked against a global cohort (all crisis-affected countries with valid data for a given metric), and its percentile position determines severity:

$$P_i = \frac{i}{n - 1} \times 100$$

where $i$ is the 0-indexed rank in ascending order and $n$ is the cohort size. This correctly identifies tail extremes regardless of distribution shape.

**Global cohort**: since the INFORM dataset maps each crisis as a single-country entry (126 crises, each with exactly 1 country), per-crisis cohorts are always size 1 — far too small for any statistical method. Instead, all unique countries across all crises are pooled by ISO3 into a single global cohort. For FTS-based metrics this yields ~66 countries.

**Minimum cohort size**: 5 countries. If fewer than 5 countries have valid data for a metric, percentile ranking is skipped for that metric.

### Thresholds

| Percentile Position | Severity | Interpretation |
|---------------------|----------|----------------|
| $P \leq 5$ (bottom 5%) | **Critical** | Extreme tail — most deprived relative to global peers |
| $5 < P \leq 10$ (bottom 5–10%) | **Warning** | Notable outlier — significantly below peers |
| $P \geq 95$ (top 5%) | **Critical** | Extreme tail — highest concentration/dependency |
| $90 \leq P < 95$ (top 5–10%) | **Warning** | Notable outlier — significantly above peers |
| $10 < P < 90$ | *No flag* | Within normal variation for the global cohort |

### Metrics Analyzed

| # | Metric | Formula | Flag Direction | Rationale |
|---|--------|---------|----------------|----------|
| 1 | **Percent funded** | $\frac{\text{FTS on-appeal funding}}{\text{requirements}} \times 100$ | Low (bottom P10) | Countries receiving the smallest share of their requirements — genuinely underfunded appeals |
| 2 | **Funding gap per capita** | $\frac{\text{requirements} - \text{funding}}{\text{people targeted}}$ | High (top P10) | Countries with the largest per-person shortfalls |
| 3 | **Severity-funding mismatch** | $\frac{\text{INFORM severity index}}{\text{percent funded}}$ | High (top P10) | High-severity countries that are disproportionately underfunded — the core "neglected crisis" signal |

### Why Only Three Metrics?

An earlier implementation tested six metrics. Critical review revealed that four were noisy or misleading:

- **Dollar per person** (CBPF allocation / targeted people): Conflated CBPF allocation with total funding adequacy — a country could receive massive bilateral aid but still flag because CBPF was small.
- **Reach ratio** (people reached / people targeted): Mostly flagged data-lag false positives — many countries report zero reached mid-year simply because results haven't been submitted yet.
- **Overfunded** (percent funded > 100%): An accounting artifact from appeal revisions, not a real anomaly — requirements often decrease mid-year while funding continues arriving.
- **Zero CBPF**: Flagged countries without a CBPF mechanism as anomalous — most of these countries simply don't participate in the pooled fund system, which is not unusual.

The three retained metrics are the most actionable and least prone to false positives.

### Current Detection Results (2025 Data Snapshot)

Based on the live datasets, the percentile engine detects approximately **15–20 anomalies** across **~12 unique countries**:

| Metric | Cohort Size | Critical | Warning | Example Flags |
|--------|-------------|----------|---------|---------------|
| Percent funded (low) | ~66 | ~4 | ~3 | Countries funded at <2% of requirements |
| Funding gap/capita (high) | ~40 | ~2 | ~2 | Largest per-person shortfalls |
| Severity-funding mismatch (high) | ~60 | ~3 | ~3 | High-severity countries with low funding shares |

### Implementation Details

1. **Build-time computation**: anomalies are detected during `aggregateAllData()` in `data-aggregator.ts` — after crisis/country data is fully assembled but before serialization. There is no runtime cost.
2. **Global cohort with ISO3 deduplication**: a country appearing in multiple crises is evaluated once against all peers. Results propagate to every `CrisisCountryEntry` sharing the same ISO3.
3. **Sorting**: within each country, anomalies are ordered critical-first, then by percentile rank ascending (lowest percentile = most extreme), so the most concerning findings surface first.
4. **Data model**: each `CrisisCountryEntry` carries an `anomalies: FundingAnomaly[]` array. The `FundingAnomaly` type includes `metric` (union of three metric names), `description` (human-readable sentence), `zScore` (percentile rank, 0–100), and `severity` ("warning" or "critical").

### UI Surfacing

- **Crisis-level banner**: at the top of Crisis Detail, a hoverable summary banner shows the total anomaly count across all countries in the crisis, broken down by critical/warning severity and number of affected countries. Hovering the banner reveals a tooltip listing every anomaly's detail.
- **Per-country badge**: each country card in the crisis detail shows a compact `AnomalyBadge` (amber for warning, red for critical). **Hovering the badge** reveals a tooltip listing each detected anomaly with its human-readable description — explaining *why* that specific country was flagged.

### Limitations & Future Work

- Percentile-based detection is **rank-invariant** — it does not distinguish between a country at 1% funded and one at 4% funded if they have similar ranks. Domain-specific thresholds could supplement percentiles for key interpretable cutoffs.
- The three metrics are analyzed independently (univariate). Multivariate approaches (e.g., Mahalanobis distance) could capture correlated anomalies that individual percentile checks miss.
- The global cohort pools very different country contexts (middle-income and LDCs together), which may mask within-group outliers. Sub-cohort analysis by income level or region could improve specificity.

---

## 8. Visualization & UI Roadmap (Very Specific)

### A) Global tab (where the key allocation narrative should live)
1. **Stacked bar chart: “Top 10 absolute funding gaps”**
	- Horizontal axis: countries (ranked by **requested funding minus on-appeal funding received**)
	- Vertical axis: USD
	- Stacks (three parts of each bar):
		- **Funded (on-appeal)**
		- **Funded (off-appeal / “Not specified”)**
		- **Unfunded gap**
	- Label the top 3 bars with exact dollar values.
	- This should immediately surface the largest structural gaps (for example: Lebanon, Sudan, Syria, DR Congo, Yemen).

2. **Scatter (keep it, but make it decision-grade)**
	- Horizontal axis: **INFORM severity** (0–5)
	- Vertical axis: **% funded (on-appeal)**
	- Bubble size: **requested funding**, but sized using a **logarithmic scale** so both small and very large crises are visible
	- Add simple reference lines:
		- severity = 3.5 (high severity)
		- % funded = 50% (a reasonable “minimum adequacy” reference line for discussion)
	- Tooltip must include:
		- requested funding
		- funded (on-appeal)
		- funded (off-appeal)
		- % funded (on-appeal) and % funded (all rows)
		- which plan lines exist (country plan vs regional plan vs flash appeal)

3. **Ranked tables: “Underlooked Countries” and “Underlooked Crises”** ✅ Implemented (core)
	- **Underlooked Countries (Severity-Adjusted)**
		- Metric: Neglect v2 from Section 4 (country-level)
		- Display: severity, on-appeal % funded, gap, off-appeal share (where relevant)
	- **Underlooked Crises (Crisis-Level)**
		- Aggregation: sum requirements + funding across all countries in the crisis
		- Metric: $\text{Crisis Neglect Index} = \frac{\max(\text{Severity})}{5} \times (1 - \text{\%Funded}) \times \log_{10}(1 + \frac{\text{Total Requirements}}{10^6})$
		- Display: countries count, max severity, % funded, and total gap
	- Interpretation note: crisis totals can overlap if a country belongs to multiple crises.

### B) Country detail (where analysts validate and explain a discrepancy)
1. **Appeal breakdown panel** (country → multiple appeal rows)
	- Show each plan line separately (examples: country plan, flash appeal, regional refugee plan, regional migrant plan)
	- For each plan line: requested funding, funded, % funded
	- Then show a separate row for “funded outside plan lines (off-appeal / ‘Not specified’)”
	- This makes countries like Lebanon and Turkey explainable in one glance.

2. **CBPF delivery panel**
	- Keep the existing sector chart, but add **% reached** and allow sorting by lowest % reached.
	- Add a clear “0 reached” badge when reached = 0 and the allocation is meaningfully large.

### C) Crisis modal (where “underlooked” should be credible)
1. Rank countries by the corrected neglect metric that does not collapse to 0 for non-CBPF countries.
2. Display both on-appeal `% funded` and off-appeal share to prevent “false comfort” from off-appeal dollars.

### D) Globe (keep it, but remove misleading signals)
1. Use country centroids + severity-driven intensity for the glow overlay (hotspots).
2. Make spike **height = funding gap** (or requested funding) and spike **color = % funded (on-appeal)**.
	- This creates an interpretable map: tall red spikes = severe, large gap, underfunded.
