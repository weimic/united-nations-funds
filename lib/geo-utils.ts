import * as THREE from "three";
import type { GeoData } from "./types";

const GLOBE_RADIUS = 1;

/**
 * Convert latitude/longitude to 3D position on sphere.
 */
export function latLonToVector3(
  lat: number,
  lon: number,
  radius: number = GLOBE_RADIUS
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/**
 * Get the centroid of a GeoJSON polygon/multipolygon for label placement.
 */
export function getFeatureCentroid(
  geometry: { type: string; coordinates: number[][][] | number[][][][] }
): [number, number] {
  let coords: number[][] = [];

  if (geometry.type === "Polygon") {
    coords = (geometry.coordinates as number[][][])[0];
  } else if (geometry.type === "MultiPolygon") {
    const polys = geometry.coordinates as number[][][][];
    let maxLen = 0;
    for (const poly of polys) {
      if (poly[0].length > maxLen) {
        maxLen = poly[0].length;
        coords = poly[0];
      }
    }
  }

  if (coords.length === 0) return [0, 0];

  let sumLon = 0;
  let sumLat = 0;
  for (const c of coords) {
    sumLon += c[0];
    sumLat += c[1];
  }

  return [sumLat / coords.length, sumLon / coords.length];
}

/**
 * Get severity-based color for a country.
 */
export function getSeverityColor(severity: number): THREE.Color {
  const t = Math.min(severity / 5, 1);
  const r = 0.2 + t * 0.8;
  const g = 0.05 * (1 - t);
  const b = 0.05 * (1 - t);
  return new THREE.Color(r, g, b);
}

/**
 * Get emissive intensity based on severity for glow effect.
 */
export function getSeverityEmissive(severity: number): number {
  const t = Math.min(severity / 5, 1);
  return 0.1 + t * 0.9;
}

/**
 * Build a CanvasTexture in equirectangular projection for globe overlays.
 * Uses radial gradients centered on each country — bright center, transparent at borders.
 * colorMap: iso3 -> [r, g, b, a] (values 0-255)
 */
export function buildCountryTexture(
  geoData: GeoData,
  colorMap: Record<string, [number, number, number, number]>,
  width = 4096,
  height = 2048
): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, width, height);

  const lonToX = (lon: number) => ((lon + 180) / 360) * width;
  const latToY = (lat: number) => ((90 - lat) / 180) * height;

  for (const feature of geoData.features) {
    const rgba = colorMap[feature.id];
    if (!rgba) continue;
    const [r, g, b, a] = rgba;

    const polys =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates as number[][][]]
        : (feature.geometry.coordinates as number[][][][]);

    // Compute bounding box across all polygons in canvas space
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const poly of polys) {
      const ring = poly[0];
      for (const pt of ring) {
        const x = lonToX(pt[0]);
        const y = latToY(pt[1]);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    if (!isFinite(minX)) continue;

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    // Radius: large enough to reach the furthest corner, with a bit extra
    const radius = Math.sqrt(
      Math.pow((maxX - minX) / 2, 2) + Math.pow((maxY - minY) / 2, 2)
    ) * 1.15 + 2;

    const alpha = a / 255;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0,    `rgba(${r},${g},${b},${alpha.toFixed(3)})`);
    gradient.addColorStop(0.1,  `rgba(${r},${g},${b},${(alpha * 0.8).toFixed(3)})`);
    gradient.addColorStop(0.3,  `rgba(${r},${g},${b},${(alpha * 0.2).toFixed(3)})`);
    gradient.addColorStop(0.5,  `rgba(${r},${g},${b},0)`);
    gradient.addColorStop(1,    `rgba(${r},${g},${b},0)`);

    ctx.fillStyle = gradient;

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Create a binary land mask (white land, black water) for point cloud generation.
 */
export function createLandMask(
  geoData: GeoData,
  width = 2048,
  height = 1024
): ImageData | null {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#FFFFFF";
  const lonToX = (lon: number) => ((lon + 180) / 360) * width;
  const latToY = (lat: number) => ((90 - lat) / 180) * height;

  for (const feature of geoData.features) {
    const polys =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates as number[][][]]
        : (feature.geometry.coordinates as number[][][][]);

    for (const poly of polys) {
      const ring = poly[0];
      if (ring.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(lonToX(ring[0][0]), latToY(ring[0][1]));
      for (let i = 1; i < ring.length; i++) {
        ctx.lineTo(lonToX(ring[i][0]), latToY(ring[i][1]));
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  return ctx.getImageData(0, 0, width, height);
}

/**
 * Build a glowing land-mass outline texture using canvas shadow blur.
 * Creates wispy blue-cyan halos around all country outlines.
 */
export function buildLandGlowTexture(
  geoData: GeoData,
  width = 2048,
  height = 1024
): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, width, height);

  const lonToX = (lon: number) => ((lon + 180) / 360) * width;
  const latToY = (lat: number) => ((90 - lat) / 180) * height;

  // Pass 1: solid fill for landmass
  ctx.fillStyle = "rgba(45, 130, 255, 0.15)";

  for (const feature of geoData.features) {
    const polys =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates as number[][][]]
        : (feature.geometry.coordinates as number[][][][]);

    for (const poly of polys) {
      const ring = poly[0];
      if (ring.length < 3) continue;
      ctx.beginPath();
      ctx.moveTo(lonToX(ring[0][0]), latToY(ring[0][1]));
      for (let i = 1; i < ring.length; i++) {
        ctx.lineTo(lonToX(ring[i][0]), latToY(ring[i][1]));
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Convert GeoJSON polygon coordinates to 3D line points on the globe.
 */
export function polygonToGlobePoints(
  coords: number[][],
  radius: number = GLOBE_RADIUS
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const step = Math.max(1, Math.floor(coords.length / 80));
  for (let i = 0; i < coords.length; i += step) {
    const [lon, lat] = coords[i];
    points.push(latLonToVector3(lat, lon, radius));
  }
  if (coords.length > 0) {
    const [lon, lat] = coords[0];
    points.push(latLonToVector3(lat, lon, radius));
  }
  return points;
}
