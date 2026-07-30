// A founder cancelled their subscription and Settings went on saying "Renews automatically. Current
// period ends 2026-08-30" — the one sentence that could not be true, sitting under the date it was
// derived from. Stripe keeps a cancelled subscription `active` until the last day of the period, so
// the status alone never had the answer: the flag beside it does.
import { describe, it, expect } from "vitest";
import type { SubscriptionRecord } from "@/lib/data/store";
import { planStanding } from "./plan-standing";

const sub = (overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord => ({
  organizationId: "org1",
  customerId: "cus_1",
  subscriptionId: "sub_1",
  status: "active",
  currentPeriodEnd: "2026-08-30T09:00:00.000Z",
  cancelAtPeriodEnd: false,
  updatedAt: "2026-07-30T09:00:00.000Z",
  ...overrides
});

describe("planStanding", () => {
  it("says a cancelled subscription is ending, even though Stripe still calls it active", () => {
    const standing = planStanding(sub({ cancelAtPeriodEnd: true }));

    expect(standing.label).toBe("Cancelled");
    expect(standing.tone).toBe("ending");
    expect(standing.detail).toMatch(/runs until 2026-08-30 and does not renew/i);
    expect(standing.detail).not.toMatch(/renews automatically/i);
  });

  it("names the next charge date when it does renew", () => {
    const standing = planStanding(sub());

    expect(standing.label).toBe("Renews automatically");
    expect(standing.tone).toBe("renewing");
    expect(standing.detail).toMatch(/charged again on 2026-08-30/i);
  });

  it("distinguishes a failed payment, which is neither fine nor over", () => {
    // Pro deliberately stays on while Stripe retries, so the copy has to explain a middle state
    // rather than read as a threat or as business as usual.
    const standing = planStanding(sub({ status: "past_due" }));

    expect(standing.label).toBe("Payment failed");
    expect(standing.tone).toBe("attention");
    expect(standing.detail).toMatch(/stays on while it does/i);
  });

  it.each([
    ["paused", "Paused"],
    ["canceled", "Ended"],
    ["incomplete_expired", "Ended"],
    ["incomplete", "Not started"],
    ["trialing", "Trial"]
  ])("has a state of its own for %s", (status, label) => {
    expect(planStanding(sub({ status })).label).toBe(label);
  });

  it("promises nothing about money for a status Stripe has not invented yet", () => {
    // Same direction as `planForStatus`: an unknown status must not produce a sentence that turns
    // out to be a claim about a charge.
    const standing = planStanding(sub({ status: "something_new" }));

    expect(standing.tone).toBe("renewing");
    expect(standing.detail).toMatch(/2026-08-30/);
  });

  it("still reads as a sentence when Stripe gave us no date", () => {
    expect(planStanding(sub({ currentPeriodEnd: null })).detail).not.toMatch(/null|undefined/);
    expect(
      planStanding(sub({ cancelAtPeriodEnd: true, currentPeriodEnd: null })).detail
    ).toMatch(/does not renew/i);
  });
});
