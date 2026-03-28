import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      { source: "/consult", destination: "/consult/index.html" },
      { source: "/consult-alt", destination: "/consult-alt/index.html" },
    ];
  },
};

export default nextConfig;
