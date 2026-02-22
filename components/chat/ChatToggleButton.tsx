"use client";

import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatToggleButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export function ChatToggleButton({ isOpen, onClick }: ChatToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      title={isOpen ? "Close AI chat" : "Chat with AI"}
      className={cn(
        "cursor-pointer flex items-center justify-center w-8 h-8 rounded-full",
        "bg-black/80 backdrop-blur-sm border border-cyan-500/30",
        "shadow-[0_0_10px_rgba(0,200,255,0.15)]",
        "text-cyan-400 hover:bg-black/90 hover:border-cyan-400/50 transition-all",
        isOpen && "border-cyan-400/60 bg-cyan-500/15 text-cyan-300"
      )}
    >
      <Bot className="h-4 w-4" />
    </button>
  );
}
