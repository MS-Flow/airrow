/**
 * Where the support form lives. Inside `/app`, so the auth matcher in `middleware.ts` gates it —
 * reaching a human requires an account, and that is deliberate: a ticket without a workspace behind
 * it cannot be answered usefully (spec 144).
 *
 * A constant rather than a literal because the chat panel links here from the public side of the
 * site (spec 158), and a link the visitor is *promised* leads to support must not be able to drift
 * from the route that serves it.
 */
export const SUPPORT_PATH = "/app/support";
