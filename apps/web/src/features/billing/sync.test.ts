// The repair for the state that cost a real payment: money taken, webhook never landed, plan still
// free, and nothing in the product able to fix it. This asks Stripe instead of waiting to be told.
//
// What matters here is not that it upgrades — it is *when it refuses to*. A sync that guesses is
// worse than no sync, because it would write an entitlement nobody paid for.
import { describe, it, expect, vi, beforeEach } from "vitest";

const getSubscription = vi.hoisted(() => vi.fn());
const applySubscriptionState = vi.hoisted(() => vi.fn(async () => {}));
const subscriptionsList = vi.hoisted(() => vi.fn());
const configured = vi.hoisted(() => ({ current: true }));
const captured = vi.hoisted(() => ({ paid: [] as { tier: string }[] }));

vi.mock("@/lib/data/store", () => ({ getSubscription, applySubscriptionState }));
// The transport only; `paid.ts` is real, because whether *this* path reports a conversion or a
// repeat is a property of this path (spec 182).
vi.mock("@/features/analytics/server", () => ({
  capture: (name: string, _id: string, properties: { tier: string }) => {
    if (name === "paid") captured.paid.push(properties);
  }
}));
vi.mock("@/lib/stripe", async () => {
  const actual = await vi.importActual<typeof import("@/lib/stripe")>("@/lib/stripe");
  return {
    ...actual,
    stripeConfigured: () => configured.current,
    stripe: () => ({ subscriptions: { list: subscriptionsList } })
  };
});

import { PLAN_FRESH_FOR_MS, planWithStripe, syncPlanFromStripe } from "./sync";

const record = {
  organizationId: "org1",
  customerId: "cus_1",
  subscriptionId: null,
  status: "incomplete",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  updatedAt: new Date(Date.now() - PLAN_FRESH_FOR_MS * 10).toISOString()
};

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    created: 1_700_000_000,
    cancel_at_period_end: false,
    // What `paidTier` reads, as Stripe actually sends it (spec 182).
    items: {
      data: [{ current_period_end: 1_800_000_000, price: { recurring: { interval: "month" } } }]
    },
    discounts: [],
    ...overrides
  };
}

describe("syncPlanFromStripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configured.current = true;
    captured.paid = [];
    getSubscription.mockResolvedValue(record);
    subscriptionsList.mockResolvedValue({ data: [subscription()] });
  });

  it("reports a conversion when this is the reconciliation that grants Pro", async () => {
    // The row said `incomplete` before the write — a founder whose webhook never arrived, which is
    // the whole reason this path exists. That is a real customer arriving, and the funnel says so.
    await syncPlanFromStripe("org1");

    expect(captured.paid).toEqual([{ tier: "monthly" }]);
  });

  it("reports nothing when the organization was already on Pro", async () => {
    // Every billing screen reconciles. Without this, opening Settings twice would be two customers.
    getSubscription.mockResolvedValue({ ...record, status: "active" });

    await syncPlanFromStripe("org1");

    expect(captured.paid).toEqual([]);
  });

  it("grants Pro from what Stripe reports, not from what a browser claims", async () => {
    await expect(syncPlanFromStripe("org1")).resolves.toBe("pro");

    expect(subscriptionsList).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_1", status: "all" })
    );
    expect(applySubscriptionState).toHaveBeenCalledWith(
      "org1",
      expect.objectContaining({ plan: "pro", subscriptionId: "sub_1", status: "active" })
    );
  });

  it("applies a cancellation the same way, so the sync is not an upgrade button in disguise", async () => {
    subscriptionsList.mockResolvedValue({ data: [subscription({ status: "canceled" })] });

    await expect(syncPlanFromStripe("org1")).resolves.toBe("free");
    expect(applySubscriptionState).toHaveBeenCalledWith(
      "org1",
      expect.objectContaining({ plan: "free" })
    );
  });

  it("prefers the subscription that entitles them to Pro over an abandoned attempt", async () => {
    // A first Checkout left an `incomplete` subscription behind; the second one succeeded. Taking the
    // newest blindly would report free to someone who is paying.
    subscriptionsList.mockResolvedValue({
      data: [
        subscription({ id: "sub_paid", status: "active", created: 1 }),
        subscription({ id: "sub_abandoned", status: "incomplete", created: 2 })
      ]
    });

    await expect(syncPlanFromStripe("org1")).resolves.toBe("pro");
    expect(applySubscriptionState).toHaveBeenCalledWith(
      "org1",
      expect.objectContaining({ subscriptionId: "sub_paid" })
    );
  });

  it("writes nothing when the organization has never been to Checkout", async () => {
    getSubscription.mockResolvedValue(null);

    await expect(syncPlanFromStripe("org1")).resolves.toBe("unknown");
    expect(subscriptionsList).not.toHaveBeenCalled();
    expect(applySubscriptionState).not.toHaveBeenCalled();
  });

  it("writes nothing when the customer has no subscriptions at all", async () => {
    subscriptionsList.mockResolvedValue({ data: [] });

    await expect(syncPlanFromStripe("org1")).resolves.toBe("unknown");
    expect(applySubscriptionState).not.toHaveBeenCalled();
  });

  it("does nothing at all when payment is not configured", async () => {
    configured.current = false;

    await expect(syncPlanFromStripe("org1")).resolves.toBe("unknown");
    expect(getSubscription).not.toHaveBeenCalled();
  });

  it("reports rather than throws when Stripe is unreachable", async () => {
    // It runs on the screen a founder opens to confirm a payment. Taking that screen down with it
    // would turn a delay into an outage.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    subscriptionsList.mockRejectedValue(new Error("connection reset"));

    await expect(syncPlanFromStripe("org1")).resolves.toBe("unknown");
    expect(applySubscriptionState).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});

// The screens reconcile themselves, so nobody has to know a "check again" button exists. What that
// must not become is a Stripe call per page view.
describe("planWithStripe", () => {
  const org = { id: "org1", plan: "free" as const };

  beforeEach(() => {
    vi.clearAllMocks();
    configured.current = true;
    subscriptionsList.mockResolvedValue({ data: [subscription()] });
  });

  it("asks Stripe when what we hold has gone stale, and renders what it says", async () => {
    getSubscription
      .mockResolvedValueOnce(record)
      .mockResolvedValueOnce({ ...record, status: "active" });

    await expect(planWithStripe(org)).resolves.toMatchObject({ plan: "pro" });
    expect(subscriptionsList).toHaveBeenCalledTimes(1);
  });

  it("leaves a recently reconciled row alone", async () => {
    getSubscription.mockResolvedValue({ ...record, updatedAt: new Date().toISOString() });

    await expect(planWithStripe(org)).resolves.toMatchObject({ plan: "free" });
    expect(subscriptionsList).not.toHaveBeenCalled();
  });

  it("asks nothing at all for an organization that never started a payment", async () => {
    getSubscription.mockResolvedValue(null);

    await expect(planWithStripe(org)).resolves.toEqual({ plan: "free", subscription: null });
    expect(subscriptionsList).not.toHaveBeenCalled();
  });

  it("keeps the plan we already had when Stripe has nothing to say", async () => {
    // Not a downgrade: "Stripe knows nothing about this" and "Stripe says they are not paying" are
    // different answers, and only the second one may change an entitlement.
    getSubscription.mockResolvedValue(record);
    subscriptionsList.mockResolvedValue({ data: [] });

    await expect(planWithStripe({ id: "org1", plan: "pro" })).resolves.toMatchObject({
      plan: "pro"
    });
  });
});
