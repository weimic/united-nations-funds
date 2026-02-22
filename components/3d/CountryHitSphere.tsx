"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { GLOBE_RADIUS } from "@/lib/constants";
import { findCountryAtPoint } from "@/lib/geo-utils";
import type { FeatureBBox } from "@/lib/geo-utils";

/** Invisible sphere that intercepts pointer events on the globe surface. */
export function CountryHitSphere({
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
  const gl = useThree((s) => s.gl);
  const geometry = useMemo(() => new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64), []);
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    [],
  );

  return (
    <mesh
      geometry={geometry}
      material={material}
      onPointerMove={(e) => {
        const point = e.point;
        const r = point.length();
        if (r === 0) return;
        const lat = Math.asin(point.y / r) * (180 / Math.PI);
        const lon = Math.atan2(point.x, point.z) * (180 / Math.PI);

        const feature = findCountryAtPoint(lon, lat, bboxes);
        if (feature) {
          gl.domElement.style.cursor = "pointer";
          onCountryHover(feature.id, feature.properties.name, e.nativeEvent.clientX, e.nativeEvent.clientY);
        } else {
          gl.domElement.style.cursor = "default";
          onCountryLeave();
        }
      }}
      onPointerLeave={() => {
        gl.domElement.style.cursor = "default";
        onCountryLeave();
      }}
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
    />
  );
}
