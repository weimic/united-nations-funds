"use client";

import { useState, useMemo } from "react";
import { useAppContext } from "@/lib/app-context";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Globe as GlobeIcon,
  Search,
  ChevronRight,
  MapPin,
} from "lucide-react";

function getSeverityBadgeColor(category: string): string {
  switch (category) {
    case "Very High":
      return "bg-red-600/90 text-white border-red-500/50";
    case "High":
      return "bg-red-500/80 text-white border-red-400/50";
    case "Medium":
      return "bg-amber-500/80 text-white border-amber-400/50";
    case "Low":
      return "bg-blue-500/70 text-white border-blue-400/50";
    case "Very Low":
      return "bg-slate-500/70 text-white border-slate-400/50";
    default:
      return "bg-zinc-600/70 text-white border-zinc-500/50";
  }
}

// ── Crises Tab ─────────────────────────────────────────────────────────────────
function CrisesTab() {
  const {
    data,
    activeCrisis,
    setActiveCrisis,
    setCrisisModalOpen,
  } = useAppContext();
  const [search, setSearch] = useState("");

  const filteredCrises = useMemo(() => {
    const q = search.toLowerCase();
    return data.crises.filter(
      (c) =>
        c.crisisName.toLowerCase().includes(q) ||
        c.countries.some((cc) => cc.countryName.toLowerCase().includes(q))
    );
  }, [data.crises, search]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative px-2">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search crises..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 bg-background/50 border-border/50 text-sm h-9"
        />
      </div>
      <ScrollArea className="h-[calc(100vh-220px)]">
        <div className="flex flex-col gap-1 px-2 pb-4">
          {filteredCrises.map((crisis) => {
            const isActive = activeCrisis?.crisisId === crisis.crisisId;
            const maxSeverity = Math.max(
              ...crisis.countries.map((c) => c.severityIndex)
            );
            const severityLabel = crisis.countries[0]?.severityCategory || "";

            return (
              <button
                key={crisis.crisisId}
                onClick={() => {
                  if (isActive) {
                    setCrisisModalOpen(true);
                  } else {
                    setActiveCrisis(crisis);
                  }
                }}
                className={`group flex flex-col gap-1.5 rounded-lg p-3 text-left transition-all duration-200 ${
                  isActive
                    ? "bg-red-500/15 border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                    : "hover:bg-accent/50 border border-transparent"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`text-sm font-medium leading-tight ${
                      isActive ? "text-red-400" : "text-foreground"
                    }`}
                  >
                    {crisis.crisisName}
                  </span>
                  <ChevronRight
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                      isActive ? "rotate-90" : "group-hover:translate-x-0.5"
                    }`}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${getSeverityBadgeColor(
                      severityLabel
                    )}`}
                  >
                    {maxSeverity.toFixed(1)}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {crisis.countries.length} countr
                    {crisis.countries.length === 1 ? "y" : "ies"}
                  </span>
                  {isActive && (
                    <span className="ml-auto text-[10px] text-red-400 font-medium">
                      Click for details →
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          {filteredCrises.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              No crises found
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Countries Tab ──────────────────────────────────────────────────────────────
function CountriesTab() {
  const { data, setSelectedCountryIso3, selectedCountryIso3 } = useAppContext();
  const [search, setSearch] = useState("");

  const countryList = useMemo(() => {
    const entries = Object.values(data.countries)
      .filter((c) => c.name && c.iso3)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!search) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.iso3.toLowerCase().includes(q)
    );
  }, [data.countries, search]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative px-2">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search countries..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 bg-background/50 border-border/50 text-sm h-9"
        />
      </div>
      <ScrollArea className="h-[calc(100vh-220px)]">
        <div className="flex flex-col gap-0.5 px-2 pb-4">
          {countryList.map((country) => {
            const isSelected = selectedCountryIso3 === country.iso3;
            return (
              <button
                key={country.iso3}
                onClick={() => setSelectedCountryIso3(country.iso3)}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-left transition-all ${
                  isSelected
                    ? "bg-primary/15 border border-primary/30"
                    : "hover:bg-accent/50 border border-transparent"
                }`}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">
                    {country.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {country.iso3}
                    </span>
                    {country.severity && (
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${getSeverityBadgeColor(
                          country.severity.severityCategory
                        )}`}
                      >
                        {country.severity.severityIndex.toFixed(1)}
                      </Badge>
                    )}
                    {country.overallFunding && (
                      <span className="text-[10px] text-muted-foreground">
                        {country.overallFunding.percentFunded}% funded
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
          {countryList.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              No countries found
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ── Main App Sidebar ───────────────────────────────────────────────────────────
export default function AppSidebar() {
  const { sidebarTab, setSidebarTab, activeCrisis } = useAppContext();

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border/30 bg-background/95 backdrop-blur-xl"
    >
      <SidebarHeader className="border-b border-border/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/20">
            <GlobeIcon className="h-4 w-4 text-white" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <h1 className="text-sm font-bold tracking-tight">UN Crisis Monitor</h1>
            <p className="text-[10px] text-muted-foreground">
              Global Funding & Severity Analysis
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-0">
        {/* Active crisis indicator */}
        {activeCrisis && (
          <div className="mx-3 mt-3 rounded-lg border border-red-500/20 bg-red-500/5 p-2.5 group-data-[collapsible=icon]:hidden">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
              <span className="text-[11px] font-medium text-red-400 truncate">
                {activeCrisis.crisisName}
              </span>
            </div>
          </div>
        )}

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupContent>
            <Tabs
              value={sidebarTab}
              onValueChange={(v) => setSidebarTab(v as "crises" | "countries")}
              className="w-full"
            >
              <TabsList className="w-full grid grid-cols-2 h-9 mx-2 mt-2 bg-muted/50">
                <TabsTrigger
                  value="crises"
                  className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                  Crises
                </TabsTrigger>
                <TabsTrigger
                  value="countries"
                  className="text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <MapPin className="h-3.5 w-3.5 mr-1.5" />
                  Countries
                </TabsTrigger>
              </TabsList>

              <TabsContent value="crises" className="mt-2">
                <CrisesTab />
              </TabsContent>

              <TabsContent value="countries" className="mt-2">
                <CountriesTab />
              </TabsContent>
            </Tabs>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/30 p-3 group-data-[collapsible=icon]:hidden">
        <p className="text-[10px] text-muted-foreground text-center">
          Data: OCHA FTS · INFORM Severity Index · CBPF
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
