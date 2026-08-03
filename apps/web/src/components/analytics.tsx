"use client";

// How many people reach the site (spec 153).
//
// Vercel Web Analytics, which is **cookieless**: it stores and reads nothing on the visitor's device.
// That is the whole reason this ships without a consent banner — ePrivacy Article 5(3) is triggered by
// storing or reading information on a device, and something that does neither does not trigger it. The
// cookie policy keeps its "no banner needed" conclusion and changes only its reason.
//
// A client component solely because `beforeSend` is a function, and a Server Component cannot hand one
// to a client boundary.
import { Analytics } from "@vercel/analytics/next";

/** Everything under here is a signed-in founder's own workspace, and none of our business to count. */
const PRIVATE_PREFIX = "/app";

export function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        // Signed-in navigation is dropped **in the browser, before anything is sent**. Postgres already
        // answers everything worth knowing about what account holders do (spec 150), and the question
        // this is here to answer — how many strangers reach the site — is a public-page question.
        // Filtering here rather than by mounting per-route keeps it one decision in one place, and one
        // that fails closed: a new route under /app is excluded the day it exists.
        try {
          const path = new URL(event.url).pathname;
          // The segment, not the string. A bare `startsWith("/app")` also swallows `/apply` and
          // `/approach` — public pages we would silently stop counting.
          if (path === PRIVATE_PREFIX || path.startsWith(`${PRIVATE_PREFIX}/`)) return null;
        } catch {
          // An unparseable URL is not something to guess about. Dropping it loses one count; letting it
          // through could send a path we meant to withhold.
          return null;
        }
        return event;
      }}
    />
  );
}
