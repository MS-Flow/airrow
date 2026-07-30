// Where an auth flow is allowed to send the founder back to (spec 113).
//
// Both redirect targets Airrow hands to Supabase — the GitHub callback (spec 67) and the email
// confirmation link — are derived from the incoming request, so previews and local development work
// without an environment variable to keep in step. That derivation reads the Host header, which is
// not ours, so it is checked against an allow-list before use: an unlisted host would otherwise mean
// mailing a founder a link to someone else's site carrying a valid confirmation token.
//
// Supabase's own `additional_redirect_urls` is the real backstop. This is the second lock (§II,
// defence in depth), and the one that fails safe rather than rejecting: an unrecognised host falls
// back to production instead of erroring, because sending a founder to the canonical site is a
// nuisance while sending them nowhere is a broken signup.
import { headers } from "next/headers";

/** The canonical origin, and what an unrecognised host falls back to. */
export const PRODUCTION_ORIGIN = "https://airrow.app";

/**
 * Hosts Airrow answers on. Local development is matched separately, by hostname.
 *
 * `airrow-dev.vercel.app` is the dev environment as it actually is today — `dev.airrow.app` is the
 * branch domain the runbook describes but which is not attached yet (it answers 404). Both are listed
 * so this keeps working when it is. The dev host would also match the preview suffix below, but naming
 * it makes the environment an explicit decision rather than a side effect of a broad rule.
 */
const ALLOWED_HOSTS = [
  "airrow.app",
  "www.airrow.app",
  "airrow-dev.vercel.app",
  "dev.airrow.app"
];

/**
 * Vercel gives every preview deploy a fresh generated hostname, so previews cannot be enumerated —
 * they are allowed by suffix. Narrow enough to matter: a request only reaches this deployment
 * through a hostname routed to it, so this is not a list of sites anyone can redirect to.
 */
const PREVIEW_SUFFIX = ".vercel.app";

const LOCAL_HOSTNAMES = ["localhost", "127.0.0.1", "[::1]"];

/** Strip the port; an allow-list decision is about the host, not where it listens. */
function hostname(host: string): string {
  return host.startsWith("[") ? (host.split("]")[0] ?? host) + "]" : (host.split(":")[0] ?? host);
}

function isLocal(host: string): boolean {
  return LOCAL_HOSTNAMES.includes(hostname(host));
}

export function isAllowedHost(host: string): boolean {
  const name = hostname(host);
  return ALLOWED_HOSTS.includes(name) || name.endsWith(PREVIEW_SUFFIX) || isLocal(host);
}

/**
 * The origin to send the founder back to, from the request's own headers.
 *
 * Pure so the allow-list is testable without a request: `requestOrigin` is the thin shell that reads
 * the headers.
 */
export function allowedOrigin(host: string | null, forwardedProto: string | null): string {
  if (!host || !isAllowedHost(host)) return PRODUCTION_ORIGIN;
  const protocol = forwardedProto ?? (isLocal(host) ? "http" : "https");
  return `${protocol}://${host}`;
}

/** `allowedOrigin` applied to the current request. Server-only. */
export async function requestOrigin(): Promise<string> {
  const list = await headers();
  return allowedOrigin(
    list.get("x-forwarded-host") ?? list.get("host"),
    list.get("x-forwarded-proto")
  );
}
