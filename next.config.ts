import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  devIndicators: false,
  async rewrites() {
    return [
      { source: "/consult", destination: "/consult/index.html" },
      { source: "/consult-alt", destination: "/consult-alt/index.html" },
    ];
  },
};

export default nextConfig;
