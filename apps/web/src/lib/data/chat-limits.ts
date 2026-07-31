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
import { GLOBAL_DAILY_ANSWER_LIMIT, VISITOR_DAILY_ANSWER_LIMIT } from "@/features/chat/limits";

/** Why an answer was not spent. `unavailable` covers everything that is our fault, not the visitor's. */
export type ChatClaim =
  | { allowed: true }
  | { allowed: false; reason: "visitor" | "global" | "unavailable" };

const UNAVAILABLE = { allowed: false, reason: "unavailable" } as const;

/**
 * The stable, unreversible identity of a visitor for one day.
 *
 * A salted SHA-256 of the address. The salt is a server secret and is required rather than optional:
 * an unsalted hash of an IPv4 address is a lookup table away from the address itself, and this value
 * is stored. No salt therefore means no rate limiting, which by the rule below means no chat — never
 * an unlimited one.
 *
 * Returns null when the chat cannot be limited at all, which the caller treats as unavailability.
 */
export function visitorKey(address: string | null): string | null {
  const salt = process.env.AIRROW_CHAT_IP_SALT;
  if (!salt || !address) return null;
  return crypto.createHash("sha256").update(`${salt}:${address}`).digest("hex").slice(0, 32);
}

/**
 * Claim one answer against both ceilings.
 *
 * One round trip: the ceilings are checked and incremented inside `claim_chat_answer`, because a
 * read-then-write from here would race with every other visitor and a budget that is only
 * approximately enforced is not a budget.
 *
 * **Every failure is a refusal.** A database one migration behind, an unreachable one, an
 * unconfigured one — none of them can say whether we may spend an answer, and the only safe reading
 * of that is no. This is the opposite of the tolerance `referrals.ts` has for the same situation, and
 * deliberately so (spec 141): there the missing table meant a *feature* was absent and "no
 * invitations" was the honest answer; here the missing thing is a *protection*, and serving the chat
 * without one would be the expensive kind of wrong.
 */
export async function claimChatAnswer(key: string | null): Promise<ChatClaim> {
  if (!key) return UNAVAILABLE;

  // `db()` throws when Supabase is unconfigured, which is a running local dev server with no
  // `.env.local` — the chat is off there, exactly as it is with no API key.
  let data: unknown;
  try {
    const res = await db().rpc("claim_chat_answer", {
      p_visitor: key,
      p_visitor_limit: VISITOR_DAILY_ANSWER_LIMIT,
      p_global_limit: GLOBAL_DAILY_ANSWER_LIMIT
    });
    if (res.error) return UNAVAILABLE;
    data = res.data;
  } catch {
    return UNAVAILABLE;
  }

  if (data === "ok") return { allowed: true };
  if (data === "visitor") return { allowed: false, reason: "visitor" };
  if (data === "global") return { allowed: false, reason: "global" };
  return UNAVAILABLE;
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
