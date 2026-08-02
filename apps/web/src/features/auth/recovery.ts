// The marker that says "this session came from a reset link" (spec 171).
//
// It exists because one screen serves two arrivals. A founder in Settings must prove they know the
// current password before replacing it — the threat is an unattended laptop, and a live session cookie
// is not an answer to it. A founder who clicked a link mailed to their address has already proved the
// thing that matters, and has by definition no current password to give.
//
// A cookie rather than a query parameter or a hidden field: those are written by whoever is holding the
// browser, and this decides whether a credential can be replaced without knowing the old one. httpOnly
// so no script can read it, and set only by `/auth/reset` after a real code exchange.
import { cookies } from "next/headers";

export const RECOVERY_COOKIE = "airrow_recovery";

/**
 * Long enough to choose a password, short enough that a shared machine does not keep the waiver.
 *
 * Fifteen minutes is roughly the reset link's own useful life: someone who clicked it, wandered off and
 * came back after lunch should be asked for the current password like anyone else — and if they cannot
 * give one, the way forward is another link, which costs them one click.
 */
export const RECOVERY_MAX_AGE = 15 * 60;

export const recoveryCookie = {
  name: RECOVERY_COOKIE,
  value: "1",
  httpOnly: true,
  sameSite: "lax",
  // Off on localhost, where there is no https to be secure on; on everywhere Airrow actually runs.
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: RECOVERY_MAX_AGE
} as const;

/** Is the founder on this request here from a reset link? Server-only, and never trusted from a form. */
export async function inRecovery(): Promise<boolean> {
  return Boolean((await cookies()).get(RECOVERY_COOKIE));
}

/**
 * Spend the marker.
 *
 * Cleared the moment the password is set rather than left to expire: it is a one-use waiver, and a
 * second change without the current password is not something the emailed link paid for.
 */
export async function clearRecovery(): Promise<void> {
  (await cookies()).delete(RECOVERY_COOKIE);
}
