// Session + auth helpers (issue #18). Real Supabase Auth (email + password) replaces the
// dev-auth bridge. Identity comes from the SSR client; the org is resolved via the
// DataStore. Server-only.
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

export async function getSession(): Promise<SessionContext | null> {
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
}

/** For RSC pages/actions that require auth. Redirects when absent. */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function signUp(
  name: string,
  email: string,
  password: string
): Promise<{ error?: string }> {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
  return error ? { error: error.message } : {};
}

export async function signIn(email: string, password: string): Promise<{ error?: string }> {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? { error: error.message } : {};
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
