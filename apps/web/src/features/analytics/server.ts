// The server half of the funnel (spec 182) — and the only file that imports `posthog-node`.
//
// The four events the whole exercise is judged on — `signup`, `foundation_generated`,
// `zip_downloaded`, `paid` — are sent from here rather than from the browser, for two reasons that
// both matter. A content blocker cannot delete them, so the bottom of the funnel does not quietly
// become a measurement of how many of our customers run uBlock. And they are emitted from the code
// that already knows the fact is true: `paid` fires beside the write to `organizations.plan`, which
// the constitution allows only from something Stripe said, so the event cannot claim a payment the
// database does not also believe in.
//
// Nothing here may fail its caller. A generation, a download, a checkout and a Stripe webhook all
// emit an event, and not one of them is worth failing over an analytics host — a webhook that 500s
// because PostHog was slow is a webhook Stripe will retry, about a payment that already worked.
import { PostHog } from "posthog-node";
import { sanitize, type EventName, type EventProperties, type Utm } from "./events";

/**
 * The project key, read once per process.
 *
 * Separate from the browser's `NEXT_PUBLIC_POSTHOG_KEY` even though a PostHog project has one
 * ingest key and both will normally hold the same value. Two variables buy one thing worth having:
 * an environment can report from the server while the browser is told nothing, which is exactly what
 * a deployment that has not yet decided about client-side measurement wants — and it makes "the
 * server sends nothing here" a configuration a preview can actually be in.
 */
const key = (): string | null => process.env.POSTHOG_KEY?.trim() || null;

/** Where events go. PostHog's EU and US clouds are different hosts, and self-hosting is a third. */
const host = (): string => process.env.POSTHOG_HOST?.trim() || "https://eu.i.posthog.com";

let client: PostHog | null = null;
let attempted = false;

/**
 * The client, or `null` on a deployment that is not measuring anything.
 *
 * Built at most once, and never retried: a missing key is a decision, not a transient failure, and
 * re-reading the environment on every event would only buy a chance to log the same line forever.
 *
 * `flushAt: 1` because this runs in serverless invocations that are frozen the moment they respond.
 * The default batches events and sends them later, and there is no "later" — the process is gone, and
 * so is the event.
 */
function posthog(): PostHog | null {
  if (attempted) return client;
  attempted = true;

  const projectKey = key();
  if (!projectKey) return null;

  try {
    client = new PostHog(projectKey, { host: host(), flushAt: 1, flushInterval: 0 });
  } catch (error) {
    // A malformed key is the whole of what can go wrong here, and it is ours to fix, not the
    // founder's to experience. One line, once, and the app carries on unmeasured.
    console.error("PostHog is not usable:", error instanceof Error ? error.message : error);
    client = null;
  }
  return client;
}

/**
 * Send one event, and never let it matter.
 *
 * Returns `void` rather than a promise on purpose: there is no caller that should be awaiting this,
 * and a signature that cannot be awaited is a signature nobody can accidentally put in the critical
 * path of a payment.
 *
 * @param distinctId who it happened to — `distinctIdForOrg`, never an email or a name.
 */
export function capture<N extends EventName>(
  name: N,
  distinctId: string,
  properties: EventProperties[N],
  utm: Utm = {}
): void {
  const posthogClient = posthog();
  if (!posthogClient) return;

  try {
    posthogClient.capture({
      distinctId,
      event: name,
      properties: sanitize(name, properties, utm)
    });
    // Flushed rather than left in the queue, for the serverless reason above. The rejection is
    // swallowed here rather than left to become an unhandled rejection that takes the process with it.
    void posthogClient.flush().catch(() => {});
  } catch (error) {
    console.error("PostHog capture failed:", error instanceof Error ? error.message : error);
  }
}

/**
 * Forget the built client. Tests only — a module-level singleton and a per-test environment are
 * otherwise incompatible, and the alternative is every test inheriting the first one's decision.
 */
export function resetAnalyticsForTests(): void {
  client = null;
  attempted = false;
}
