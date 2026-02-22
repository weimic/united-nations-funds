import { PineconeStore } from "@langchain/pinecone";
import { getHFEmbeddings, getPinecone } from "@/lib/embeddings";

// Lazy singleton — reused across requests in the same Next.js server process.
let _vectorStore: PineconeStore | null = null;

/**
 * Returns a PineconeStore backed by HuggingFace Inference embeddings.
 * Uses `fromExistingIndex` — read-only, no upserts.
 *
 * Throws on missing env vars so the caller receives a proper error response
 * rather than a cryptic SDK failure.
 */
export async function getVectorStore(): Promise<PineconeStore> {
  if (!_vectorStore) {
    const indexName = process.env.PINECONE_INDEX;
    if (!indexName) throw new Error("Missing env var: PINECONE_INDEX");
    const pineconeIndex = getPinecone().index(indexName);
    _vectorStore = await PineconeStore.fromExistingIndex(getHFEmbeddings(), {
      pineconeIndex,
    });
  }
  return _vectorStore;
}
