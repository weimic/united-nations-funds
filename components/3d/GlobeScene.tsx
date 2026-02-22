"use client";

import { useRef } from "react";
import * as THREE from "three";
import { OrbitControls, Stars } from "@react-three/drei";
import { GLOBE_RADIUS } from "@/lib/constants";
import type { GeoData } from "@/lib/types";
import type { FeatureBBox } from "@/lib/geo-utils";
import type { ActiveThreat, SeverityZone } from "./globe-data";
import { LandmassDots } from "./LandmassDots";
import { ThreatSpikes } from "./ThreatSpikes";
import { CountryBorderHighlight } from "./CountryBorders";
import { CountryHitSphere } from "./CountryHitSphere";
import { CameraFocusController } from "./CameraFocus";

/**
 * Everything inside the R3F `<Canvas>` except post-processing.
 * Composes the globe sphere, map visualisation, spikes, borders,
 * lighting, stars, hit-sphere, orbit-controls and camera focus.
 */
export function GlobeScene({
  geoData,
  severityZones,
  threats,
  hoveredIso3,
  selectedCountryIso3,
  globeFocusIso3,
  spikeMode,
  spikeColorMode,
  mapStyle,
  solidMapTexture,
  bboxes,
  onFocusHandled,
  onSpikeHover,
  onSpikeLeave,
  onSpikeClick,
  onCountryHover,
  onCountryLeave,
  onCountryClick,
}: {
  geoData: GeoData;
  severityZones: SeverityZone[];
  threats: ActiveThreat[];
  hoveredIso3: string | null;
  selectedCountryIso3: string | null;
  globeFocusIso3: string | null;
  spikeMode: "fundingGap" | "severity";
  spikeColorMode: "default" | "spectrum";
  mapStyle: "dots" | "solid";
  solidMapTexture: THREE.CanvasTexture | null;
  bboxes: FeatureBBox[];
  onFocusHandled: () => void;
  onSpikeHover: (instanceId: number, x: number, y: number) => void;
  onSpikeLeave: () => void;
  onSpikeClick: (instanceId: number) => void;
  onCountryHover: (iso3: string, name: string, clientX: number, clientY: number) => void;
  onCountryLeave: () => void;
  onCountryClick: (iso3: string) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orbitRef = useRef<any>(null);

  return (
    <>
      <group>
        {/* Base sphere + map visualisation */}
        {mapStyle === "dots" ? (
          <>
            <mesh>
              <sphereGeometry args={[GLOBE_RADIUS * 0.985, 64, 64]} />
              <meshBasicMaterial color="#03060b" />
            </mesh>
            <LandmassDots geoData={geoData} severityZones={severityZones} />
          </>
        ) : solidMapTexture ? (
          <mesh rotation={[0, -Math.PI / 2, 0]}>
            <sphereGeometry args={[GLOBE_RADIUS * 0.985, 128, 64]} />
            <meshBasicMaterial map={solidMapTexture} toneMapped={false} />
          </mesh>
        ) : (
          <mesh>
            <sphereGeometry args={[GLOBE_RADIUS * 0.985, 64, 64]} />
            <meshBasicMaterial color="#03060b" />
          </mesh>
        )}

        {/* Country hover hit-test sphere */}
        <CountryHitSphere
          bboxes={bboxes}
          onCountryHover={onCountryHover}
          onCountryLeave={onCountryLeave}
          onCountryClick={onCountryClick}
        />

        <ThreatSpikes
          threats={threats}
          spikeMode={spikeMode}
          spikeColorMode={spikeColorMode}
          onHover={onSpikeHover}
          onLeave={onSpikeLeave}
          onClick={onSpikeClick}
        />

        {/* Border highlight: hovered country */}
        <CountryBorderHighlight iso3={hoveredIso3} features={geoData.features} />
        {/* Border highlight: selected country (persistent) */}
        {selectedCountryIso3 && selectedCountryIso3 !== hoveredIso3 && (
          <CountryBorderHighlight iso3={selectedCountryIso3} features={geoData.features} />
        )}

        {/* Atmosphere rim */}
        <mesh>
          <sphereGeometry args={[GLOBE_RADIUS * 1.03, 64, 64]} />
          <meshBasicMaterial color="#1a2a44" transparent opacity={0.2} side={THREE.BackSide} />
        </mesh>
      </group>

      {/* Lighting */}
      <ambientLight intensity={0.22} color="#82b6ff" />
      <directionalLight position={[2.5, 1.2, 3.5]} intensity={0.55} color="#8db4ff" />
      <pointLight position={[0, 0, 2.8]} intensity={1.3} color="#ff5f2e" />

      <Stars radius={140} depth={70} count={2500} factor={3} saturation={0} fade speed={0.25} />

      <CameraFocusController
        features={geoData.features}
        globeFocusIso3={globeFocusIso3}
        onFocusHandled={onFocusHandled}
        orbitRef={orbitRef}
      />
      <OrbitControls
        ref={orbitRef}
        enablePan={false}
        enableZoom
        minDistance={1.65}
        maxDistance={4.8}
        rotateSpeed={0.45}
        dampingFactor={0.08}
        enableDamping
      />
    </>
  );
}
