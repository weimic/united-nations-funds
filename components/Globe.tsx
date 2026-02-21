"use client";

import { useRef, useMemo, useCallback, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { useAppContext } from "@/lib/app-context";
import {
  latLonToVector3,
  getFeatureCentroid,
  polygonToGlobePoints,
  buildCountryTexture,
  buildLandGlowTexture,
} from "@/lib/geo-utils";
import type { GeoData, GeoFeature } from "@/lib/types";

const GLOBE_RADIUS = 1;
const ATMOSPHERE_RADIUS = 1.038;

// ── Globe Atmosphere Shader (boosted, wider glow) ──────────────────────────────
const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmosphereFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float ndv = max(0.0, dot(viewDirection, vNormal));
    float fresnel = pow(1.0 - ndv, 2.6);
    float rim = pow(1.0 - ndv, 5.5);
    vec3 color = vec3(0.07, 0.24, 0.56);
    float alpha = fresnel * 0.58 + rim * 0.18;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
  }
`;

// ── Outer diffuse atmosphere (very large, faint) ───────────────────────────────
const outerAtmoFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float ndv = max(0.0, dot(viewDirection, vNormal));
    float fresnel = pow(1.0 - ndv, 1.7);
    vec3 color = vec3(0.04, 0.12, 0.34);
    gl_FragColor = vec4(color, fresnel * 0.22);
  }
`;

// ── Globe Surface Shader ───────────────────────────────────────────────────────
const globeVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const globeFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec3 baseColor = vec3(0.008, 0.016, 0.04);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - max(0.0, dot(viewDir, vNormal)), 2.2);
    vec3 rimColor = vec3(0.05, 0.25, 0.6);
    vec3 color = baseColor + rimColor * fresnel * 0.5;
    gl_FragColor = vec4(color, 1.0);
  }
`;

// ── Spike Vertex Shader (shared by core + glow) ────────────────────────────────
// Uses Three.js instancing shader chunks for InstancedMesh support.
const spikeVertexShader = `
  #include <common>
  #include <instanced_pars_vertex>

  varying float vT;

  void main() {
    // vT: 0.0 at base (Y = -0.5), 1.0 at tip (Y = +0.5)
    vT = clamp(position.y + 0.5, 0.0, 1.0);

    vec3 transformed = vec3(position);
    #include <instanced_vertex>

    gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
  }
`;

// Core spike — bright green, fades from base to tip
const spikeCoreFragmentShader = `
  uniform float uTime;
  varying float vT;

  void main() {
    // Subtle shimmer along height
    float shimmer = 0.93 + 0.07 * sin(uTime * 3.8 + vT * 8.0);
    float alpha = pow(1.0 - vT, 1.35) * shimmer;
    // Bright neon green, slightly cooler at tip
    vec3 col = mix(vec3(0.18, 1.0, 0.45), vec3(0.35, 1.0, 0.62), vT) * (1.75 - vT * 0.85);
    gl_FragColor = vec4(col, alpha);
  }
`;

// Outer glow halo — wider, softer, pulsing
const spikeGlowFragmentShader = `
  uniform float uTime;
  varying float vT;

  void main() {
    float pulse = 0.80 + 0.20 * sin(uTime * 2.2);
    float alpha = pow(1.0 - vT, 2.1) * 0.32 * pulse;
    vec3 col = vec3(0.08, 0.90, 0.40);
    gl_FragColor = vec4(col, alpha);
  }
`;

// ── Crisis Severity Texture Layer ──────────────────────────────────────────────
function CrisisSeverityLayer({ geoData }: { geoData: GeoData }) {
  const { data } = useAppContext();

  const texture = useMemo(() => {
    const colorMap: Record<string, [number, number, number, number]> = {};
    for (const [iso3, country] of Object.entries(data.countries)) {
      if (!country.severity) continue;
      const t = Math.min(country.severity.severityIndex / 5, 1);
      const r = Math.round(80 + t * 175);
      const g = Math.round(5 * (1 - t));
      const b = Math.round(5 * (1 - t));
      const alpha = Math.round(45 + t * 185);
      colorMap[iso3] = [r, g, b, alpha];
    }
    return buildCountryTexture(geoData, colorMap);
  }, [data.countries, geoData]);

  useEffect(() => {
    return () => { texture?.dispose(); };
  }, [texture]);

  if (!texture) return null;

  return (
    <mesh>
      <sphereGeometry args={[GLOBE_RADIUS + 0.001, 64, 64]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} opacity={1} />
    </mesh>
  );
}

// ── Land Mass Glow Layer ───────────────────────────────────────────────────────
function LandGlowLayer({ geoData }: { geoData: GeoData }) {
  const texture = useMemo(() => buildLandGlowTexture(geoData), [geoData]);

  useEffect(() => {
    return () => { texture?.dispose(); };
  }, [texture]);

  if (!texture) return null;

  return (
    <mesh>
      <sphereGeometry args={[GLOBE_RADIUS + 0.002, 64, 64]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={1}
      />
    </mesh>
  );
}

// ── Wispy Budget Spikes ────────────────────────────────────────────────────────
function BudgetSpikes({ geoData }: { geoData: GeoData }) {
  const { data } = useAppContext();
  const coreRef = useRef<THREE.InstancedMesh>(null);
  const glowRef = useRef<THREE.InstancedMesh>(null);

  // Create materials once
  const coreMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: spikeVertexShader,
        fragmentShader: spikeCoreFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    []
  );

  const glowMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: spikeVertexShader,
        fragmentShader: spikeGlowFragmentShader,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    []
  );

  // Cone geometries: inner core (thin) + outer glow (wider)
  const coreGeo = useMemo(
    () => new THREE.CylinderGeometry(0.0008, 0.008, 1, 6),
    []
  );
  const glowGeo = useMemo(
    () => new THREE.CylinderGeometry(0.003, 0.022, 1, 6),
    []
  );

  useEffect(() => {
    return () => {
      coreMaterial.dispose();
      glowMaterial.dispose();
      coreGeo.dispose();
      glowGeo.dispose();
    };
  }, [coreMaterial, glowMaterial, coreGeo, glowGeo]);

  const spikeData = useMemo(() => {
    const spikes: Array<{
      iso3: string;
      position: THREE.Vector3;
      height: number;
    }> = [];

    const fundingValues: number[] = [];
    for (const country of Object.values(data.countries)) {
      if (country.overallFunding && country.overallFunding.totalFunding > 0) {
        fundingValues.push(country.overallFunding.totalFunding);
      }
    }

    if (fundingValues.length === 0) return spikes;

    const maxFunding = Math.max(...fundingValues);
    const logMax = Math.log(maxFunding + 1);

    for (const feature of geoData.features) {
      const country = data.countries[feature.id];
      if (!country?.overallFunding || country.overallFunding.totalFunding <= 0) continue;

      const [lat, lon] = getFeatureCentroid(feature.geometry);
      const pos = latLonToVector3(lat, lon, GLOBE_RADIUS);

      const logVal = Math.log(country.overallFunding.totalFunding + 1);
      const t = logVal / logMax;
      const height = 0.018 + t * 0.30;

      spikes.push({ iso3: feature.id, position: pos, height });
    }

    return spikes;
  }, [data.countries, geoData]);

  useEffect(() => {
    if (!coreRef.current || !glowRef.current || spikeData.length === 0) return;

    const dummy = new THREE.Object3D();
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < spikeData.length; i++) {
      const { position, height } = spikeData[i];
      const outward = position.clone().normalize();

      dummy.quaternion.setFromUnitVectors(up, outward);
      dummy.position.copy(position).addScaledVector(outward, height * 0.5);
      dummy.scale.set(1, height, 1);
      dummy.updateMatrix();

      coreRef.current.setMatrixAt(i, dummy.matrix);
      glowRef.current.setMatrixAt(i, dummy.matrix);
    }

    coreRef.current.instanceMatrix.needsUpdate = true;
    glowRef.current.instanceMatrix.needsUpdate = true;
  }, [spikeData]);

  // Animate time uniform for shimmer/pulse
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    coreMaterial.uniforms.uTime.value = t;
    glowMaterial.uniforms.uTime.value = t;
  });

  const count = Math.max(spikeData.length, 1);

  if (spikeData.length === 0) return null;

  return (
    <>
      {/* Core spike — thin, bright neon green */}
      <instancedMesh ref={coreRef} args={[coreGeo, coreMaterial, count]} />
      {/* Glow halo — wider, soft, pulsing */}
      <instancedMesh ref={glowRef} args={[glowGeo, glowMaterial, count]} />
    </>
  );
}

// ── Selected Country Outline ───────────────────────────────────────────────────
// Only the currently selected country gets an outline.
function SelectedCountryOutline({ geoData }: { geoData: GeoData }) {
  const { selectedCountryIso3 } = useAppContext();

  const outlineGroups = useMemo(() => {
    if (!selectedCountryIso3) return [];

    const feature = geoData.features.find((f) => f.id === selectedCountryIso3);
    if (!feature) return [];

    const groups: Array<{ points: THREE.Vector3[]; color: THREE.Color; opacity: number }> = [];
    const color = new THREE.Color(0.6, 0.95, 1.0); // bright cyan-white

    const polys =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates as number[][][]]
        : (feature.geometry.coordinates as number[][][][]);

    for (const poly of polys) {
      const ring = poly[0];
      if (ring.length < 3) continue;
      const points = polygonToGlobePoints(ring, GLOBE_RADIUS + 0.003);
      if (points.length > 2) {
        groups.push({ points, color, opacity: 0.95 });
      }
    }

    return groups;
  }, [geoData, selectedCountryIso3]);

  if (outlineGroups.length === 0) return null;

  return (
    <group>
      {outlineGroups.map((g, i) => (
        <CountryLine key={i} points={g.points} color={g.color} opacity={g.opacity} />
      ))}
    </group>
  );
}

function CountryLine({
  points,
  color,
  opacity = 0.95,
}: {
  points: THREE.Vector3[];
  color: THREE.Color;
  opacity?: number;
}) {
  const lineObj = useMemo(() => {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    return new THREE.Line(geometry, material);
  }, [points, color, opacity]);

  return <primitive object={lineObj} />;
}

// ── Country Markers (crisis-active) ───────────────────────────────────────────
function CountryMarkers({ geoData }: { geoData: GeoData }) {
  const { activeCrisis, activeCrisisCountryCodes, setSelectedCountryIso3 } = useAppContext();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const glowMeshRef = useRef<THREE.InstancedMesh>(null);

  const markerData = useMemo(() => {
    if (!activeCrisis) return [];
    const markers: Array<{
      iso3: string;
      position: THREE.Vector3;
      severity: number;
      color: THREE.Color;
    }> = [];

    for (const feature of geoData.features) {
      if (!activeCrisisCountryCodes.has(feature.id)) continue;
      const entry = activeCrisis.countries.find((c) => c.iso3 === feature.id);
      if (!entry) continue;
      const [lat, lon] = getFeatureCentroid(feature.geometry);
      const pos = latLonToVector3(lat, lon, GLOBE_RADIUS + 0.012);
      const t = Math.min(entry.severityIndex / 5, 1);
      const color = new THREE.Color(0.2 + t * 0.8, 0.05 * (1 - t), 0.05 * (1 - t));
      markers.push({ iso3: feature.id, position: pos, severity: entry.severityIndex, color });
    }

    return markers;
  }, [activeCrisis, activeCrisisCountryCodes, geoData]);

  useMemo(() => {
    if (!meshRef.current || !glowMeshRef.current || markerData.length === 0) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < markerData.length; i++) {
      const { position, severity, color } = markerData[i];
      dummy.position.copy(position);
      dummy.lookAt(0, 0, 0);
      const scale = 0.007 + (severity / 5) * 0.018;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, color);
      dummy.scale.setScalar(scale * 2.5);
      dummy.updateMatrix();
      glowMeshRef.current.setMatrixAt(i, dummy.matrix);
      glowMeshRef.current.setColorAt(i, color);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
    glowMeshRef.current.instanceMatrix.needsUpdate = true;
    if (glowMeshRef.current.instanceColor) glowMeshRef.current.instanceColor.needsUpdate = true;
  }, [markerData]);

  useFrame(({ clock }) => {
    if (!glowMeshRef.current || markerData.length === 0) return;
    const t = clock.getElapsedTime();
    const pulse = 0.15 + Math.sin(t * 2.5) * 0.1;
    const mat = glowMeshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = pulse;
  });

  const count = Math.max(markerData.length, 1);
  const handleClick = useCallback(
    (e: THREE.Event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const event = e as any;
      event.stopPropagation();
      if (event.instanceId !== undefined && markerData[event.instanceId]) {
        setSelectedCountryIso3(markerData[event.instanceId].iso3);
      }
    },
    [markerData, setSelectedCountryIso3]
  );

  if (markerData.length === 0) return null;

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]} onClick={handleClick}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial vertexColors emissive="#ff1800" emissiveIntensity={1.0} roughness={0.15} metalness={0.1} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={glowMeshRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial vertexColors transparent opacity={0.18} depthWrite={false} />
      </instancedMesh>
    </>
  );
}

// ── Main Globe Scene ───────────────────────────────────────────────────────────
function GlobeScene({ geoData }: { geoData: GeoData }) {
  const { globeFocusIso3 } = useAppContext();
  const globeRef = useRef<THREE.Group>(null);
  const rotationRef = useRef(0);
  const targetRotYRef = useRef<number | null>(null);

  useEffect(() => {
    if (!globeFocusIso3) return;
    const feature = geoData.features.find((f) => f.id === globeFocusIso3);
    if (!feature) return;
    const [, lon] = getFeatureCentroid(feature.geometry);
    const targetRotY = Math.PI / 2 + lon * (Math.PI / 180);
    targetRotYRef.current = targetRotY;
  }, [globeFocusIso3, geoData.features]);

  useFrame((_state, delta) => {
    if (!globeRef.current) return;

    if (targetRotYRef.current !== null) {
      let diff = targetRotYRef.current - rotationRef.current;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;

      if (Math.abs(diff) < 0.005) {
        rotationRef.current = targetRotYRef.current;
        targetRotYRef.current = null;
      } else {
        rotationRef.current += diff * Math.min(delta * 4, 0.12);
      }
    } else {
      rotationRef.current += delta * 0.04;
    }

    globeRef.current.rotation.y = rotationRef.current;
  });

  return (
    <>
      <ambientLight intensity={0.08} />
      <directionalLight position={[4, 3, 4]} intensity={0.25} color="#3060a0" />
      <directionalLight position={[-4, -2, -4]} intensity={0.06} color="#001022" />
      <pointLight position={[2, 3, 2]} intensity={0.18} color="#204080" />

      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={0.2} />

      <group ref={globeRef}>
        {/* Dark globe surface */}
        <mesh>
          <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
          <shaderMaterial
            vertexShader={globeVertexShader}
            fragmentShader={globeFragmentShader}
          />
        </mesh>

        {/* Radial severity fill — centered glow per country */}
        <CrisisSeverityLayer geoData={geoData} />

        {/* Wispy land-mass glow outline */}
        <LandGlowLayer geoData={geoData} />

        {/* Selected country outline only */}
        <SelectedCountryOutline geoData={geoData} />

        {/* Wispy neon-green budget spikes */}
        <BudgetSpikes geoData={geoData} />

        {/* Pulsing crisis markers */}
        <CountryMarkers geoData={geoData} />
      </group>

      {/* Primary atmosphere glow */}
      <mesh>
        <sphereGeometry args={[ATMOSPHERE_RADIUS, 64, 64]} />
        <shaderMaterial
          vertexShader={atmosphereVertexShader}
          fragmentShader={atmosphereFragmentShader}
          transparent
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Outer diffuse haze */}
      <mesh>
        <sphereGeometry args={[1.09, 48, 48]} />
        <shaderMaterial
          vertexShader={atmosphereVertexShader}
          fragmentShader={outerAtmoFragmentShader}
          transparent
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      <OrbitControls
        enableDamping
        dampingFactor={0.06}
        minDistance={1.3}
        maxDistance={2.5}
        enablePan={false}
        rotateSpeed={0.4}
      />
    </>
  );
}

// ── Globe Canvas Wrapper ───────────────────────────────────────────────────────
export default function Globe({ geoData }: { geoData: GeoData }) {
  return (
    <div className="h-full w-full">
      <Canvas
        camera={{ position: [0, 0, 2.5], fov: 48, near: 0.1, far: 1000 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
        style={{ background: "transparent" }}
      >
        <GlobeScene geoData={geoData} />
      </Canvas>
    </div>
  );
}

// Re-export type for usage in other files
export type { GeoFeature };
