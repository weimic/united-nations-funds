"use client";

import { useEffect, type MutableRefObject } from "react";
import { useThree } from "@react-three/fiber";
import { getFeatureCentroid } from "@/lib/geo-utils";
import { latLongToVector3 } from "./globe-data";
import type { GeoFeature } from "@/lib/types";

/**
 * Imperatively repositions the camera to face a given country when
 * `globeFocusIso3` changes. Calls `onFocusHandled` after the move so
 * the parent can clear the focus target.
 */
export function CameraFocusController({
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
    const feature = features.find((f) => f.id === globeFocusIso3);
    if (!feature) return;
    const [lat, lon] = getFeatureCentroid(feature.geometry);
    const dist = camera.position.length();
    const newPos = latLongToVector3(lat, lon, dist);
    camera.position.copy(newPos);
    camera.lookAt(0, 0, 0);
    if (orbitRef.current) orbitRef.current.update();
    onFocusHandled();
    // Only re-run on focus target change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globeFocusIso3]);

  return null;
}
