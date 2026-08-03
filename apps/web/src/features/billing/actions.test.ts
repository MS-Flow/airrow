// Checkout has one failure mode that costs a founder money and gives them nothing, so it is the one
// worth pinning down: paying against a Stripe customer the webhook cannot resolve to an organization.
//
// `linkStripeCustomer` ignores a duplicate insert, so if two upgrade clicks race, only one customer
// id is recorded. The loser used to be handed to Checkout anyway — the founder pays, the webhook
// looks the customer up, finds nothing, and Pro is never granted.
import { describe, it, expect, vi, beforeEach } from "vitest";

const requireSession = vi.hoisted(() => vi.fn());
const getSubscription = vi.hoisted(() => vi.fn());
const linkStripeCustomer = vi.hoisted(() => vi.fn(async () => {}));
const customersCreate = vi.hoisted(() => vi.fn());
const sessionsCreate = vi.hoisted(() => vi.fn());
const portalCreate = vi.hoisted(() => vi.fn());
const stripeCouponFounding = vi.hoisted(() => vi.fn<() => string | null>(() => "founding100"));
const analytics = vi.hoisted(() => ({
  captures: [] as { name: string; distinctId: string; properties: Record<string, unknown> }[]
}));

vi.mock("@/features/analytics/server", () => ({
  capture: (name: string, distinctId: string, properties: Record<string, unknown>) => {
    analytics.captures.push({ name, distinctId, properties });
  }
}));
vi.mock("@/lib/auth", () => ({ requireSession }));
vi.mock("next/headers", () => ({ headers: async () => new Map([["host", "airrow.test"]]) }));
vi.mock("@/lib/data/store", () => ({ getSubscription, linkStripeCustomer }));
vi.mock("@/lib/stripe", () => ({
  stripeConfigured: () => true,
  stripePrices: () => [
    { id: "price_monthly", interval: "month" },
    { id: "price_yearly", interval: "year" }
  ],
  stripeCouponFounding,
  stripe: () => ({
    customers: { create: customersCreate },
    checkout: { sessions: { create: sessionsCreate } },
    billingPortal: { sessions: { create: portalCreate } }
  })
}));

import { openBillingPortalAction, startCheckoutAction } from "./actions";

const subscription = (customerId: string) => ({
  organizationId: "org1",
  customerId,
  subscriptionId: null,
  status: "incomplete",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false
});

function form(interval?: string): FormData {
  const f = new FormData();
  if (interval) f.set("interval", interval);
  return f;
}

describe("startCheckoutAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSession.mockResolvedValue({
      user: { id: "u1", email: "f@example.com", name: "F", createdAt: "2026-01-01T00:00:00.000Z" },
      org: { id: "org1", name: "Workspace", kind: "personal", createdBy: "u1", plan: "free" }
    });
    getSubscription.mockResolvedValue(null);
    customersCreate.mockResolvedValue({ id: "cus_new" });
    sessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.test/s/1" });
    stripeCouponFounding.mockReturnValue("founding100");
    analytics.captures = [];
  });

  // The funnel's second-to-last step (spec 182). It had no test at all until `/analyze` noticed:
  // the call typechecked, which is not the same as firing.
  it("records the checkout, with the interval that was chosen", async () => {
    await startCheckoutAction(form("month"));

    expect(analytics.captures).toEqual([
      {
        name: "checkout_started",
        distinctId: "org_org1",
        properties: { interval: "month", founding: false }
      }
    ]);
  });

  it("marks a yearly checkout as founding, because that is where the coupon rides", async () => {
    await startCheckoutAction(form("year"));

    expect(analytics.captures[0]?.properties).toEqual({ interval: "year", founding: true });
  });

  it("records the checkout even when Stripe refuses to open it", async () => {
    // `checkout_started → paid` is the ratio this event exists for, so an abandoned or failed
    // checkout is exactly the case it has to count. Recording only the successes would make the
    // conversion rate read as 100%.
    sessionsCreate.mockRejectedValue(new Error("Stripe is down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await startCheckoutAction(form("month"));

    expect(result.error).toBeTruthy();
    expect(analytics.captures).toHaveLength(1);
  });

  it("reuses the customer already recorded instead of creating another", async () => {
    getSubscription.mockResolvedValue(subscription("cus_existing"));

    await startCheckoutAction(form("month"));

    expect(customersCreate).not.toHaveBeenCalled();
    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_existing" })
    );
  });

  it("checks out against the recorded customer when two requests raced", async () => {
    // First read finds nothing, so this request creates `cus_new`. By the time it writes, another
    // request has already recorded `cus_winner` and the duplicate insert is ignored. Checkout has to
    // follow the database, not the local variable.
    getSubscription.mockResolvedValueOnce(null).mockResolvedValueOnce(subscription("cus_winner"));

    await startCheckoutAction(form("month"));

    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_winner" })
    );
  });

  it("creates the customer idempotently, keyed on the organization", async () => {
    await startCheckoutAction(form("month"));

    expect(customersCreate).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { organization_id: "org1" } }),
      { idempotencyKey: "airrow-customer-org1" }
    );
  });

  it("takes the price from configuration, never from the form", async () => {
    // A posted price id would let anyone subscribe at any price in the Stripe account, including a
    // zero-amount one.
    await startCheckoutAction(form("price_free_lol"));

    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ line_items: [{ price: "price_monthly", quantity: 1 }] })
    );
  });

  it("returns through the route that reconciles with Stripe, not straight to Settings", async () => {
    // Spec 100: the plan has to be right when the founder lands. Returning to Settings meant showing
    // whatever the webhook had managed to write by then, which on a bad day was nothing at all.
    await startCheckoutAction(form("month"));

    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ success_url: "https://airrow.test/app/upgrade/return" })
    );
  });

  it("never asks Checkout to grant anything itself", async () => {
    // The webhook is the only writer of the plan. Checkout only takes money.
    await startCheckoutAction(form("month"));

    const args = sessionsCreate.mock.calls[0]?.[0];
    expect(args).toMatchObject({ mode: "subscription" });
    expect(JSON.stringify(args)).not.toMatch(/"plan"/);
  });

  it("reports a missing checkout URL rather than redirecting nowhere", async () => {
    sessionsCreate.mockResolvedValue({ url: null });

    const state = await startCheckoutAction(form("month"));

    expect(state.error).toMatch(/did not return a checkout URL/i);
    expect(state.url).toBeUndefined();
  });

  it("reports a Stripe failure instead of throwing it at the founder", async () => {
    // What a misconfigured price id did: `No such price: ':price_…'` came back from Stripe, the action
    // rejected, and the founder got a Next runtime error page on the button they pressed to pay.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    sessionsCreate.mockRejectedValue(new Error("No such price: ':price_123'"));

    const state = await startCheckoutAction(form("month"));

    expect(state.url).toBeUndefined();
    expect(state.error).toMatch(/nothing has been charged/i);
    // The detail a developer needs is not lost, it just goes somewhere a customer never looks.
    expect(logged).toHaveBeenCalledWith(expect.stringMatching(/checkout failed/i), "No such price: ':price_123'");
    logged.mockRestore();
  });

  // The founding-member offer (spec 179). Stripe holds the cap; these pin down that we attach the
  // coupon to the right price, never take one from the browser, and translate "sold out" into
  // something other than "try again in a moment".
  it("attaches the founding coupon to the yearly price", async () => {
    await startCheckoutAction(form("year"));

    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_yearly", quantity: 1 }],
        discounts: [{ coupon: "founding100" }]
      })
    );
  });

  it("does not discount the monthly price", async () => {
    // The offer is the annual deal. A monthly subscription taking the same coupon would hand out the
    // founding discount every month to anyone who clicked the other button.
    await startCheckoutAction(form("month"));

    expect(sessionsCreate.mock.calls[0]?.[0]).not.toHaveProperty("discounts");
  });

  it("takes the coupon from configuration, never from the form", async () => {
    const f = new FormData();
    f.set("interval", "year");
    f.set("coupon", "FREE_FOREVER");

    await startCheckoutAction(f);

    expect(sessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ discounts: [{ coupon: "founding100" }] })
    );
  });

  it("sells the yearly price undiscounted when no founding coupon is configured", async () => {
    stripeCouponFounding.mockReturnValue(null);

    await startCheckoutAction(form("year"));

    expect(sessionsCreate.mock.calls[0]?.[0]).not.toHaveProperty("discounts");
  });

  it("says the founding places are gone when Stripe reports the coupon exhausted", async () => {
    // The 101st buyer. "Stripe couldn't open that page just now, try again in a moment" is advice
    // that can never come true, on the one failure that is not an outage.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    sessionsCreate.mockRejectedValue(
      new Error("This coupon has reached its maximum number of redemptions.")
    );

    const state = await startCheckoutAction(form("year"));

    expect(state.error).toMatch(/last founding place/i);
    expect(state.error).toMatch(/nothing has been charged/i);
    logged.mockRestore();
  });

  it("still reads a mistyped coupon id as a Stripe failure, not a sold-out offer", async () => {
    // Our bug, not the founder's missed chance. Telling them the offer ended would be a lie that
    // costs a sale and hides the misconfiguration.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    sessionsCreate.mockRejectedValue(new Error("No such coupon: 'foundng100'"));

    const state = await startCheckoutAction(form("year"));

    expect(state.error).toMatch(/couldn't open that page/i);
    expect(state.error).not.toMatch(/founding place/i);
    logged.mockRestore();
  });

  it("reports a failure while creating the customer the same way", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    customersCreate.mockRejectedValue(new Error("Invalid API Key provided"));

    const state = await startCheckoutAction(form("month"));

    expect(state.error).toMatch(/nothing has been charged/i);
    logged.mockRestore();
  });
});

describe("openBillingPortalAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSession.mockResolvedValue({
      user: { id: "u1", email: "f@example.com", name: "F", createdAt: "2026-01-01T00:00:00.000Z" },
      org: { id: "org1", name: "Workspace", kind: "personal", createdBy: "u1", plan: "pro" }
    });
  });

  it("says so plainly when there is no billing account yet", async () => {
    getSubscription.mockResolvedValue(null);

    const state = await openBillingPortalAction();

    expect(state.error).toMatch(/no billing account/i);
    expect(portalCreate).not.toHaveBeenCalled();
  });

  it("opens the portal for the organization's own customer", async () => {
    getSubscription.mockResolvedValue(subscription("cus_existing"));
    portalCreate.mockResolvedValue({ url: "https://billing.stripe.test/p/1" });

    const state = await openBillingPortalAction();

    expect(portalCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_existing" })
    );
    expect(state.url).toBe("https://billing.stripe.test/p/1");
  });
});
