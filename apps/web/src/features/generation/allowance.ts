// What an organization is entitled to (spec 74, replacing the free-only ceiling of spec 65).
//
// Every generation makes a Claude call that Airrow pays for, and signup is open. That used to be a
// cost control with nowhere to go once it bit. It is now the shape of the product: free is one
// complete foundation, Pro is unlimited, and importing an existing project is Pro.
//
// One function answers "may this organization do this", so every caller asks the same question and
// none of them knows that plans exist. What is counted lives in `generation_usage` and outlives the
// projects it refers to — counting live jobs made the limit refundable, and a call already paid for
// would be forgotten the moment a project was deleted.
import { countGenerations, isAdminUser, projectUsage } from "@/lib/data/store";
import type { OrgPlan } from "@/lib/data/store";
import { FREE_GENERATION_LIMIT, FREE_REPAIR_LIMIT, REPAIR_WINDOW_HOURS } from "./limits";

export { FREE_GENERATION_LIMIT, FREE_REPAIR_LIMIT, REPAIR_WINDOW_HOURS };

const REPAIR_WINDOW_MS = REPAIR_WINDOW_HOURS * 60 * 60 * 1000;

/** Why an organization may proceed. */
export type AllowanceGrant =
  /** Within the free foundation. */
  | "free"
  /** A free repair on a project that has already been generated. */
  | "repair"
  /** A paid plan. */
  | "pro"
  /** An account exempt from the limit entirely. */
  | "admin";

/** Why it may not. */
export type AllowanceDenial =
  /** The free foundation is spent, and this is not a repair of it. */
  | "free-spent"
  /** Both repairs on this project are used. */
  | "repairs-spent"
  /** The repair window has closed on this project. */
  | "window-closed";

/**
 * A discriminated union rather than a bag of booleans (§I): `allowed` is the discriminant, and the
 * reason travels with the answer so the founder can be told *which* limit they met. "No" without a
 * reason reads as a bug.
 */
export type Entitlement =
  | { allowed: true; plan: OrgPlan; grant: AllowanceGrant; used: number; remaining: number; unlimited: boolean }
  | { allowed: false; plan: OrgPlan; denial: AllowanceDenial; used: number; remaining: 0; unlimited: false };

/** Everything the answer depends on. `projectId` is absent when only summarising, e.g. in settings. */
export interface AllowanceQuery {
  orgId: string;
  plan: OrgPlan;
  /**
   * Optional so a caller without a session gets the ordinary limit rather than an accidental bypass
   * — the admin flag is only ever read for a user we actually have.
   */
  userId?: string;
  /** The project a generation is about to run on. Only a project can be repaired. */
  projectId?: string;
  /** Injected so the window is testable without touching the clock. */
  now?: Date;
}

/**
 * Whether this organization may start another generation.
 *
 * Pro and admin short-circuit; everyone else is measured against the free foundation first and the
 * repair window second. The order matters: a founder who still has their free foundation is on the
 * `free` path even when generating a project that already exists, so their first regeneration is not
 * silently charged to the repair budget.
 */
export async function checkAllowance(query: AllowanceQuery): Promise<Entitlement> {
  const { orgId, plan, userId, projectId, now = new Date() } = query;

  const [used, admin] = await Promise.all([
    countGenerations(orgId),
    userId ? isAdminUser(userId) : Promise.resolve(false)
  ]);

  const unlimited = (grant: AllowanceGrant): Entitlement => ({
    allowed: true,
    plan,
    grant,
    used,
    remaining: Number.POSITIVE_INFINITY,
    unlimited: true
  });

  if (admin) return unlimited("admin");
  if (plan === "pro") return unlimited("pro");

  const remaining = Math.max(0, FREE_GENERATION_LIMIT - used);
  if (used < FREE_GENERATION_LIMIT) {
    return { allowed: true, plan, grant: "free", used, remaining, unlimited: false };
  }

  const denied = (denial: AllowanceDenial): Entitlement => ({
    allowed: false,
    plan,
    denial,
    used,
    remaining: 0,
    unlimited: false
  });

  // Past the free foundation, the only way through is a repair — and a repair is a second run of
  // something that already exists. A project with nothing on it is a new foundation by another name.
  if (!projectId) return denied("free-spent");

  const project = await projectUsage(projectId);
  if (project.count === 0 || project.firstAt === null) return denied("free-spent");
  if (project.count - 1 >= FREE_REPAIR_LIMIT) return denied("repairs-spent");
  if (now.getTime() - Date.parse(project.firstAt) > REPAIR_WINDOW_MS) return denied("window-closed");

  return { allowed: true, plan, grant: "repair", used, remaining: 0, unlimited: false };
}

/**
 * What the founder is told when they are refused.
 *
 * Names the limit they actually met rather than one generic wall, and in every case says plainly
 * that what they already have is safe — the first fear on hitting a limit is losing work. Pro is
 * named as the way on but not as a button: it is not purchasable yet, and promising a checkout that
 * does not exist is worse than saying so.
 */
export function allowanceMessage(denial: AllowanceDenial): string {
  const safe = "Your existing projects and downloads are unaffected.";
  switch (denial) {
    case "free-spent":
      return (
        `You've used your free foundation. Pro lifts the limit to unlimited foundations and adds ` +
        `importing an existing project — it isn't purchasable yet, and we'll tell you the moment it ` +
        `is. ${safe}`
      );
    case "repairs-spent":
      return (
        `You've used both free revisions of this foundation. Pro removes the limit — it isn't ` +
        `purchasable yet, and we'll tell you the moment it is. ${safe}`
      );
    case "window-closed":
      return (
        `Free revisions of a foundation are open for ${REPAIR_WINDOW_HOURS} hours after it is first ` +
        `generated, and that window has closed. Pro removes the limit — it isn't purchasable yet, ` +
        `and we'll tell you the moment it is. ${safe}`
      );
  }
}
