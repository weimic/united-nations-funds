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

function CitationChip({
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
  onCitationClick: (citation: ChatCitation) => void;
}

export function ChatMessageBubble({ message, onCitationClick }: ChatMessageBubbleProps) {
  const isUser = message.role === "user";

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
          <p className="text-sm">{message.content}</p>
        ) : (
          <div className="prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {message.citations && message.citations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-white/10">
            {message.citations.map((citation, i) => (
              <CitationChip
                key={`${citation.iso3}-${citation.crisisId}-${i}`}
                citation={citation}
                onClick={() => onCitationClick(citation)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
