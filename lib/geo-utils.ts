import * as THREE from "three";

const GLOBE_RADIUS = 1;

/**
 * Convert latitude/longitude to 3D position on sphere.
 * Per threejs-fundamentals: Three.js uses right-handed coordinate system
 * (+X right, +Y up, +Z toward viewer).
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
    // Use the largest polygon
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
 * Uses increasing red intensity per skill: threejs-materials color handling.
 */
export function getSeverityColor(severity: number): THREE.Color {
  // Severity scale 0-5
  // 0-1: dim red, 2-3: medium red, 4-5: bright glowing red
  const t = Math.min(severity / 5, 1);

  // Dark red (low) to bright glowing red (high)
  const r = 0.2 + t * 0.8;
  const g = 0.05 * (1 - t);
  const b = 0.05 * (1 - t);

  return new THREE.Color(r, g, b);
}

/**
 * Get emissive intensity based on severity for glow effect.
 * Per threejs-materials: emissive + emissiveIntensity for glow.
 */
export function getSeverityEmissive(severity: number): number {
  const t = Math.min(severity / 5, 1);
  return 0.1 + t * 0.9;
}

/**
 * Convert GeoJSON polygon coordinates to 3D line points on the globe.
 * Used for wireframe country outlines (per threejs-geometry: Lines).
 */
export function polygonToGlobePoints(
  coords: number[][],
  radius: number = GLOBE_RADIUS
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  // Sample every few points for performance
  const step = Math.max(1, Math.floor(coords.length / 80));
  for (let i = 0; i < coords.length; i += step) {
    const [lon, lat] = coords[i];
    points.push(latLonToVector3(lat, lon, radius));
  }
  // Close the loop
  if (coords.length > 0) {
    const [lon, lat] = coords[0];
    points.push(latLonToVector3(lat, lon, radius));
  }
  return points;
}
