"use client";

import { useRef, useState, useCallback } from "react";
import { useAppContext } from "@/lib/app-context";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe2, AlertTriangle, MapPin } from "lucide-react";

import { OverviewTab } from "./OverviewTab";
import { CrisesTab } from "./CrisesTab";
import { CountriesTab } from "./CountriesTab";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ChatToggleButton } from "@/components/chat/ChatToggleButton";
import { AboutDialog } from "./AboutDialog";

interface AppSidebarProps {
  chatOpen: boolean;
  onChatToggle: () => void;
}

export default function AppSidebar({ chatOpen, onChatToggle }: AppSidebarProps) {
  const { sidebarTab, setSidebarTab, setNavigationSource, setCountryDetailSource } = useAppContext();

  const [chatHeightPx, setChatHeightPx] = useState<number | null>(null);
  const [chatFullscreen, setChatFullscreen] = useState(false);
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartHeight = useRef<number>(0);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = sidebarContentRef.current;
    if (!container) return;
    dragStartY.current = e.clientY;
    dragStartHeight.current = chatHeightPx ?? container.clientHeight * 0.5;

    let rafId: number | null = null;

    const onMouseMove = (ev: MouseEvent) => {
      if (dragStartY.current === null) return;
      // Throttle to one state update per animation frame to prevent
      // rapid-fire re-renders that push Recharts ResizeObserver into an
      // infinite setState loop (maximum update depth exceeded).
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        if (dragStartY.current === null) return;
        const delta = dragStartY.current - ev.clientY;
        const containerH = sidebarContentRef.current?.clientHeight ?? container.clientHeight;
        const newHeight = Math.max(80, Math.min(containerH - 60, dragStartHeight.current + delta));
        setChatHeightPx(newHeight);
      });
    };

    const onMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      dragStartY.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [chatHeightPx]);

  const handleToggleFullscreen = useCallback(() => {
    setChatFullscreen(prev => !prev);
  }, []);

  return (
    <Sidebar
      side="right"
      collapsible="icon"
      className="border-l border-cyan-500/20 bg-black/90 backdrop-blur-xl"
    >
      {/* Scanline overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-40"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.015) 2px, rgba(0,255,255,0.015) 4px)",
        }}
      />

      <SidebarHeader className="relative z-10 border-b border-cyan-500/20 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 to-red-800 shadow-[0_0_12px_rgba(220,40,40,0.4)]">
            <Globe2 className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
            <h1 className="text-sm font-bold tracking-tight font-mono text-cyan-100">
              UN Crisis Monitor
            </h1>
            <p className="text-[10px] font-mono tracking-widest text-cyan-400/50 uppercase">
              Global Analysis
            </p>
          </div>
          <div className="group-data-[collapsible=icon]:hidden shrink-0">
            <AboutDialog />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="relative z-10 p-0 overflow-hidden flex flex-col">
        <div ref={sidebarContentRef} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Stats / tabs — takes remaining space; hidden in fullscreen chat mode */}
        <div
          className="group-data-[collapsible=icon]:hidden flex flex-col min-h-0 px-2 pb-2 overflow-hidden"
          style={{
            flex: chatOpen
              ? chatFullscreen
                ? "0 0 0px"
                : chatHeightPx
                  ? `0 0 calc(100% - ${chatHeightPx}px)`
                  : "0 0 50%"
              : "1 1 0%",
          }}
        >
          <Tabs
            value={sidebarTab}
            onValueChange={(v) => {
              setSidebarTab(v as "crises" | "countries" | "overview");
              // Clear navigation sources when manually switching tabs
              setNavigationSource(null);
              setCountryDetailSource(null);
            }}
            className="flex flex-col flex-1 min-h-0"
          >
            <TabsList className="w-full grid grid-cols-3 h-9 mt-2 bg-black/60 border border-cyan-500/15 shrink-0">
              <TabsTrigger
                value="overview"
                className="text-xs font-mono data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300 data-[state=active]:shadow-[0_0_8px_rgba(0,200,255,0.2)] text-cyan-400/50"
              >
                <Globe2 className="h-3.5 w-3.5 mr-1.5" />
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="crises"
                className="text-xs font-mono data-[state=active]:bg-red-500/15 data-[state=active]:text-red-300 data-[state=active]:shadow-[0_0_8px_rgba(255,60,60,0.2)] text-cyan-400/50"
              >
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                Crises
              </TabsTrigger>
              <TabsTrigger
                value="countries"
                className="text-xs font-mono data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-300 data-[state=active]:shadow-[0_0_8px_rgba(0,200,255,0.2)] text-cyan-400/50"
              >
                <MapPin className="h-3.5 w-3.5 mr-1.5" />
                Countries
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="overview"
              className="flex-1 min-h-0 mt-2 data-[state=inactive]:hidden flex flex-col"
            >
              <OverviewTab />
            </TabsContent>
            <TabsContent
              value="crises"
              className="flex-1 min-h-0 mt-2 data-[state=inactive]:hidden flex flex-col"
            >
              <CrisesTab />
            </TabsContent>
            <TabsContent
              value="countries"
              className="flex-1 min-h-0 mt-2 data-[state=inactive]:hidden"
            >
              <CountriesTab />
            </TabsContent>
          </Tabs>
        </div>

        {/* Chat panel — resizable bottom section when open */}
        {chatOpen && (
          <div
            className="group-data-[collapsible=icon]:hidden flex flex-col border-t border-cyan-500/20 overflow-hidden"
            style={{
              flex: chatFullscreen
                ? "1 1 0%"
                : chatHeightPx
                  ? `0 0 ${chatHeightPx}px`
                  : "0 0 50%",
            }}
          >
            {/* Drag resize handle */}
            {!chatFullscreen && (
              <div
                onMouseDown={handleResizeMouseDown}
                className="h-2 w-full shrink-0 cursor-row-resize flex items-center justify-center group select-none"
                title="Drag to resize"
              >
                <div className="w-8 h-0.5 rounded-full bg-cyan-500/20 group-hover:bg-cyan-400/60 transition-colors" />
              </div>
            )}
            <ChatWindow
              isOpen={chatOpen}
              onClose={onChatToggle}
              embedded
              isFullscreen={chatFullscreen}
              onToggleFullscreen={handleToggleFullscreen}
            />
          </div>
        )}
        </div>
      </SidebarContent>
      <SidebarFooter className="relative z-10 border-t border-cyan-500/15 p-3 group-data-[collapsible=icon]:hidden shrink-0">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-mono text-cyan-400/30 tracking-widest uppercase">
            <a className="underline cursor-pointer" target="_blank" rel="noopener noreferrer" href="https://fts.unocha.org/">OCHA FTS</a> · <a className="underline cursor-pointer" target="_blank" rel="noopener noreferrer" href="https://www.acaps.org/en/thematics/all-topics/inform-severity-index">INFORM</a> · <a className="underline cursor-pointer" target="_blank" rel="noopener noreferrer" href="https://data.humdata.org/">HDX</a>
          </p>
          <ChatToggleButton isOpen={chatOpen} onClick={onChatToggle} />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
