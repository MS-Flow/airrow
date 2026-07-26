import path from "node:path";
import type { NextConfig } from "next";

// next.config is loaded with the app directory as cwd; the workspace root is two levels up.
const repoRoot = path.join(process.cwd(), "..", "..");

const nextConfig: NextConfig = {
  transpilePackages: ["@airrow/engine", "@airrow/schemas"],
  // Generation reads the canonical `template/**` at runtime, so it must survive file tracing.
  outputFileTracingRoot: repoRoot,
  outputFileTracingIncludes: {
    "/**": ["../../template/**"]
  }
};

export default nextConfig;
