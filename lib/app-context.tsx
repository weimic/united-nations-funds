"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type {
  CrisisData,
  CrisisCountryEntry,
  UnifiedCountryData,
  SerializedData,
} from "@/lib/types";

interface AppContextType {
  data: SerializedData;
  activeCrisis: CrisisData | null;
  setActiveCrisis: (crisis: CrisisData | null) => void;
  selectedCountryIso3: string | null;
  setSelectedCountryIso3: (iso3: string | null) => void;
  sidebarTab: "crises" | "countries";
  setSidebarTab: (tab: "crises" | "countries") => void;
  crisisModalOpen: boolean;
  setCrisisModalOpen: (open: boolean) => void;
  /** Get the active crisis entry for a specific country */
  getCrisisEntry: (iso3: string) => CrisisCountryEntry | null;
  /** Get unified country data */
  getCountry: (iso3: string) => UnifiedCountryData | null;
  /** ISO3 codes of countries in the active crisis */
  activeCrisisCountryCodes: Set<string>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({
  data,
  children,
}: {
  data: SerializedData;
  children: ReactNode;
}) {
  const [activeCrisis, setActiveCrisis] = useState<CrisisData | null>(null);
  const [selectedCountryIso3, setSelectedCountryIso3] = useState<string | null>(
    null
  );
  const [sidebarTab, setSidebarTab] = useState<"crises" | "countries">("crises");
  const [crisisModalOpen, setCrisisModalOpen] = useState(false);

  const activeCrisisCountryCodes = new Set(
    activeCrisis?.countries.map((c) => c.iso3) ?? []
  );

  const getCrisisEntry = useCallback(
    (iso3: string): CrisisCountryEntry | null => {
      if (!activeCrisis) return null;
      return activeCrisis.countries.find((c) => c.iso3 === iso3) || null;
    },
    [activeCrisis]
  );

  const getCountry = useCallback(
    (iso3: string): UnifiedCountryData | null => {
      return data.countries[iso3] || null;
    },
    [data]
  );

  return (
    <AppContext.Provider
      value={{
        data,
        activeCrisis,
        setActiveCrisis,
        selectedCountryIso3,
        setSelectedCountryIso3,
        sidebarTab,
        setSidebarTab,
        crisisModalOpen,
        setCrisisModalOpen,
        getCrisisEntry,
        getCountry,
        activeCrisisCountryCodes,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
