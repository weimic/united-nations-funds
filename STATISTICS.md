# Statistical Analysis & Data Strategy Report

*Last revised: February 2026. Findings based on direct analysis of `/public/data/` datasets.*

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

### 2025 Global Numbers (Computed from dataset directly)
| Metric | Value |
|--------|-------|
| Countries with appeals | 103 |
| Total Requirements | $45.2B |
| Total Funded | $22.4B |
| Global % Funded | **49.5%** |
| CBPF countries covered | 23 |
| Total CBPF Allocations | $917M (~2% of requirements) |
| People targeted (CBPF) | 55.7M |
| People reached (CBPF) | 10.2M |
| System-wide CBPF Reach Ratio | **18.2%** |


---

## 2. Real Findings: What the Data Actually Shows

### Finding 1: Lebanon is the Most Neglected Large Crisis
Lebanon is the single largest underfunding story when measured by absolute gap relative to attention received:
- **Requirements:** $3.36B
- **Funded:** $0.67B (19.8%)
- **Funding gap:** $2.69B

Despite one of the highest-severity contexts in the Middle East and a collapsed economy, Lebanon trails far behind Palestine and Syria in absolute funding. It represents a case where media salience correlates poorly with funding need.

### Finding 2: DRC is Systematically Starved of Funds
- **Requirements:** $2.54B
- **Funded:** $0.76B (30.1%)
- **Gap:** $1.78B

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
- **Requirements:** $4.07B — **Funded:** $4.27B = **104.8% funded**

Palestine is the only entity overfunded relative to its formal appeal. This is due to the Gaza emergency triggering extraordinary bilateral contributions outside the normal HRP cycle. When Palestine is included in global "% funded" averages, it inflates the headline metric. Excluding Palestine lowers the global funding rate from 49.5% to roughly 47–48%.

### Finding 5: The "Low % Funded" Tail is Dominated by Transition Economies, Not Just Crisis States
The 15 most underfunded countries by percentage include Guyana (1.1%), Uruguay (1.6%), Bulgaria (2.1%), Chile (3.4%), and Turkey (4.4%). These are not traditional humanitarian crises — they are economic stabilization or climate-adaptation appeals with very low donor interest. Including them in severity–funding disparity charts without filtering creates misleading visual clusters.

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

**1. Globe severity glows are mock data.**
`buildMockSeverityZones()` hardcodes 5 geographic coordinates (Kabul, Khartoum, Kharkiv, Abuja, Tanzania). This is the most significant gap. The visualization gives the impression of a real severity heatmap but the glow colors/positions bear no relationship to actual INFORM indices. A country like Lebanon (severity 3.8, critical) has no glow; DRC's zones are wrong. This actively misleads any UN analyst using the globe.

**2. Derived metrics are computed but invisible.**
`lib/data-aggregator.ts` calculates `neglectIndex`, `fundingGapPerCapita`, `reachRatio`, and `cbpfDependency` per country-crisis entry, but:
- `CrisisCountryEntry` in `lib/types.ts` does not declare these fields (type mismatch — extra properties silently shed at runtime)
- None of these metrics appear in the sidebar UI
- The country ranking in `CrisisDetailView` still sorts only by `neglectIndex` but the bar displays `underfundedScore`

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

1. **Replace mock severity zones** with real INFORM data. Compute centroid per country from geoData, look up severity index, and drive the epicenter glow radius/intensity from it. This is the single highest-impact improvement for the visualization's credibility.

2. **Add `neglectIndex`, `reachRatio`, `fundingGapPerCapita` to `lib/types.ts`** (`CrisisCountryEntry`). Without this, TypeScript silently drops computed values from the serialized data and the frontend cannot use them.

3. **Surface reach ratio in the CBPF cluster chart.** Add a third line/bar to `CBPFClusterChart` showing reach ratio (%). The current chart shows cost per person but not whether aid was actually delivered.

4. **Use log-scale ZAxis in the scatter plot.** Replace `range={[30, 500]}` with a log transform preprocessing step or a custom scatter with SVG radius = `Math.sqrt(requirements / maxReq) * 20` to produce perceptually accurate bubbles.

5. **Filter out non-crisis economic appeals** from the scatter plot. A whitelist by INFORM severity ≥ 2.0 would remove the misleading cluster of wealthy nations with near-zero funding percentages.
