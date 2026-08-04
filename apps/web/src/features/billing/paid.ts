// When a payment becomes a *conversion*, and what it was bought as (spec 182).
//
// `paid` is the last step of the funnel and the one with the most ways to be wrong. Stripe delivers
// at least once and retries for days; a renewal arrives every month looking much like a purchase;
// `syncPlanFromStripe` re-applies the same state whenever a billing screen is opened. Emitting an
// event on each of those would make "paid" a count of Stripe traffic rather than of customers.
//
// So the event fires on the *transition*: an organization that was not entitled to Pro before this
// application of state, and is after it. That is a fact about our own database, checked against the
// row that is already read before the write in both callers, and it survives every one of the
// repeats above — the second delivery of the same event finds a row that already says Pro.
//
// This file decides; `sync.ts` and the webhook route call it. It is deliberately not inside
// `applySubscriptionState`: that function is the DataStore's, and the DataStore is the bottom layer
// (§I). Analytics belongs to the feature, not underneath it.
import type Stripe from "stripe";
import { capture } from "@/features/analytics/server";
import { distinctIdForOrg, type PaidTier } from "@/features/analytics/events";
import type { SubscriptionState } from "@/lib/data/store";
import { planForStatus } from "@/lib/stripe";

/**
 * What this subscription was bought as.
 *
 * A discount on a yearly subscription is the founding offer: it is the only coupon Checkout ever
 * attaches, and it rides on the yearly price alone (`startCheckoutAction`). Read off the
 * subscription rather than remembered from the click, because the click is not what we were paid on.
 *
 * A discounted *monthly* subscription would be somebody applying a coupon in the Stripe dashboard by
 * hand, which is a real thing support does and is not the launch offer — so it reports as monthly,
 * and the founding count stays a count of founding places.
 */
export function paidTier(subscription: Stripe.Subscription): PaidTier {
  const interval = subscription.items.data[0]?.price?.recurring?.interval;
  if (interval !== "year") return "monthly";
  // `?.` on fields Stripe's types call required: this reads an object that arrived over the network
  // from an API whose shape moves between versions, and the alternative to a defensive read is a
  // `TypeError` inside a webhook that has already applied a payment.
  return (subscription.discounts?.length ?? 0) > 0 ? "founding" : "yearly";
}

/**
 * Whether this application of state is the moment the organization started paying.
 *
 * @param previous the subscription row as it stood *before* the write, or `null` when there was
 * none. Both callers already hold it — the webhook to find the organization, the sync to decide
 * whether to ask Stripe at all — so this costs no extra read.
 */
export function isNewConversion(
  previous: { status: string } | null,
  next: SubscriptionState
): boolean {
  if (next.plan !== "pro") return false;
  return previous === null || planForStatus(previous.status) !== "pro";
}

/**
 * Record a conversion, if this was one. Never throws, never awaited.
 *
 * Called after the state has been applied rather than before: an event about a payment that then
 * failed to save is a lie that outlives the request.
 *
 * The `catch` is not decoration. Its caller in the webhook route sits inside the block that releases
 * the event claim and rethrows, so anything thrown here would answer Stripe with a 500 about a
 * payment that had *already succeeded* — Stripe would retry, and the founder would watch the plan
 * they paid for depend on an analytics helper. Nothing this file can learn is worth that.
 */
export function capturePaid(
  orgId: string,
  previous: { status: string } | null,
  next: SubscriptionState,
  subscription: Stripe.Subscription
): void {
  try {
    if (!isNewConversion(previous, next)) return;
    capture("paid", distinctIdForOrg(orgId), { tier: paidTier(subscription) });
  } catch (error) {
    console.error("Paid event failed:", error instanceof Error ? error.message : error);
  }
}
