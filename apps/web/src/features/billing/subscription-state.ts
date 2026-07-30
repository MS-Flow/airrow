// One reading of a Stripe subscription, used by everything that applies one (spec 100).
//
// The webhook and the return-from-Checkout sync are the same operation reached two ways: Stripe hands
// us a subscription, and we decide what it entitles the organization to. Written twice they would
// drift, and the drift would be silent — two places deciding a plan slightly differently is exactly
// the bug nobody notices until a founder is charged for something they do not have.
import type Stripe from "stripe";
import type { SubscriptionState } from "@/lib/data/store";
import { planForStatus } from "@/lib/stripe";

/** Whatever Stripe puts a customer id in: a string on the way out, an object on the way back. */
export function stripeCustomerId(
  value: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

export function toSubscriptionState(subscription: Stripe.Subscription): SubscriptionState | null {
  const customer = stripeCustomerId(subscription.customer);
  if (!customer) return null;

  // `current_period_end` is seconds since the epoch and is absent on some statuses. Read off the
  // first item rather than the subscription: Stripe moved it there, and the top-level field is not
  // present on newer API versions.
  const periodEnd = subscription.items.data[0]?.current_period_end;

  return {
    customerId: customer,
    subscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    plan: planForStatus(subscription.status)
  };
}

/**
 * Which of a customer's subscriptions decides the plan.
 *
 * A customer can hold several — an abandoned `incomplete` from a first attempt, a `canceled` one from
 * last year, a live one. Any that entitles them to Pro wins, because being charged for Pro and shown
 * free is the failure that costs us a customer; among equals, the most recently created. Sorting on
 * `created` rather than trusting Stripe's order: the list endpoint's ordering is not part of its
 * contract.
 */
export function decisiveSubscription(
  subscriptions: Stripe.Subscription[]
): Stripe.Subscription | null {
  const newestFirst = [...subscriptions].sort((a, b) => b.created - a.created);
  return newestFirst.find((s) => planForStatus(s.status) === "pro") ?? newestFirst[0] ?? null;
}
