// The landing chat's daily ceilings, as the app sees them (spec 141).
//
// A sibling of `store.ts` for the same reason `referrals.ts` is one: this one table is only ever
// touched by this one caller, and the store is already long enough. Server-side only, like every
// module in `lib/data` — the Supabase client uses the service-role key.
//
// Everything here answers one question: may we spend an answer on this request? A `false` is never an
// error; it is the panel falling back to its handwritten replies.
import crypto from "node:crypto";
import { db } from "./supabase";
import {
  reportChatUnavailable,
  reportSharedBucket,
  type ChatUnavailableReason
} from "@/features/chat/diagnostics";
import { GLOBAL_DAILY_ANSWER_LIMIT, VISITOR_DAILY_ANSWER_LIMIT } from "@/features/chat/limits";

/**
 * Why an answer was not spent.
 *
 * `unavailable` carries its cause so the route can log it and, outside production, return it as a
 * header — the visitor still learns nothing (spec 151).
 */
export type ChatClaim =
  | { allowed: true }
  | { allowed: false; reason: "visitor" | "global" }
  | { allowed: false; reason: "unavailable"; cause: ChatUnavailableReason };

function unavailable(cause: ChatUnavailableReason): ChatClaim {
  reportChatUnavailable(cause);
  return { allowed: false, reason: "unavailable", cause };
}

/**
 * The bucket every caller we cannot identify shares.
 *
 * Not a hash of anything, and deliberately not confusable with one: `claim_chat_answer` reserves
 * only the name `global`, so this needs to be a value no hex digest can collide with.
 */
const SHARED_BUCKET = "shared-no-address";

/**
 * The stable, unreversible identity of a visitor for one day.
 *
 * A salted SHA-256 of the address. The salt is a server secret and is required rather than optional:
 * an unsalted hash of an IPv4 address is a lookup table away from the address itself, and this value
 * is stored. No salt therefore means no rate limiting, and no rate limiting means no chat — never an
 * unlimited one. That is the one part of spec 141's "everything the protection needs is missing ⇒
 * FAQ mode" rule that still stands.
 *
 * **A missing address is different, and spec 151 changed it.** It used to be refused the same way,
 * which meant the panel could never answer in a browser on localhost — the dev server sets no
 * `x-forwarded-for` and no browser sends one — and that a deployment behind a proxy that strips the
 * header would sit in FAQ mode forever without saying so. Now those callers share one bucket: safe,
 * because the per-visitor and global ceilings both still apply, and loud, because it is logged.
 */
export function visitorKey(address: string | null): string | null {
  const salt = process.env.AIRROW_CHAT_IP_SALT;
  if (!salt) return null;
  if (!address) {
    reportSharedBucket();
    return SHARED_BUCKET;
  }
  return crypto.createHash("sha256").update(`${salt}:${address}`).digest("hex").slice(0, 32);
}

/**
 * Claim one answer against both ceilings.
 *
 * One round trip: the ceilings are checked and incremented inside `claim_chat_answer`, because a
 * read-then-write from here would race with every other visitor and a budget that is only
 * approximately enforced is not a budget.
 *
 * **Every failure is a refusal, and now says so.** A database one migration behind, an unreachable
 * one, an unconfigured one — none of them can say whether we may spend an answer, and the only safe
 * reading of that is no. This is the opposite of the tolerance `referrals.ts` has for the same
 * situation, and deliberately so (spec 141): there the missing table meant a *feature* was absent and
 * "no invitations" was the honest answer; here the missing thing is a *protection*, and serving the
 * chat without one would be the expensive kind of wrong. What spec 151 adds is that each of those
 * refusals is now logged with its cause instead of being indistinguishable from the others.
 */
export async function claimChatAnswer(key: string | null): Promise<ChatClaim> {
  if (!key) return unavailable("no-salt");

  // `db()` throws when Supabase is unconfigured, which is a running local dev server with no
  // `.env.local` — the chat is off there, exactly as it is with no API key.
  let data: unknown;
  try {
    const res = await db().rpc("claim_chat_answer", {
      p_visitor: key,
      p_visitor_limit: VISITOR_DAILY_ANSWER_LIMIT,
      p_global_limit: GLOBAL_DAILY_ANSWER_LIMIT
    });
    if (res.error) return unavailable("limit-store-unreachable");
    data = res.data;
  } catch {
    return unavailable("limit-store-unreachable");
  }

  if (data === "ok") return { allowed: true };
  if (data === "visitor") return { allowed: false, reason: "visitor" };
  if (data === "global") return { allowed: false, reason: "global" };
  return unavailable("limit-store-unreachable");
}

/**
 * Give a claimed answer back, when the model produced nothing.
 *
 * The claim happens before the call because the call is what costs money; this is what keeps that
 * from charging a visitor for silence. Failure here is deliberately swallowed — the visitor is
 * already being handed the fallback, and a bookkeeping error is not worth turning that into an error
 * page. Worst case the allowance is one short for the rest of the day.
 */
export async function releaseChatAnswer(key: string | null): Promise<void> {
  if (!key) return;
  try {
    await db().rpc("release_chat_answer", { p_visitor: key });
  } catch {
    // `db()` throws when Supabase is unconfigured; the rpc itself reports errors rather than
    // throwing. Neither is worth surfacing on a request that is already returning the fallback.
  }
}
