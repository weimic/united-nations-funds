import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Next.js walks up for lockfiles and can pick the wrong root (e.g. ~/package-lock.json),
  // which breaks Tailwind CSS @import resolution in dev.
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
