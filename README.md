# UN Crisis Monitor

An analytics and exploration tool for humanitarian funding and crisis severity, combining INFORM Severity, FTS funding, and CBPF allocation datasets to surface where needs and funding are most mismatched in 2025.

## Features

- **3D Globe** — interactive globe with country hover/click, severity glow, and spike overlays switchable between funding-gap and severity modes. Supports dot-cloud and solid-fill map styles.
- **Overview Tab** — underlooked crises and absolute funding-gap rankings, underlooked countries table (neglect index), and global funding progress cards.
- **Countries Tab** — searchable country list with sort/filter controls (severity, funding gap, neglect index). Clicking a country focuses the globe and shows country detail.
- **Country Detail** — severity summary, funding gap bar, per-country crisis list, appeal breakdown, and CBPF cluster analysis.
- **Crises Tab** — category-based crisis browsing with per-category aggregate stats and crisis detail view.
- **AI Chat Panel** — embedded RAG chatbot (LangChain LCEL + Pinecone) that answers questions about humanitarian data. Responses that identify a primary country focus the globe and switch to the Countries tab automatically.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **3D**: Three.js via React Three Fiber
- **Styling**: Tailwind CSS + shadcn/ui
- **AI**: LangChain LCEL · Pinecone vector store · OpenRouter (Llama-3) · HuggingFace (Mistral-7B fallback)
- **Data**: INFORM Severity, FTS requirements/funding CSV, CBPF specificcrisis CSV, GeoJSON country borders

## Getting Started

```bash
npm install
cp .env.local.example .env.local   # add OPENROUTER_API_KEY, HF_TOKEN, PINECONE_* keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Description |
|---|---|
| `OPENROUTER_API_KEY` | OpenRouter API key (primary LLM) |
| `HF_TOKEN` | HuggingFace token (fallback LLM) |
| `PINECONE_API_KEY` | Pinecone API key |
| `PINECONE_INDEX` | Pinecone index name |

### Ingest Data

Populate the Pinecone vector store from the source CSVs:

```bash
npx ts-node scripts/ingest-data.ts
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint check |

## Architecture Notes

See [AGENT.md](AGENT.md) for detailed state, data modelling, and engineering notes.

Neglect index: `(severity / 5) × (1 − % funded) × log₁₀(1 + requirements / $1M)`

Globe coordinate mapping puts the prime meridian facing the camera: `x = cos(lat)·sin(lon), y = sin(lat), z = cos(lat)·cos(lon)`
