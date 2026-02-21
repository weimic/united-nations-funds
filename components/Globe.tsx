"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { OrbitControls, Stars } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { createLandMask, getFeatureCentroid, getSeverityColor } from "@/lib/geo-utils";
import type { GeoData, GeoFeature, OverallFunding } from "@/lib/types";
import { useAppContext } from "@/lib/app-context";
import { formatDollars } from "@/lib/utils";

const GLOBE_RADIUS = 1;
const LAND_MASK_WIDTH = 1024;
const LAND_MASK_HEIGHT = 512;

type SeverityZone = {
  lat: number;
  lon: number;
  radius: number;
  intensity: number;
  color: THREE.Color;
};

type ActiveThreat = {
  id: string; // iso3
  countryName: string;
  lat: number;
  lon: number;
  magnitude: number;
  totalFunding: number;
  offAppealFunding: number;
  totalFundingAll: number;
  percentFunded: number;
  percentFundedAll: number;
  severityIndex: number;
};

type HoveredSpike = {
  x: number;
  y: number;
  iso3: string;
  countryName: string;
  totalFunding: number;
  offAppealFunding: number;
  totalFundingAll: number;
  percentFunded: number;
  percentFundedAll: number;
  severityIndex: number;
};

function latLongToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const latRad = THREE.MathUtils.degToRad(lat);
  const lonRad = THREE.MathUtils.degToRad(lon);
  const cosLat = Math.cos(latRad);

  return new THREE.Vector3(
    radius * cosLat * Math.cos(lonRad),
    radius * Math.sin(latRad),
    radius * cosLat * Math.sin(lonRad)
  );
}

function angularDistance(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
}

/**
 * Build funding spikes from real country data.
 * Selects up to 60 countries with the largest requirements, then scales spike
 * height by funding gap (requirements - on-appeal funding) so taller = bigger shortfall.
 * Color is driven by % funded: deep red = severely underfunded, orange = partially funded.
 */
function buildThreatsFromData(
  countries: Record<string, { name: string; overallFunding: OverallFunding | null; severity: { severityIndex: number } | null }>,
  features: GeoFeature[]
): ActiveThreat[] {
  const centroidMap = new Map<string, [number, number]>();
  for (const feature of features) {
    if (!feature.id) continue;
    const [lat, lon] = getFeatureCentroid(feature.geometry);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      centroidMap.set(feature.id, [lat, lon]);
    }
  }

  const entries = Object.entries(countries)
    .filter(([iso3, c]) =>
      c.overallFunding &&
      c.overallFunding.totalRequirements > 0 &&
      centroidMap.has(iso3)
    )
    .map(([iso3, c]) => ({
      iso3,
      country: c,
      centroid: centroidMap.get(iso3)!,
      fundingGap: Math.max(0, c.overallFunding!.totalRequirements - c.overallFunding!.totalFunding),
    }))
    .sort((a, b) => b.fundingGap - a.fundingGap)
    .slice(0, 60);

  if (entries.length === 0) return [];

  // Spike height represents funding gap — sort + normalize by funding
  const maxGap = Math.max(...entries.map(e => e.fundingGap), 1);

  return entries.map(({ iso3, country, centroid, fundingGap }) => ({
    id: iso3,
    countryName: country.name,
    lat: centroid[0],
    lon: centroid[1],
    magnitude: Math.max(0.05, fundingGap / maxGap),
    totalFunding: country.overallFunding!.totalFunding,
    offAppealFunding: country.overallFunding!.offAppealFunding,
    totalFundingAll: country.overallFunding!.totalFundingAll,
    percentFunded: country.overallFunding!.percentFunded,
    percentFundedAll: country.overallFunding!.percentFundedAll,
    severityIndex: country.severity?.severityIndex ?? 0,
  }));
}

function buildSeverityZonesFromData(
  countries: Record<string, { severity: { severityIndex: number } | null }>,
  features: GeoFeature[]
): SeverityZone[] {
  const centroidMap = new Map<string, [number, number]>();
  for (const feature of features) {
    if (!feature.id) continue;
    const [lat, lon] = getFeatureCentroid(feature.geometry);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      centroidMap.set(feature.id, [lat, lon]);
    }
  }

  const zones = Object.entries(countries)
    .filter(([iso3, c]) => c.severity && centroidMap.has(iso3))
    .map(([iso3, c]) => ({
      iso3,
      severity: c.severity!.severityIndex,
      centroid: centroidMap.get(iso3)!,
    }))
    .sort((a, b) => b.severity - a.severity)
    .filter((d) => d.severity >= 3.0)
    .slice(0, 25)
    .map(({ severity, centroid }) => {
      const t = THREE.MathUtils.clamp(severity / 5, 0, 1);
      return {
        lat: centroid[0],
        lon: centroid[1],
        radius: 6 + t * 18,
        intensity: 0.25 + t * 0.75,
        color: getSeverityColor(severity),
      };
    });

  return zones;
}

// ── Country Border Ring ────────────────────────────────────────────────────────
function CountryBorderRing({ points }: { points: THREE.Vector3[] }) {
  const line = useMemo(() => {
    const positions = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      positions[i * 3]     = points[i].x;
      positions[i * 3 + 1] = points[i].y;
      positions[i * 3 + 2] = points[i].z;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: new THREE.Color(3, 3, 3), // Over-bright white → triggers bloom glow
      toneMapped: false,
    });
    return new THREE.Line(g, mat);
  }, [points]);

  return <primitive object={line} />;
}

function CountryBorderHighlight({ iso3, features }: { iso3: string | null; features: GeoFeature[] }) {
  const lineSegments = useMemo(() => {
    if (!iso3) return [] as THREE.Vector3[][];
    const feature = features.find(f => f.id === iso3);
    if (!feature) return [];
    const polys =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates as number[][][]]
        : (feature.geometry.coordinates as number[][][][]);
    return polys.map(poly => {
      const ring = poly[0];
      const pts: THREE.Vector3[] = [];
      const step = Math.max(1, Math.floor(ring.length / 100));
      for (let i = 0; i < ring.length; i += step) {
        const [lon, lat] = ring[i];
        pts.push(latLongToVector3(lat, lon, GLOBE_RADIUS * 1.002));
      }
      // Close the ring
      const [lon0, lat0] = ring[0];
      pts.push(latLongToVector3(lat0, lon0, GLOBE_RADIUS * 1.002));
      return pts;
    });
  }, [iso3, features]);

  if (lineSegments.length === 0) return null;
  return (
    <>
      {lineSegments.map((pts, idx) => (
        <CountryBorderRing key={idx} points={pts} />
      ))}
    </>
  );
}

// ── Camera Focus Controller ────────────────────────────────────────────────────
function CameraFocusController({
  features,
  globeFocusIso3,
  onFocusHandled,
  orbitRef,
}: {
  features: GeoFeature[];
  globeFocusIso3: string | null;
  onFocusHandled: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orbitRef: MutableRefObject<any>;
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (!globeFocusIso3) return;
    const feature = features.find(f => f.id === globeFocusIso3);
    if (!feature) return;
    const [lat, lon] = getFeatureCentroid(feature.geometry);
    const dist = camera.position.length();
    const newPos = latLongToVector3(lat, lon, dist);
    camera.position.copy(newPos);
    camera.lookAt(0, 0, 0);
    if (orbitRef.current) orbitRef.current.update();
    onFocusHandled();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globeFocusIso3]);

  return null;
}

function LandmassDots({ geoData, severityZones }: { geoData: GeoData; severityZones: SeverityZone[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  // Brightened base color — contributes directly as instance color (material.color is white)
  const baseColor = useMemo(() => new THREE.Color("#5a96b0"), []);

  const dots = useMemo(() => {
    const mask = createLandMask(geoData, LAND_MASK_WIDTH, LAND_MASK_HEIGHT);
    if (!mask) return [] as Array<{ position: THREE.Vector3; color: THREE.Color }>;

    const zoneVectors = severityZones.map((zone) => ({
      ...zone,
      center: latLongToVector3(zone.lat, zone.lon, 1).normalize(),
      radiusRad: THREE.MathUtils.degToRad(zone.radius),
    }));

    const DOT_COUNT = 25000;
    const generated: Array<{ position: THREE.Vector3; color: THREE.Color }> = [];
    const phi = Math.PI * (3.0 - Math.sqrt(5.0)); // Golden angle

    for (let i = 0; i < DOT_COUNT; i++) {
      const y = 1 - (i / (DOT_COUNT - 1)) * 2; // y goes from 1 to -1
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phi * i;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      // Convert to Lat/Lon to check mask
      // y = sin(lat) -> lat = asin(y)
      // x = cos(lat) * cos(lon), z = cos(lat) * sin(lon) -> tan(lon) = z/x
      // Note: latLongToVector3 uses: y=sin(lat), x=cos(lat)cos(lon), z=cos(lat)sin(lon)
      // This matches standard physics convention if z is forward? 
      // Actually latLongToVector3: x = r*cosLat*cosLon, z = r*cosLat*sinLon.
      // So tan(lon) = z/x is correct.

      const lat = Math.asin(y) * (180 / Math.PI);
      const lon = Math.atan2(z, x) * (180 / Math.PI);

      // Map to mask UV
      const u = (lon + 180) / 360;
      const v = (90 - lat) / 180;

      const px = Math.floor(u * mask.width);
      const py = Math.floor(v * mask.height);

      // Wrap coords just in case
      const cPx = Math.max(0, Math.min(mask.width - 1, px));
      const cPy = Math.max(0, Math.min(mask.height - 1, py));
      const idx = (cPy * mask.width + cPx) * 4;

      // Check red channel (white = land)
      if (mask.data[idx] < 120) continue;

      // Position
      const position = new THREE.Vector3(x, y, z).multiplyScalar(GLOBE_RADIUS);
      const normal = new THREE.Vector3(x, y, z);

      // Color logic
      const dotColor = baseColor.clone();
      for (const zone of zoneVectors) {
        const d = angularDistance(normal, zone.center);
        if (d > zone.radiusRad) continue;

        const edge = 1 - d / zone.radiusRad;
        const mix = THREE.MathUtils.clamp(edge * zone.intensity, 0, 1);
        dotColor.lerp(zone.color, mix);
      }

      generated.push({ position, color: dotColor });
    }

    return generated;
  }, [baseColor, geoData, severityZones]);

  const dotGeometry = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(0.0058, 0);
    return g;
  }, []);

  /**
   * TRUE ROOT CAUSE FIX for black dots:
   * MeshBasicMaterial with vertexColors:true causes the shader to read the geometry's
   * "color" attribute (USE_COLOR define). IcosahedronGeometry has NO vertex color attribute,
   * so WebGL returns vec3(0,0,0) (disabled attrib default). The fragment shader then computes
   * `diffuseColor.rgb *= vColor` = 0 — blacking out everything BEFORE instance colors are applied.
   * Instance color multiplication on already-zero diffuse can never recover the color.
   *
   * Fix: vertexColors: false (default). Instance colors set via setColorAt() use the separate
   * USE_INSTANCING_COLOR path and are completely unaffected by this setting.
   * material.color = "#ffffff" ensures the instance color is unattenuated.
   */
  const dotMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#ffffff",
        vertexColors: false,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  );

  useEffect(() => {
    if (!meshRef.current || dots.length === 0) return;

    const helper = new THREE.Object3D();
    for (let i = 0; i < dots.length; i++) {
      helper.position.copy(dots[i].position);
      helper.quaternion.identity();
      helper.scale.setScalar(1);
      helper.updateMatrix();

      meshRef.current.setMatrixAt(i, helper.matrix);
      meshRef.current.setColorAt(i, dots[i].color);
    }

    meshRef.current.count = dots.length;
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [dots]);

  if (dots.length === 0) return null;

  return <instancedMesh ref={meshRef} args={[dotGeometry, dotMaterial, dots.length]} frustumCulled={false} />;
}

function ThreatSpikes({
  threats,
  onHover,
  onLeave,
  onClick,
}: {
  threats: ActiveThreat[];
  onHover: (instanceId: number, x: number, y: number) => void;
  onLeave: () => void;
  onClick: (instanceId: number) => void;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const spikeGeometry = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(0.004, 0.011, 1, 6, 1, false);
    geometry.translate(0, 0.5, 0);
    return geometry;
  }, []);

  const spikeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#ff4d1f",
        emissive: new THREE.Color("#ff2d00"),
        emissiveIntensity: 3.5,
        roughness: 0.15,
        metalness: 0.25,
        // vertexColors must be false — CylinderGeometry has no vertex color attribute.
        // Same root cause as LandmassDots: USE_COLOR shader path reads vec3(0,0,0) from
        // missing attrib, zeroing diffuse before instance colors are applied.
        vertexColors: false,
        toneMapped: false,
      }),
    []
  );

  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  // Static layout — set once when threats change. Height is proportional to totalFunding.
  useEffect(() => {
    if (!meshRef.current || threats.length === 0) return;

    const helper = new THREE.Object3D();
    for (let i = 0; i < threats.length; i++) {
      const threat        = threats[i];
      const surfacePoint  = latLongToVector3(threat.lat, threat.lon, GLOBE_RADIUS);
      const surfaceNormal = surfacePoint.clone().normalize();

      helper.position.copy(surfacePoint);
      helper.quaternion.setFromUnitVectors(up, surfaceNormal);
      // Scale Y: 0.05 minimum → 0.50 maximum, proportional to funding amount
      helper.scale.set(1, 0.05 + threat.magnitude * 0.45, 1);
      helper.updateMatrix();

      meshRef.current.setMatrixAt(i, helper.matrix);

      // Color by % funded: deep red (< 30%) → orange (30-60%) → amber (60%+)
      // Low % funded = more underfunded = deeper red
      const pctNorm = THREE.MathUtils.clamp(threat.percentFunded / 100, 0, 1);
      const color = new THREE.Color("#ff1a1a").lerp(new THREE.Color("#ff8c42"), pctNorm);
      meshRef.current.setColorAt(i, color);
    }

    meshRef.current.count = threats.length;
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [threats, up]);

  if (threats.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[spikeGeometry, spikeMaterial, threats.length]}
      frustumCulled={false}
      onPointerMove={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) {
          onHover(e.instanceId, e.nativeEvent.clientX, e.nativeEvent.clientY);
        }
      }}
      onPointerLeave={onLeave}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) {
          onClick(e.instanceId);
        }
      }}
    />
  );
}

function GlobeCore({
  geoData,
  severityZones,
  threats,
  hoveredIso3,
  globeFocusIso3,
  onFocusHandled,
  onSpikeHover,
  onSpikeLeave,
  onSpikeClick,
}: {
  geoData: GeoData;
  severityZones: SeverityZone[];
  threats: ActiveThreat[];
  hoveredIso3: string | null;
  globeFocusIso3: string | null;
  onFocusHandled: () => void;
  onSpikeHover: (instanceId: number, x: number, y: number) => void;
  onSpikeLeave: () => void;
  onSpikeClick: (instanceId: number) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orbitRef = useRef<any>(null);

  return (
    <>
      <group>
        <mesh>
          <sphereGeometry args={[GLOBE_RADIUS * 0.985, 64, 64]} />
          <meshBasicMaterial color="#03060b" />
        </mesh>

        <LandmassDots geoData={geoData} severityZones={severityZones} />
        <ThreatSpikes
          threats={threats}
          onHover={onSpikeHover}
          onLeave={onSpikeLeave}
          onClick={onSpikeClick}
        />
        <CountryBorderHighlight iso3={hoveredIso3} features={geoData.features} />

        <mesh>
          <sphereGeometry args={[GLOBE_RADIUS * 1.03, 64, 64]} />
          <meshBasicMaterial color="#1a2a44" transparent opacity={0.2} side={THREE.BackSide} />
        </mesh>
      </group>

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

export default function Globe({ geoData }: { geoData: GeoData }) {
  const { data, globeFocusIso3, setGlobeFocusIso3, setSelectedCountryIso3, setSidebarTab } = useAppContext();
  const [tooltip, setTooltip] = useState<HoveredSpike | null>(null);
  const [hoveredIso3, setHoveredIso3] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build real-data threats once — shared for both rendering and tooltip lookup
  const threats = useMemo(
    () => buildThreatsFromData(data.countries, geoData.features),
    [data.countries, geoData.features]
  );

  const severityZones = useMemo(
    () => buildSeverityZonesFromData(data.countries, geoData.features),
    [data.countries, geoData.features]
  );

  const handleSpikeHover = (instanceId: number, x: number, y: number) => {
    const threat = threats[instanceId];
    if (!threat || !containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    const localX = x - bounds.left;
    const localY = y - bounds.top;
    setHoveredIso3(threat.id);
    setTooltip({
      x: localX,
      y: localY,
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
    setTooltip(null);
    setHoveredIso3(null);
  };

  const handleSpikeClick = (instanceId: number) => {
    const threat = threats[instanceId];
    if (!threat) return;
    setSelectedCountryIso3(threat.id);
    setSidebarTab("countries");
  };

  return (
    <div ref={containerRef} className="h-full w-full bg-black relative">
      <Canvas
        camera={{ position: [0, 0, 2.9], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance", toneMapping: THREE.NoToneMapping }}
        dpr={[1, 2]}
      >
        <GlobeCore
          geoData={geoData}
          severityZones={severityZones}
          threats={threats}
          hoveredIso3={hoveredIso3}
          globeFocusIso3={globeFocusIso3}
          onFocusHandled={() => setGlobeFocusIso3(null)}
          onSpikeHover={handleSpikeHover}
          onSpikeLeave={handleSpikeLeave}
          onSpikeClick={handleSpikeClick}
        />

        <EffectComposer enableNormalPass={false}>
          <Bloom intensity={1.6} luminanceThreshold={0.16} luminanceSmoothing={0.2} mipmapBlur />
        </EffectComposer>
      </Canvas>

      {/* Spike hover tooltip — HTML overlay outside the WebGL canvas */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-30 px-3 py-2"
          style={{
            left: Math.min(Math.max(tooltip.x + 10, 8), Math.max(8, (containerRef.current?.clientWidth ?? 0) - 220)),
            top: Math.min(Math.max(tooltip.y, 24), Math.max(24, (containerRef.current?.clientHeight ?? 0) - 40)),
            transform: "translateY(-50%)",
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[12px] font-semibold font-mono text-cyan-100">{tooltip.countryName}</p>
            {tooltip.severityIndex > 0 && (
              <span className="text-[10px] font-mono font-bold text-red-400">
                {tooltip.severityIndex.toFixed(1)}/5
              </span>
            )}
          </div>
          <p className="text-[11px] font-mono text-cyan-400">
            Funded (on-appeal): {formatDollars(tooltip.totalFunding)}
          </p>
          {tooltip.offAppealFunding > 0 && (
            <p className="text-[10px] font-mono text-muted-foreground">
              Off-appeal: {formatDollars(tooltip.offAppealFunding)} (all: {tooltip.percentFundedAll.toFixed(0)}%)
            </p>
          )}
          <p className="text-[10px] font-mono text-muted-foreground">
            {Number.isFinite(tooltip.percentFunded)
              ? `${tooltip.percentFunded.toFixed(0)}% of requirements`
              : "—"}
          </p>
          <p className="text-[9px] font-mono text-cyan-400/40 mt-0.5">Click to open country</p>
        </div>
      )}

      <div className="pointer-events-none absolute left-0 top-0 h-20 w-full bg-gradient-to-b from-black/75 to-transparent" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-20 w-full bg-gradient-to-t from-black/75 to-transparent" />
    </div>
  );
}
