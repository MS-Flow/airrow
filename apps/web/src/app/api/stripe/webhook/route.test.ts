// The webhook is a public endpoint that grants paid access, so the things worth pinning down are the
// ones that would let someone through, or let Stripe's retries do damage (spec 99):
//
//   - an unsigned or wrongly-signed request changes nothing, and is refused before the body matters
//   - the same event twice is one upgrade, because Stripe delivers at least once
//   - a failed payment does not downgrade, because Stripe is still retrying
//   - an event for a customer we do not know changes nothing
//
// Stripe's SDK is mocked: §V forbids the network, and the signature check is Stripe's code, not
// ours — what this file asserts is that we *call* it, before doing anything, and honour the answer.
import { describe, it, expect, vi, beforeEach } from "vitest";

const constructEventAsync = vi.hoisted(() => vi.fn());
const retrieve = vi.hoisted(() => vi.fn());
const claimStripeEvent = vi.hoisted(() => vi.fn(async () => true));
const orgForStripeCustomer = vi.hoisted(() => vi.fn(async (): Promise<string | null> => "org1"));
const applySubscriptionState = vi.hoisted(() => vi.fn(async () => {}));
const releaseStripeEvent = vi.hoisted(() => vi.fn(async () => {}));
/** The row as it stood before the write, which is what tells `paid` a purchase from a renewal. */
const getSubscription = vi.hoisted(() =>
  vi.fn(async (): Promise<{ status: string } | null> => null)
);
const captured = vi.hoisted(() => ({ paid: [] as { tier: string }[] }));

vi.mock("@/lib/stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stripe")>();
  return {
    ...actual,
    stripeConfigured: () => true,
    stripeWebhookSecret: () => "whsec_test",
    stripe: () => ({
      webhooks: { constructEventAsync },
      subscriptions: { retrieve }
    })
  };
});
vi.mock("@/lib/data/store", () => ({
  claimStripeEvent,
  orgForStripeCustomer,
  applySubscriptionState,
  getSubscription,
  releaseStripeEvent
}));
// The transport only. `paid.ts` itself is real, because whether this endpoint reports a *conversion*
// rather than a redelivery is a property of the endpoint (spec 182).
vi.mock("@/features/analytics/server", () => ({
  capture: (name: string, _id: string, properties: { tier: string }) => {
    if (name === "paid") captured.paid.push(properties);
  }
}));

import { POST } from "./route";

/** A subscription as Stripe sends it, with the period end where the current API puts it. */
function subscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    cancel_at_period_end: false,
    // `price` and `discounts` are what `paidTier` reads to tell monthly from yearly from a founding
    // place (spec 182). Stripe sends them on every subscription; the fixture now does too.
    items: {
      data: [{ current_period_end: 1790000000, price: { recurring: { interval: "year" } } }]
    },
    discounts: [],
    ...overrides
  };
}

function request(signed = true): Request {
  return new Request("https://airrow.test/api/stripe/webhook", {
    method: "POST",
    headers: signed ? { "stripe-signature": "t=1,v1=deadbeef" } : {},
    body: JSON.stringify({ hello: "world" })
  });
}

function event(type: string, object: unknown, id = "evt_1") {
  return { id, type, data: { object } };
}

describe("stripe webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    claimStripeEvent.mockResolvedValue(true);
    orgForStripeCustomer.mockResolvedValue("org1");
    applySubscriptionState.mockResolvedValue(undefined);
    releaseStripeEvent.mockResolvedValue(undefined);
    getSubscription.mockResolvedValue(null);
    captured.paid = [];
  });

  describe("authorization", () => {
    it("refuses a request with no signature at all", async () => {
      const res = await POST(request(false));

      expect(res.status).toBe(400);
      expect(constructEventAsync).not.toHaveBeenCalled();
      expect(applySubscriptionState).not.toHaveBeenCalled();
    });

    it("refuses a request whose signature does not verify, and writes nothing", async () => {
      constructEventAsync.mockRejectedValue(new Error("no match"));

      const res = await POST(request());

      expect(res.status).toBe(400);
      expect(claimStripeEvent).not.toHaveBeenCalled();
      expect(applySubscriptionState).not.toHaveBeenCalled();
    });

    it("says nothing useful about why it refused", async () => {
      // An endpoint that explains the failure teaches whoever is probing it how to succeed.
      constructEventAsync.mockRejectedValue(new Error("timestamp outside tolerance"));

      const body = await (await POST(request())).json();

      expect(JSON.stringify(body)).not.toMatch(/timestamp|tolerance/i);
    });

    it("verifies against the raw body, not a re-serialised one", async () => {
      // Stripe signs the bytes it sent. Parsing and re-encoding changes them and every signature
      // fails — the classic way this endpoint breaks.
      const raw = JSON.stringify({ hello: "world" });
      constructEventAsync.mockResolvedValue(event("customer.subscription.updated", subscription()));

      await POST(request());

      expect(constructEventAsync).toHaveBeenCalledWith(raw, expect.any(String), "whsec_test");
    });
  });

  describe("idempotency", () => {
    it("applies an event the first time it arrives", async () => {
      constructEventAsync.mockResolvedValue(event("customer.subscription.updated", subscription()));

      await POST(request());

      expect(applySubscriptionState).toHaveBeenCalledWith(
        "org1",
        expect.objectContaining({ plan: "pro", subscriptionId: "sub_1" })
      );
    });

    it("does nothing the second time, and still answers 200", async () => {
      // A non-2xx here would make Stripe retry what we have already done, forever.
      constructEventAsync.mockResolvedValue(event("customer.subscription.updated", subscription()));
      claimStripeEvent.mockResolvedValue(false);

      const res = await POST(request());

      expect(res.status).toBe(200);
      expect(applySubscriptionState).not.toHaveBeenCalled();
    });

    it("hands the claim back when applying fails, so the retry is a real second attempt", async () => {
      // The bug this guards, found by /analyze: claim, then fail, then have Stripe retry into a
      // "duplicate — already handled" answer. The upgrade a founder paid for disappears silently and
      // permanently. The claim exists to stop concurrent deliveries doing the same work, not to
      // stop the redelivery that exists because the work did not happen.
      constructEventAsync.mockResolvedValue(event("customer.subscription.updated", subscription()));
      applySubscriptionState.mockRejectedValue(new Error("connection reset"));

      await expect(POST(request())).rejects.toThrow(/connection reset/);

      expect(releaseStripeEvent).toHaveBeenCalledWith("evt_1");
    });

    it("hands the claim back when reading the subscription fails", async () => {
      // The same window, one call earlier: Stripe itself can be down when we call back on checkout.
      constructEventAsync.mockResolvedValue(
        event("checkout.session.completed", {
          customer: "cus_1",
          mode: "subscription",
          subscription: "sub_1"
        })
      );
      retrieve.mockRejectedValue(new Error("stripe unavailable"));

      await expect(POST(request())).rejects.toThrow(/stripe unavailable/);

      expect(releaseStripeEvent).toHaveBeenCalledWith("evt_1");
    });

    it("keeps the claim when the event simply did not apply to anything", async () => {
      // An unknown event type is a finished, correct outcome — not a failure. Releasing here would
      // make Stripe redeliver something we have already decided to ignore.
      constructEventAsync.mockResolvedValue(event("payout.paid", { id: "po_1" }));

      await POST(request());

      expect(releaseStripeEvent).not.toHaveBeenCalled();
    });

    it("claims the event before applying it", async () => {
      // The other order leaves a window where two concurrent redeliveries both pass the check.
      const order: string[] = [];
      claimStripeEvent.mockImplementation(async () => {
        order.push("claim");
        return true;
      });
      applySubscriptionState.mockImplementation(async () => {
        order.push("apply");
      });
      constructEventAsync.mockResolvedValue(event("customer.subscription.updated", subscription()));

      await POST(request());

      expect(order).toEqual(["claim", "apply"]);
    });
  });

  describe("what each event means", () => {
    it("reads the subscription back on checkout, rather than assuming its state", async () => {
      constructEventAsync.mockResolvedValue(
        event("checkout.session.completed", {
          customer: "cus_1",
          mode: "subscription",
          subscription: "sub_1"
        })
      );
      retrieve.mockResolvedValue(subscription());

      await POST(request());

      expect(retrieve).toHaveBeenCalledWith("sub_1");
      expect(applySubscriptionState).toHaveBeenCalledWith(
        "org1",
        expect.objectContaining({ plan: "pro" })
      );
    });

    it("does not downgrade on a failed payment", async () => {
      // Stripe retries for days. This is the assertion that stops a card expiry from reading as a
      // cancellation on the first decline.
      constructEventAsync.mockResolvedValue(
        event("invoice.payment_failed", { customer: "cus_1", id: "in_1" })
      );

      await POST(request());

      expect(applySubscriptionState).not.toHaveBeenCalled();
    });

    it("keeps a past_due subscription on Pro", async () => {
      constructEventAsync.mockResolvedValue(
        event("customer.subscription.updated", subscription({ status: "past_due" }))
      );

      await POST(request());

      expect(applySubscriptionState).toHaveBeenCalledWith(
        "org1",
        expect.objectContaining({ plan: "pro" })
      );
    });

    it("ends Pro when the subscription is actually deleted", async () => {
      constructEventAsync.mockResolvedValue(
        event("customer.subscription.deleted", subscription({ status: "canceled" }))
      );

      await POST(request());

      expect(applySubscriptionState).toHaveBeenCalledWith(
        "org1",
        expect.objectContaining({ plan: "free" })
      );
    });

    it("carries cancel-at-period-end through, so settings can say Pro is still running", async () => {
      constructEventAsync.mockResolvedValue(
        event("customer.subscription.updated", subscription({ cancel_at_period_end: true }))
      );

      await POST(request());

      expect(applySubscriptionState).toHaveBeenCalledWith(
        "org1",
        expect.objectContaining({ plan: "pro", cancelAtPeriodEnd: true })
      );
    });

    it("ignores an event type it does not handle, without erroring", async () => {
      constructEventAsync.mockResolvedValue(event("payout.paid", { id: "po_1" }));

      const res = await POST(request());

      expect(res.status).toBe(200);
      expect(applySubscriptionState).not.toHaveBeenCalled();
    });

    it("changes nothing for a customer it has never seen", async () => {
      constructEventAsync.mockResolvedValue(event("customer.subscription.updated", subscription()));
      orgForStripeCustomer.mockResolvedValue(null);

      const res = await POST(request());

      expect(res.status).toBe(200);
      expect(applySubscriptionState).not.toHaveBeenCalled();
    });
  });

  // The funnel's last step, which is the one with the most ways to overcount (spec 182).
  describe("the paid event", () => {
    it("reports a conversion the first time an organization becomes Pro", async () => {
      constructEventAsync.mockResolvedValue(
        event("customer.subscription.updated", subscription({ discounts: ["di_1"] }))
      );

      await POST(request());

      expect(captured.paid).toEqual([{ tier: "founding" }]);
    });

    it("distinguishes an undiscounted yearly subscription from a founding place", async () => {
      constructEventAsync.mockResolvedValue(event("customer.subscription.updated", subscription()));

      await POST(request());

      expect(captured.paid).toEqual([{ tier: "yearly" }]);
    });

    it("reports nothing when the organization was already paying", async () => {
      // A renewal, or Stripe redelivering an event whose twin already landed. Both find a row that
      // says Pro, and neither is a new customer.
      getSubscription.mockResolvedValue({ status: "active" });
      constructEventAsync.mockResolvedValue(event("customer.subscription.updated", subscription()));

      await POST(request());

      expect(captured.paid).toEqual([]);
    });

    it("reports nothing on a cancellation", async () => {
      getSubscription.mockResolvedValue({ status: "active" });
      constructEventAsync.mockResolvedValue(
        event("customer.subscription.deleted", subscription({ status: "canceled" }))
      );

      await POST(request());

      expect(captured.paid).toEqual([]);
    });

    it("reads the row before the write, not after", async () => {
      // The other order reads back the row this very request just wrote, which always says Pro —
      // and the event would then never fire at all.
      const order: string[] = [];
      getSubscription.mockImplementation(async () => {
        order.push("read");
        return null;
      });
      applySubscriptionState.mockImplementation(async () => {
        order.push("write");
      });
      constructEventAsync.mockResolvedValue(event("customer.subscription.updated", subscription()));

      await POST(request());

      expect(order).toEqual(["read", "write"]);
    });

    it("still answers 200 when the analytics helper throws", async () => {
      // The property everything else here depends on: Stripe must never be told a successful
      // payment failed, because it would retry one that already worked.
      vi.spyOn(console, "error").mockImplementation(() => {});
      constructEventAsync.mockResolvedValue(
        // A subscription with no items at all — the shape that would throw on a naive read.
        event("customer.subscription.updated", subscription({ items: { data: [] } }))
      );

      const res = await POST(request());

      expect(res.status).toBe(200);
      expect(applySubscriptionState).toHaveBeenCalled();
    });
  });
});
