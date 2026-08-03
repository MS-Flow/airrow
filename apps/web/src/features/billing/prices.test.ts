// The pricing card's figures (spec 179). What matters here is that a number on a public page is
// either Stripe's or absent: never invented, never stale-by-guess, never a placeholder shaped like a
// price. The failure paths get as much attention as the happy one, because the happy one is the only
// path that is obvious when it breaks.
import { describe, it, expect, vi, beforeEach } from "vitest";

const stripeConfigured = vi.hoisted(() => vi.fn(() => true));
const stripePrices = vi.hoisted(() => vi.fn());
const stripeCouponFounding = vi.hoisted(() => vi.fn<() => string | null>(() => "founding100"));
const priceRetrieve = vi.hoisted(() => vi.fn());
const couponRetrieve = vi.hoisted(() => vi.fn());

vi.mock("@/lib/stripe", () => ({
  stripeConfigured,
  stripePrices,
  stripeCouponFounding,
  stripe: () => ({
    prices: { retrieve: priceRetrieve },
    coupons: { retrieve: couponRetrieve }
  })
}));

// The cache is Next's, and it is not what this file is testing. Unwrapping it keeps every assertion
// below about what Stripe said rather than about what a cache remembered — except for `cache.throws`,
// which reproduces the wrapper failing before the wrapped function is ever called.
const cache = vi.hoisted(() => ({ throws: false }));

vi.mock("next/cache", () => ({
  unstable_cache:
    <A extends unknown[], R>(fn: (...args: A) => R) =>
    (...args: A): R => {
      if (cache.throws) throw new Error("no request scope");
      return fn(...args);
    }
}));

import {
  formatAmount,
  seatsRemaining,
  discounted,
  upgradeAmounts,
  readPricing,
  NO_PRICING
} from "./prices";

describe("discounted", () => {
  it("takes a percentage off", () => {
    expect(discounted(11999, { percent_off: 20, amount_off: null })).toBe(9599);
  });

  it("rounds rather than truncates", () => {
    // Stripe would charge $95.99; advertising $95.98 is a figure nobody is billed.
    expect(discounted(11999, { percent_off: 20, amount_off: null })).toBe(9599);
    expect(discounted(999, { percent_off: 33, amount_off: null })).toBe(669);
  });

  it("takes a fixed amount off", () => {
    expect(discounted(11999, { percent_off: null, amount_off: 2000 })).toBe(9999);
  });

  it("never goes below zero", () => {
    expect(discounted(1000, { percent_off: null, amount_off: 5000 })).toBe(0);
  });

  it("reports nothing for a coupon carrying neither kind of discount", () => {
    // Rather than falling back to the list price, which would advertise the founding deal at the rate
    // you get for declining it.
    expect(discounted(11999, { percent_off: null, amount_off: null })).toBeNull();
  });
});

describe("formatAmount", () => {
  it("formats minor units as a currency amount", () => {
    expect(formatAmount(1499, "usd")).toBe("$14.99");
    expect(formatAmount(14999, "usd")).toBe("$149.99");
  });

  it("drops the trailing zeroes on a whole amount", () => {
    // "$15.00" reads like a form field; "$15" reads like a price.
    expect(formatAmount(1500, "usd")).toBe("$15");
  });

  it("uses the currency Stripe reported rather than assuming dollars", () => {
    expect(formatAmount(1499, "eur")).toContain("14.99");
    expect(formatAmount(1499, "eur")).not.toContain("$");
  });
});

describe("seatsRemaining", () => {
  it("counts down from the cap", () => {
    expect(seatsRemaining(100, 12)).toBe(88);
  });

  it("never goes below zero", () => {
    // Stripe's own reporting can show more redemptions than the cap. "-2 places left" is worse on a
    // pricing card than sold out.
    expect(seatsRemaining(100, 103)).toBe(0);
  });
});

describe("upgradeAmounts", () => {
  const pricing = {
    prices: [
      { interval: "month" as const, amount: "$11.99" },
      { interval: "year" as const, amount: "$119.99" }
    ],
    founding: { total: 100, remaining: 40, amount: "$95.99", listAmount: "$119.99" }
  };

  it("bills yearly at the founding rate while places remain", async () => {
    expect(upgradeAmounts(pricing, ["month", "year"])).toEqual([
      { interval: "month", amount: "$11.99", wasAmount: null },
      { interval: "year", amount: "$95.99", wasAmount: "$119.99" }
    ]);
  });

  it("falls back to the list price once the offer is gone", async () => {
    // Which is then what Checkout actually charges, because the coupon no longer applies — and
    // there is nothing left to strike through, because that figure is now simply the price.
    const soldOut = {
      ...pricing,
      founding: { total: 100, remaining: 0, amount: "$95.99", listAmount: "$119.99" }
    };

    expect(upgradeAmounts(soldOut, ["year"])).toEqual([
      { interval: "year", amount: "$119.99", wasAmount: null }
    ]);
  });

  it("never discounts monthly, which the coupon does not cover", async () => {
    expect(upgradeAmounts(pricing, ["month"])).toEqual([
      { interval: "month", amount: "$11.99", wasAmount: null }
    ]);
  });

  it("reports no amounts at all when Stripe could not be asked", async () => {
    expect(upgradeAmounts(NO_PRICING, ["month", "year"])).toEqual([
      { interval: "month", amount: null, wasAmount: null },
      { interval: "year", amount: null, wasAmount: null }
    ]);
  });

  it("shows no strikethrough when the list price could not be read", async () => {
    // The founding figure renders alone. An empty struck-through element beside a real price reads
    // as a bug, and a missing saving reads as no offer — the second is merely less informative.
    const noList = {
      ...pricing,
      founding: { total: 100, remaining: 40, amount: "$95.99", listAmount: null }
    };

    expect(upgradeAmounts(noList, ["year"])).toEqual([
      { interval: "year", amount: "$95.99", wasAmount: null }
    ]);
  });

  it("shows no strikethrough when the coupon discounts nothing", async () => {
    // A zero-value coupon is not an offer, and `$119.99 was $119.99` is a sentence nobody believes.
    const noSaving = {
      ...pricing,
      founding: { total: 100, remaining: 40, amount: "$119.99", listAmount: "$119.99" }
    };

    expect(upgradeAmounts(noSaving, ["year"])).toEqual([
      { interval: "year", amount: "$119.99", wasAmount: null }
    ]);
  });
});

describe("readPricing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.throws = false;
    stripeConfigured.mockReturnValue(true);
    stripeCouponFounding.mockReturnValue("founding100");
    stripePrices.mockReturnValue([
      { id: "price_monthly", interval: "month" },
      { id: "price_yearly", interval: "year" }
    ]);
    priceRetrieve.mockImplementation(async (id: string) =>
      id === "price_monthly"
        ? { unit_amount: 1499, currency: "usd" }
        : { unit_amount: 14999, currency: "usd" }
    );
    couponRetrieve.mockResolvedValue({
      valid: true,
      max_redemptions: 100,
      times_redeemed: 12,
      percent_off: 20,
      amount_off: null
    });
  });

  it("reports the amounts Stripe holds for the configured prices", async () => {
    const pricing = await readPricing();

    expect(pricing.prices).toEqual([
      { interval: "month", amount: "$14.99" },
      { interval: "year", amount: "$149.99" }
    ]);
  });

  it("reports the founding places left, as Stripe counts them", async () => {
    const pricing = await readPricing();

    expect(pricing.founding).toMatchObject({ total: 100, remaining: 88 });
  });

  it("prices the founding offer after the coupon, not at the list price", async () => {
    // The defect this replaces: the card read "88 founding places left at $149.99 a year" while
    // Checkout applied the coupon and charged less. A founding deal advertised at the rate you get
    // for declining it.
    const pricing = await readPricing();

    expect(pricing.founding?.amount).toBe("$119.99");
    // And the list price is still reported separately, untouched.
    expect(pricing.prices).toContainEqual({ interval: "year", amount: "$149.99" });
  });

  it("names no founding amount when the coupon carries no discount to apply", async () => {
    couponRetrieve.mockResolvedValue({
      valid: true,
      max_redemptions: 100,
      times_redeemed: 12,
      percent_off: null,
      amount_off: null
    });

    const pricing = await readPricing();

    expect(pricing.founding).toMatchObject({ total: 100, remaining: 88, amount: null });
  });

  it("names no founding amount when no yearly price is configured", async () => {
    // The coupon rides on the annual price. Without one there is nothing for it to discount.
    stripePrices.mockReturnValue([{ id: "price_monthly", interval: "month" }]);

    expect((await readPricing()).founding?.amount).toBeNull();
  });

  it("keeps the prices when the coupon is gone, and drops only the offer", async () => {
    // Found live: `STRIPE_COUPON_FOUNDING` held an id no longer in the Stripe account, so the coupon
    // read threw and took both list prices with it — a pricing card with no figure anywhere on it
    // because a promotion was misconfigured. A stale coupon id must read as "no offer running".
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    couponRetrieve.mockRejectedValue(new Error("No such coupon: 'gone'"));

    const pricing = await readPricing();

    expect(pricing.prices).toEqual([
      { interval: "month", amount: "$14.99" },
      { interval: "year", amount: "$149.99" }
    ]);
    expect(pricing.founding).toBeNull();
    expect(logged).toHaveBeenCalledWith(
      expect.stringMatching(/coupon read failed/i),
      "No such coupon: 'gone'"
    );
    logged.mockRestore();
  });

  it("shows nothing at all when Stripe is not configured", async () => {
    // And asks Stripe nothing: an unconfigured deployment should not construct a client, let alone
    // occupy a cache entry with the answer "no".
    stripeConfigured.mockReturnValue(false);

    expect(await readPricing()).toEqual(NO_PRICING);
    expect(priceRetrieve).not.toHaveBeenCalled();
  });

  it("shows nothing rather than failing the page when Stripe cannot be reached", async () => {
    // The landing page is the first thing anyone sees. A Stripe outage costs us a number on a card.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    priceRetrieve.mockRejectedValue(new Error("connection error"));

    expect(await readPricing()).toEqual(NO_PRICING);
    expect(logged).toHaveBeenCalledWith(expect.stringMatching(/pricing read failed/i), "connection error");
    logged.mockRestore();
  });

  it("shows nothing rather than failing the page when the cache itself throws", async () => {
    // Not a hypothetical: the cache wrapper needs a request scope, and a render without one threw
    // straight past `fetchPricing`'s own catch and took the whole page down.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    cache.throws = true;

    expect(await readPricing()).toEqual(NO_PRICING);
    logged.mockRestore();
  });

  it("still prices Pro when no founding coupon is configured", async () => {
    // Absence of the launch offer is a deployment without a promotion, not a broken one.
    stripeCouponFounding.mockReturnValue(null);

    const pricing = await readPricing();

    expect(pricing.founding).toBeNull();
    expect(pricing.prices).toHaveLength(2);
    expect(couponRetrieve).not.toHaveBeenCalled();
  });

  it("reports no counter for a coupon with no cap on it", async () => {
    couponRetrieve.mockResolvedValue({ valid: true, max_redemptions: null, times_redeemed: 4 });

    expect((await readPricing()).founding).toBeNull();
  });

  it("reports no counter for a coupon Stripe no longer considers valid", async () => {
    couponRetrieve.mockResolvedValue({ valid: false, max_redemptions: 100, times_redeemed: 100 });

    expect((await readPricing()).founding).toBeNull();
  });

  it("reports sold out rather than a negative count", async () => {
    couponRetrieve.mockResolvedValue({ valid: true, max_redemptions: 100, times_redeemed: 100 });

    expect((await readPricing()).founding).toMatchObject({ total: 100, remaining: 0 });
  });

  it("omits a price with no fixed amount instead of inventing a figure for it", async () => {
    // A metered or tiered price has no `unit_amount`. We do not sell one, and a guessed number on the
    // card would be a figure nobody is charged.
    priceRetrieve.mockImplementation(async (id: string) =>
      id === "price_monthly"
        ? { unit_amount: null, currency: "usd" }
        : { unit_amount: 14999, currency: "usd" }
    );

    expect((await readPricing()).prices).toEqual([{ interval: "year", amount: "$149.99" }]);
  });
});
