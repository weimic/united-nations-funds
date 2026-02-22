"use client";

import { useState, useCallback, useRef } from "react";
import type { ChatMessage, ChatResponse } from "@/lib/chat-types";

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
          content: data.message,
          citations: data.citations,
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
