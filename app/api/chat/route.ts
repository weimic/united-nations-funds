import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { HuggingFaceInference } from "@langchain/community/llms/hf";
import { RunnableSequence, RunnableLambda } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  AIMessageChunk,
  BaseMessage,
} from "@langchain/core/messages";
import type { Document } from "@langchain/core/documents";
import { getVectorStore } from "@/vector-store";
import type { ChatResponse } from "@/lib/chat-types";

// ── Types ──────────────────────────────────────────────────────────────────────

type MessageInput = { role: "user" | "assistant"; content: string };

interface RetrievalInput {
  messages: MessageInput[];
  docs: Document[];
}

// ── Input guards ───────────────────────────────────────────────────────────────

/** Maximum number of messages retained from the conversation history. */
const MAX_HISTORY_MESSAGES = 20; // 10 user+assistant pairs
/** Maximum characters accepted per message (prevents token-exhaustion attacks). */
const MAX_CONTENT_LENGTH = 2_000;

// ── LLM Providers — lazy singletons ───────────────────────────────────────────
//
// LLMs are initialised on first use rather than at module load time so that:
//   1. Missing env vars produce a clear Error instead of silently baking in
//      an empty-string API key that fails with a cryptic 401 later.
//   2. Serverless cold starts don't allocate objects this route never uses.

let _primaryLlm: ChatOpenAI | null = null;
let _hfTextLlm: HuggingFaceInference | null = null;
let _fallbackLlm: RunnableLambda<BaseMessage[], AIMessageChunk> | null = null;
let _ragChain: RunnableSequence<{ messages: MessageInput[] }, string> | null = null;

/**
 * Primary LLM: Llama 3 via OpenRouter.
 * ChatOpenAI is used with a custom baseURL so the same LCEL interface works
 * unchanged — only the routing layer differs.
 */
function getPrimaryLlm(): ChatOpenAI {
  if (!_primaryLlm) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("Missing env var: OPENROUTER_API_KEY");
    _primaryLlm = new ChatOpenAI({
      model: "meta-llama/llama-3-8b-instruct",
      temperature: 0.3,
      maxTokens: 1024,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        apiKey,
        defaultHeaders: {
          "HTTP-Referer": "https://un-crisis-monitor.vercel.app",
          "X-Title": "UN Crisis Monitor",
        },
      },
    });
  }
  return _primaryLlm;
}

/**
 * Serialise a `BaseMessage[]` into a Mistral v0.3 instruct prompt string.
 *
 * Mistral format: the system message must be merged into the first [INST] block
 * alongside the first user turn — it cannot stand alone as its own [INST].
 *
 *   <s>[INST] {system}\n\n{user_1} [/INST] {assistant_1}</s>
 *   <s>[INST] {user_2} [/INST] {assistant_2}</s> …
 */
function messagesToMistralPrompt(messages: BaseMessage[]): string {
  const systemMsg = messages.find((m) => m instanceof SystemMessage);
  const systemContent = systemMsg ? String(systemMsg.content) : "";
  const turns = messages.filter((m) => !(m instanceof SystemMessage));

  const parts: string[] = [];
  let firstUser = true;

  for (const msg of turns) {
    if (msg instanceof HumanMessage) {
      const userContent = String(msg.content);
      const content =
        firstUser && systemContent
          ? `${systemContent}\n\n${userContent}`
          : userContent;
      parts.push(`<s>[INST] ${content} [/INST]`);
      firstUser = false;
    } else {
      // AIMessage or other — assistant turn closes the exchange
      parts.push(` ${String(msg.content)}</s>`);
    }
  }

  return parts.join("").trim();
}

/**
 * Fallback LLM: Mistral-7B via HuggingFace Inference API.
 *
 * @langchain/community@1.1.17 ships `HuggingFaceInference` as a text LLM
 * (string in → string out).  We wrap it in a `RunnableLambda` that accepts
 * `BaseMessage[]` and returns an `AIMessageChunk` so the Runnable signature is
 * identical to `ChatOpenAI` — a requirement for `.withFallbacks()`.
 */
function getFallbackLlm(): RunnableLambda<BaseMessage[], AIMessageChunk> {
  if (!_fallbackLlm) {
    const apiKey = process.env.HF_TOKEN;
    if (!apiKey) throw new Error("Missing env var: HF_TOKEN");
    if (!_hfTextLlm) {
      _hfTextLlm = new HuggingFaceInference({
        model: "mistralai/Mistral-7B-Instruct-v0.3",
        apiKey,
        temperature: 0.3,
        maxTokens: 1024,
        // api-inference.huggingface.co was decommissioned (HTTP 410).
        // endpointUrl causes _prepareHFInference() to call hfi.endpoint(url),
        // routing directly through the new HF router model URL.
        endpointUrl: "https://router.huggingface.co/hf-inference/models/mistralai/Mistral-7B-Instruct-v0.3",
      });
    }
    const hfTextLlm = _hfTextLlm;
    _fallbackLlm = new RunnableLambda({
      func: async (messages: BaseMessage[]): Promise<AIMessageChunk> => {
        const prompt = messagesToMistralPrompt(messages);
        const text = await hfTextLlm.invoke(prompt);
        return new AIMessageChunk({ content: text });
      },
    });
  }
  return _fallbackLlm;
}

// ── System Prompt ──────────────────────────────────────────────────────────────

function buildSystemPrompt(docs: Document[]): string {
  const context = docs
    .map((doc, i) => `[${i + 1}] ${doc.pageContent}`)
    .join("\n");

  return `You are the UN Crisis Monitor AI assistant. You analyze humanitarian funding data, INFORM severity indices, and CBPF (Country-Based Pooled Fund) allocations for 2025.

RETRIEVED CONTEXT:
${context}

INSTRUCTIONS:
- Answer the user's question based on the context above.
- When mentioning a specific country, include its ISO3 code in parentheses, e.g. "Sudan (SDN)".
- If the question is primarily about one country, set "focusIso3" to that country's ISO3 code.
- In your "citations" array, include entities you referenced. Use type "country" with the ISO3 code, or type "crisis" with the crisis name.
- If the data is insufficient to answer, say so clearly.
- Use markdown formatting for readability (bold, lists, tables where appropriate).

You MUST respond with valid JSON matching this exact schema:
{
  "message": "Your markdown-formatted response text.",
  "focusIso3": "ISO3" or null,
  "citations": [
    { "type": "country" or "crisis", "iso3": "ISO3_CODE", "crisisId": "optional_crisis_id", "label": "Display Name" }
  ]
}

Respond ONLY with the JSON object, no other text.`;
}

// ── LCEL Retrieval Chain — lazy singleton ─────────────────────────────────────

/**
 * Returns (and caches) the full LCEL RAG pipeline:
 *   1. Retrieve top-K documents from PineconeStore using the last user message.
 *   2. Build [SystemMessage, ...history] with the retrieved context injected.
 *   3. Invoke the LLM fallback chain (OpenRouter/Llama-3 → HF/Mistral-7B).
 *   4. Extract the raw string from the AIMessage output.
 *
 * Built lazily so env vars are validated on first request, not at module load.
 */
function getRagChain(): RunnableSequence<{ messages: MessageInput[] }, string> {
  if (!_ragChain) {
    const llmWithFallback = getPrimaryLlm().withFallbacks({
      fallbacks: [getFallbackLlm()],
    });

    _ragChain = RunnableSequence.from<{ messages: MessageInput[] }, string>([
      // Step 1 — Retrieve context from PineconeStore
      new RunnableLambda({
        func: async (input: { messages: MessageInput[] }): Promise<RetrievalInput> => {
          const lastUserMsg = [...input.messages]
            .reverse()
            .find((m) => m.role === "user");
          if (!lastUserMsg) throw new Error("No user message found in chain");

          const store = await getVectorStore();
          const retriever = store.asRetriever({ k: 8 });
          const docs = await retriever.invoke(lastUserMsg.content);

          return { messages: input.messages, docs };
        },
      }),

      // Step 2 — Format messages: system prompt + conversation history
      new RunnableLambda({
        func: (input: RetrievalInput): BaseMessage[] => {
          const systemMsg = new SystemMessage(buildSystemPrompt(input.docs));
          const history = input.messages.map((m) =>
            m.role === "user" ? new HumanMessage(m.content) : new AIMessage(m.content)
          );
          return [systemMsg, ...history];
        },
      }),

      // Step 3 — Primary (OpenRouter/Llama-3) with automatic HF/Mistral fallback
      llmWithFallback,

      // Step 4 — Pull the text string out of the AIMessage
      new StringOutputParser(),
    ]);
  }
  return _ragChain;
}

// ── Route Handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // ── Input validation & sanitisation ───────────────────────────────────────
    const rawMessages: MessageInput[] = Array.isArray(body.messages)
      ? body.messages
      : [];

    if (!rawMessages.length) {
      return NextResponse.json({ error: "No messages provided" }, { status: 400 });
    }

    // Truncate history to the last N messages and cap per-message content length
    const messages: MessageInput[] = rawMessages
      .slice(-MAX_HISTORY_MESSAGES)
      .map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content ?? "").slice(0, MAX_CONTENT_LENGTH),
      }));

    const lastUserMsg = messages.slice().reverse().find((m) => m.role === "user");
    if (!lastUserMsg) {
      return NextResponse.json({ error: "No user message found" }, { status: 400 });
    }

    // Invoke the LCEL chain — returns the raw LLM text string
    const responseText = await getRagChain().invoke({ messages });

    // ── Robust JSON extraction ─────────────────────────────────────────────────
    // LLMs frequently:
    //   • Wrap the JSON in ```json ... ``` code fences
    //   • Prepend a sentence before the opening brace
    //   • Append extra commentary after the closing brace
    // Strategy: strip fences first, then isolate the outermost { … } block.

    const stripped = responseText
      .replace(/^```(?:json)?\s*/im, "")
      .replace(/\s*```\s*$/im, "")
      .trim();

    // Find the outermost JSON object boundaries
    const firstBrace = stripped.indexOf("{");
    const lastBrace = stripped.lastIndexOf("}");
    const jsonStr =
      firstBrace !== -1 && lastBrace > firstBrace
        ? stripped.slice(firstBrace, lastBrace + 1)
        : stripped;

    let parsed: ChatResponse;
    try {
      parsed = JSON.parse(jsonStr) as ChatResponse;
    } catch {
      // Graceful fallback: surface the cleaned text as the message so the UI
      // still renders something useful rather than a raw JSON error.
      parsed = { message: stripped || responseText, citations: [] };
    }

    // Defensive normalisation — ensure required fields are present and typed
    if (typeof parsed.message !== "string" || !parsed.message) {
      const raw = (parsed as unknown as Record<string, unknown>);
      parsed.message =
        typeof raw.text === "string"
          ? raw.text
          : stripped || responseText;
    }
    if (!Array.isArray(parsed.citations)) {
      parsed.citations = [];
    }
    // Sanitise focusIso3: must be a 3-char string or omitted
    if (
      typeof parsed.focusIso3 !== "string" ||
      parsed.focusIso3.length !== 3
    ) {
      parsed.focusIso3 = undefined;
    }

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;

    if (status === 429) {
      return NextResponse.json(
        { error: "API_LIMIT_REACHED", message: "Rate limit reached. Please try again later." },
        { status: 429 }
      );
    }

    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "An unexpected error occurred." },
      { status: 500 }
    );
  }
}

