// Session + auth helpers (issue #18). Real Supabase Auth (email + password) replaces the
// dev-auth bridge. Identity comes from the SSR client; the org is resolved via the
// DataStore. Server-only.
//
// GitHub is the second way in (spec 67) — the same accounts, reached with an OAuth identity that
// asks for no scopes at all.
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/data/supabase-server";
import {
  getOrgForUser,
  profileFlags,
  setDisplayName,
  type OrgRecord,
  type UserRecord
} from "@/lib/data/store";

export interface SessionContext {
  user: UserRecord;
  org: OrgRecord;
  /** True when this account operates Airrow (spec 150). Decides the admin nav entry and nothing else. */
  isAdmin: boolean;
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
 * Where an account stands, as three cases rather than a value-or-absence (spec 164).
 *
 * Suspension used to be expressed by `getSession()` answering `null`, which is the same answer it
 * gives a signed-out visitor — so the only thing the app could do with a suspended founder was send
 * them to `/login`, a screen that says they are not signed in when they are, and which they could not
 * get past anyway. Naming the third case is what lets one door stay open.
 */
export type SessionRead =
  | { kind: "none" }
  /** Signed in, and taken offline. `suspendedAt` is for us; no screen shows it to them. */
  | { kind: "suspended"; session: SessionContext; suspendedAt: string }
  | { kind: "active"; session: SessionContext };

/**
 * The authenticated user, their org, and whether they are suspended.
 *
 * Memoised per request with React `cache()`. Without it a single `/app` navigation paid
 * for this twice — once in the layout and again in the page — and each call is a network
 * round-trip to Supabase Auth plus an org lookup. The middleware gate makes a third.
 * Deduplicating here is the single biggest win on time-to-first-byte in the app shell.
 *
 * `getUser()` (not `getSession()`) stays deliberate: it revalidates the token with the
 * auth server rather than trusting the cookie, and this is the value every RSC and action
 * scopes its data by.
 *
 * **The suspension is read from the database on every request, and that is the whole of the
 * enforcement** (spec 164). Supabase Auth's ban used to be described as the other half of it; it is
 * not, and it no longer runs. A ban stops a new sign-in and a token refresh, but an access token
 * already issued keeps working for its full lifetime — which is how a founder suspended nine seconds
 * after signing in went on using the product. This check bites at their next server call, and it is
 * the only one that does.
 */
const readSession = cache(async (): Promise<SessionRead> => {
  const supabase = await supabaseServer();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user?.email) return { kind: "none" };

  const [org, flags] = await Promise.all([getOrgForUser(user.id), profileFlags(user.id)]);
  if (!org) return { kind: "none" };

  const rec: UserRecord = {
    id: user.id,
    email: user.email,
    name: metaName(user.user_metadata, user.email),
    createdAt: user.created_at
  };
  const session: SessionContext = { user: rec, org, isAdmin: flags.isAdmin };
  return flags.suspendedAt
    ? { kind: "suspended", session, suspendedAt: flags.suspendedAt }
    : { kind: "active", session };
});

/**
 * The session, or null — where "suspended" counts as null.
 *
 * The contract every existing caller was written against, kept exactly: thirty-odd call sites,
 * including all three `/api/*` handlers, decide access by whether this returns something. Widening it
 * to hand back suspended sessions would have quietly re-opened every one of them, so the widening
 * lives in `requireSessionEvenIfSuspended` instead, where it has to be asked for by name.
 */
export const getSession = async (): Promise<SessionContext | null> => {
  const read = await readSession();
  return read.kind === "active" ? read.session : null;
};

/**
 * For RSC pages/actions that require an account in good standing.
 *
 * Two refusals, because they are two different facts: no session goes to `/login`, and a suspended one
 * goes to `/app/suspended`. Sending the suspended case to `/login` — which is what fell out of
 * answering `null` for both — tells a founder their password is the problem and leaves them with no
 * way to ask about the thing that actually happened.
 */
export async function requireSession(): Promise<SessionContext> {
  const read = await readSession();
  if (read.kind === "none") redirect("/login");
  if (read.kind === "suspended") redirect("/app/suspended");
  return read.session;
}

/**
 * The one door a suspension leaves open: support, and the screen that explains there is one.
 *
 * Deliberately verbose at the call site. Everything else in `/app` uses `requireSession`, so a reader
 * scanning for what a suspended account can still reach finds exactly the two files that name this,
 * and a third would stand out in review — which is the property the spec's "one allowed route" rests
 * on.
 */
export async function requireSessionEvenIfSuspended(): Promise<{
  session: SessionContext;
  suspended: boolean;
}> {
  const read = await readSession();
  if (read.kind === "none") redirect("/login");
  return { session: read.session, suspended: read.kind === "suspended" };
}

/**
 * For the admin console and every action behind it (spec 150).
 *
 * `notFound()` rather than a redirect, deliberately: a redirect to `/app` tells a signed-in founder
 * that `/app/admin` is a real route they are not allowed on, and the existence of an operator console
 * is not something they need to learn from a probe. A 404 says the same thing to them as to a typo.
 *
 * Called by the admin layout *and* independently by every admin server action, because a page that is
 * gated while its actions are not is not gated — a server action is a POST endpoint, reachable without
 * ever rendering the page that normally posts to it. `lib/data/admin.ts` then checks a third time, at
 * the point the tenancy boundary is actually crossed.
 */
export async function requireAdmin(): Promise<SessionContext> {
  const session = await requireSession();
  if (!session.isAdmin) notFound();
  return session;
}

/**
 * Signup has three outcomes, not two: the project may require e-mail confirmation,
 * in which case an account exists but there is no session yet. Collapsing that
 * into "success" sends the founder to /app, where middleware bounces them
 * straight back to /login with no explanation.
 */
/**
 * Why a signup did not happen (spec 135).
 *
 * A reason rather than the provider's message, because the screen has to give *advice* and only one of
 * these has "try signing in" as the right advice. Supabase's own wording is written for developers,
 * changes without notice, and would be quoted at a founder as if it were ours.
 */
export type SignUpFailure =
  /** The address already has an account. The one case where signing in is the way forward. */
  | "already-registered"
  /** Supabase is refusing further confirmation mail for now. Temporary, and nobody's fault. */
  | "rate-limited"
  /** Something we have not seen. Say so plainly rather than guessing at a cause. */
  | "unknown";

export type SignUpResult =
  | { status: "signed-in" }
  | { status: "confirmation-required" }
  | { status: "error"; reason: SignUpFailure };

/**
 * Read the provider's answer as one of the three reasons above.
 *
 * Code first, HTTP status second, message last — in decreasing order of how stable they are. A cause we
 * cannot place becomes `unknown`, which is the honest outcome: the previous behaviour was to call every
 * failure a duplicate address, and that told a rate-limited founder they had an account they do not have.
 *
 * Exported so the classification is testable without a Supabase client.
 */
export function signUpFailure(error: { message?: string; code?: string; status?: number }): SignUpFailure {
  const code = error.code ?? "";
  const message = error.message ?? "";

  if (code === "user_already_exists" || code === "email_exists") return "already-registered";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") return "rate-limited";
  if (error.status === 429) return "rate-limited";

  // Older clients send no code at all. These two phrasings are what Supabase has used for long enough
  // to be worth matching; anything else is deliberately not guessed at.
  if (/already registered|already exists/i.test(message)) return "already-registered";
  if (/rate limit|only request this after|too many requests/i.test(message)) return "rate-limited";

  return "unknown";
}

/**
 * `emailRedirectTo` is where the confirmation link lands, and it has to be passed per request rather
 * than left to the project's Site URL (spec 113). Production and Preview share one Supabase project,
 * so a single configured Site URL would mail every founder a link to production — including the ones
 * who signed up on dev. The caller derives it, matching `signInWithGitHub` above.
 */
export async function signUp(
  name: string,
  email: string,
  password: string,
  emailRedirectTo: string
): Promise<SignUpResult> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name }, emailRedirectTo }
  });
  if (error) return { status: "error", reason: signUpFailure(error) };
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
 * Start the Google OAuth flow (spec 140). The same shape as `signInWithGitHub` — the caller owns the
 * navigation — and the same posture: Airrow asks for an identity and nothing more.
 *
 * `prompt: "select_account"` is the one thing GitHub cannot offer. Google otherwise assumes the first
 * account already signed in on the device, which for a founder holding a personal and a work account is
 * a coin flip they never got to call. Asking every time costs one click and removes a whole class of
 * "why is my workspace on the wrong address".
 */
export async function signInWithGoogle(redirectTo: string): Promise<{ url: string } | { error: string }> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, queryParams: { prompt: "select_account" } }
  });
  if (error || !data.url) return { error: error?.message ?? "Google sign-in is unavailable." };
  return { url: data.url };
}

/** The OAuth providers a founder can sign in with. */
export type OAuthProvider = "github" | "google";

/**
 * Has the provider verified the address this identity signed in with?
 *
 * An unverified address is no evidence of who someone is: anyone can put a stranger's address on a
 * GitHub or Google account, and linking on it would hand them the stranger's Airrow account. So an
 * explicit `false` always blocks, and is never talked out of it by anything else.
 *
 * The `email_confirmed_at` fallback covers only the case where the identity carries no flag at all —
 * an absent field is not a claim that the address is unverified, and treating it as one would lock
 * out every OAuth sign-in if a provider payload ever changed shape.
 *
 * The provider is an argument rather than a search across identities (spec 140): a founder who has
 * linked both accounts has two identities, and the one that matters is the one they just used. Reading
 * the wrong one would answer a question nobody asked.
 */
export function providerEmailVerified(user: User, provider: OAuthProvider): boolean {
  const identity = user.identities?.find((i) => i.provider === provider);
  const flag: unknown = identity?.identity_data?.email_verified;
  if (typeof flag === "boolean") return flag;
  return Boolean(user.email_confirmed_at);
}

/**
 * Which provider this session was created by, for a callback that has to name it in an error.
 *
 * `app_metadata.provider` is Supabase's record of the identity used *for this sign-in*, which is the
 * question being asked. Anything unrecognised is treated as GitHub-shaped only in so far as it still
 * gets checked — an unknown provider name finds no identity and therefore falls back, rather than
 * skipping the gate.
 */
export function oauthProviderOf(user: User): OAuthProvider {
  return user.app_metadata?.provider === "google" ? "google" : "github";
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
