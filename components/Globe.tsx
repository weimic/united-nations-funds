"use client";

import { useRef, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { useAppContext } from "@/lib/app-context";
import {
  latLonToVector3,
  getFeatureCentroid,
  getSeverityColor,
  getSeverityEmissive,
  polygonToGlobePoints,
} from "@/lib/geo-utils";
import type { GeoData, GeoFeature } from "@/lib/types";

const GLOBE_RADIUS = 1;
const ATMOSPHERE_RADIUS = 1.15;

// ── Globe Atmosphere Shader ────────────────────────────────────────────────────
// Per threejs-shaders: Custom ShaderMaterial with uniforms, fresnel pattern
const atmosphereVertexShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmosphereFragmentShader = `
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - dot(viewDirection, vNormal), 3.0);
    vec3 color = vec3(0.15, 0.4, 0.9);
    gl_FragColor = vec4(color, fresnel * 0.6);
  }
`;

// ── Globe Surface Shader ───────────────────────────────────────────────────────
// Dark base with grid lines for futuristic look
const globeVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const globeFragmentShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  void main() {
    // Dark base
    vec3 baseColor = vec3(0.02, 0.04, 0.08);

    // Subtle grid lines for futuristic feel
    float latLines = sin(vUv.y * 3.14159 * 18.0);
    float lonLines = sin(vUv.x * 3.14159 * 36.0);
    float grid = smoothstep(0.95, 1.0, abs(latLines)) + smoothstep(0.95, 1.0, abs(lonLines));
    grid *= 0.08;

    // Fresnel rim light
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - max(0.0, dot(viewDir, vNormal)), 2.5);

    vec3 rimColor = vec3(0.1, 0.3, 0.6);
    vec3 color = baseColor + vec3(grid * 0.3, grid * 0.5, grid) + rimColor * fresnel * 0.3;

    gl_FragColor = vec4(color, 1.0);
  }
`;

// ── Country Marker Component ───────────────────────────────────────────────────
// Per threejs-geometry: InstancedMesh for many identical objects
function CountryMarkers({ geoData }: { geoData: GeoData }) {
  const { activeCrisis, activeCrisisCountryCodes, setSelectedCountryIso3 } =
    useAppContext();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const glowMeshRef = useRef<THREE.InstancedMesh>(null);

  // Build per-crisis country data
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
      const pos = latLonToVector3(lat, lon, GLOBE_RADIUS + 0.01);
      const color = getSeverityColor(entry.severityIndex);

      markers.push({
        iso3: feature.id,
        position: pos,
        severity: entry.severityIndex,
        color,
      });
    }

    return markers;
  }, [activeCrisis, activeCrisisCountryCodes, geoData]);

  // Apply instance matrices and colors
  // Per threejs-geometry: InstancedMesh setup pattern
  useMemo(() => {
    if (!meshRef.current || !glowMeshRef.current || markerData.length === 0)
      return;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < markerData.length; i++) {
      const { position, severity, color } = markerData[i];

      dummy.position.copy(position);
      dummy.lookAt(0, 0, 0);
      // Scale based on severity
      const scale = 0.01 + (severity / 5) * 0.03;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();

      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, color);

      // Larger glow behind
      dummy.scale.setScalar(scale * 2.5);
      dummy.updateMatrix();
      glowMeshRef.current.setMatrixAt(i, dummy.matrix);
      glowMeshRef.current.setColorAt(i, color);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor)
      meshRef.current.instanceColor.needsUpdate = true;
    glowMeshRef.current.instanceMatrix.needsUpdate = true;
    if (glowMeshRef.current.instanceColor)
      glowMeshRef.current.instanceColor.needsUpdate = true;
  }, [markerData]);

  // Pulsing animation
  // Per threejs-animation: Clock for animation timing
  useFrame(({ clock }) => {
    if (!glowMeshRef.current || markerData.length === 0) return;
    const t = clock.getElapsedTime();
    const pulse = 0.3 + Math.sin(t * 2) * 0.15;
    const mat = glowMeshRef.current.material as THREE.MeshBasicMaterial;
    mat.opacity = pulse;
  });

  const count = Math.max(markerData.length, 1);

  // Per threejs-interaction: Raycasting with instancedMesh
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
      {/* Solid markers */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, count]}
        onClick={handleClick}
      >
        <sphereGeometry args={[1, 12, 12]} />
        <meshStandardMaterial
          emissive="#ff2200"
          emissiveIntensity={0.8}
          roughness={0.3}
          metalness={0.1}
        />
      </instancedMesh>

      {/* Glow layer */}
      <instancedMesh ref={glowMeshRef} args={[undefined, undefined, count]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial transparent opacity={0.3} depthWrite={false} />
      </instancedMesh>
    </>
  );
}

// ── Country Outlines ───────────────────────────────────────────────────────────
// Per threejs-geometry: Lines for wireframes
function CountryOutlines({ geoData }: { geoData: GeoData }) {
  const { activeCrisisCountryCodes, activeCrisis } = useAppContext();

  const outlineGroups = useMemo(() => {
    const groups: Array<{
      iso3: string;
      points: THREE.Vector3[];
      color: THREE.Color;
    }> = [];

    for (const feature of geoData.features) {
      const isActive = activeCrisisCountryCodes.has(feature.id);
      if (!isActive && activeCrisis) continue;

      const entry = activeCrisis?.countries.find(
        (c) => c.iso3 === feature.id
      );
      const color = entry
        ? getSeverityColor(entry.severityIndex)
        : new THREE.Color(0.1, 0.15, 0.25);

      const polys =
        feature.geometry.type === "Polygon"
          ? [feature.geometry.coordinates as number[][][]]
          : (feature.geometry.coordinates as number[][][][]);

      for (const poly of polys) {
        const ring = poly[0];
        if (ring.length < 3) continue;
        const points = polygonToGlobePoints(ring, GLOBE_RADIUS + 0.002);
        if (points.length > 2) {
          groups.push({ iso3: feature.id, points, color });
        }
      }
    }

    return groups;
  }, [geoData, activeCrisisCountryCodes, activeCrisis]);

  return (
    <group>
      {outlineGroups.map((g, i) => (
        <CountryLine key={`${g.iso3}-${i}`} points={g.points} color={g.color} />
      ))}
    </group>
  );
}

function CountryLine({
  points,
  color,
}: {
  points: THREE.Vector3[];
  color: THREE.Color;
}) {
  const lineObj = useMemo(() => {
    // Per threejs-geometry: BufferGeometry from points
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
    });
    return new THREE.Line(geometry, material);
  }, [points, color]);

  return <primitive object={lineObj} />;
}

// ── Main Globe Scene ───────────────────────────────────────────────────────────
function GlobeScene({ geoData }: { geoData: GeoData }) {
  const globeRef = useRef<THREE.Mesh>(null);

  // Per threejs-animation: Slow rotation
  useFrame(({ clock }) => {
    if (globeRef.current) {
      globeRef.current.rotation.y = clock.getElapsedTime() * 0.03;
    }
  });

  return (
    <>
      {/* Per threejs-lighting: Ambient + directional for globe */}
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 3, 5]} intensity={0.4} color="#4488cc" />
      <directionalLight
        position={[-5, -2, -5]}
        intensity={0.15}
        color="#112244"
      />
      <pointLight position={[3, 3, 3]} intensity={0.3} color="#6699ff" />

      {/* Stars background - per threejs-geometry: Points */}
      <Stars
        radius={100}
        depth={50}
        count={3000}
        factor={4}
        saturation={0}
        fade
        speed={0.5}
      />

      <group ref={globeRef}>
        {/* Globe surface with custom shader */}
        <mesh>
          <sphereGeometry args={[GLOBE_RADIUS, 64, 64]} />
          <shaderMaterial
            vertexShader={globeVertexShader}
            fragmentShader={globeFragmentShader}
          />
        </mesh>

        {/* Country outlines */}
        <CountryOutlines geoData={geoData} />

        {/* Country markers (crisis-active countries) */}
        <CountryMarkers geoData={geoData} />
      </group>

      {/* Atmosphere glow - per threejs-shaders: Fresnel effect */}
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

      {/* Camera controls - per threejs-interaction: OrbitControls with damping */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={1.3}
        maxDistance={4}
        enablePan={false}
        rotateSpeed={0.5}
      />
    </>
  );
}

// ── Globe Canvas Wrapper ───────────────────────────────────────────────────────
export default function Globe({ geoData }: { geoData: GeoData }) {
  return (
    <div className="h-full w-full">
      <Canvas
        camera={{ position: [0, 0, 2.5], fov: 50, near: 0.1, far: 1000 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        // Per threejs-fundamentals: pixel ratio clamping for performance
        dpr={[1, 2]}
        style={{ background: "transparent" }}
      >
        <GlobeScene geoData={geoData} />
      </Canvas>
    </div>
  );
}
