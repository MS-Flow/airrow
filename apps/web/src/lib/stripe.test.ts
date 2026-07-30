// What a Stripe status entitles an organization to (spec 99).
//
// The interesting cases are the failing ones. Stripe retries a declined card for days and moves the
// subscription to `past_due` while it does; treating that as "not Pro" would cut off a founder whose
// card expired before Stripe has finished trying, or even emailed them. So this file mostly exists
// to pin down what does *not* end a subscription.
import { describe, it, expect, afterEach } from "vitest";
import { missingStripeConfig, planForStatus, stripeConfigured, stripePrices } from "./stripe";

describe("planForStatus", () => {
  it.each(["active", "trialing"])("keeps %s on Pro", (status) => {
    expect(planForStatus(status)).toBe("pro");
  });

  it.each(["past_due", "unpaid"])("keeps %s on Pro while Stripe is still retrying", (status) => {
    // The whole policy in one assertion: a failed charge is not a cancellation.
    expect(planForStatus(status)).toBe("pro");
  });

  it.each(["canceled", "incomplete", "incomplete_expired", "paused"])(
    "drops %s to free",
    (status) => {
      expect(planForStatus(status)).toBe("free");
    }
  );

  it("treats a status it has never heard of as free", () => {
    // Stripe adds statuses. Defaulting an unknown one *down* is the only safe direction for an
    // entitlement — the failure mode is a founder asking why, not silent free Pro.
    expect(planForStatus("something_new")).toBe("free");
  });
});

describe("configuration", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  function configured(): void {
    process.env.STRIPE_SECRET_KEY = "sk_test";
    process.env.STRIPE_PRICE_MONTHLY = "price_monthly";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  }

  it("is unconfigured without a secret key, so nothing offers to charge anyone", () => {
    configured();
    delete process.env.STRIPE_SECRET_KEY;

    expect(stripeConfigured()).toBe(false);
  });

  it("is unconfigured without a price, because a key alone cannot sell anything", () => {
    configured();
    delete process.env.STRIPE_PRICE_MONTHLY;

    expect(stripeConfigured()).toBe(false);
  });

  it("refuses to sell without the webhook secret, which is what grants the plan", () => {
    // Charging a card the webhook cannot then be verified for takes money and delivers nothing. The
    // founder would be Pro in Stripe and free in Airrow, and only they would notice.
    configured();
    delete process.env.STRIPE_WEBHOOK_SECRET;

    expect(stripeConfigured()).toBe(false);
  });

  it("is configured when all three are present", () => {
    configured();

    expect(stripeConfigured()).toBe(true);
    expect(missingStripeConfig()).toEqual([]);
  });

  it("names what is missing, because a typo in a variable name looks like nothing at all", () => {
    // The real one: `STRIPE_PRICE_MONTLY` was set in the deployment. Every screen behaved as if Pro
    // had never been built, and no log said otherwise.
    configured();
    delete process.env.STRIPE_PRICE_MONTHLY;
    process.env.STRIPE_PRICE_MONTLY = "price_monthly";

    expect(missingStripeConfig()).toEqual(["STRIPE_PRICE_MONTHLY"]);
  });

  it("offers monthly only when yearly is unset", () => {
    // Shipping monthly and turning yearly on later is an environment change, not a code change.
    process.env.STRIPE_PRICE_MONTHLY = "price_monthly";
    delete process.env.STRIPE_PRICE_YEARLY;

    expect(stripePrices()).toEqual([{ id: "price_monthly", interval: "month" }]);
  });

  it("offers monthly first when both are set", () => {
    process.env.STRIPE_PRICE_MONTHLY = "price_monthly";
    process.env.STRIPE_PRICE_YEARLY = "price_yearly";

    expect(stripePrices()).toEqual([
      { id: "price_monthly", interval: "month" },
      { id: "price_yearly", interval: "year" }
    ]);
  });
});
