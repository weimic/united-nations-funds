"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { createLandMask } from "@/lib/geo-utils";
import { GLOBE_RADIUS, LAND_MASK_WIDTH, LAND_MASK_HEIGHT, LANDMASS_DOT_COUNT } from "@/lib/constants";
import { latLongToVector3, angularDistance } from "./globe-data";
import type { SeverityZone } from "./globe-data";
import type { GeoData } from "@/lib/types";

const BASE_COLOR = new THREE.Color("#5a96b0");

/** Instanced dot-cloud covering all land masses with severity-zone color blending. */
export function LandmassDots({ geoData, severityZones }: { geoData: GeoData; severityZones: SeverityZone[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const dots = useMemo(() => {
    const mask = createLandMask(geoData, LAND_MASK_WIDTH, LAND_MASK_HEIGHT);
    if (!mask) return [] as Array<{ position: THREE.Vector3; color: THREE.Color }>;

    const zoneVectors = severityZones.map((zone) => ({
      ...zone,
      center: latLongToVector3(zone.lat, zone.lon, 1).normalize(),
      radiusRad: THREE.MathUtils.degToRad(zone.radius),
    }));

    const generated: Array<{ position: THREE.Vector3; color: THREE.Color }> = [];
    const phi = Math.PI * (3.0 - Math.sqrt(5.0)); // Golden angle

    for (let i = 0; i < LANDMASS_DOT_COUNT; i++) {
      const y = 1 - (i / (LANDMASS_DOT_COUNT - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phi * i;

      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;

      const lat = Math.asin(y) * (180 / Math.PI);
      const lon = Math.atan2(x, z) * (180 / Math.PI);

      const u = (lon + 180) / 360;
      const v = (90 - lat) / 180;

      const px = Math.max(0, Math.min(mask.width - 1, Math.floor(u * mask.width)));
      const py = Math.max(0, Math.min(mask.height - 1, Math.floor(v * mask.height)));
      const idx = (py * mask.width + px) * 4;

      if (mask.data[idx] < 120) continue;

      const position = new THREE.Vector3(x, y, z).multiplyScalar(GLOBE_RADIUS);
      const normal = new THREE.Vector3(x, y, z);

      const dotColor = BASE_COLOR.clone();
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
  }, [geoData, severityZones]);

  const dotGeometry = useMemo(() => new THREE.IcosahedronGeometry(0.0058, 0), []);

  const dotMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
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
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [dots]);

  if (dots.length === 0) return null;

  return <instancedMesh ref={meshRef} args={[dotGeometry, dotMaterial, dots.length]} frustumCulled={false} />;
}
