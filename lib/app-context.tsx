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
  sidebarTab: "crises" | "countries" | "global";
  setSidebarTab: (tab: "crises" | "countries" | "global") => void;
  crisisModalOpen: boolean;
  setCrisisModalOpen: (open: boolean) => void;
  activeCategories: Set<string>;
  setActiveCategories: (cats: Set<string>) => void;
  /** ISO3 to rotate globe to face */
  globeFocusIso3: string | null;
  setGlobeFocusIso3: (iso3: string | null) => void;
  /** Get the active crisis entry for a specific country */
  getCrisisEntry: (iso3: string) => CrisisCountryEntry | null;
  /** Get unified country data */
  getCountry: (iso3: string) => UnifiedCountryData | null;
  /** ISO3 codes of countries in the active crisis */
  activeCrisisCountryCodes: Set<string>;
  /** All crises that include a given country, with their entry */
  getAllCrisesForCountry: (iso3: string) => Array<{ crisis: CrisisData; entry: CrisisCountryEntry }>;
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
  const [selectedCountryIso3, setSelectedCountryIso3] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"crises" | "countries" | "global">("crises");
  const [crisisModalOpen, setCrisisModalOpen] = useState(false);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [globeFocusIso3, setGlobeFocusIso3] = useState<string | null>(null);

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

  const getAllCrisesForCountry = useCallback(
    (iso3: string): Array<{ crisis: CrisisData; entry: CrisisCountryEntry }> => {
      const results: Array<{ crisis: CrisisData; entry: CrisisCountryEntry }> = [];
      for (const crisis of data.crises) {
        const entry = crisis.countries.find((c) => c.iso3 === iso3);
        if (entry) results.push({ crisis, entry });
      }
      return results;
    },
    [data.crises]
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
        activeCategories,
        setActiveCategories,
        globeFocusIso3,
        setGlobeFocusIso3,
        getCrisisEntry,
        getCountry,
        activeCrisisCountryCodes,
        getAllCrisesForCountry,
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
