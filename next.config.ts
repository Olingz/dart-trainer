import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tillad cross-origin requests fra telefon under lokal udvikling
  allowedDevOrigins: ["192.168.0.147"],
};

export default nextConfig;
