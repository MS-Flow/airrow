// Session + auth helpers (issue #18). Real Supabase Auth (email + password) replaces the
// dev-auth bridge. Identity comes from the SSR client; the org is resolved via the
// DataStore. Server-only.
//
// GitHub is the second way in (spec 67) — the same accounts, reached with an OAuth identity that
// asks for no scopes at all.
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/data/supabase-server";
import { getOrgForUser, setDisplayName, type OrgRecord, type UserRecord } from "@/lib/data/store";

export interface SessionContext {
  user: UserRecord;
  org: OrgRecord;
}

/** Narrow the untrusted user_metadata bag to a display name. */
function metaName(meta: unknown, fallback: string): string {
  if (meta && typeof meta === "object" && "name" in meta) {
    // `as` justified: `in` has narrowed to an object with a `name` key of unknown type.
    const name = (meta as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) return name;
  }
  return fallback;
}

/**
 * The authenticated user and their org, or null.
 *
 * Memoised per request with React `cache()`. Without it a single `/app` navigation paid
 * for this twice — once in the layout and again in the page — and each call is a network
 * round-trip to Supabase Auth plus an org lookup. The middleware gate makes a third.
 * Deduplicating here is the single biggest win on time-to-first-byte in the app shell.
 *
 * `getUser()` (not `getSession()`) stays deliberate: it revalidates the token with the
 * auth server rather than trusting the cookie, and this is the value every RSC and action
 * scopes its data by.
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await supabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const org = await getOrgForUser(user.id);
  if (!org) return null;

  const rec: UserRecord = {
    id: user.id,
    email: user.email,
    name: metaName(user.user_metadata, user.email),
    createdAt: user.created_at
  };
  return { user: rec, org };
});

/** For RSC pages/actions that require auth. Redirects when absent. */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/**
 * Signup has three outcomes, not two: the project may require e-mail confirmation,
 * in which case an account exists but there is no session yet. Collapsing that
 * into "success" sends the founder to /app, where middleware bounces them
 * straight back to /login with no explanation.
 */
export type SignUpResult =
  | { status: "signed-in" }
  | { status: "confirmation-required" }
  | { status: "error"; message: string };

export async function signUp(
  name: string,
  email: string,
  password: string
): Promise<SignUpResult> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } }
  });
  if (error) return { status: "error", message: error.message };
  return data.session ? { status: "signed-in" } : { status: "confirmation-required" };
}

export type SignInResult =
  | { status: "signed-in" }
  | { status: "unconfirmed" }
  | { status: "error"; message: string };

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return { status: "signed-in" };
  // An unconfirmed account is not a wrong password — saying so saves a support round.
  const unconfirmed =
    error.code === "email_not_confirmed" || /email not confirmed/i.test(error.message);
  return unconfirmed ? { status: "unconfirmed" } : { status: "error", message: error.message };
}

/**
 * Start the GitHub OAuth flow (spec 67). Returns the URL to send the browser to, rather than
 * redirecting here, so the caller owns the navigation.
 *
 * `scopes: ""` is the whole security posture in one argument: an empty scope list reaches exactly
 * what an anonymous visitor can already read on github.com, and the consent screen GitHub shows says
 * so. Anything private, and every write, needs an App installation instead (§II).
 */
export async function signInWithGitHub(redirectTo: string): Promise<{ url: string } | { error: string }> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { scopes: "", redirectTo }
  });
  if (error || !data.url) return { error: error?.message ?? "GitHub sign-in is unavailable." };
  return { url: data.url };
}

/**
 * Has GitHub verified the address this identity signed in with?
 *
 * An unverified address is no evidence of who someone is: anyone can put a stranger's address on a
 * GitHub account, and linking on it would hand them the stranger's Airrow account. So an explicit
 * `false` always blocks, and is never talked out of it by anything else.
 *
 * The `email_confirmed_at` fallback covers only the case where the identity carries no flag at all —
 * an absent field is not a claim that the address is unverified, and treating it as one would lock
 * out every GitHub sign-in if the provider payload ever changed shape.
 */
export function githubEmailVerified(user: User): boolean {
  const identity = user.identities?.find((i) => i.provider === "github");
  const flag: unknown = identity?.identity_data?.email_verified;
  if (typeof flag === "boolean") return flag;
  return Boolean(user.email_confirmed_at);
}

/** The GitHub account behind the signed-in user, when there is one (spec 67). */
export interface GitHubIdentity {
  /** GitHub's own username, so the founder can see *which* account is connected. */
  login: string | null;
  connectedAt: string | null;
}

/**
 * The signed-in user's GitHub identity, or null when they signed in with an email address.
 *
 * Distinct from `githubToken()`: the identity is durable and says *whether* an account is connected,
 * while the token is short-lived and says whether repositories can be read *right now*. Settings
 * asks the first question; the import screen asks the second.
 */
export const githubIdentity = cache(async (): Promise<GitHubIdentity | null> => {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    const identity = user?.identities?.find((i) => i.provider === "github");
    if (!identity) return null;

    // `identity_data` is an untyped bag from the provider — narrowed, never trusted.
    const login: unknown = identity.identity_data?.user_name;
    return {
      login: typeof login === "string" && login.trim() ? login : null,
      connectedAt: identity.created_at ?? null
    };
  } catch (error) {
    // Settings renders this beside a profile form and a plan; whether a GitHub account is attached
    // is the least important thing on that page and must never be the reason it fails to load.
    // "Not connected" is the safe reading — it offers the sign-in, which is the way out anyway.
    console.error("[auth] reading the GitHub identity failed:", error);
    return null;
  }
});

/**
 * The GitHub token from the current session, or null.
 *
 * Read from the session rather than stored: Supabase hands `provider_token` back with the session it
 * issues and Airrow never writes it anywhere of its own (§II — no repo credential is persisted). It
 * does not survive a token refresh, which is why every caller has to handle its absence as a normal
 * state and not an error — the founder signs in with GitHub again, and the ZIP path never needed it.
 */
export async function githubToken(): Promise<string | null> {
  const supabase = await supabaseServer();
  const {
    data: { session }
  } = await supabase.auth.getSession();
  return session?.provider_token ?? null;
}

export async function signOut(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
}

/** Update the current user's display name (auth metadata + profiles). */
export async function updateName(name: string): Promise<void> {
  const supabase = await supabaseServer();
  const {
    data: { user }
  } = await supabase.auth.updateUser({ data: { name } });
  if (user) await setDisplayName(user.id, name);
}
