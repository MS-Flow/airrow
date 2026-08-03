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

  /**
   * Response headers (spec 157, finding L2).
   *
   * Two, deliberately — the two that cannot change what any page does. `nosniff` stops a browser
   * from deciding for itself that a response is a script, which is what turns an upload or a
   * generated file served with the wrong type into executable code. `Referrer-Policy` keeps the
   * path out of the `Referer` on cross-origin requests: `/app/projects/<uuid>/preview` is not
   * something Stripe, GitHub or Resend need to be told.
   *
   * A Content-Security-Policy is the one that would matter most and is **not** here: Next.js needs a
   * per-request nonce for its inline bootstrap, so a CSP is middleware work plus a rollout, and a
   * wrong one is a white page. It gets its own spec.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
        ]
      }
    ];
  }
};

export default nextConfig;
