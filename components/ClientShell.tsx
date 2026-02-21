"use client";

import dynamic from "next/dynamic";
import { AppProvider } from "@/lib/app-context";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import CrisisModal from "@/components/CrisisModal";
import type { SerializedData } from "@/lib/types";

// Dynamic import Globe to avoid SSR issues with Three.js
const Globe = dynamic(() => import("@/components/Globe"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
        <p className="text-sm text-cyan-400/60 font-mono tracking-widest text-xs uppercase">
          Initializing...
        </p>
      </div>
    </div>
  ),
});

interface ClientShellProps {
  data: SerializedData;
}

export default function ClientShell({ data }: ClientShellProps) {
  return (
    <AppProvider data={data}>
      <SidebarProvider
        defaultOpen={true}
        style={{ "--sidebar-width": "40vw" } as React.CSSProperties}
      >
        <div className="flex h-screen w-screen overflow-hidden">
          <main className="relative flex-1 overflow-hidden">
            <SidebarTrigger className="absolute top-4 right-4 z-40 bg-black/80 backdrop-blur-sm border border-cyan-500/30 shadow-[0_0_12px_rgba(0,200,255,0.15)] text-cyan-400 hover:bg-black/90 hover:border-cyan-400/50" />
            <Globe geoData={data.geoData} />
            <CrisisModal />
          </main>
          <AppSidebar />
        </div>
      </SidebarProvider>
    </AppProvider>
  );
}
