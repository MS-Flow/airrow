// The recovery marker's name and shape (spec 171).
//
// Split from `recovery.ts` because the **middleware** needs it, and middleware may not import
// `next/headers` — one edge-runtime import of `cookies()` is enough to break the whole matcher. The
// definition therefore lives here, with no imports at all: the route sets it, the middleware reads it off
// the request, and `recovery.ts` does the request-time reads for pages and actions.
export const RECOVERY_COOKIE = "airrow_recovery";

/**
 * Long enough to choose a password, short enough that a shared machine does not keep the waiver.
 *
 * Fifteen minutes is roughly the reset link's own useful life. It is also how long the app stays shut to
 * this browser (see `middleware.ts`), which is the other reason not to make it generous: someone who
 * abandons a reset half-way should get their normal session back quickly, and signing out does it at once.
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
