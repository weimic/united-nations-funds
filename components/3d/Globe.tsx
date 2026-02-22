"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { buildFeatureBBoxes, getSeverityColor, buildSolidCountryTexture } from "@/lib/geo-utils";
import type { GeoData } from "@/lib/types";
import { useAppContext } from "@/lib/app-context";
import { formatDollars } from "@/lib/utils";
import {
  buildThreatsFromData,
  buildSeverityZones,
  type HoveredSpike,
  type CountryHoverData,
} from "./globe-data";
import { GlobeScene } from "./GlobeScene";

// ── Overlay sub-components (HTML, outside WebGL) ─────────────────────────────

function SpikeTooltip({ tip, maxWidth }: { tip: HoveredSpike; maxWidth: number }) {
  return (
    <div
      className="pointer-events-none absolute z-30"
      style={{
        left: Math.min(Math.max(tip.x + 16, 12), maxWidth - 180),
        top: Math.max(tip.y - 8, 20),
        transform: "translateY(-100%)",
      }}
    >
      <div className="flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg bg-black/90 backdrop-blur-md border border-cyan-500/25 shadow-[0_0_16px_rgba(0,200,255,0.12)]">
        <p className="text-[12px] font-semibold font-mono text-cyan-100 whitespace-nowrap">
          {tip.countryName}
        </p>
        {tip.severityIndex > 0 && (
          <span className="text-[11px] font-mono font-bold text-red-400">
            Severity {tip.severityIndex.toFixed(1)}/5
          </span>
        )}
        <p className="text-[10px] font-mono text-cyan-400 whitespace-nowrap">
          {formatDollars(tip.totalFunding)} funded
          {Number.isFinite(tip.percentFunded) && ` · ${tip.percentFunded.toFixed(0)}%`}
        </p>
        <p className="text-[9px] font-mono text-cyan-400/50 mt-0.5">Click to open</p>
      </div>
    </div>
  );
}

function CountryTooltip({ tip, maxWidth }: { tip: CountryHoverData; maxWidth: number }) {
  return (
    <div
      className="pointer-events-none absolute z-30"
      style={{
        left: Math.min(Math.max(tip.x + 16, 12), maxWidth - 180),
        top: Math.max(tip.y - 8, 20),
        transform: "translateY(-100%)",
      }}
    >
      <div className="flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg bg-black/90 backdrop-blur-md border border-cyan-500/25 shadow-[0_0_16px_rgba(0,200,255,0.12)]">
        <p className="text-[12px] font-semibold font-mono text-cyan-100 whitespace-nowrap">
          {tip.countryName}
        </p>
        {tip.hasData ? (
          <>
            {tip.severityIndex != null && tip.severityIndex > 0 && (
              <span className="text-[11px] font-mono font-bold text-red-400">
                Severity {tip.severityIndex.toFixed(1)}/5
              </span>
            )}
            {tip.totalFunding != null && (
              <p className="text-[10px] font-mono text-cyan-400 whitespace-nowrap">
                {formatDollars(tip.totalFunding)} funded
                {tip.percentFunded != null &&
                  Number.isFinite(tip.percentFunded) &&
                  ` · ${tip.percentFunded.toFixed(0)}%`}
              </p>
            )}
            <p className="text-[9px] font-mono text-cyan-400/50 mt-0.5">Click to open</p>
          </>
        ) : (
          <p className="text-[10px] font-mono text-cyan-400/40 whitespace-nowrap">
            No funding or crisis data
          </p>
        )}
      </div>
    </div>
  );
}

function SpikeModeSwitch({
  spikeMode,
  onToggle,
}: {
  spikeMode: "fundingGap" | "severity";
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-sm border border-cyan-500/20">
      <span className="text-[10px] font-mono text-cyan-400/60 uppercase tracking-widest mr-1">
        Spikes:
      </span>
      <span
        className={`text-[10px] font-mono cursor-pointer transition-colors ${
          spikeMode === "fundingGap" ? "text-cyan-400" : "text-cyan-400/40"
        }`}
        onClick={onToggle}
      >
        Funding
      </span>
      <button
        onClick={onToggle}
        className="relative w-8 h-4 rounded-full transition-colors"
        style={{
          backgroundColor:
            spikeMode === "severity" ? "rgba(34,211,238,0.3)" : "rgba(34,211,238,0.1)",
        }}
        aria-label="Toggle spike mode"
      >
        <span
          className="absolute top-0.5 h-3 w-3 rounded-full bg-cyan-400 transition-all"
          style={{
            left: spikeMode === "fundingGap" ? "2px" : "calc(100% - 14px)",
          }}
        />
      </button>
      <span
        className={`text-[10px] font-mono cursor-pointer transition-colors ${
          spikeMode === "severity" ? "text-cyan-400" : "text-cyan-400/40"
        }`}
        onClick={onToggle}
      >
        Severity
      </span>
    </div>
  );
}

function MapStyleToggle({
  mapStyle,
  onToggle,
}: {
  mapStyle: "dots" | "solid";
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-sm border border-cyan-500/20">
      <span className="text-[10px] font-mono text-cyan-400/60 uppercase tracking-widest mr-1">
        View:
      </span>
      <span
        className={`text-[10px] font-mono cursor-pointer transition-colors ${
          mapStyle === "dots" ? "text-cyan-400" : "text-cyan-400/40"
        }`}
        onClick={onToggle}
      >
        Dots
      </span>
      <button
        onClick={onToggle}
        className="relative w-8 h-4 rounded-full transition-colors"
        style={{
          backgroundColor: mapStyle === "solid" ? "rgba(34,211,238,0.3)" : "rgba(34,211,238,0.1)",
        }}
        aria-label="Toggle map style"
      >
        <span
          className="absolute top-0.5 h-3 w-3 rounded-full bg-cyan-400 transition-all"
          style={{ left: mapStyle === "dots" ? "2px" : "calc(100% - 14px)" }}
        />
      </button>
      <span
        className={`text-[10px] font-mono cursor-pointer transition-colors ${
          mapStyle === "solid" ? "text-cyan-400" : "text-cyan-400/40"
        }`}
        onClick={onToggle}
      >
        Countries
      </span>
    </div>
  );
}



// ── Main Globe component ─────────────────────────────────────────────────────

export default function Globe({ geoData }: { geoData: GeoData }) {
  const {
    data,
    globeFocusIso3,
    setGlobeFocusIso3,
    selectedCountryIso3,
    setSelectedCountryIso3,
    setSidebarTab,
    spikeMode,
    setSpikeMode,
    mapStyle,
    setMapStyle,
    spikeColorMode,
  } = useAppContext();

  const [spikeTooltip, setSpikeTooltip] = useState<HoveredSpike | null>(null);
  const [countryTooltip, setCountryTooltip] = useState<CountryHoverData | null>(null);
  const [hoveredIso3, setHoveredIso3] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Derived data ────────────────────────────────────────────────────────────
  const threats = useMemo(
    () => buildThreatsFromData(data.countries, geoData.features, spikeMode),
    [data.countries, geoData.features, spikeMode],
  );

  const severityZones = useMemo(
    () => buildSeverityZones(data.countries, geoData.features),
    [data.countries, geoData.features],
  );

  const bboxes = useMemo(() => buildFeatureBBoxes(geoData.features), [geoData.features]);

  const solidMapTexture = useMemo(() => {
    const colorMap: Record<string, string> = {};
    for (const feature of geoData.features) {
      const country = data.countries[feature.id];
      if (!country) {
        colorMap[feature.id] = "#e0e0e0";
      } else if (country.severity && country.severity.severityIndex > 0) {
        const sev = country.severity.severityIndex;
        const sevColor = getSeverityColor(sev);
        const baseColor = new THREE.Color("#5a96b0");
        const t = Math.min(sev / 5, 1);
        baseColor.lerp(sevColor, t);
        colorMap[feature.id] = `#${baseColor.getHexString()}`;
      } else {
        colorMap[feature.id] = "#5a96b0";
      }
    }
    return buildSolidCountryTexture(geoData, colorMap, "#03060b");
  }, [geoData, data.countries]);

  // ── Spike event handlers ──────────────────────────────────────────────────
  const handleSpikeHover = (instanceId: number, x: number, y: number) => {
    const threat = threats[instanceId];
    if (!threat || !containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    setHoveredIso3(threat.id);
    setCountryTooltip(null);
    setSpikeTooltip({
      x: x - bounds.left,
      y: y - bounds.top,
      iso3: threat.id,
      countryName: threat.countryName,
      totalFunding: threat.totalFunding,
      offAppealFunding: threat.offAppealFunding,
      totalFundingAll: threat.totalFundingAll,
      percentFunded: threat.percentFunded,
      percentFundedAll: threat.percentFundedAll,
      severityIndex: threat.severityIndex,
    });
  };

  const handleSpikeLeave = () => {
    setSpikeTooltip(null);
    setHoveredIso3(null);
  };

  const handleSpikeClick = (instanceId: number) => {
    const threat = threats[instanceId];
    if (!threat) return;
    setSelectedCountryIso3(threat.id);
    setSidebarTab("countries");
  };

  // ── Country surface event handlers ────────────────────────────────────────
  const handleCountryHover = (iso3: string, name: string, clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    setHoveredIso3(iso3);
    if (spikeTooltip) return; // spike takes priority

    const country = data.countries[iso3];
    setCountryTooltip({
      x: clientX - bounds.left,
      y: clientY - bounds.top,
      iso3,
      countryName: name,
      hasData: !!country,
      totalFunding: country?.overallFunding?.totalFunding,
      percentFunded: country?.overallFunding?.percentFunded,
      severityIndex: country?.severity?.severityIndex,
    });
  };

  const handleCountryLeave = () => {
    if (!spikeTooltip) {
      setCountryTooltip(null);
      setHoveredIso3(null);
    }
  };

  const handleCountryClick = (iso3: string) => {
    if (!data.countries[iso3]) return;
    setSelectedCountryIso3(iso3);
    setSidebarTab("countries");
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const containerWidth = containerRef.current?.clientWidth ?? 300;

  return (
    <div ref={containerRef} className="h-full w-full bg-black relative">
      <Canvas
        camera={{ position: [0, 0, 2.9], fov: 42 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
          toneMapping: THREE.NoToneMapping,
        }}
        dpr={[1, 2]}
      >
        <GlobeScene
          geoData={geoData}
          severityZones={severityZones}
          threats={threats}
          hoveredIso3={hoveredIso3}
          selectedCountryIso3={selectedCountryIso3}
          globeFocusIso3={globeFocusIso3}
          spikeMode={spikeMode}
          spikeColorMode={spikeColorMode}
          mapStyle={mapStyle}
          solidMapTexture={solidMapTexture}
          bboxes={bboxes}
          onFocusHandled={() => setGlobeFocusIso3(null)}
          onSpikeHover={handleSpikeHover}
          onSpikeLeave={handleSpikeLeave}
          onSpikeClick={handleSpikeClick}
          onCountryHover={handleCountryHover}
          onCountryLeave={handleCountryLeave}
          onCountryClick={handleCountryClick}
        />

        <EffectComposer enableNormalPass={false}>
          <Bloom
            intensity={1.6}
            luminanceThreshold={0.16}
            luminanceSmoothing={0.2}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>

      {/* Tooltips */}
      {spikeTooltip && <SpikeTooltip tip={spikeTooltip} maxWidth={containerWidth} />}
      {!spikeTooltip && countryTooltip && (
        <CountryTooltip tip={countryTooltip} maxWidth={containerWidth} />
      )}

      {/* Bottom-right controls: view + spike mode */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2 items-end">
        <MapStyleToggle
          mapStyle={mapStyle}
          onToggle={() => setMapStyle(mapStyle === "dots" ? "solid" : "dots")}
        />
        <SpikeModeSwitch
          spikeMode={spikeMode}
          onToggle={() => setSpikeMode(spikeMode === "fundingGap" ? "severity" : "fundingGap")}
        />
      </div>

      {/* Edge gradient overlays */}
      <div className="pointer-events-none absolute left-0 top-0 h-20 w-full bg-gradient-to-b from-black/75 to-transparent" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-20 w-full bg-gradient-to-t from-black/75 to-transparent" />
    </div>
  );
}
