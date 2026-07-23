import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@arrow/engine", "@arrow/schemas"]
};

export default nextConfig;
