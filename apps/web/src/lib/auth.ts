// Session helpers (F-202). Local dev auth per ADR-0005 — replaced by Supabase Auth later.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createSession,
  deleteSession,
  resolveSession,
  upsertUserByEmail,
  type SessionContext
} from "@/lib/data/store";

export const SESSION_COOKIE = "airrow_session";

export async function getSession(): Promise<SessionContext | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return resolveSession(token);
}

/** For RSC pages/actions that require auth. Redirects when absent. */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function signIn(name: string, email: string): Promise<void> {
  const user = upsertUserByEmail(email, name);
  const session = createSession(user.id);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) deleteSession(token);
  jar.delete(SESSION_COOKIE);
}
