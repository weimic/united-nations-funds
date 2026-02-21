"use client";

import dynamic from "next/dynamic";
import { AppProvider } from "@/lib/app-context";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import CrisisModal from "@/components/CrisisModal";
import CountryCard from "@/components/CountryCard";
import type { SerializedData } from "@/lib/types";

// Dynamic import Globe to avoid SSR issues with Three.js
const Globe = dynamic(() => import("@/components/Globe"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading globe...</p>
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
      <SidebarProvider defaultOpen={true}>
        <div className="flex h-screen w-screen overflow-hidden">
          <AppSidebar />
          <main className="relative flex-1 overflow-hidden">
            <SidebarTrigger className="absolute top-4 left-4 z-40 bg-background/80 backdrop-blur-sm border border-border/30 shadow-lg" />
            <Globe geoData={data.geoData} />
            <CountryCard />
            <CrisisModal />
          </main>
        </div>
      </SidebarProvider>
    </AppProvider>
  );
}
