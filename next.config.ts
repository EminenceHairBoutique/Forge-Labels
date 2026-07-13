import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp is a native module used by the TIFF transcode route; it must load
  // from node_modules at runtime rather than being bundled.
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
