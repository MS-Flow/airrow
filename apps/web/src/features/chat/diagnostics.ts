// Why the landing chat went quiet (spec 151).
//
// `unavailable` is deliberately one answer for five different causes — a visitor must learn nothing
// about how we are configured. The mistake spec 141 made was letting that same silence apply to
// *us*: the route logged nothing, so a misconfigured deployment had to be diagnosed from the outside
// by timing responses, 0.29s against 1.0s, to work out how far into the chain it fell.
//
// So the cause travels server-side, next to the answer that hides it. One module, so the prefix is
// in one place and the list of causes is exhaustive in the type system rather than in a comment.
import type { ChatReply } from "./contract";

/**
 * Every way the chat can fail to produce an answer.
 *
 * Kebab-case because these are read in a log, not in code, and `[chat] unavailable: no-api-key`
 * greps better than a camelCase identifier would.
 */
export type ChatUnavailableReason =
  | "no-api-key"
  | "no-salt"
  | "limit-store-unreachable"
  | "model-call-failed"
  | "model-contract-violated";

/** The header the cause is echoed in outside production. See `diagnosticHeaders`. */
export const CHAT_REASON_HEADER = "x-airrow-chat-reason";

/**
 * Log why the chat could not answer.
 *
 * `console.error` with a bracketed prefix is the house convention (`features/import/actions.ts`,
 * `lib/auth.ts`); there is no logger module to go through.
 *
 * **Never takes the visitor's text, the answer, the API key or the hashed visitor key.** The cause is
 * a closed set of constants, which is what makes that guarantee structural rather than a promise:
 * there is no parameter for content to arrive through (§II).
 */
export function reportChatUnavailable(reason: ChatUnavailableReason): void {
  console.error(`[chat] unavailable: ${reason}`);
}

/**
 * Log that an answer was counted against the shared bucket because the request carried no address.
 *
 * A warning rather than an error: the chat *worked*: this is the deployment telling its operator that
 * everyone behind it shares one visitor's allowance. On Vercel the platform always sets the header,
 * so seeing this in production means a proxy in front is stripping it.
 *
 * Safe to call per request without flooding — the shared bucket runs out after
 * `VISITOR_DAILY_ANSWER_LIMIT` answers a day, so the ceiling bounds the log volume too.
 */
export function reportSharedBucket(): void {
  console.warn(
    "[chat] no caller address (no x-forwarded-for); counting this answer in the shared bucket"
  );
}

/**
 * The cause as a response header — **outside production only**.
 *
 * Gated on `VERCEL_ENV`, not `NODE_ENV`, and that distinction is the whole reason this is written
 * down: Vercel builds *preview* deployments with `NODE_ENV === "production"`, so a `NODE_ENV` gate
 * would have stayed silent on exactly the deployment the bug was in, while looking perfectly
 * reasonable in the diff. `VERCEL_ENV` is `production` | `preview` | `development`, and is unset
 * when running outside Vercel — which is local development, where we want the header most.
 */
export function diagnosticHeaders(reason: ChatUnavailableReason): Record<string, string> {
  if (process.env.VERCEL_ENV === "production") return {};
  return { [CHAT_REASON_HEADER]: reason };
}

/** The body a visitor gets, whatever the cause. Unchanged from spec 141, and that is the point. */
export const UNAVAILABLE_REPLY: ChatReply = { status: "unavailable" };
