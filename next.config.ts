import type { NextConfig } from "next";

// Hostname only: allowedDevOrigins ignores scheme and port.
const base = process.env.APP_BASE_URL;
let allowedDevOrigins: string[] = [];
if (base) {
  try {
    allowedDevOrigins = [new URL(base).hostname];
  } catch {
    // A non-URL APP_BASE_URL must not stop the dev server from booting.
  }
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  allowedDevOrigins,
};

export default nextConfig;
