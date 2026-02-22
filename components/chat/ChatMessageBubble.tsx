"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MapPin, AlertTriangle } from "lucide-react";
import type { ChatMessage, ChatCitation } from "@/lib/chat-types";
import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";

const mdComponents: Components = {
  p: ({ children }) => (
    <p className="text-sm text-cyan-100/90 mb-2 last:mb-0">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="text-cyan-300 font-semibold">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="text-cyan-200/80">{children}</em>
  ),
  code: ({ children }) => (
    <code className="text-xs font-mono bg-cyan-500/10 text-cyan-300 px-1 py-0.5 rounded">
      {children}
    </code>
  ),
  ul: ({ children }) => (
    <ul className="text-sm space-y-1 ml-4 list-disc text-cyan-100/80 mb-2">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="text-sm space-y-1 ml-4 list-decimal text-cyan-100/80 mb-2">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="text-sm">{children}</li>,
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="text-xs font-mono border-collapse w-full">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-cyan-500/30">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="text-left text-cyan-400 px-2 py-1 text-[10px] uppercase tracking-wider">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="text-cyan-100/80 px-2 py-1 border-b border-cyan-500/10">
      {children}
    </td>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-cyan-300 mt-3 mb-1">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-xs font-semibold text-cyan-400 mt-2 mb-1 uppercase tracking-wider">
      {children}
    </h4>
  ),
};

// _CitationChip is preserved for future re-enablement of the citation pipeline.
// It is not rendered in the current UI.
function _CitationChip({
  citation,
  onClick,
}: {
  citation: ChatCitation;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400/50 transition-colors cursor-pointer"
    >
      {citation.type === "country" ? (
        <MapPin className="h-2.5 w-2.5" />
      ) : (
        <AlertTriangle className="h-2.5 w-2.5" />
      )}
      {citation.label}
    </button>
  );
}

interface ChatMessageBubbleProps {
  message: ChatMessage;
  // onCitationClick preserved for future re-enablement; not active in current pipeline
  onCitationClick?: (citation: ChatCitation) => void;
}

/**
 * Last-resort safeguard: strip a JSON response envelope from content that
 * somehow reached the component without being cleaned upstream.
 * Also normalises any surviving literal \n two-char sequences → real newlines.
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

function safeBubbleContent(content: string): string {
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

  // Convert any literal \n sequences that survived all upstream sanitisation
  if (result.includes("\\n") || result.includes("\\t") || result.includes("\\r")) {
    result = result
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\r/g, "\r")
      .replace(/\\"/g, '"');
  }
  return result;
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";
  const displayContent = isUser ? message.content : safeBubbleContent(message.content);

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2",
          isUser
            ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-100"
            : "bg-white/5 border border-white/10"
        )}
      >
        {isUser ? (
          <p className="text-sm">{displayContent}</p>
        ) : (
          <div className="prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {displayContent}
            </ReactMarkdown>
          </div>
        )}
        {/* Citation chips disabled — pipeline removed. _CitationChip preserved above for future re-enablement. */}
      </div>
    </div>
  );
}
