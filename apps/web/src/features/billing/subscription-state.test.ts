// The reading both writers share, and the field that was missing from it.
//
// A cancelled subscription kept showing "Renews automatically. Your card is charged again on
// 2026-08-30" — on the date it would end. Stripe had answered the question: `cancel_at` set to the
// period end and `canceled_at` set to the click, with `cancel_at_period_end` left false. The numbers
// in the first test are the ones taken off the real subscription.
import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { decisiveSubscription, toSubscriptionState } from "./subscription-state";

type Sub = Stripe.Subscription;

const subscription = (overrides: Record<string, unknown> = {}): Sub =>
  ({
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    created: 1_785_000_000,
    cancel_at: null,
    canceled_at: null,
    cancel_at_period_end: false,
    pause_collection: null,
    items: { data: [{ current_period_end: 1_788_109_968 }] },
    ...overrides
  }) as unknown as Sub;

describe("toSubscriptionState", () => {
  it("treats a scheduled cancellation as ending, not as renewing", () => {
    const state = toSubscriptionState(
      subscription({ cancel_at: 1_788_109_968, canceled_at: 1_785_433_384 })
    );

    expect(state?.cancelAtPeriodEnd).toBe(true);
    expect(state?.currentPeriodEnd).toBe(new Date(1_788_109_968 * 1000).toISOString());
    // Still Pro until it actually ends: they paid for the period they are in.
    expect(state?.plan).toBe("pro");
  });

  it("still understands the older flag on its own", () => {
    expect(toSubscriptionState(subscription({ cancel_at_period_end: true }))?.cancelAtPeriodEnd).toBe(
      true
    );
  });

  it("leaves a healthy subscription renewing, with its next charge date", () => {
    const state = toSubscriptionState(subscription());

    expect(state?.cancelAtPeriodEnd).toBe(false);
    expect(state?.currentPeriodEnd).toBe(new Date(1_788_109_968 * 1000).toISOString());
    expect(state?.plan).toBe("pro");
  });

  it("ends the entitlement when Stripe has been told to stop collecting", () => {
    // `pause_collection` leaves the status `active`, so without this a paused subscription would go
    // on reporting that a card is charged on a date no card will be charged on.
    const state = toSubscriptionState(
      subscription({ pause_collection: { behavior: "void" } })
    );

    expect(state?.status).toBe("paused");
    expect(state?.plan).toBe("free");
  });

  it("has no state for a subscription with no customer", () => {
    expect(toSubscriptionState(subscription({ customer: null }))).toBeNull();
  });
});

describe("decisiveSubscription", () => {
  it("prefers the one that entitles them to Pro", () => {
    const paid = subscription({ id: "sub_paid", created: 1 });
    const abandoned = subscription({ id: "sub_abandoned", status: "incomplete", created: 2 });

    expect(decisiveSubscription([abandoned, paid])?.id).toBe("sub_paid");
  });

  it("falls back to the most recent when none of them do", () => {
    const old = subscription({ id: "sub_old", status: "canceled", created: 1 });
    const recent = subscription({ id: "sub_recent", status: "canceled", created: 2 });

    expect(decisiveSubscription([old, recent])?.id).toBe("sub_recent");
  });

  it("has nothing to say about a customer with no subscriptions", () => {
    expect(decisiveSubscription([])).toBeNull();
  });
});
