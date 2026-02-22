import { NextRequest, NextResponse } from "next/server";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGroq } from "@langchain/groq";
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
let _groqLlm: ChatGroq | null = null;
let _hfTextLlm: HuggingFaceInference | null = null;
let _hfFallbackLlm: RunnableLambda<BaseMessage[], AIMessageChunk> | null = null;
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
 * Serialise a `BaseMessage[]` into a ChatML-style prompt string.
 *
 * This is a better default for Qwen Instruct models than Mistral's `[INST]`.
 * It also tends to improve adherence to "respond ONLY with JSON" constraints.
 */
function messagesToChatMlPrompt(messages: BaseMessage[]): string {
  const parts: string[] = [];

  for (const msg of messages) {
    if (msg instanceof SystemMessage) {
      parts.push(`<|im_start|>system\n${String(msg.content)}<|im_end|>`);
      continue;
    }
    if (msg instanceof HumanMessage) {
      parts.push(`<|im_start|>user\n${String(msg.content)}<|im_end|>`);
      continue;
    }
    // AIMessage or other
    parts.push(`<|im_start|>assistant\n${String(msg.content)}<|im_end|>`);
  }

  // Signal the model to continue as assistant.
  parts.push("<|im_start|>assistant\n");
  return parts.join("\n").trim();
}

/**
 * Primary Fallback LLM: Llama 3.3 70B via Groq.
 *
 * ChatGroq implements the same ChatModel interface as ChatOpenAI, so it plugs
 * directly into `.withFallbacks()` with no wrapper needed.
 */
function getGroqFallbackLlm(): ChatGroq {
  if (!_groqLlm) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("Missing env var: GROQ_API_KEY");
    _groqLlm = new ChatGroq({
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      maxTokens: 1024,
      apiKey,
    });
  }
  return _groqLlm;
}

/**
 * Secondary Fallback LLM: Meta-Llama-3-8B-Instruct via HuggingFace Inference API.
 *
 * Last line of defence if both OpenRouter and Groq are unavailable.
 *
 * `HuggingFaceInference` is a text LLM (string in → string out). We wrap it in a
 * `RunnableLambda` that accepts `BaseMessage[]` and returns an `AIMessageChunk`
 * so the Runnable signature matches `ChatOpenAI` — required for `.withFallbacks()`.
 */
function getHfFallbackLlm(): RunnableLambda<BaseMessage[], AIMessageChunk> {
  if (!_hfFallbackLlm) {
    const apiKey = process.env.HF_TOKEN;
    if (!apiKey) throw new Error("Missing env var: HF_TOKEN");
    if (!_hfTextLlm) {
      _hfTextLlm = new HuggingFaceInference({
        model: "meta-llama/Meta-Llama-3-8B-Instruct",
        apiKey,
        temperature: 0,
        maxTokens: 1024,
        endpointUrl:
          "https://router.huggingface.co/hf-inference/models/meta-llama/Meta-Llama-3-8B-Instruct",
      });
    }
    const hfTextLlm = _hfTextLlm;
    _hfFallbackLlm = new RunnableLambda({
      func: async (messages: BaseMessage[]): Promise<AIMessageChunk> => {
        const prompt = messagesToChatMlPrompt(messages);
        const text = await hfTextLlm.invoke(prompt);
        return new AIMessageChunk({ content: text });
      },
    });
  }
  return _hfFallbackLlm;
}

// ── ISO3 → Country Name Reference ──────────────────────────────────────────────
// Authoritative mapping injected into the system prompt so the LLM (especially
// the weaker Mistral-7B fallback) never has to guess country names from codes.

const ISO3_TO_NAME: Record<string, string> = {
  AFG: "Afghanistan", AGO: "Angola", ALB: "Albania", ARG: "Argentina",
  ARM: "Armenia", AZE: "Azerbaijan", BDI: "Burundi", BEN: "Benin",
  BFA: "Burkina Faso", BGD: "Bangladesh", BLR: "Belarus", BOL: "Bolivia",
  BRA: "Brazil", CAF: "Central African Republic", CHL: "Chile",
  CHN: "China", CIV: "Côte d'Ivoire", CMR: "Cameroon", COD: "Democratic Republic of the Congo",
  COG: "Republic of the Congo", COL: "Colombia", CRI: "Costa Rica",
  CUB: "Cuba", DJI: "Djibouti", DOM: "Dominican Republic", DZA: "Algeria",
  ECU: "Ecuador", EGY: "Egypt", ERI: "Eritrea", ETH: "Ethiopia",
  GEO: "Georgia", GHA: "Ghana", GIN: "Guinea", GMB: "Gambia",
  GTM: "Guatemala", GNB: "Guinea-Bissau", GUY: "Guyana", HND: "Honduras",
  HTI: "Haiti", IDN: "Indonesia", IND: "India", IRN: "Iran",
  IRQ: "Iraq", ISR: "Israel", JOR: "Jordan", KEN: "Kenya",
  KGZ: "Kyrgyzstan", KHM: "Cambodia", LAO: "Laos", LBN: "Lebanon",
  LBR: "Liberia", LBY: "Libya", LKA: "Sri Lanka", LSO: "Lesotho",
  MAR: "Morocco", MDA: "Moldova", MDG: "Madagascar", MEX: "Mexico",
  MLI: "Mali", MMR: "Myanmar", MNG: "Mongolia", MOZ: "Mozambique",
  MRT: "Mauritania", MWI: "Malawi", NAM: "Namibia", NER: "Niger",
  NGA: "Nigeria", NIC: "Nicaragua", NPL: "Nepal", PAK: "Pakistan",
  PAN: "Panama", PER: "Peru", PHL: "Philippines", PNG: "Papua New Guinea",
  PRK: "North Korea", PRY: "Paraguay", PSE: "Palestine",
  RWA: "Rwanda", SAU: "Saudi Arabia", SDN: "Sudan", SEN: "Senegal",
  SLE: "Sierra Leone", SLV: "El Salvador", SOM: "Somalia",
  SSD: "South Sudan", SWZ: "Eswatini", SYR: "Syria", TCD: "Chad",
  TGO: "Togo", THA: "Thailand", TJK: "Tajikistan", TKM: "Turkmenistan",
  TLS: "Timor-Leste", TUN: "Tunisia", TUR: "Turkey", TZA: "Tanzania",
  UGA: "Uganda", UKR: "Ukraine", URY: "Uruguay", UZB: "Uzbekistan",
  VEN: "Venezuela", VNM: "Vietnam", YEM: "Yemen", ZAF: "South Africa",
  ZMB: "Zambia", ZWE: "Zimbabwe",
};

/** Resolve an ISO3 code to "CountryName (ISO3)". Returns the code unchanged if no mapping exists. */
function iso3ToLabel(code: string): string {
  const name = ISO3_TO_NAME[code.toUpperCase()];
  return name ? `${name} (${code.toUpperCase()})` : code;
}

// ── System Prompt ──────────────────────────────────────────────────────────────

/**
 * Build a compact ISO3 reference block for the system prompt.
 * Format: "AFG=Afghanistan, AGO=Angola, …" — compact to save tokens.
 */
function buildIso3ReferenceBlock(): string {
  return Object.entries(ISO3_TO_NAME)
    .map(([code, name]) => `${code}=${name}`)
    .join(", ");
}

function buildSystemPrompt(docs: Document[]): string {
  const context = docs
    .map((doc, i) => `[${i + 1}] ${doc.pageContent}`)
    .join("\n");

  const iso3Ref = buildIso3ReferenceBlock();

  return `You are the UN Crisis Monitor AI assistant. You analyze humanitarian funding data, INFORM severity indices, and CBPF (Country-Based Pooled Fund) allocations for 2025.

ISO3 COUNTRY CODE REFERENCE (use this to map codes to names):
${iso3Ref}

IMPORTANT: The retrieved context below uses ISO3 codes (e.g. "UGA", "BGD"). You MUST translate these to full country names using the reference above. For example, UGA = Uganda, BGD = Bangladesh, COL = Colombia, AGO = Angola, COD = Democratic Republic of the Congo. NEVER write a country as just its ISO3 code.

RETRIEVED CONTEXT:
${context}

RESPONSE RULES:
1. Answer the user's question using ONLY the retrieved context above.
2. ALWAYS use full country names with ISO3 in parentheses: "Uganda (UGA)", NOT "UGA" or "UGA (UGA)".
3. If the question is primarily about one country, set focusIso3 to that country's 3-letter ISO3 code.
4. Do NOT include citation markers like [1], [2].
5. If the data is insufficient, say so clearly.
6. Use markdown formatting (bold, bullet lists) for readability.
7. Keep responses concise and factual. Do not add section headers like "Focus:", "Note:", or "Key Facts:" at the end.
8. Do NOT confuse country codes. AGO is Angola, COD is Democratic Republic of the Congo, COG is Republic of the Congo.

You MUST respond with ONLY a valid JSON object (no extra text before or after):
{"message": "Your response here", "focusIso3": "ISO3 or null"}`;
}

// ── LCEL Retrieval Chain — lazy singleton ─────────────────────────────────────

/**
 * Returns (and caches) the full LCEL RAG pipeline:
 *   1. Retrieve top-K documents from PineconeStore using the last user message.
 *   2. Build [SystemMessage, ...history] with the retrieved context injected.
 *   3. Invoke the three-tier LLM fallback chain (OpenRouter/Llama-3 → Groq/Llama-3.3 → HF/Llama-3).
 *   4. Extract the raw string from the AIMessage output.
 *
 * Built lazily so env vars are validated on first request, not at module load.
 */
function getRagChain(): RunnableSequence<{ messages: MessageInput[] }, string> {
  if (!_ragChain) {
    const llmWithFallback = getPrimaryLlm().withFallbacks({
      fallbacks: [getGroqFallbackLlm(), getHfFallbackLlm()],
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

      // Step 3 — Primary (OpenRouter/Llama-3) → Groq/Llama-3.3 → HF/Llama-3 fallback
      llmWithFallback,

      // Step 4 — Pull the text string out of the AIMessage
      new StringOutputParser(),
    ]);
  }
  return _ragChain;
}

// ── Response sanitisation helpers ──────────────────────────────────────────────

/**
 * Manually unescape JSON string escape sequences for the case where
 * JSON.parse fails on the captured regex group (e.g. unbalanced quotes).
 * Handles: \n \t \r \" \\ \/ \b \f
 */
function unescapeJsonString(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\b/g, "\b")
    .replace(/\\f/g, "\f")
    .replace(/\\\//g, "/")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

/**
 * Detect and convert literal two-char escape sequences (\n, \t, \r) that
 * slipped through as raw text rather than being interpreted by JSON.parse.
 * Only applies when the string actually contains these sequences — avoids
 * touching content that is already correctly formatted.
 */
function normalizeLiteralEscapes(s: string): string {
  if (!s.includes("\\n") && !s.includes("\\t") && !s.includes("\\r")) {
    return s;
  }
  return unescapeJsonString(s);
}

// ── Citation helpers — reserved for future expansion ─────────────────────────
// These functions are not active in the current pipeline. They are preserved
// so citation support can be re-enabled without re-implementing the logic.

/**
 * Parse individual citation JSON objects that are NOT wrapped in a `[…]`
 * array. Preserved for future citation expansion.
 */
function parseLooseCitationObjects(text: string): ChatResponse["citations"] {
  const citations: ChatResponse["citations"] = [];
  const objectPattern = /\{[^{}]*\}/g;
  let match: RegExpExecArray | null;
  while ((match = objectPattern.exec(text)) !== null) {
    try {
      const obj = JSON.parse(match[0]);
      if (obj && typeof obj.type === "string" && typeof obj.label === "string") {
        citations.push(obj);
      }
    } catch {
      // Not valid JSON — skip
    }
  }
  return citations;
}

/**
 * Try to rescue citations from the raw text via regex when JSON.parse failed.
 */
function extractFallbackCitations(text: string): ChatResponse["citations"] {
  const citMatch = text.match(/"citations"\s*:\s*(\[[\s\S]*\])/);
  if (!citMatch) return [];
  try {
    const arr = JSON.parse(citMatch[1]);
    if (Array.isArray(arr)) return arr;
  } catch {
    // citations array wasn't valid JSON either
  }
  return [];
}

/**
 * Boundary-based message extraction: find the raw value between `"message":`
 * and the next known JSON key (`"focusIso3"`, `"citations"`) or closing `}`.
 *
 * This handles three LLM failure modes that break JSON.parse:
 *   1. Properly quoted value with unescaped internal quotes (truncates regex)
 *   2. Completely unquoted value (no quotes at all)
 *   3. Malformed escaping (e.g. single-backslash before non-escape chars)
 *
 * Once the raw slice is isolated, if it's wrapped in quotes we attempt
 * JSON.parse for proper unescaping, then fall back to manual unescaping.
 */
function extractMessageByBoundary(text: string): string | null {
  const keyMatch = text.match(/"message"\s*:\s*/);
  if (!keyMatch || keyMatch.index === undefined) return null;

  const valueStart = keyMatch.index + keyMatch[0].length;
  const remainder = text.slice(valueStart);

  // Find the boundary: ,"focusIso3" or ,"citations" (with flexible whitespace)
  const boundaryMatch = remainder.match(/,\s*"(?:focusIso3|citations)"\s*:/);
  let rawValue: string;
  if (boundaryMatch && boundaryMatch.index !== undefined) {
    rawValue = remainder.slice(0, boundaryMatch.index);
  } else {
    // No next key found — take everything up to the last closing brace
    const closingBrace = remainder.lastIndexOf("}");
    rawValue = closingBrace !== -1 ? remainder.slice(0, closingBrace) : remainder;
  }

  rawValue = rawValue.trim();
  // Strip trailing comma left over from the JSON structure
  rawValue = rawValue.replace(/,\s*$/, "");

  // If the value is wrapped in quotes, try JSON string parse for proper unescaping
  if (rawValue.startsWith('"')) {
    // Find the actual closing quote (the last `"` in the raw value)
    const lastQuote = rawValue.lastIndexOf('"');
    if (lastQuote > 0) {
      const jsonCandidate = rawValue.slice(0, lastQuote + 1);
      try {
        return JSON.parse(jsonCandidate) as string;
      } catch {
        // Unescaped internal quotes — strip outer quotes and manually unescape
        return unescapeJsonString(rawValue.slice(1, lastQuote));
      }
    }
  }

  // Unquoted value — use as-is
  return rawValue;
}

/**
 * Quick heuristic: does the text look like the plain-text key-value format
 * ("Message: ...\nFocusIso3: ...\nCitations: [...]") rather than a JSON
 * object?  Used to short-circuit the firstBrace/lastBrace extraction that
 * otherwise mistakes the `{` inside the Citations array for a JSON envelope.
 */
function isPlainTextKeyValueFormat(text: string): boolean {
  return /^Message\s*:/im.test(text) && !text.trimStart().startsWith("{");
}

/**
 * Parse plain-text key-value format that some LLMs produce instead of JSON.
 *
 * Uses section-based parsing — locating every known top-level key at the
 * start of a line and slicing between them — so multi-line message bodies
 * are captured correctly.  The previous regex approach with `$` in a
 * `m`-flag lookahead would terminate the capture at the first line-end,
 * truncating multi-paragraph messages.
 *
 * Recognised keys (case-insensitive): Message, FocusIso3, Citations.
 *
 *   Message: Venezuela is trapped in a profound...
 *   Multi-line paragraph content is preserved.
 *
 *   FocusIso3: VEN
 *
 *   Citations: [ { "type": "country", ... } ]
 */
function extractPlainTextResponse(text: string): ChatResponse | null {
  const keyPattern = /^(Message|FocusIso3|Citations)\s*:\s*/gim;
  const keys: { key: string; valueStart: number; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = keyPattern.exec(text)) !== null) {
    keys.push({ key: m[1].toLowerCase(), valueStart: m.index + m[0].length, index: m.index });
  }

  if (!keys.some((k) => k.key === "message")) return null;

  // Build key → raw-value map (each value runs from after the colon to the
  // start of the next key, or end-of-string for the last key).
  const sections: Record<string, string> = {};
  for (let i = 0; i < keys.length; i++) {
    const valueEnd = i + 1 < keys.length ? keys[i + 1].index : text.length;
    sections[keys[i].key] = text.slice(keys[i].valueStart, valueEnd).trim();
  }

  const message = sections.message;
  if (!message) return null;

  let focusIso3: string | undefined;
  if (sections.focusiso3) {
    const fm = sections.focusiso3.match(/^([A-Z]{3})/i);
    if (fm) focusIso3 = fm[1].toUpperCase();
  }

  let citations: ChatResponse["citations"] = [];
  if (sections.citations) {
    const bracketMatch = sections.citations.match(/\[[\s\S]*\]/);
    if (bracketMatch) {
      try {
        const arr = JSON.parse(bracketMatch[0]);
        if (Array.isArray(arr)) citations = arr;
      } catch {
        // Citations array wasn't valid JSON
      }
    }
    // Fall back to loose citation objects (not wrapped in [])
    if (citations.length === 0) {
      citations = parseLooseCitationObjects(sections.citations);
    }
  }

  return { message, focusIso3, citations };
}

/**
 * Handle freeform LLM responses that embed a "Citations:" section header
 * inline within the message body — no `Message:` key, no JSON envelope.
 *
 * Example:
 *   Yemen is heavily affected by various crises…
 *
 *   Citations:
 *   { "type": "country", "iso3": "YEM", … }
 *   { "type": "crisis", … }
 *
 *   Note: Some trailing text.
 *
 * The text is split at the `Citations:` header.  Everything before becomes
 * the message; citation objects after the header are parsed (bracket-wrapped
 * array first, then loose `{…}` objects as fallback).
 */
function extractInlineCitationsResponse(text: string): ChatResponse | null {
  const citHeaderMatch = text.match(/(?:^|\n)\s*Citations\s*:\s*/im);
  if (!citHeaderMatch || citHeaderMatch.index === undefined) return null;

  const message = text.slice(0, citHeaderMatch.index).trim();
  if (!message) return null;

  const afterCitations = text.slice(
    citHeaderMatch.index + citHeaderMatch[0].length,
  );

  // Try bracket-wrapped array first, then fall back to loose objects
  let citations: ChatResponse["citations"] = [];
  const bracketMatch = afterCitations.match(/\[[\s\S]*\]/);
  if (bracketMatch) {
    try {
      const arr = JSON.parse(bracketMatch[0]);
      if (Array.isArray(arr)) citations = arr;
    } catch {
      /* fall through to loose objects */
    }
  }
  if (citations.length === 0) {
    citations = parseLooseCitationObjects(afterCitations);
  }

  // Only return if we actually extracted citations — otherwise the
  // "Citations:" header might be conversational text, not structure.
  if (citations.length === 0) return null;

  // Extract focusIso3 if present anywhere in the text
  let focusIso3: string | undefined;
  const focusMatch = text.match(/\bFocusIso3\s*:\s*([A-Z]{3})/i);
  if (focusMatch) focusIso3 = focusMatch[1].toUpperCase();

  return { message, focusIso3, citations };
}

/**
 * When JSON.parse fails on the full response, attempt to rescue the "message"
 * and "focusIso3" values via regex so we never surface the raw JSON envelope
 * to the user, and country focus is preserved even in the fallback path.
 */
function extractFallbackResponse(text: string): ChatResponse {
  // Strategy 1: JSON-shaped — quoted or unquoted "message" key with boundary extraction
  let focusIso3: string | undefined;
  const focusMatch = text.match(/"focusIso3"\s*:\s*"([A-Z]{3})"/i);
  if (focusMatch) focusIso3 = focusMatch[1].toUpperCase();

  const message = extractMessageByBoundary(text);
  if (message) {
    return { message, citations: extractFallbackCitations(text), focusIso3 };
  }

  // Strategy 2: Plain-text key-value format (Message: ..., FocusIso3: ..., Citations: ...)
  const plainText = extractPlainTextResponse(text);
  if (plainText) return plainText;

  // Strategy 3: Freeform text with inline "Citations:" section header
  const inlineCit = extractInlineCitationsResponse(text);
  if (inlineCit) return inlineCit;

  // No recognizable format — return text as-is
  return { message: text, citations: [] };
}

/**
 * Final safeguard: if the message string still looks like it contains the raw
 * JSON response envelope (`{ "message": "...", ... }`), extract just the inner
 * message value.  This prevents the user from ever seeing protocol-level JSON.
 * Also normalises any literal \n sequences that survived the JSON parse path.
 */
function stripJsonEnvelope(message: string): string {
  const trimmed = message.trim();

  // JSON object envelope
  if (trimmed.startsWith("{") && trimmed.includes('"message"')) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      if (typeof obj.message === "string" && obj.message) {
        return obj.message;
      }
    } catch {
      const extracted = extractMessageByBoundary(trimmed);
      if (extracted) return extracted;
    }
  }

  // Plain-text key-value format (Message: ... FocusIso3: ... Citations: ...)
  if (/^Message\s*:/im.test(trimmed)) {
    const pt = extractPlainTextResponse(trimmed);
    if (pt) return pt.message;
  }

  // Freeform text with inline "Citations:" section — strip citations from display
  const inlineCit = extractInlineCitationsResponse(trimmed);
  if (inlineCit) return inlineCit.message;

  return normalizeLiteralEscapes(message);
}

// ── Post-processing: ISO3 resolution & formatting cleanup ─────────────────────

/**
 * Replace bare ISO3 codes in the response with "CountryName (ISO3)".
 *
 * Patterns handled:
 *   - "UGA (UGA)"  → "Uganda (UGA)"          (code used as name with code in parens)
 *   - "**UGA**"    → "**Uganda (UGA)**"       (bold-wrapped ISO3)
 *   - Bare ISO3 at start of list item or sentence when not already preceded by a name
 *
 * Also strips trailing formatting artifacts that weaker models produce:
 *   - Trailing "**" without a matching opener
 *   - Trailing "Focus:" / "Note:" sections appended after the real answer
 */
function postProcessMessage(message: string): string {
  let result = message;

  // Fix "CODE (CODE)" → "CountryName (CODE)" — e.g. "UGA (UGA)" → "Uganda (UGA)"
  result = result.replace(
    /\b([A-Z]{3})\s*\(\1\)/g,
    (_match, code: string) => iso3ToLabel(code),
  );

  // Fix bare ISO3 codes used as country names in markdown bold: "**UGA**" → "**Uganda (UGA)**"
  result = result.replace(
    /\*\*([A-Z]{3})\*\*/g,
    (_match, code: string) => {
      const name = ISO3_TO_NAME[code];
      return name ? `**${name} (${code})**` : _match;
    },
  );

  // Fix bare ISO3 at start of bullet/numbered list items: "- UGA:" → "- Uganda (UGA):"
  result = result.replace(
    /^(\s*[-*]\s+)([A-Z]{3})(\s*[:(])/gm,
    (_match, prefix: string, code: string, suffix: string) => {
      const name = ISO3_TO_NAME[code];
      if (!name) return _match;
      // If suffix is "(", the parens are already there — just fix the name
      if (suffix.trim() === "(") return `${prefix}${name} (`;
      return `${prefix}${name} (${code})${suffix}`;
    },
  );

  // Fix bare ISO3 at start of sentence / after newline when followed by data
  // e.g. "UGA: $273M" → "Uganda (UGA): $273M"
  result = result.replace(
    /(?:^|\n)([A-Z]{3})(\s*:\s*\$)/gm,
    (match, code: string, suffix: string) => {
      const name = ISO3_TO_NAME[code];
      if (!name) return match;
      const nl = match.startsWith("\n") ? "\n" : "";
      return `${nl}${name} (${code})${suffix}`;
    },
  );

  // Strip trailing "Focus:" / "Note:" sections that Mistral appends
  result = result.replace(
    /\n+(?:Focus|Note|Summary)\s*:\s*[^\n]*$/i,
    "",
  );

  // Strip trailing dangling "**" (bold markers without matching opener)
  result = result.replace(/\*\*\s*$/, "").trimEnd();

  return result;
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

    // ── Robust response extraction ──────────────────────────────────────────────
    // LLMs answer in one of two shapes:
    //   A. A JSON object (possibly wrapped in ```json fences / preamble prose).
    //   B. Plain-text key-value pairs:  Message: …  FocusIso3: …  Citations: […]
    //
    // Shape B must be detected *before* the brace-based JSON extraction,
    // because the `{` inside the Citations array would otherwise be mistaken
    // for the opening brace of a JSON envelope, producing a garbage slice.

    const stripped = responseText
      .replace(/^```(?:json)?\s*/im, "")
      .replace(/\s*```\s*$/im, "")
      .trim();

    let parsed: ChatResponse;

    // Strategy 1: Plain-text key-value format (Message: … FocusIso3: … Citations: …)
    const plainTextResult = isPlainTextKeyValueFormat(stripped)
      ? extractPlainTextResponse(stripped)
      : null;

    if (plainTextResult) {
      parsed = plainTextResult;
    } else {
      // Strategy 2: Freeform text with inline "Citations:" section header.
      // Must be checked before brace extraction — the `{` inside citation
      // objects would otherwise be mistaken for a JSON envelope.
      const inlineCitResult = extractInlineCitationsResponse(stripped);

      if (inlineCitResult) {
        parsed = inlineCitResult;
      } else {
        // Strategy 3: JSON object extraction (outermost { … } block)
        const firstBrace = stripped.indexOf("{");
        const lastBrace = stripped.lastIndexOf("}");
        const jsonStr =
          firstBrace !== -1 && lastBrace > firstBrace
            ? stripped.slice(firstBrace, lastBrace + 1)
            : stripped;

        try {
          parsed = JSON.parse(jsonStr) as ChatResponse;
        } catch {
          // JSON.parse failed — try boundary / regex rescue before giving up.
          parsed = extractFallbackResponse(stripped || responseText);
        }
      }
    }

    // Defensive normalisation — ensure required fields are present and typed
    if (typeof parsed.message !== "string" || !parsed.message) {
      const raw = (parsed as unknown as Record<string, unknown>);
      parsed.message =
        typeof raw.text === "string"
          ? raw.text
          : stripped || responseText;
    }
    // Citations are disabled in the active pipeline — always return empty array.
    // The citation helpers above remain available for future re-enablement.
    parsed.citations = [];
    // Sanitise focusIso3: must be a 3-char string that exists in our ISO3 mapping
    if (
      typeof parsed.focusIso3 !== "string" ||
      parsed.focusIso3.length !== 3 ||
      !ISO3_TO_NAME[parsed.focusIso3.toUpperCase()]
    ) {
      parsed.focusIso3 = undefined;
    } else {
      parsed.focusIso3 = parsed.focusIso3.toUpperCase();
    }

    // Final safeguard: if `message` still looks like a raw JSON object (i.e. it
    // contains the wrapper schema keys), extract just the inner message value so
    // the user never sees the raw protocol envelope.
    parsed.message = stripJsonEnvelope(parsed.message);

    // ── Post-processing: fix ISO3-only references & formatting artifacts ────
    parsed.message = postProcessMessage(parsed.message);

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

