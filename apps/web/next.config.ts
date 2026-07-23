import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@airrow/engine", "@airrow/schemas"]
};

export default nextConfig;
