// The funnel, named once (spec 182).
//
// This file is the complete answer to "what does Airrow send to PostHog?". Every event name, every
// property key, and the rule that nothing outside this list leaves the process. It is deliberately
// readable in full in one sitting, because the question it answers is a privacy question and the
// honest way to answer it is to be able to point at a file.
//
// Nothing here imports a PostHog SDK — the server and the browser each have their own transport, and
// both consult this. Keeping the vocabulary separate from the delivery is what lets a test assert
// what may be sent without a network in sight.

/**
 * Every event Airrow emits, in funnel order.
 *
 * `github_pushed` is defined and never emitted. Pushing a foundation to a repository does not exist
 * yet — `recordDelivery` accepts `"github"` but `"zip"` is the only value any caller passes — so the
 * name is here to hold the place, not to claim a capability. A dashboard tile reading zero because
 * the feature is unbuilt is a different fact from one reading zero because nobody used it, and only
 * the first is true today.
 */
export const EVENT_NAMES = [
  "pageview",
  "interview_started",
  "interview_step",
  "signup",
  "foundation_generated",
  "zip_downloaded",
  "github_pushed",
  "checkout_started",
  "paid"
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

/** What Pro was bought as. `founding` is the capped launch offer (spec 179), which rides on yearly. */
export type PaidTier = "monthly" | "yearly" | "founding";

/**
 * The properties each event carries.
 *
 * Every value is an enum, a count, or an opaque id we generated. No email, no name, no project title,
 * no answer text, no document body — none of which is an oversight to be corrected later: the ratios
 * this exists to produce need none of it, and a funnel is not a reason to hand a third party a
 * customer list.
 */
export interface EventProperties {
  pageview: { path: string };
  /** Whether the interview was started with an account or as a guest — the two have different exits. */
  interview_started: { mode: "guest" | "account" };
  /** Which question was just completed, and where it sits. This is the drop-off curve. */
  interview_step: { question: string; index: number; total: number };
  signup: { method: "email" | "github" | "google" };
  foundation_generated: { project: string; reused: boolean };
  zip_downloaded: { project: string };
  github_pushed: { project: string };
  checkout_started: { interval: string; founding: boolean };
  paid: { tier: PaidTier };
}

/**
 * The property keys each event may carry — the same information as `EventProperties`, in a form the
 * running program can check itself against.
 *
 * Both exist on purpose. The interface stops a mistake at compile time, which is where mistakes are
 * cheapest to fix; this list stops one at runtime, which is where the mistake that matters happens —
 * a caller reaching for `unknown`, an object spread that carries more than its author read, a
 * property added in a hurry. `sanitize` keeps what is named here and silently drops everything else,
 * so the worst case is a missing dimension on a chart rather than a customer's name in a third-party
 * database.
 */
const ALLOWED_KEYS: Record<EventName, readonly string[]> = {
  pageview: ["path"],
  interview_started: ["mode"],
  interview_step: ["question", "index", "total"],
  signup: ["method"],
  foundation_generated: ["project", "reused"],
  zip_downloaded: ["project"],
  github_pushed: ["project"],
  checkout_started: ["interval", "founding"],
  paid: ["tier"]
};

/**
 * Campaign parameters, as they appear in a URL.
 *
 * Allowed on any event, because the whole point of them is to survive from the page that was landed
 * on to the thing that was eventually done. What limits how far they actually travel is not this list
 * — see `client.tsx`.
 */
export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term"
] as const;

export type UtmKey = (typeof UTM_KEYS)[number];
export type Utm = Partial<Record<UtmKey, string>>;

/**
 * How much of a campaign parameter is kept.
 *
 * They come out of a URL anyone can write, so they are attacker-controlled text on their way to a
 * third party. Long enough for every real campaign name; short enough that the field cannot be used
 * to smuggle a paragraph.
 */
const UTM_MAX_LENGTH = 100;

/** A property value that is safe to put on the wire: a scalar, never an object or an array. */
type Scalar = string | number | boolean;

const isScalar = (value: unknown): value is Scalar =>
  typeof value === "string" || typeof value === "number" || typeof value === "boolean";

/**
 * Read campaign parameters out of a query string, keeping only the five that are ours to read.
 *
 * Empty values are dropped rather than sent as `""`: a UTM that was present but blank is not a
 * channel, and an empty string on a chart reads as one.
 */
export function readUtm(search: string): Utm {
  const params = new URLSearchParams(search);
  const utm: Utm = {};
  for (const key of UTM_KEYS) {
    const value = params.get(key)?.trim();
    if (value) utm[key] = value.slice(0, UTM_MAX_LENGTH);
  }
  return utm;
}

/**
 * The final property bag for an event: what this event is allowed to carry, and nothing else.
 *
 * Unknown keys are dropped without complaint. Throwing would put analytics in a position to break the
 * thing it is measuring, which is the one rule everything in this feature is written around.
 */
export function sanitize(
  name: EventName,
  properties: Record<string, unknown>,
  utm: Utm = {}
): Record<string, Scalar> {
  const allowed = ALLOWED_KEYS[name];
  const out: Record<string, Scalar> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (allowed.includes(key) && isScalar(value)) out[key] = value;
  }
  for (const key of UTM_KEYS) {
    const value = utm[key];
    if (value) out[key] = value;
  }
  return out;
}

/** Everything under here is a signed-in founder's own workspace. */
const PRIVATE_PREFIX = "/app";

/**
 * Whether a path belongs to somebody's workspace rather than to the public site.
 *
 * Lives here because two different analytics tools ask it — Vercel's, which counts visitors
 * (spec 153), and this one, which counts the funnel — and the same question answered in two files is
 * the same question answered differently a year from now (§IV).
 *
 * The check is on the path **segment**, not the string. A bare `startsWith("/app")` also swallows
 * `/apply` and `/approach`, which are public pages we would silently stop counting — a real bug, in
 * the first version of spec 153's filter, caught by a test rather than by anybody noticing.
 */
export function isPrivatePath(path: string): boolean {
  return path === PRIVATE_PREFIX || path.startsWith(`${PRIVATE_PREFIX}/`);
}

/**
 * The identity a server-sent event is attributed to.
 *
 * An organization id, prefixed so a distinct id can never be mistaken for anything else in PostHog's
 * own interface. The id is a UUID we generated: it names a workspace, it is meaningless to anyone
 * without our database, and it is the same id from signup to payment — which is what makes the
 * bottom half of the funnel a funnel rather than five unrelated counters.
 */
export const distinctIdForOrg = (orgId: string): string => `org_${orgId}`;
