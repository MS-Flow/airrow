// The early-access generation allowance (spec 65).
//
// Every generation makes a Claude call that Airrow pays for, and signup is open. Without a ceiling
// one account can spend without limit, which is the gap the authoring work opened. This is that
// ceiling — deliberately a plain count rather than a time window: the intent is "three free
// foundations", not "three per hour", and a paywall replaces it rather than extending it (#74).
import { countGenerations } from "@/lib/data/store";

/** Free generations per organization while Airrow is in early access. */
export const FREE_GENERATION_LIMIT = 3;

export interface AllowanceCheck {
  allowed: boolean;
  used: number;
  remaining: number;
}

export async function checkAllowance(orgId: string): Promise<AllowanceCheck> {
  const used = await countGenerations(orgId);
  return {
    allowed: used < FREE_GENERATION_LIMIT,
    used,
    remaining: Math.max(0, FREE_GENERATION_LIMIT - used)
  };
}

/** What the founder is told when they have run out. Names the number rather than hiding it. */
export const ALLOWANCE_REACHED_MESSAGE = `You've used all ${FREE_GENERATION_LIMIT} generations included in early access. Your existing projects and downloads are unaffected.`;
