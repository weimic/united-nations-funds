"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { OrbitControls, Stars } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import { createLandMask, getFeatureCentroid, getSeverityColor, buildFeatureBBoxes, findCountryAtPoint, buildSolidCountryTexture } from "@/lib/geo-utils";
import type { GeoData, GeoFeature, OverallFunding } from "@/lib/types";
import type { FeatureBBox } from "@/lib/geo-utils";
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

/** Minimal tooltip for hovering a country on the globe surface (not via spike). */
type CountryHoverData = {
  x: number;
  y: number;
  iso3: string;
  countryName: string;
  hasData: boolean;
  totalFunding?: number;
  percentFunded?: number;
  severityIndex?: number;
};

function latLongToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const latRad = THREE.MathUtils.degToRad(lat);
  const lonRad = THREE.MathUtils.degToRad(lon);
  const cosLat = Math.cos(latRad);

  return new THREE.Vector3(
    radius * cosLat * Math.sin(lonRad),
    radius * Math.sin(latRad),
    radius * cosLat * Math.cos(lonRad)
  );
}

function angularDistance(a: THREE.Vector3, b: THREE.Vector3): number {
  return Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
}

/**
 * Build funding spikes from real country data.
 * In "fundingGap" mode: selects up to 60 countries by largest funding gap.
 * In "severity" mode: selects up to 60 countries by highest severity index.
 */
function buildThreatsFromData(
  countries: Record<string, { name: string; overallFunding: OverallFunding | null; severity: { severityIndex: number } | null }>,
  features: GeoFeature[],
  mode: "fundingGap" | "severity" = "fundingGap"
): ActiveThreat[] {
  const centroidMap = new Map<string, [number, number]>();
  for (const feature of features) {
    if (!feature.id) continue;
    const [lat, lon] = getFeatureCentroid(feature.geometry);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      centroidMap.set(feature.id, [lat, lon]);
    }
  }

  if (mode === "severity") {
    const entries = Object.entries(countries)
      .filter(
        ([iso3, c]) =>
          c.severity &&
          c.severity.severityIndex > 0 &&
          centroidMap.has(iso3)
      )
      .map(([iso3, c]) => ({
        iso3,
        country: c,
        centroid: centroidMap.get(iso3)!,
      }))
      .sort((a, b) => (b.country.severity?.severityIndex ?? 0) - (a.country.severity?.severityIndex ?? 0))
      .slice(0, 60);

    if (entries.length === 0) return [];
    const maxSev = Math.max(...entries.map((e) => e.country.severity?.severityIndex ?? 0), 1);

    return entries.map(({ iso3, country, centroid }) => ({
      id: iso3,
      countryName: country.name,
      lat: centroid[0],
      lon: centroid[1],
      magnitude: Math.max(0.05, (country.severity?.severityIndex ?? 0) / maxSev),
      totalFunding: country.overallFunding?.totalFunding ?? 0,
      offAppealFunding: country.overallFunding?.offAppealFunding ?? 0,
      totalFundingAll: country.overallFunding?.totalFundingAll ?? 0,
      percentFunded: country.overallFunding?.percentFunded ?? 0,
      percentFundedAll: country.overallFunding?.percentFundedAll ?? 0,
      severityIndex: country.severity?.severityIndex ?? 0,
    }));
  }

  // Default: fundingGap mode
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
  }, [globeFocusIso3]); // Only re-run on focus target change

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
      const lon = Math.atan2(x, z) * (180 / Math.PI);

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
  spikeMode,
  onHover,
  onLeave,
  onClick,
}: {
  threats: ActiveThreat[];
  spikeMode: "fundingGap" | "severity";
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

      // Color depends on spikeMode
      let color: THREE.Color;
      if (spikeMode === "severity") {
        // Severity mode: color by severity index (low = amber, high = deep red)
        const sevNorm = THREE.MathUtils.clamp(threat.severityIndex / 5, 0, 1);
        color = new THREE.Color("#ff8c42").lerp(new THREE.Color("#ff1a1a"), sevNorm);
      } else {
        // Funding gap mode: color by % funded (low % = deep red, high % = amber)
        const pctNorm = THREE.MathUtils.clamp(threat.percentFunded / 100, 0, 1);
        color = new THREE.Color("#ff1a1a").lerp(new THREE.Color("#ff8c42"), pctNorm);
      }
      meshRef.current.setColorAt(i, color);
    }

    meshRef.current.count = threats.length;
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  }, [threats, up, spikeMode]);

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

// ── Country Hit Sphere ─────────────────────────────────────────────────────────
/** Invisible sphere that intercepts pointer events on the globe surface. */
function CountryHitSphere({
  bboxes,
  onCountryHover,
  onCountryLeave,
  onCountryClick,
}: {
  bboxes: FeatureBBox[];
  onCountryHover: (iso3: string, name: string, clientX: number, clientY: number) => void;
  onCountryLeave: () => void;
  onCountryClick: (iso3: string) => void;
}) {
  return (
    <mesh
      onPointerMove={(e) => {
        const point = e.point;
        const r = point.length();
        if (r === 0) return;
        const lat = Math.asin(point.y / r) * (180 / Math.PI);
        const lon = Math.atan2(point.x, point.z) * (180 / Math.PI);

        const feature = findCountryAtPoint(lon, lat, bboxes);
        if (feature) {
          onCountryHover(feature.id, feature.properties.name, e.nativeEvent.clientX, e.nativeEvent.clientY);
        } else {
          onCountryLeave();
        }
      }}
      onPointerLeave={onCountryLeave}
      onClick={(e) => {
        e.stopPropagation();
        const point = e.point;
        const r = point.length();
        if (r === 0) return;
        const lat = Math.asin(point.y / r) * (180 / Math.PI);
        const lon = Math.atan2(point.x, point.z) * (180 / Math.PI);

        const feature = findCountryAtPoint(lon, lat, bboxes);
        if (feature) {
          onCountryClick(feature.id);
        }
      }}
    >
      <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function GlobeCore({
  geoData,
  severityZones,
  threats,
  hoveredIso3,
  selectedCountryIso3,
  globeFocusIso3,
  spikeMode,
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
        {/* Base sphere + map visualization */}
        {mapStyle === "dots" ? (
          <>
            <mesh>
              <sphereGeometry args={[GLOBE_RADIUS * 0.985, 64, 64]} />
              <meshBasicMaterial color="#03060b" />
            </mesh>
            <LandmassDots geoData={geoData} severityZones={severityZones} />
          </>
        ) : solidMapTexture ? (
          <mesh>
            <sphereGeometry args={[GLOBE_RADIUS * 0.985, 64, 64]} />
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
  const {
    data,
    globeFocusIso3,
    setGlobeFocusIso3,
    selectedCountryIso3,
    setSelectedCountryIso3,
    setSidebarTab,
    spikeMode,
    mapStyle,
    setMapStyle,
  } = useAppContext();
  const [spikeTooltip, setSpikeTooltip] = useState<HoveredSpike | null>(null);
  const [countryTooltip, setCountryTooltip] = useState<CountryHoverData | null>(null);
  const [hoveredIso3, setHoveredIso3] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build threats once — shared for both rendering and tooltip lookup
  const threats = useMemo(
    () => buildThreatsFromData(data.countries, geoData.features, spikeMode),
    [data.countries, geoData.features, spikeMode]
  );

  const severityZones = useMemo(
    () => buildSeverityZonesFromData(data.countries, geoData.features),
    [data.countries, geoData.features]
  );

  // Pre-computed bounding boxes for fast country-at-point lookup
  const bboxes = useMemo(
    () => buildFeatureBBoxes(geoData.features),
    [geoData.features]
  );

  // Pre-compute solid country map texture (always available for toggle)
  const solidMapTexture = useMemo(() => {
    const colorMap: Record<string, string> = {};
    for (const feature of geoData.features) {
      const country = data.countries[feature.id];
      if (!country) {
        // No data → white (neutral)
        colorMap[feature.id] = "#e0e0e0";
      } else if (country.severity && country.severity.severityIndex > 0) {
        const sev = country.severity.severityIndex;
        const sevColor = getSeverityColor(sev);
        const baseColor = new THREE.Color("#5a96b0");
        const t = Math.min(sev / 5, 1);
        baseColor.lerp(sevColor, t);
        colorMap[feature.id] = `#${baseColor.getHexString()}`;
      } else {
        // Has data but no severity → base blue
        colorMap[feature.id] = "#5a96b0";
      }
    }
    return buildSolidCountryTexture(geoData, colorMap, "#03060b");
  }, [geoData, data.countries]);

  // ── Spike hover handlers ──────────────────────────────────────────────────
  const handleSpikeHover = (instanceId: number, x: number, y: number) => {
    const threat = threats[instanceId];
    if (!threat || !containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    const localX = x - bounds.left;
    const localY = y - bounds.top;
    setHoveredIso3(threat.id);
    setCountryTooltip(null); // spike takes priority
    setSpikeTooltip({
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
    setSpikeTooltip(null);
    setHoveredIso3(null);
  };

  const handleSpikeClick = (instanceId: number) => {
    const threat = threats[instanceId];
    if (!threat) return;
    setSelectedCountryIso3(threat.id);
    setSidebarTab("countries");
  };

  // ── Country (surface) hover handlers ──────────────────────────────────────
  const handleCountryHover = (iso3: string, name: string, clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    const localX = clientX - bounds.left;
    const localY = clientY - bounds.top;
    setHoveredIso3(iso3);

    // Don't overwrite spike tooltip
    if (spikeTooltip) return;

    const country = data.countries[iso3];
    setCountryTooltip({
      x: localX,
      y: localY,
      iso3,
      countryName: name,
      hasData: !!country,
      totalFunding: country?.overallFunding?.totalFunding,
      percentFunded: country?.overallFunding?.percentFunded,
      severityIndex: country?.severity?.severityIndex,
    });
  };

  const handleCountryLeave = () => {
    // Only clear if spike isn't active
    if (!spikeTooltip) {
      setCountryTooltip(null);
      setHoveredIso3(null);
    }
  };

  const handleCountryClick = (iso3: string) => {
    const country = data.countries[iso3];
    if (!country) return; // No click for countries without data
    setSelectedCountryIso3(iso3);
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
          selectedCountryIso3={selectedCountryIso3}
          globeFocusIso3={globeFocusIso3}
          spikeMode={spikeMode}
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
          <Bloom intensity={1.6} luminanceThreshold={0.16} luminanceSmoothing={0.2} mipmapBlur />
        </EffectComposer>
      </Canvas>

      {/* Tooltip — HTML overlay outside the WebGL canvas */}
      {spikeTooltip && (
        <div
          className="pointer-events-none absolute z-30"
          style={{
            left: Math.min(Math.max(spikeTooltip.x, 60), (containerRef.current?.clientWidth ?? 300) - 60),
            top: Math.max(spikeTooltip.y - 8, 20),
            transform: "translate(-50%, -100%)",
            textShadow: "0 1px 6px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.8)",
          }}
        >
          <div className="flex flex-col items-center gap-0.5 px-1">
            <p className="text-[12px] font-semibold font-mono text-cyan-100 whitespace-nowrap">{spikeTooltip.countryName}</p>
            {spikeTooltip.severityIndex > 0 && (
              <span className="text-[11px] font-mono font-bold text-red-400">
                Severity {spikeTooltip.severityIndex.toFixed(1)}/5
              </span>
            )}
            <p className="text-[10px] font-mono text-cyan-400 whitespace-nowrap">
              {formatDollars(spikeTooltip.totalFunding)} funded
              {Number.isFinite(spikeTooltip.percentFunded) && ` · ${spikeTooltip.percentFunded.toFixed(0)}%`}
            </p>
            <p className="text-[9px] font-mono text-cyan-400/50 mt-0.5">Click to open</p>
          </div>
        </div>
      )}

      {/* Country surface hover tooltip */}
      {!spikeTooltip && countryTooltip && (
        <div
          className="pointer-events-none absolute z-30"
          style={{
            left: Math.min(Math.max(countryTooltip.x, 60), (containerRef.current?.clientWidth ?? 300) - 60),
            top: Math.max(countryTooltip.y - 8, 20),
            transform: "translate(-50%, -100%)",
            textShadow: "0 1px 6px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.8)",
          }}
        >
          <div className="flex flex-col items-center gap-0.5 px-1">
            <p className="text-[12px] font-semibold font-mono text-cyan-100 whitespace-nowrap">{countryTooltip.countryName}</p>
            {countryTooltip.hasData ? (
              <>
                {countryTooltip.severityIndex != null && countryTooltip.severityIndex > 0 && (
                  <span className="text-[11px] font-mono font-bold text-red-400">
                    Severity {countryTooltip.severityIndex.toFixed(1)}/5
                  </span>
                )}
                {countryTooltip.totalFunding != null && (
                  <p className="text-[10px] font-mono text-cyan-400 whitespace-nowrap">
                    {formatDollars(countryTooltip.totalFunding)} funded
                    {countryTooltip.percentFunded != null && Number.isFinite(countryTooltip.percentFunded) && ` · ${countryTooltip.percentFunded.toFixed(0)}%`}
                  </p>
                )}
                <p className="text-[9px] font-mono text-cyan-400/50 mt-0.5">Click to open</p>
              </>
            ) : (
              <p className="text-[10px] font-mono text-cyan-400/40 whitespace-nowrap">No funding or crisis data</p>
            )}
          </div>
        </div>
      )}

      {/* Data label — what the spikes currently represent */}
      <div className="absolute bottom-4 left-4 z-20">
        <div className="px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-sm border border-cyan-500/20">
          <span className="text-[10px] font-mono text-cyan-400/70 uppercase tracking-widest">
            Spikes: {spikeMode === "fundingGap" ? "Funding Gap" : "Severity"}
          </span>
        </div>
      </div>

      {/* Map style toggle */}
      <div className="absolute bottom-4 right-4 z-20">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-sm border border-cyan-500/20">
          <span className={`text-[10px] font-mono cursor-pointer transition-colors ${mapStyle === "dots" ? "text-cyan-400" : "text-cyan-400/40"}`} onClick={() => setMapStyle("dots")}>
            Dots
          </span>
          <button
            onClick={() => setMapStyle(mapStyle === "dots" ? "solid" : "dots")}
            className="relative w-8 h-4 rounded-full transition-colors"
            style={{ backgroundColor: mapStyle === "solid" ? "rgba(34,211,238,0.3)" : "rgba(34,211,238,0.1)" }}
            aria-label="Toggle map style"
          >
            <span
              className="absolute top-0.5 h-3 w-3 rounded-full bg-cyan-400 transition-all"
              style={{ left: mapStyle === "dots" ? "2px" : "calc(100% - 14px)" }}
            />
          </button>
          <span className={`text-[10px] font-mono cursor-pointer transition-colors ${mapStyle === "solid" ? "text-cyan-400" : "text-cyan-400/40"}`} onClick={() => setMapStyle("solid")}>
            Countries
          </span>
        </div>
      </div>

      <div className="pointer-events-none absolute left-0 top-0 h-20 w-full bg-gradient-to-b from-black/75 to-transparent" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-20 w-full bg-gradient-to-t from-black/75 to-transparent" />
    </div>
  );
}
