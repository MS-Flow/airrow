// Reading the recovery marker at request time (spec 171). Its name and shape live in
// `recovery-cookie.ts`, which the middleware imports and this file re-exports for everyone else.
//
// The marker exists because a reset link has to hand over a session — Supabase cannot change a password
// without one — and that session must not be a way into the account. So it is not treated as a sign-in at
// all: while it is set, `middleware.ts` keeps the whole of `/app` shut, `/reset-password` is the only
// screen it opens, and setting the password ends the session and returns the founder to `/login`.
//
// It also decides the smaller question of whether the current password is required. In Settings it is —
// a live session cookie is no answer to a borrowed laptop. Here the founder has proved control of the
// mailbox, which is the same proof a password is, and by definition has no old password to give.
//
// httpOnly, so nothing in the browser can read or forge it, and set only by `/auth/reset` after a real
// code exchange.
import { cookies } from "next/headers";
import { RECOVERY_COOKIE } from "./recovery-cookie";

export { RECOVERY_COOKIE, RECOVERY_MAX_AGE, recoveryCookie } from "./recovery-cookie";

/** Is the founder on this request mid-reset? Server-only, and never trusted from a form. */
export async function inRecovery(): Promise<boolean> {
  return Boolean((await cookies()).get(RECOVERY_COOKIE));
}

/**
 * Spend the marker.
 *
 * Cleared the moment the password is set rather than left to expire: it is a one-use waiver, and it is
 * also what is keeping the app shut — a founder signing in with their new password must not walk back
 * into the reset screen.
 */
export async function clearRecovery(): Promise<void> {
  (await cookies()).delete(RECOVERY_COOKIE);
}
