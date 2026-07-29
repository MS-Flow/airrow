"use server";

// Starting the GitHub OAuth flow (spec 67). A server action rather than a client-side call, because
// every external call is server-side (§I) — the button posts a form and the browser is redirected.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signInWithGitHub } from "@/lib/auth";

/**
 * Where GitHub sends the founder back to. Derived from the request rather than configured, so
 * previews and local development work without a second environment variable to keep in step.
 */
async function callbackUrl(): Promise<string> {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const protocol = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}/auth/callback`;
}

export async function signInWithGitHubAction(): Promise<void> {
  const result = await signInWithGitHub(await callbackUrl());
  redirect("error" in result ? "/login?error=github" : result.url);
}
