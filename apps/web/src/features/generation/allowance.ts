// The free generation allowance (spec 65).
//
// Every generation makes a Claude call that Airrow pays for, and signup is open. Without a ceiling
// one account can spend without limit, which is the gap the authoring work opened. This is that
// ceiling — deliberately a plain count rather than a time window: the intent is "two free
// foundations", not "two per hour", and Pro replaces it rather than extending it (#74).
//
// What is counted lives in `generation_usage` and outlives the projects it refers to. Counting live
// jobs made the limit refundable: delete a project, get the generation back, and the call already
// paid for is forgotten.
import { countGenerations, isAdminUser } from "@/lib/data/store";

/** Free generations per organization. Pro lifts it; see `ALLOWANCE_REACHED_MESSAGE`. */
export const FREE_GENERATION_LIMIT = 2;

export interface AllowanceCheck {
  allowed: boolean;
  used: number;
  remaining: number;
  /** True when the account is not subject to the limit at all. */
  unlimited: boolean;
}

/**
 * Whether this organization may start another generation.
 *
 * `userId` is optional so a caller without a session gets the ordinary limit rather than an
 * accidental bypass — the admin flag is only ever read for a user we actually have.
 */
export async function checkAllowance(orgId: string, userId?: string): Promise<AllowanceCheck> {
  const [used, unlimited] = await Promise.all([
    countGenerations(orgId),
    userId ? isAdminUser(userId) : Promise.resolve(false)
  ]);
  if (unlimited) return { allowed: true, used, remaining: Number.POSITIVE_INFINITY, unlimited };
  return {
    allowed: used < FREE_GENERATION_LIMIT,
    used,
    remaining: Math.max(0, FREE_GENERATION_LIMIT - used),
    unlimited: false
  };
}

/**
 * What the founder is told when they have run out. Names the number rather than hiding it, and says
 * plainly that what they already have is safe — the first fear on hitting a limit is losing work.
 */
export const ALLOWANCE_REACHED_MESSAGE =
  "You've used both of your free generations. Upgrade to Pro to keep generating — unlimited " +
  "foundations and more, coming soon. Your existing projects and downloads are unaffected.";
