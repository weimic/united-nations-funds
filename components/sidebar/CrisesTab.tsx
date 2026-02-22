"use client";

import { useState, useMemo } from "react";
import { useAppContext } from "@/lib/app-context";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronRight } from "lucide-react";
import { CrisisDetail } from "./CrisisDetail";
import { CategoryDetail } from "./CategoryDetail";

/** The "Crises" tab — shows category list → category detail → crisis detail. */
export function CrisesTab() {
  const { data, activeCrisis, setActiveCrisis, navigationSource, setNavigationSource, setSidebarTab } = useAppContext();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categoriesWithCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of data.crises) {
      for (const cat of c.categories) {
        map.set(cat, (map.get(cat) ?? 0) + 1);
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([cat, count]) => ({ cat, count }));
  }, [data.crises]);

  if (activeCrisis) {
    return (
      <CrisisDetail
        crisis={activeCrisis}
        onBack={() => {
          setActiveCrisis(null);
          const source = navigationSource;
          if (source && source !== "crises") {
            setNavigationSource(null);
            setSidebarTab(source as "crises" | "countries" | "overview");
          }
        }}
      />
    );
  }

  if (selectedCategory) {
    return <CategoryDetail category={selectedCategory} onBack={() => setSelectedCategory(null)} />;
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-1 px-2 pb-4 pt-1">
          <p className="text-[10px] font-mono uppercase tracking-widest text-cyan-400/40 px-1 pb-1">
            Crisis Categories
          </p>
          {categoriesWithCounts.map(({ cat, count }) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="group flex items-center justify-between gap-3 rounded-lg px-3 py-3 text-left transition-all border border-red-500/10 hover:border-red-500/28 hover:bg-red-500/5 hover:shadow-[0_0_10px_rgba(255,30,30,0.07)]"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{cat}</p>
                <p className="text-[10px] font-mono text-cyan-400/45 mt-0.5">
                  {count} Cris{count !== 1 ? "es" : "is"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-cyan-400/25 group-hover:text-cyan-400/55 transition-colors" />
            </button>
          ))}
          {categoriesWithCounts.length === 0 && (
            <p className="text-center text-sm text-cyan-400/40 font-mono py-8">No crises found</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
