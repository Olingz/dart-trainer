import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tillad cross-origin requests fra telefon under lokal udvikling
  allowedDevOrigins: ["192.168.0.147"],
  // Next.js 16.2.x på Vercel: sørg for at @swc/helpers ESM pakkes med
  outputFileTracingIncludes: {
    "*": ["./node_modules/@swc/helpers/**/*"],
  },
};

export default nextConfig;
