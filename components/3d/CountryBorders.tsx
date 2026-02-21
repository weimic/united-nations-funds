"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { GLOBE_RADIUS } from "@/lib/constants";
import { latLongToVector3 } from "./globe-data";
import type { GeoFeature } from "@/lib/types";

/** Single border ring rendered as a THREE.Line with over-bright color for bloom. */
function CountryBorderRing({ points }: { points: THREE.Vector3[] }) {
  const line = useMemo(() => {
    const positions = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      positions[i * 3] = points[i].x;
      positions[i * 3 + 1] = points[i].y;
      positions[i * 3 + 2] = points[i].z;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(3, 3, 3),
      toneMapped: false,
    });
    return new THREE.Line(geometry, material);
  }, [points]);

  return <primitive object={line} />;
}

/** Renders highlighted borders for a specific country by ISO3 code. */
export function CountryBorderHighlight({
  iso3,
  features,
}: {
  iso3: string | null;
  features: GeoFeature[];
}) {
  const lineSegments = useMemo(() => {
    if (!iso3) return [] as THREE.Vector3[][];
    const feature = features.find((f) => f.id === iso3);
    if (!feature) return [];

    const polys =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates as number[][][]]
        : (feature.geometry.coordinates as number[][][][]);

    return polys.map((poly) => {
      const ring = poly[0];
      const pts: THREE.Vector3[] = [];
      const step = Math.max(1, Math.floor(ring.length / 100));
      for (let i = 0; i < ring.length; i += step) {
        const [lon, lat] = ring[i];
        pts.push(latLongToVector3(lat, lon, GLOBE_RADIUS * 1.002));
      }
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
