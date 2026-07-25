// Session + auth helpers (issue #18). Real Supabase Auth (email + password) replaces the
// dev-auth bridge. Identity comes from the SSR client; the org is resolved via the
// DataStore. Server-only.
import { cache } from "react";
import { redirect } from "next/navigation";
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
