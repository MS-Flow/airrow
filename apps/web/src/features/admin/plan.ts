// What a workspace's plan actually says, in one sentence (spec 164).
//
// The console used to print `Stripe: active` and stop. That is the raw status word and it answers
// neither question support is ever asked — *when does this end* and *did they cancel* — while both
// answers were already in the `subscriptions` row, filled correctly by `toSubscriptionState` and then
// discarded by the read.
//
// Pure, and deliberately so: every case below is a date and a couple of booleans, which is exactly the
// kind of logic that rots when it can only be exercised by clicking through a screen with a real Stripe
// customer behind it.
import type { ActiveGrant, AdminSubscription } from "@/lib/data/admin";

/**
 * Where a workspace's Pro comes from, if it has any.
 *
 * `bought` is the only one that means money; the other two are ours to end. Keeping them apart on the
 * card is the difference between "cancel their subscription" and "click revoke".
 */
export type PlanSource = "bought" | "earned" | "granted";

/**
 * The verdict a card renders.
 *
 * A union rather than a formatted string, so the screen decides tone (a lapsed subscription is not
 * styled like a live one) and the test asserts meaning rather than punctuation.
 */
export type PlanStanding =
  /** Paying, and it renews. `until` absent on statuses Stripe gives no period for. */
  | { kind: "pro"; source: PlanSource; until: string | null }
  /** Paying, and they cancelled — Pro until `until`, then free. */
  | { kind: "pro-cancelling"; source: PlanSource; until: string | null }
  /** Stripe has stopped collecting. Reported `active` by Stripe throughout, which would read as renewing. */
  | { kind: "pro-paused"; until: string | null }
  /** A subscription that once was and is not: `canceled`, `past_due`, `unpaid`, `incomplete_expired`. */
  | { kind: "lapsed"; status: string; since: string | null }
  /** Never paid, never granted. */
  | { kind: "free" }
  /** Free, but Stripe holds an unfinished attempt — worth seeing before answering a billing ticket. */
  | { kind: "free-attempted"; status: string };

/** Statuses that mean "there is a subscription here, it is simply not paying for anything". */
const PENDING = new Set(["incomplete", "incomplete_expired", "trialing"]);

/**
 * Read plan + subscription + grant as one standing.
 *
 * Order matters and follows the entitlement itself: `organizations.plan` is Stripe's answer and wins,
 * a grant is consulted only when the plan is free — which is exactly what `claimPro` does, so the card
 * cannot claim an entitlement the product would not honour.
 */
export function planStanding(input: {
  plan: string;
  subscription: AdminSubscription | null;
  grant: ActiveGrant | null;
}): PlanStanding {
  const { plan, subscription, grant } = input;

  if (plan === "pro") {
    if (subscription?.status === "paused") {
      return { kind: "pro-paused", until: subscription.currentPeriodEnd };
    }
    return subscription?.cancelAtPeriodEnd
      ? { kind: "pro-cancelling", source: "bought", until: subscription.currentPeriodEnd }
      : { kind: "pro", source: "bought", until: subscription?.currentPeriodEnd ?? null };
  }

  // Free by plan, but covered by something we gave or they earned. Never `cancelling`: a grant has a
  // fixed end from the moment it is written, so "ends on the 30th" is the whole truth about it.
  if (grant) {
    return {
      kind: "pro",
      source: grant.source === "support" ? "granted" : "earned",
      until: grant.expiresAt
    };
  }

  if (!subscription) return { kind: "free" };
  // A subscription exists and the plan is free, so Stripe said no. Two ways for that to read: it ran
  // and stopped, or it never started. Only the first has a date worth showing.
  if (PENDING.has(subscription.status)) return { kind: "free-attempted", status: subscription.status };
  return { kind: "lapsed", status: subscription.status, since: subscription.currentPeriodEnd };
}

/** How each standing reads on the card. The date is formatted by the caller, which owns the locale. */
export function planLabel(standing: PlanStanding): string {
  switch (standing.kind) {
    case "pro":
      return "Pro";
    case "pro-cancelling":
      return "Pro · cancelled";
    case "pro-paused":
      return "Pro · paused";
    case "lapsed":
      return `Lapsed · ${standing.status}`;
    case "free-attempted":
      return `Free · ${standing.status}`;
    case "free":
      return "Free";
  }
}

/** Where the Pro came from, for the card. Null when there is none to explain. */
export function planSourceLabel(standing: PlanStanding): string | null {
  if (standing.kind === "pro-paused") return "bought from Stripe";
  if (standing.kind !== "pro" && standing.kind !== "pro-cancelling") return null;
  switch (standing.source) {
    case "bought":
      return "bought from Stripe";
    case "earned":
      return "earned by inviting someone";
    case "granted":
      return "granted by support";
  }
}

/** True when an operator's grant would change anything — the plan short-circuits before a grant. */
export function grantWouldApply(standing: PlanStanding): boolean {
  return standing.kind === "free" || standing.kind === "free-attempted" || standing.kind === "lapsed";
}
