/** Application-wide constants */

/** Year used to filter FTS and CBPF datasets */
export const TARGET_YEAR = 2025;

/** Globe sphere radius in world units */
export const GLOBE_RADIUS = 1;

/** Land mask resolution for dot-cloud generation */
export const LAND_MASK_WIDTH = 1024;
export const LAND_MASK_HEIGHT = 512;

/** Maximum countries rendered as spikes */
export const MAX_SPIKE_COUNTRIES = 60;

/** Number of dots in the landmass point cloud */
export const LANDMASS_DOT_COUNT = 25_000;

/** Chart tooltip shared styles */
export const CHART_TOOLTIP_STYLE = {
  background: "rgba(2, 8, 20, 0.97)",
  border: "1px solid rgba(0,200,255,0.25)",
  borderRadius: "8px",
  fontSize: "11px",
  fontFamily: "monospace",
  padding: "8px 12px",
} as const;

export const CHART_LABEL_STYLE = {
  color: "rgba(0,200,255,0.85)",
  fontWeight: 600,
} as const;
