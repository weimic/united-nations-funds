import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { Pinecone } from "@pinecone-database/pinecone";

// ── HuggingFace Embeddings (sentence-transformers/all-MiniLM-L6-v2, 384-dim) ──

let _hfEmbeddings: HuggingFaceInferenceEmbeddings | null = null;

export function getHFEmbeddings(): HuggingFaceInferenceEmbeddings {
  if (!_hfEmbeddings) {
    const apiKey = process.env.HF_TOKEN;
    if (!apiKey) throw new Error("Missing env var: HF_TOKEN");
    _hfEmbeddings = new HuggingFaceInferenceEmbeddings({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      apiKey,
      // Route through the new HF Inference Router (api-inference.huggingface.co
      // was decommissioned). The "hf-inference" provider resolves to
      // https://router.huggingface.co/hf-inference internally within the SDK.
      provider: "hf-inference",
    });
  }
  return _hfEmbeddings;
}

// ── Pinecone client ────────────────────────────────────────────────────────────

let _pineconeClient: Pinecone | null = null;

export function getPinecone(): Pinecone {
  if (!_pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) throw new Error("Missing env var: PINECONE_API_KEY");
    _pineconeClient = new Pinecone({ apiKey });
  }
  return _pineconeClient;
}
