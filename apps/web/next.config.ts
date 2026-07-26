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
  },
  // isomorphic-dompurify pulls in jsdom, which pulls in an ESM-only transitive dep
  // (@exodus/bytes via html-encoding-sniffer). Next's bundler can't require() that;
  // leaving the package external lets Node's own resolver load it at runtime instead.
  serverExternalPackages: ["isomorphic-dompurify", "jsdom"]
};

export default nextConfig;
