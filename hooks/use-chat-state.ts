"use client";

import { useState, useCallback, useRef } from "react";
import type { ChatMessage, ChatResponse } from "@/lib/chat-types";

/**
 * Client-side safeguard: if the message content looks like a raw JSON response
 * envelope (contains `"message":` key), extract just the inner message value.
 * Also normalises any literal \n two-char sequences that survive the API path.
 */
/**
 * Boundary-based extraction: find content between `"message":` and the next
 * known JSON key. Handles quoted values with unescaped internal quotes,
 * completely unquoted values, and other LLM formatting failures.
 */
function extractMessageByBoundary(text: string): string | null {
  const keyMatch = text.match(/"message"\s*:\s*/);
  if (!keyMatch || keyMatch.index === undefined) return null;

  const valueStart = keyMatch.index + keyMatch[0].length;
  const remainder = text.slice(valueStart);

  const boundaryMatch = remainder.match(/,\s*"(?:focusIso3|citations)"\s*:/);
  let rawValue: string;
  if (boundaryMatch && boundaryMatch.index !== undefined) {
    rawValue = remainder.slice(0, boundaryMatch.index);
  } else {
    const closingBrace = remainder.lastIndexOf("}");
    rawValue = closingBrace !== -1 ? remainder.slice(0, closingBrace) : remainder;
  }

  rawValue = rawValue.trim().replace(/,\s*$/, "");

  if (rawValue.startsWith('"')) {
    const lastQuote = rawValue.lastIndexOf('"');
    if (lastQuote > 0) {
      const jsonCandidate = rawValue.slice(0, lastQuote + 1);
      try {
        return JSON.parse(jsonCandidate) as string;
      } catch {
        return rawValue.slice(1, lastQuote)
          .replace(/\\n/g, "\n")
          .replace(/\\t/g, "\t")
          .replace(/\\r/g, "\r")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\");
      }
    }
  }

  return rawValue;
}

function extractPlainTextMessage(text: string): string | null {
  const msgMatch = text.match(/^Message\s*:\s*([\s\S]*?)(?=\n\s*(?:FocusIso3|Citations)\s*:|$)/im);
  return msgMatch?.[1]?.trim() || null;
}

function sanitizeMessageContent(content: unknown): string {
  if (typeof content !== "string") return String(content ?? "");
  const trimmed = content.trim();
  let result = content;

  if (trimmed.startsWith("{") && trimmed.includes('"message"')) {
    // JSON object envelope
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      if (typeof obj.message === "string" && obj.message) {
        result = obj.message;
      }
    } catch {
      const extracted = extractMessageByBoundary(trimmed);
      if (extracted) result = extracted;
    }
  } else if (/^Message\s*:/im.test(trimmed)) {
    // Plain-text key-value format (Message: ... FocusIso3: ... Citations: ...)
    const extracted = extractPlainTextMessage(trimmed);
    if (extracted) result = extracted;
  }

  // Final safeguard: convert any surviving literal \n sequences to real newlines
  if (result.includes("\\n") || result.includes("\\t") || result.includes("\\r")) {
    result = result
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\r/g, "\r")
      .replace(/\\"/g, '"');
  }
  return result;
}

export function useChatState() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string): Promise<ChatResponse | undefined> => {
      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content,
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);
      setError(null);

      try {
        abortRef.current = new AbortController();

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, userMsg].map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
          signal: abortRef.current.signal,
        });

        if (res.status === 429) {
          setError("API_LIMIT_REACHED");
          return undefined;
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data: ChatResponse = await res.json();

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: sanitizeMessageContent(data.message),
          // citations omitted — citation pipeline disabled; preserved in types for future re-enablement
          focusIso3: data.focusIso3,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        return data;
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message || "Failed to send message");
        }
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [messages]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, clearMessages };
}
