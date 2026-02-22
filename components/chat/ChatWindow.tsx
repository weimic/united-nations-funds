"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Trash2, AlertTriangle, Bot } from "lucide-react";
import { useAppContext } from "@/lib/app-context";
import { useChatState } from "@/hooks/use-chat-state";
import { ChatMessageBubble } from "./ChatMessageBubble";
import type { ChatCitation } from "@/lib/chat-types";
import { cn } from "@/lib/utils";

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
  /** When true, renders inline (no fixed overlay) — used inside the sidebar split panel */
  embedded?: boolean;
}

const SUGGESTED_QUESTIONS = [
  "What is the most underfunded crisis in 2025?",
  "Which countries have the largest funding gaps?",
  "Tell me about the crisis in Sudan",
  "How is CBPF funding distributed?",
];

export function ChatWindow({ isOpen, onClose, embedded = false }: ChatWindowProps) {
  const { messages, isLoading, error, sendMessage, clearMessages } = useChatState();
  const {
    setGlobeFocusIso3,
    setSelectedCountryIso3,
    setSidebarTab,
    setActiveCrisis,
    data,
  } = useAppContext();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages — ref points directly at the scrollable div
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const query = input;
    setInput("");
    const response = await sendMessage(query);
    if (response?.focusIso3) {
      // Always focus the globe on the primary country mentioned
      setGlobeFocusIso3(response.focusIso3);
      // Only switch to countries tab / select the country if there are no crisis
      // citations — otherwise the crisis citation chips will route the sidebar.
      const hasCrisisCitations = response.citations?.some((c) => c.type === "crisis");
      if (!hasCrisisCitations) {
        setSelectedCountryIso3(response.focusIso3);
        setSidebarTab("countries");
      }
    }
  };

  const handleSuggestedQuestion = async (question: string) => {
    if (isLoading) return;
    const response = await sendMessage(question);
    if (response?.focusIso3) {
      setGlobeFocusIso3(response.focusIso3);
      const hasCrisisCitations = response.citations?.some((c) => c.type === "crisis");
      if (!hasCrisisCitations) {
        setSelectedCountryIso3(response.focusIso3);
        setSidebarTab("countries");
      }
    }
  };

  /** Resolve a crisis citation against the actual dataset. */
  const resolveCrisis = useCallback(
    (citation: ChatCitation) => {
      const labelLower = (citation.label || "").toLowerCase();
      const crisisIdLower = (citation.crisisId || "").toLowerCase();
      return data.crises.find(
        (c) =>
          c.crisisId === citation.crisisId ||
          c.crisisName.toLowerCase() === crisisIdLower ||
          c.crisisName.toLowerCase() === labelLower ||
          c.crisisName.toLowerCase().includes(crisisIdLower) ||
          c.crisisName.toLowerCase().includes(labelLower) ||
          crisisIdLower.includes(c.crisisName.toLowerCase())
      );
    },
    [data.crises]
  );

  /** Only keep citations that actually navigate somewhere on click. */
  const filterActionableCitations = useCallback(
    (citations: ChatCitation[] | undefined): ChatCitation[] => {
      if (!citations?.length) return [];
      return citations.filter((c) => {
        if (c.type === "country") return !!c.iso3;
        if (c.type === "crisis") return !!resolveCrisis(c);
        return false;
      });
    },
    [resolveCrisis]
  );

  const handleCitationClick = (citation: ChatCitation) => {
    if (citation.type === "country" && citation.iso3) {
      setGlobeFocusIso3(citation.iso3);
      setSelectedCountryIso3(citation.iso3);
      setSidebarTab("countries");
    } else if (citation.type === "crisis") {
      const crisis = resolveCrisis(citation);
      if (crisis) {
        setActiveCrisis(crisis);
        setSidebarTab("crises");
      }
    }
  };

  if (embedded) {
    return (
      <div className="flex flex-col h-full bg-transparent">
        {/* Embedded header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-500/20 shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">
              Crisis AI
            </span>
          </div>
          <button
            onClick={clearMessages}
            className="p-1 rounded text-cyan-500/50 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
            title="Clear chat"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>

        {/* Messages — scrollable div so ref works directly */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-6 space-y-3">
              <Bot className="h-6 w-6 text-cyan-500/30" />
              <p className="text-[10px] text-cyan-500/40 font-mono text-center uppercase tracking-wider">
                Ask about humanitarian funding, crises, or country data
              </p>
              <div className="flex flex-col gap-1.5 w-full">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSuggestedQuestion(q)}
                    className="text-left text-[10px] text-cyan-400/60 hover:text-cyan-300 px-2 py-1.5 rounded border border-cyan-500/10 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-colors font-mono"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessageBubble
              key={msg.id}
              message={{
                ...msg,
                citations: filterActionableCitations(msg.citations),
              }}
              onCitationClick={handleCitationClick}
            />
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse [animation-delay:0.2s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse [animation-delay:0.4s]" />
                  </div>
                  <span className="text-[10px] font-mono text-cyan-500/50 uppercase tracking-wider">Analyzing...</span>
                </div>
              </div>
            </div>
          )}

          {error === "API_LIMIT_REACHED" && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-amber-300/90 font-mono">
                At capacity for free requests. Please try again later.
              </p>
            </div>
          )}

          {error && error !== "API_LIMIT_REACHED" && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
              <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-[10px] text-red-300/90 font-mono">Error: {error}</p>
            </div>
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-2 border-t border-cyan-500/20 shrink-0">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a crisis or country..."
              disabled={isLoading}
              className="flex-1 bg-white/5 border border-cyan-500/20 rounded-lg px-3 py-1.5 text-xs text-cyan-100 placeholder:text-cyan-500/30 font-mono focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-2.5 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 hover:border-cyan-400/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed top-0 right-0 bottom-0 z-[60] w-[420px] flex flex-col",
        "bg-black/95 backdrop-blur-xl border-l border-cyan-500/20",
        "shadow-[-10px_0_40px_rgba(0,200,255,0.08)]",
        "transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/20">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest">
            Crisis AI
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearMessages}
            className="p-1.5 rounded text-cyan-500/50 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
            title="Clear chat"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-cyan-500/50 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Messages — plain div so scrollTop manipulation works directly */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Bot className="h-8 w-8 text-cyan-500/30" />
              <p className="text-xs text-cyan-500/40 font-mono text-center uppercase tracking-wider">
                Ask about humanitarian funding, crises, or country data
              </p>
              <div className="flex flex-col gap-2 w-full mt-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSuggestedQuestion(q)}
                    className="text-left text-xs text-cyan-400/60 hover:text-cyan-300 px-3 py-2 rounded border border-cyan-500/10 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-colors font-mono"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatMessageBubble
              key={msg.id}
              message={{
                ...msg,
                citations: filterActionableCitations(msg.citations),
              }}
              onCitationClick={handleCitationClick}
            />
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse [animation-delay:0.2s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse [animation-delay:0.4s]" />
                  </div>
                  <span className="text-[10px] font-mono text-cyan-500/50 uppercase tracking-wider">
                    Analyzing...
                  </span>
                </div>
              </div>
            </div>
          )}

          {error === "API_LIMIT_REACHED" && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300/90 font-mono">
                I&apos;m currently at capacity for free requests. Please try again later.
              </p>
            </div>
          )}

          {error && error !== "API_LIMIT_REACHED" && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30">
              <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-300/90 font-mono">
                Error: {error}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-cyan-500/20">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a crisis or country..."
            disabled={isLoading}
            className="flex-1 bg-white/5 border border-cyan-500/20 rounded-lg px-3 py-2 text-sm text-cyan-100 placeholder:text-cyan-500/30 font-mono focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-3 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/25 hover:border-cyan-400/50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
