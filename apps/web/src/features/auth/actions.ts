"use server";

// Starting the GitHub OAuth flow (spec 67). A server action rather than a client-side call, because
// every external call is server-side (§I) — the button posts a form and the browser is redirected.
import { redirect } from "next/navigation";
import { signInWithGitHub } from "@/lib/auth";
import { requestOrigin } from "@/lib/site-url";

/**
 * Where GitHub sends the founder back to. Still derived from the request rather than configured, so
 * previews and local development work without a second environment variable to keep in step — but the
 * host is now checked against an allow-list on the way (`@/lib/site-url`, spec 113), because it comes
 * from a header and this is a redirect target.
 */
export async function signInWithGitHubAction(): Promise<void> {
  const result = await signInWithGitHub(`${await requestOrigin()}/auth/callback`);
  redirect("error" in result ? "/login?error=github" : result.url);
}
