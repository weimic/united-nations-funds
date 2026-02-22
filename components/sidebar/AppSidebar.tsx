"use client";

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

export default function AppSidebar() {
  const { sidebarTab, setSidebarTab, setNavigationSource, setCountryDetailSource } = useAppContext();

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
          <div className="group-data-[collapsible=icon]:hidden">
            <h1 className="text-sm font-bold tracking-tight font-mono text-cyan-100">
              UN Crisis Monitor
            </h1>
            <p className="text-[10px] font-mono tracking-widest text-cyan-400/50 uppercase">
              Global Analysis
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="relative z-10 p-0 overflow-hidden flex flex-col">
        <div className="group-data-[collapsible=icon]:hidden flex flex-col flex-1 min-h-0 px-2 pb-2">
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
      </SidebarContent>

      <SidebarFooter className="relative z-10 border-t border-cyan-500/15 p-3 group-data-[collapsible=icon]:hidden shrink-0">
        <p className="text-[10px] font-mono text-cyan-400/30 text-center tracking-widest uppercase">
          OCHA FTS · INFORM · CBPF
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
