"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Info, Brain, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";


/* ------------------------------------------------------------------ */
/*  Sub-components for each content section                            */
/* ------------------------------------------------------------------ */

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[13px] font-semibold font-mono text-cyan-300 tracking-wide uppercase mt-4 mb-1.5">
      {children}
    </h3>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] leading-relaxed text-foreground/75 mb-2">
      {children}
    </p>
  );
}

function BulletList({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-none space-y-1 mb-2 ml-1">
      {items.map((item, i) => (
        <li
          key={i}
          className="text-[12px] leading-relaxed text-foreground/75 flex gap-1.5"
        >
          <span className="text-cyan-500/60 shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 1 — About                                                      */
/* ------------------------------------------------------------------ */

function AboutTab() {
  return (
    <div className="pr-1">
      <SectionHeading>Purpose</SectionHeading>
      <Paragraph>
        UN Crisis Monitor is an analytics platform that unifies humanitarian
        funding, crisis severity, and aid delivery data to help budget committees
        identify where needs and funding are most mismatched. It surfaces
        overlooked crises and underfunded countries so decision-makers can
        allocate resources based on evidence rather than media salience.
      </Paragraph>

      <SectionHeading>Data Sources (2025)</SectionHeading>
      <BulletList
        items={[
          <>
            <strong className="text-cyan-200/80">OCHA Financial Tracking Service (FTS)</strong>{" "}
            — requirements and funding by country/plan, split into on-appeal
            (tied to formal plan lines) and off-appeal (unattributed) streams.
          </>,
          <>
            <strong className="text-cyan-200/80">INFORM Severity Index</strong>{" "}
            — 0–5 severity scores per crisis and per country from the Jan 2026
            snapshot, used as the primary severity signal.
          </>,
          <>
            <strong className="text-cyan-200/80">Country-Based Pooled Funds (CBPF)</strong>{" "}
            — allocations by sector/cluster with people targeted and people
            reached, enabling delivery-rate analysis.
          </>,
          <>
            <strong className="text-cyan-200/80">The GDELT Project & Per-Crisis Cited Sources</strong>{" "}
            — narrative summaries, timelines, and external links 
          </>,
        ]}
      />

      <SectionHeading>Key Capabilities</SectionHeading>
      <BulletList
        items={[
          "Overlooked crisis and country rankings powered by the Neglect Index — a composite score combining severity, funding coverage, and scale.",
          "Absolute funding gap analysis with on-appeal vs. off-appeal breakdown to prevent misleading aggregate statistics.",
          "Statistical anomaly detection that flags extreme outliers in funding coverage, per-capita gaps, and severity-funding mismatch.",
          "Interactive 3D globe with severity-driven spikes, country borders, and click-through to detailed views.",
          "Per-country appeal breakdown showing individual plan lines (HRP, flash appeal, regional plans) so within-country imbalances are visible.",
          "CBPF cluster-level delivery analysis showing allocation, targeted population, and reach rates per sector.",
          "AI-assisted natural language querying over the full dataset via RAG pipeline.",
        ]}
      />

      <SectionHeading>Important Caveats</SectionHeading>
      <BulletList
        items={[
          "On-appeal and off-appeal funding behave differently. The default view uses on-appeal % funded for fair comparison. Off-appeal totals (e.g., bilateral aid) are shown separately.",
          "Crisis-level totals can overlap when a country appears in multiple crises. Rankings are valid for triage but not globally additive.",
          "CBPF reach ratios of 0% typically indicate conflict-related access denial or reporting lag, not misappropriation.",
        ]}
      />

      <div className="mt-4 pt-3 border-t border-cyan-500/10">
        <p className="text-[10px] font-mono text-cyan-400/30 tracking-widest uppercase text-center">
          Data: OCHA FTS · INFORM · HDX · Analysis year: 2025
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab 2 — Methodology                                                */
/* ------------------------------------------------------------------ */

function MethodologyTab() {
  return (
    <div className="pr-1">
      <SectionHeading>Neglect Index</SectionHeading>
      <Paragraph>
        The Neglect Index ranks crises and countries by how structurally
        under-resourced they are, combining three factors:
      </Paragraph>
      <div className="bg-black/40 border border-cyan-500/15 rounded-md px-3 py-2 mb-2 font-mono text-[11px] text-cyan-200/80">
        Neglect = (Severity / 5) × (1 − % Funded) × log₁₀(1 + Requirements / $1M)
      </div>
      <BulletList
        items={[
          <><strong className="text-cyan-200/80">Severity / 5</strong> — normalizes the INFORM Severity Index (0–5) to a 0–1 scale. Higher severity increases the score.</>,
          <><strong className="text-cyan-200/80">1 − % Funded</strong> — uses on-appeal funding only (the comparable denominator). A crisis funded at 20% contributes 0.80.</>,
          <><strong className="text-cyan-200/80">log₁₀(1 + Req / $1M)</strong> — a logarithmic scale factor that rewards scale without letting billion-dollar crises overwhelm everything. $3B requirements ≈ 3.48; $50M ≈ 1.71.</>,
        ]}
      />
      <Paragraph>
        Country-level rankings use the official INFORM country severity (aggregate across all crises). Crisis-level rankings use the maximum per-crisis severity and sum requirements across all affected countries.
      </Paragraph>

      <SectionHeading>On-Appeal vs. Off-Appeal Funding</SectionHeading>
      <Paragraph>
        The FTS dataset contains two types of rows:
      </Paragraph>
      <BulletList
        items={[
          <><strong className="text-cyan-200/80">On-appeal</strong> — tied to a named plan line with non-zero requirements. These have a clear denominator, making &quot;% funded&quot; meaningful and comparable across countries.</>,
          <><strong className="text-cyan-200/80">Off-appeal</strong> — labeled &quot;Not specified&quot; with funding but no requirements. Real money, but not attributable to a formal plan line. In 2025, $7.16B falls in this category.</>,
        ]}
      />
      <Paragraph>
        Mixing both streams inflates global % funded from 33.7% to 49.5% and weakens the correlation between severity and funding coverage (Spearman correlation drops from 0.452 to 0.257). The default view uses on-appeal only.
      </Paragraph>

      <SectionHeading>Anomaly Detection</SectionHeading>
      <Paragraph>
        Percentile-based outlier detection flags countries with statistically
        extreme funding patterns. Each country is ranked against all
        crisis-affected peers (~66 countries) for three metrics:
      </Paragraph>
      <BulletList
        items={[
          <><strong className="text-cyan-200/80">Percent funded (low tail)</strong> — countries receiving the smallest share of their requirements.</>,
          <><strong className="text-cyan-200/80">Funding gap per capita (high tail)</strong> — countries with the largest per-person shortfalls.</>,
          <><strong className="text-cyan-200/80">Severity-funding mismatch (high tail)</strong> — high-severity countries that are disproportionately underfunded.</>,
        ]}
      />

      <div className="bg-black/40 border border-cyan-500/15 rounded-md px-3 py-2 mb-2">
        <p className="text-[11px] font-mono text-cyan-200/80 mb-1">Severity thresholds:</p>
        <div className="flex gap-4 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
            <span className="text-foreground/60">Critical — ≤ P5 or ≥ P95</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-foreground/60">Warning — P5–P10 or P90–P95</span>
          </span>
        </div>
      </div>

      <Paragraph>
        Percentile ranking is used instead of z-scores because humanitarian
        funding data is heavily right-skewed (σ ≈ mean for most metrics),
        making parametric thresholds impossible to trigger. Percentiles are
        distribution-agnostic and correctly identify tail extremes regardless of
        shape. Minimum cohort size: 5 countries.
      </Paragraph>

      <SectionHeading>CBPF Delivery Rate</SectionHeading>
      <Paragraph>
        The reach ratio (people reached ÷ people targeted) measures aid delivery
        effectiveness per CBPF cluster. Rates near 0% with meaningful
        allocations typically signal conflict-related access denial. The system
        highlights these at the cluster level in country and crisis views.
      </Paragraph>

      <SectionHeading>Data Processing</SectionHeading>
      <BulletList
        items={[
          "All datasets are filtered to 2025 at aggregation time.",
          "Countries are joined by ISO3 with alias handling for naming variants.",
          "Multi-ISO crisis rows (e.g., \"ECU, PER\") are expanded so every affected country appears in its crisis.",
          "Anomaly detection runs at build time — no runtime cost.",
          "Severity fallback: if a country is missing from the INFORM country sheet, the max per-crisis severity is used.",
        ]}
      />

      <div className="mt-4 pt-3 border-t border-cyan-500/10">
        <p className="text-[10px] font-mono text-cyan-400/30 tracking-widest uppercase text-center">
          Full methodology: STATISTICS.md in project repository
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main dialog                                                        */
/* ------------------------------------------------------------------ */

export function AboutDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          title="About this tool"
          className="cursor-pointer flex items-center justify-center w-8 h-8 rounded-full bg-black/80 backdrop-blur-sm border border-cyan-500/30 shadow-[0_0_10px_rgba(0,200,255,0.15)] text-cyan-400 hover:bg-black/90 hover:border-cyan-400/50 transition-all"
        >
          <Info className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent
        className="bg-black/95 backdrop-blur-xl border-cyan-500/20 shadow-[0_0_40px_rgba(0,200,255,0.08)] sm:max-w-2xl max-h-[80vh] flex flex-col gap-0 p-0 overflow-hidden"
        showCloseButton
      >
        {/* Scanline overlay matching sidebar aesthetic */}
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-30 rounded-lg"
          style={{
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.01) 2px, rgba(0,255,255,0.01) 4px)",
          }}
        />

        <DialogHeader className="relative z-10 px-5 pt-5 pb-0 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-cyan-100 font-mono tracking-tight">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 to-red-800 shadow-[0_0_10px_rgba(220,40,40,0.3)]">
              <img
                src="/logo3.svg"
                alt="VisiUN logo"
                className="h-8 w-8 rounded-lg shadow-[0_0_12px_rgba(220,40,40,0.5)]"
              />
            </div>
            VisiUN
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="about" className="relative z-10 flex flex-col flex-1 min-h-0 px-5 pb-5 pt-3">
          <TabsList className="w-full grid grid-cols-2 h-9 bg-black/60 border border-cyan-500/15 shrink-0">
            <TabsTrigger
              value="about"
              className="text-xs font-mono data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300 data-[state=active]:shadow-[0_0_8px_rgba(0,200,255,0.2)] text-cyan-400/50"
            >
              <Info className="h-3.5 w-3.5 mr-1.5" />
              About
            </TabsTrigger>
            <TabsTrigger
              value="methodology"
              className="text-xs font-mono data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300 data-[state=active]:shadow-[0_0_8px_rgba(0,200,255,0.2)] text-cyan-400/50"
            >
              <Brain className="h-3.5 w-3.5 mr-1.5" />
              Methodology
            </TabsTrigger>
          </TabsList>

          <TabsContent value="about" className="flex-1 min-h-0 mt-3 data-[state=inactive]:hidden">
            <ScrollArea className="max-h-[calc(80vh-160px)]" style={{ height: 'calc(80vh - 160px)' }}>
              <div className="pr-3">
                <AboutTab />
              </div>
            </ScrollArea>
          </TabsContent>
          <TabsContent value="methodology" className="flex-1 min-h-0 mt-3 data-[state=inactive]:hidden">
            <ScrollArea className="max-h-[calc(80vh-160px)]" style={{ height: 'calc(80vh - 160px)' }}>
              <div className="pr-3">
                <MethodologyTab />
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
