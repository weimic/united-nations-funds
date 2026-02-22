import { config as loadEnv } from "dotenv";
// Next.js stores secrets in .env.local; dotenv/config only reads .env by default.
loadEnv({ path: ".env.local" });
import { readFileSync } from "fs";
import { join } from "path";
import Papa from "papaparse";
import { Pinecone } from "@pinecone-database/pinecone";

const TARGET_YEAR = "2025";
/** HuggingFace feature-extraction model — 384-dim, matches Pinecone index. */
const HF_EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2";
/**
 * api-inference.huggingface.co was decommissioned (HTTP 410).
 * All inference now routes through router.huggingface.co.
 * Feature-extraction endpoint path: /hf-inference/models/<model>/pipeline/feature-extraction
 */
const HF_ROUTER_URL = `https://router.huggingface.co/hf-inference/models/${HF_EMBEDDING_MODEL}/pipeline/feature-extraction`;
/** HF Inference API can handle up to ~50 inputs per call; keep headroom. */
const BATCH_SIZE = 32;

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDollars(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Embed a batch of texts using the HuggingFace Inference feature-extraction
 * endpoint.  Response is directly `number[][]` for sentence-transformers models.
 */
async function embed(texts: string[]): Promise<number[][]> {
  const response = await fetch(
    HF_ROUTER_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: texts,
        options: { wait_for_model: true },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`HF Embedding API error ${response.status}: ${err}`);
  }

  // HF feature-extraction returns number[][] for batch inputs
  const data: number[][] = await response.json();
  return data;
}

// ── Build semantic sentences ───────────────────────────────────────────────────

interface FtsRow {
  countryCode: string;
  id: string;
  name: string;
  typeName: string;
  year: string;
  requirements: string;
  funding: string;
  percentFunded: string;
}

interface CbpfRow {
  Year: string;
  "CBPF Name": string;
  Cluster: string;
  "Total Allocations": string;
  "Targeted People": string;
  "Reached People": string;
}

interface CrisisDetail {
  crisis_name: string;
  summary: string;
  timeline?: Array<{ date: string; name: string; description: string }>;
}

function buildFtsSentences(): Array<{ text: string; metadata: Record<string, string> }> {
  const csv = readFileSync(join(__dirname, "../public/data/fts_requirements_funding_global.csv"), "utf-8");
  const { data } = Papa.parse<FtsRow>(csv, { header: true, skipEmptyLines: true });

  const results: Array<{ text: string; metadata: Record<string, string> }> = [];

  for (const row of data) {
    if (row.year !== TARGET_YEAR) continue;
    // Skip HXL tag row
    if (row.countryCode?.startsWith("#")) continue;

    const iso3 = row.countryCode;
    if (!iso3) continue;

    const requirements = parseFloat(row.requirements) || 0;
    const funding = parseFloat(row.funding) || 0;
    const pct = row.percentFunded ? parseInt(row.percentFunded) : 0;
    const planName = row.name || "Not specified";

    if (planName === "Not specified") {
      // Off-appeal row
      if (funding > 0) {
        const text = `In ${TARGET_YEAR}, ${iso3} received ${formatDollars(funding)} in off-appeal humanitarian funding (outside formal appeals).`;
        results.push({ text, metadata: { iso3, type: "funding", source: "fts_off_appeal" } });
      }
    } else {
      // On-appeal row
      const gap = requirements - funding;
      const text = `In ${TARGET_YEAR}, ${iso3} had humanitarian requirements of ${formatDollars(requirements)} under the "${planName}" (${row.typeName || "appeal"}), received ${formatDollars(funding)} (${pct}% funded), leaving a funding gap of ${formatDollars(gap)}.`;
      results.push({ text, metadata: { iso3, type: "funding", source: "fts_on_appeal" } });
    }
  }

  return results;
}

function buildCbpfSentences(): Array<{ text: string; metadata: Record<string, string> }> {
  const csv = readFileSync(join(__dirname, "../public/data/specificcrisis.csv"), "utf-8");
  const { data } = Papa.parse<CbpfRow>(csv, { header: true, skipEmptyLines: true });

  const results: Array<{ text: string; metadata: Record<string, string> }> = [];

  for (const row of data) {
    if (row.Year !== TARGET_YEAR) continue;

    const cbpfName = row["CBPF Name"];
    const cluster = row.Cluster;
    const allocations = parseFloat(row["Total Allocations"]) || 0;
    const targeted = parseInt(row["Targeted People"]) || 0;
    const reached = parseInt(row["Reached People"]) || 0;

    // Extract country name (strip regional suffixes like "(RhPF-WCA)")
    const parsedName = cbpfName.replace(/\s*\(.*?\)\s*$/, "").trim();

    const text = `In ${TARGET_YEAR}, the ${cbpfName} CBPF allocated ${formatDollars(allocations)} to the ${cluster} cluster, targeting ${formatNumber(targeted)} people and reaching ${formatNumber(reached)} people.`;

    results.push({
      text,
      metadata: {
        iso3: "", // Will be empty — CBPF names don't have ISO3 directly
        type: "cbpf",
        source: "specificcrisis",
        cbpfName: parsedName,
        cluster,
      },
    });
  }

  return results;
}

function buildCrisisDetailSentences(): Array<{ text: string; metadata: Record<string, string> }> {
  const json = readFileSync(join(__dirname, "../public/data/crisisdetails.json"), "utf-8");
  const crises: CrisisDetail[] = JSON.parse(json);

  const results: Array<{ text: string; metadata: Record<string, string> }> = [];

  for (const crisis of crises) {
    const text = `Crisis: ${crisis.crisis_name}. ${crisis.summary}`;
    results.push({
      text,
      metadata: {
        iso3: "",
        type: "crisis_detail",
        source: "crisisdetails",
        crisisName: crisis.crisis_name,
      },
    });

    // Add timeline entries as separate chunks for temporal queries
    if (crisis.timeline) {
      for (const event of crisis.timeline) {
        const eventText = `${crisis.crisis_name} — ${event.name} (${event.date}): ${event.description}`;
        results.push({
          text: eventText,
          metadata: {
            iso3: "",
            type: "crisis_detail",
            source: "crisisdetails_timeline",
            crisisName: crisis.crisis_name,
          },
        });
      }
    }
  }

  return results;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Starting data ingestion...\n");

  // Validate env
  for (const key of ["HF_TOKEN", "PINECONE_API_KEY", "PINECONE_INDEX"]) {
    if (!process.env[key]) {
      console.error(`Missing env var: ${key}`);
      process.exit(1);
    }
  }

  // Build all sentences
  const ftsSentences = buildFtsSentences();
  console.log(`FTS sentences: ${ftsSentences.length}`);

  const cbpfSentences = buildCbpfSentences();
  console.log(`CBPF sentences: ${cbpfSentences.length}`);

  const crisisSentences = buildCrisisDetailSentences();
  console.log(`Crisis detail sentences: ${crisisSentences.length}`);

  const allDocs = [...ftsSentences, ...cbpfSentences, ...crisisSentences];
  console.log(`\nTotal documents to embed: ${allDocs.length}`);

  // Initialize Pinecone
  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
  const index = pc.index(process.env.PINECONE_INDEX!);

  // Process in batches
  let upsertCount = 0;

  for (let i = 0; i < allDocs.length; i += BATCH_SIZE) {
    const batch = allDocs.slice(i, i + BATCH_SIZE);
    const texts = batch.map((d) => d.text);

    console.log(`\nEmbedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allDocs.length / BATCH_SIZE)} (${texts.length} docs)...`);

    const embeddings = await embed(texts);

    const vectors = batch.map((doc, j) => ({
      id: `doc-${i + j}`,
      values: embeddings[j],
      metadata: {
        ...doc.metadata,
        text: doc.text,
      },
    }));

    await index.upsert({ records: vectors });
    upsertCount += vectors.length;
    console.log(`Upserted ${upsertCount}/${allDocs.length} vectors`);
  }

  console.log(`\nIngestion complete! ${upsertCount} vectors in Pinecone index "${process.env.PINECONE_INDEX}".`);
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
