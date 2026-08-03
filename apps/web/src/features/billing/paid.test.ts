// When a payment is a conversion, and what it was bought as (spec 182).
//
// `paid` is the event with the most ways to be quietly wrong: Stripe delivers at least once and
// retries for days, a renewal looks much like a purchase, and every billing screen re-applies the
// same state. Each of those would inflate the bottom of the funnel, and a funnel that overcounts its
// last step is worse than no funnel — it says the product converts better than it does.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import type { SubscriptionState } from "@/lib/data/store";

const analytics = vi.hoisted(() => ({
  captures: [] as { name: string; distinctId: string; properties: Record<string, unknown> }[]
}));

vi.mock("@/features/analytics/server", () => ({
  capture: (name: string, distinctId: string, properties: Record<string, unknown>) => {
    analytics.captures.push({ name, distinctId, properties });
  }
}));

import { capturePaid, isNewConversion, paidTier } from "./paid";

/** Only the fields `paidTier` reads. The cast keeps the fixture to the shape under test. */
function subscription(interval: "month" | "year", discounts: string[] = []): Stripe.Subscription {
  return {
    items: { data: [{ price: { recurring: { interval } } }] },
    discounts
  } as unknown as Stripe.Subscription;
}

const pro: SubscriptionState = {
  customerId: "cus_1",
  subscriptionId: "sub_1",
  status: "active",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  plan: "pro"
};

beforeEach(() => {
  analytics.captures = [];
});

describe("paidTier", () => {
  it("reads a discounted yearly subscription as a founding place", () => {
    expect(paidTier(subscription("year", ["di_1"]))).toBe("founding");
  });

  it("reads an undiscounted yearly subscription as yearly", () => {
    expect(paidTier(subscription("year"))).toBe("yearly");
  });

  it("reads monthly as monthly", () => {
    expect(paidTier(subscription("month"))).toBe("monthly");
  });

  it("reads a hand-discounted monthly subscription as monthly, not founding", () => {
    // Support applying a coupon in the Stripe dashboard is a real thing and is not the launch offer.
    // Counting it as one would make the founding count stop being a count of founding places.
    expect(paidTier(subscription("month", ["di_2"]))).toBe("monthly");
  });
});

describe("isNewConversion", () => {
  it("counts an organization that has never paid", () => {
    expect(isNewConversion(null, pro)).toBe(true);
  });

  it("counts an organization whose subscription was not entitling", () => {
    expect(isNewConversion({ status: "incomplete" }, pro)).toBe(true);
    expect(isNewConversion({ status: "canceled" }, pro)).toBe(true);
  });

  it("does not count a redelivery of an event already applied", () => {
    // Stripe retries for days. The second delivery finds a row that already says Pro.
    expect(isNewConversion({ status: "active" }, pro)).toBe(false);
  });

  it("does not count a renewal", () => {
    expect(isNewConversion({ status: "active" }, { ...pro, status: "active" })).toBe(false);
  });

  it("does not count a founder whose card merely failed and recovered", () => {
    // `past_due` stays Pro (`planForStatus`), so coming back from it is not a new customer.
    expect(isNewConversion({ status: "past_due" }, pro)).toBe(false);
  });

  it("does not count a cancellation", () => {
    expect(isNewConversion({ status: "active" }, { ...pro, status: "canceled", plan: "free" })).toBe(
      false
    );
  });
});

describe("capturePaid", () => {
  it("records the workspace and the tier on a new conversion", () => {
    capturePaid("org1", null, pro, subscription("year", ["di_1"]));

    expect(analytics.captures).toEqual([
      { name: "paid", distinctId: "org_org1", properties: { tier: "founding" } }
    ]);
  });

  it("records nothing on a repeat", () => {
    capturePaid("org1", { status: "active" }, pro, subscription("month"));

    expect(analytics.captures).toEqual([]);
  });
});
