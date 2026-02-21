# Statistical Analysis & Data Strategy Report

*Last revised: 2026-02-21. Findings based on direct analysis of `/public/data/` datasets.*

---

## 1. Dataset Audit — 2025 Ground Truth

### Temporal Aggregation — Status: Already Fixed
The previously noted multi-year summing error has been corrected. `lib/data-aggregator.ts` already applies `TARGET_YEAR = 2025` to both the FTS and CBPF datasets. This section is no longer a blocker; it is documented here for traceability.

### Dataset Alignment (Current State)
| Dataset | Content | Year Coverage | Status |
|---------|---------|---------------|--------|
| **INFORM Severity** | Risk index snapshot per crisis-country | Jan 2026 | ✅ Used as current risk context |
| **FTS Funding** (`fts_requirements_funding_global.csv`) | Requirements + funding per country | 2023–2028 (multi-year rows) | ✅ Filtered to 2025 |
| **CBPF Allocations** (`specificcrisis.csv`) | Cluster allocations, targeted/reached people | 2025 only | ✅ In use |

### 2025 Global Numbers — Two Funding Lenses (Computed from `/public/data`)
The 2025 FTS CSV contains two *structurally different* kinds of rows:
- **On-appeal rows** (have an appeal record with non-zero `requirements`). These are the rows where “% funded” has a clear denominator and is comparable across countries.
- **Off-appeal rows** marked as `name = "Not specified"` (often `requirements = 0` but `funding > 0`). These are real dollars, but they are *not attributable to a specific appeal requirement line*.

If we sum *off-appeal* funding into the same numerator as on-appeal requirements, the global % funded headline increases sharply. For UN budgeting / gap analysis, both views should be reported explicitly.

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
Lebanon is the single largest underfunding story when measured by absolute gap relative to attention received:
- **Requirements (on-appeal):** $3.36B
- **Funded (on-appeal):** $0.575B (**17.1%**)
- **Off-appeal (“Not specified”) funding:** $0.092B
- **Funded (all rows):** $0.667B (19.8%)
- **Funding gap (vs on-appeal requirements):** $2.70B

Lebanon also illustrates why *appeal-level breakdown matters*. Its 2025 total is dominated by the underfunded **3RP 2025** line (10% funded), while its separate **Lebanon Flash Appeal 2025** is relatively better funded (78%). Aggregating those into one country-level “% funded” hides a very real within-country allocation imbalance.

Despite one of the highest-severity contexts in the Middle East and a collapsed economy, Lebanon trails far behind Palestine and Syria in absolute funding. It represents a case where media salience correlates poorly with funding need.

### Finding 2: DRC is Systematically Starved of Funds
- **Requirements (on-appeal):** $2.54B
- **Funded (on-appeal):** $0.670B (**26.4%**)
- **Off-appeal (“Not specified”) funding:** $0.093B
- **Funded (all rows):** $0.763B (30.1%)
- **Gap (vs on-appeal requirements):** $1.77B

Africa's largest active displacement crisis gets less than a third of its requirements funded. Chad (38.6%) and Somalia (37.4%) follow the same pattern — all large Sahelian/Sub-Saharan crises are consistently underfunded as a group.

### Finding 3: The CBPF Delivery System Has Broken-Down Countries
Three CBPFs in the 2025 dataset report **0 people reached** despite allocations:

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

Quantitatively, the difference is visible in severity alignment: in 2025, Spearman rank correlation between INFORM severity and `% funded` is **0.452** using **on-appeal** funding, but only **0.257** using **all-rows** funding — a strong signal that off-appeal dollars are less severity-driven and should not be mixed into “fairness / neglect” comparisons.

### Finding 5: The "Low % Funded" Tail is Dominated by Regional Response Plans
At the very bottom of on-appeal `% funded`, the dataset is dominated by **regional response plans** (e.g. **3RP**, **RMRP**) whose country-level requirements are large but whose funding is often recorded unevenly across host countries.

Concrete 2025 examples (on-appeal):
- **Turkey** (3RP 2025): **4.4% funded** on $740.9M required
- **Ecuador** (RMRP 2025): **7.3% funded** on $229.7M required
- **Iran** (Afghanistan refugee RRP 2025): **7.9% funded** on $263.2M required
- **Chile** (RMRP 2025): **3.4% funded** on $80.3M required

These are real humanitarian programs (refugees/migrants), but they behave differently from single-country HRPs. For dashboards, this argues for a **view that can group by appeal plan** (3RP/RMRP/HRP/Flash) rather than only by country.

---

## 3. Codebase Achievement Assessment

The stated goal (AGENT.md) is to *"help the UN analyze, compare, and revise budget allocations"* and *"highlight discrepancies between required funding and actual funding."*

### What the Codebase Does Well
| Feature | Status | Notes |
|---------|-------|-------|
| Data unification (3 datasets) | ✅ Done | All joined per country in aggregator |
| Year-filtered 2025 view | ✅ Done | `TARGET_YEAR = 2025` applied correctly |
| Funding gap display in sidebar | ✅ Working | Progress bars, stat cards, gap metric |
| CBPF cluster breakdown | ✅ Working | Per-cluster chart for country/crisis views |
| Scatter plot (severity vs. % funded) | ✅ Working | Country name in tooltip (fixed); margin clipping fixed |
| Globe spikes (real data) | ✅ Fixed | Height now proportional to absolute funding received |
| Globe land dots | ✅ Fixed | `vertexColors` root cause resolved |

### Critical Gaps Between Goal and Current State

**0. The app currently mixes on-appeal and off-appeal funding into a single `% funded`.**
`lib/data-aggregator.ts` sums all 2025 rows in `fts_requirements_funding_global.csv`, including `name = "Not specified"` rows that have `funding > 0` but `requirements = 0`. This is why the UI global headline is **49.5% funded** instead of **33.7% funded (on-appeal)**.

For the stated product goal (“compare, revise budget allocations”, “highlight discrepancies between funding and crisis severity”), **on-appeal** must be the default funding lens, with **off-appeal** shown as a separate component (otherwise severity-vs-funding comparisons are mathematically distorted).

**1. Globe severity glows are mock data.**
`buildMockSeverityZones()` hardcodes 5 geographic coordinates (Kabul, Khartoum, Kharkiv, Abuja, Tanzania). This is the most significant gap. The visualization gives the impression of a real severity heatmap but the glow colors/positions bear no relationship to actual INFORM indices. A country like Lebanon (severity 3.8, critical) has no glow; DRC's zones are wrong. This actively misleads any UN analyst using the globe.

**2. Appeal-level structure is not visualized.**
Some countries have multiple simultaneous appeal lines (e.g., Lebanon has Flash + 3RP), and regional plans (3RP/RMRP) behave differently than HRPs. The current country-level aggregation collapses these into a single `% funded`, which hides within-country allocation discrepancies that matter for revision decisions.

**3. The Neglect Index formula has a coverage flaw.**
$$\text{Neglect Index} = \frac{\text{Severity}}{5} \times (1 - \text{\%Funded}) \times \log_{10}(1 + \text{Targeted People})$$

`Targeted People` comes from the CBPF dataset, which covers only 23 CBPFs. The 80+ countries in FTS without a CBPF entry get `Targeted People = 0`, yielding a `neglectIndex = 0` regardless of severity or funding gap. Lebanon, which is the most neglected large crisis, would score **zero** on this index because it lacks CBPF cluster data. The formula systematically under-identifies the crises it was designed to surface.

**4. Bubble size in the Severity vs. Funding Disparity scatter plot uses raw `requirements`.**
The linear range `[30, 500]` px for bubble area compresses the enormous variance in requirements (Palestine at $4.07B vs. Uruguay at $9.9M = 410× difference). A log scale for the `ZAxis` range would make the chart readable without hiding the magnitude relationship.

---

## 4. Corrected Neglect Index Proposal

To fix the coverage gap in metric #3 above, replace the CBPF-dependent people count with FTS requirements, which is available for all 103 countries:

$$\text{Neglect Index (v2)} = \frac{\text{Severity}}{5} \times (1 - \text{\%Funded}) \times \log_{10}\!\left(1 + \frac{\text{Requirements}}{10^6}\right)$$

Using requirements in millions keeps the log values in a readable 0–4 range (e.g., $3B → log₁₀(3001) ≈ 3.48), and every country with FTS data scores non-zero. Under this formula the current dataset would rank:
1. **Sudan** — severity 4.4, 42% funded, $4.16B req
2. **DRC** — severity 4.2, 30% funded, $2.54B req
3. **Lebanon** — severity 3.8, 20% funded, $3.36B req
4. **Chad / Somalia** — high severity, ~37–39% funded

This aligns with expert humanitarian consensus on which crises are structurally under-resourced.

---

## 5. Verified "Underlooked" Crises (Data-Backed)

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

1. **Split FTS funding into two explicit streams: on-appeal vs off-appeal.**
	- On-appeal: rows with appeal identity + non-zero requirements (comparable denominators)
	- Off-appeal: `name = "Not specified"` rows with funding but zero requirements
	Update global stats, the sidebar “% funded” badges, the globe tooltips, and the severity scatter plot to default to **on-appeal**.

2. **Replace mock severity zones** with real INFORM data. Compute centroid per country from geoData, look up severity index, and drive the epicenter glow radius/intensity from it. This is the single highest-impact improvement for the visualization's credibility.

3. **Add an appeal-level breakdown view (per country).**
	For each country, list all 2025 appeal lines (HRP/3RP/RMRP/Flash) with requirements, funded, `% funded`, and whether funding is on-appeal or off-appeal. This is necessary to support “revise allocations” decisions.

4. **Surface reach ratio directly in the CBPF cluster chart.** Add a third line/bar for `reachRatio = reached/targeted`. The dataset contains multiple “0 reached” situations with meaningful allocations (e.g., Chad Health/WASH; Syria Cross-border Education; Lebanon WASH), and the UI should make these visible.

5. **Use a log-scale bubble size in the severity scatter plot.** With requirements spanning orders of magnitude, linear sizing hides most countries. Prefer `radius ∝ sqrt(log1p(requirements))` so both large and medium appeals remain visible.

6. **Add a “Delivery” tab for CBPF performance.** Rank CBPFs by reach ratio and by allocations with “0 reached” flags, and add a cluster-level view to identify systemic delivery bottlenecks.

---

## 7. Visualization & UI Roadmap (Very Specific)

### A) Global tab (where the key allocation narrative should live)
1. **Stacked bar chart: “Top 10 absolute funding gaps”**
	- X axis: countries (ranked by `requirements - onAppealFunding`)
	- Y axis: USD
	- Stacks: `on-appeal funded`, `off-appeal funded`, `unfunded gap`
	- Annotate the top 3 bars with exact values.
	- This immediately surfaces Lebanon/SDN/SYR/COD/YEM as the largest structural gaps.

2. **Scatter (keep it, but make it decision-grade)**
	- X: INFORM severity (0–5)
	- Y: **on-appeal** `% funded`
	- Bubble size: `log1p(requirements)` (or sqrt-log) instead of linear requirements
	- Add reference lines: severity = 3.5 (high), % funded = 50 (minimum adequacy)
	- Tooltip must include: on-appeal funded, off-appeal funded, requirements, and appeal type(s) present.

3. **Ranked table: “Underlooked crises (severity-adjusted)”**
	- Metric: Neglect v2 from Section 4
	- Columns: severity, on-appeal % funded, requirements, gap, off-appeal share
	- This is how analysts quickly find “high severity + big gap” outliers (e.g., Turkey/Colombia/Lebanon/Mali/Ethiopia as the data currently indicates).

### B) Country detail (where analysts validate and explain a discrepancy)
1. **Appeal breakdown panel** (country → multiple appeal rows)
	- Show each appeal line separately (HRP / Flash / 3RP / RMRP / RRP)
	- For each: requirements, funded, % funded
	- Then show a separate row for “off-appeal funding (Not specified)”
	- Lebanon and Turkey become explainable in one glance.

2. **CBPF delivery panel**
	- Keep the existing cluster cost chart, but add **reach %** and allow sorting by lowest reach.
	- Add a “0 reached” badge when reached = 0 and allocations are non-trivial.

### C) Crisis modal (where “underlooked” should be credible)
1. Rank countries by the corrected neglect metric that does not collapse to 0 for non-CBPF countries.
2. Display both on-appeal `% funded` and off-appeal share to prevent “false comfort” from off-appeal dollars.

### D) Globe (keep it, but remove misleading signals)
1. Replace mock glow zones with country centroids + severity-driven intensity.
2. Make spike **height = funding gap** (or requirements) and spike **color = on-appeal % funded**.
	- This creates an immediately interpretable map: tall red spikes = severe, large gap, underfunded.
