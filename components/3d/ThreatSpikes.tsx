"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { GLOBE_RADIUS } from "@/lib/constants";
import { latLongToVector3 } from "./globe-data";
import type { ActiveThreat } from "./globe-data";

/** Instanced spike mesh representing funding gap or severity per country. */
export function ThreatSpikes({
  threats,
  spikeMode,
  spikeColorMode,
  onHover,
  onLeave,
  onClick,
}: {
  threats: ActiveThreat[];
  spikeMode: "fundingGap" | "severity";
  spikeColorMode: "default" | "spectrum";
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
        toneMapped: false,
      }),
    [],
  );

  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useEffect(() => {
    if (!meshRef.current || threats.length === 0) return;

    const helper = new THREE.Object3D();
    for (let i = 0; i < threats.length; i++) {
      const threat = threats[i];
      const surfacePoint = latLongToVector3(threat.lat, threat.lon, GLOBE_RADIUS);
      const surfaceNormal = surfacePoint.clone().normalize();

      helper.position.copy(surfacePoint);
      helper.quaternion.setFromUnitVectors(up, surfaceNormal);
      helper.scale.set(1, 0.05 + threat.magnitude * 0.45, 1);
      helper.updateMatrix();
      meshRef.current.setMatrixAt(i, helper.matrix);

      let color: THREE.Color;
      if (spikeColorMode === "spectrum") {
        const t = THREE.MathUtils.clamp(threat.magnitude, 0, 1);
        color = new THREE.Color("#ffd700").lerp(new THREE.Color("#dc2626"), t);
      } else if (spikeMode === "severity") {
        const sevNorm = THREE.MathUtils.clamp(threat.severityIndex / 5, 0, 1);
        color = new THREE.Color("#ff8c42").lerp(new THREE.Color("#ff1a1a"), sevNorm);
      } else {
        const pctNorm = THREE.MathUtils.clamp(threat.percentFunded / 100, 0, 1);
        color = new THREE.Color("#ff1a1a").lerp(new THREE.Color("#ff8c42"), pctNorm);
      }
      meshRef.current.setColorAt(i, color);
    }

    meshRef.current.count = threats.length;
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [threats, up, spikeMode, spikeColorMode]);

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
