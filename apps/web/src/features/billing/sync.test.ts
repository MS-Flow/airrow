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

vi.mock("@/lib/data/store", () => ({ getSubscription, applySubscriptionState }));
vi.mock("@/lib/stripe", async () => {
  const actual = await vi.importActual<typeof import("@/lib/stripe")>("@/lib/stripe");
  return {
    ...actual,
    stripeConfigured: () => configured.current,
    stripe: () => ({ subscriptions: { list: subscriptionsList } })
  };
});

import { syncPlanFromStripe } from "./sync";

const record = { organizationId: "org1", customerId: "cus_1", subscriptionId: null, status: "incomplete", currentPeriodEnd: null, cancelAtPeriodEnd: false };

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    created: 1_700_000_000,
    cancel_at_period_end: false,
    items: { data: [{ current_period_end: 1_800_000_000 }] },
    ...overrides
  };
}

describe("syncPlanFromStripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configured.current = true;
    getSubscription.mockResolvedValue(record);
    subscriptionsList.mockResolvedValue({ data: [subscription()] });
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
