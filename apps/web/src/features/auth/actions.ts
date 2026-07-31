"use server";

// Starting an OAuth flow (specs 67, 140). Server actions rather than client-side calls, because
// every external call is server-side (§I) — the button posts a form and the browser is redirected.
import { redirect } from "next/navigation";
import { signInWithGitHub, signInWithGoogle } from "@/lib/auth";
import { requestOrigin } from "@/lib/site-url";

/**
 * Where the provider sends the founder back to. Still derived from the request rather than configured, so
 * previews and local development work without a second environment variable to keep in step — but the
 * host is now checked against an allow-list on the way (`@/lib/site-url`, spec 113), because it comes
 * from a header and this is a redirect target.
 *
 * **Bare path, no query string.** Supabase matches `redirectTo` against its own redirect allow-list
 * (`supabase/config.toml` locally, `scripts/sync-supabase-auth.mjs` for the hosted project), and those
 * entries are exact paths. Appending anything — a `?provider=` telling the callback which button was
 * pressed was the tempting one — stops matching and Supabase refuses the redirect, taking GitHub down
 * with Google. The callback reads the provider off the session instead (spec 140).
 */
async function callbackUrl(): Promise<string> {
  return `${await requestOrigin()}/auth/callback`;
}

export async function signInWithGitHubAction(): Promise<void> {
  const result = await signInWithGitHub(await callbackUrl());
  redirect("error" in result ? "/login?error=github" : result.url);
}

export async function signInWithGoogleAction(): Promise<void> {
  const result = await signInWithGoogle(await callbackUrl());
  redirect("error" in result ? "/login?error=google" : result.url);
}
