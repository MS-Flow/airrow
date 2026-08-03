// The pricing card, and the one thing it exists to do: name a price (spec 179).
//
// `smoke.test.tsx` proves the landing page renders; this proves what the Pro card says when Stripe
// answers, and what it does *not* say when Stripe cannot be asked. The empty state is the half that
// rots quietly — nobody notices a missing figure in review, and the card spent a release advertising
// Pro as "Monthly" because of it.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Pricing } from "@/features/billing/prices";

vi.mock("@/lib/auth", () => ({
  getSession: () => Promise.resolve(null),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn()
}));

vi.mock("@/lib/theme", () => ({ readTheme: () => Promise.resolve("dark") }));

vi.mock("@/features/generation/allowance", () => ({
  checkAllowance: () =>
    Promise.resolve({
      allowed: true,
      plan: "free",
      denial: null,
      used: 0,
      remaining: 1,
      unlimited: false
    })
}));

const pricing = vi.hoisted((): { current: Pricing } => ({
  current: { prices: [], founding: null }
}));

vi.mock("@/features/billing/prices", () => ({
  readPricing: () => Promise.resolve(pricing.current)
}));

import Landing from "./page";

const PRICED: Pricing = {
  prices: [
    { interval: "month", amount: "$14.99" },
    { interval: "year", amount: "$149.99" }
  ],
  // `amount` is the founding rate, already discounted — deliberately different from the $149.99 list
  // price above, so a test asserting the wrong one fails.
  founding: { total: 100, remaining: 88, amount: "$119.99" }
};

describe("the Pro pricing card", () => {
  beforeEach(() => {
    pricing.current = PRICED;
  });

  it("names the monthly amount Stripe reported", async () => {
    render(await Landing());

    expect(screen.getByText("$14.99")).toBeInTheDocument();
    expect(screen.getByText("per month")).toBeInTheDocument();
  });

  it("says how many founding places are left, and what they cost", async () => {
    render(await Landing());

    expect(screen.getByText(/88 founding places left of 100/i)).toBeInTheDocument();
    expect(screen.getByText(/founding member/i)).toBeInTheDocument();
  });

  it("prices the founding offer at the founding rate, not the list price", async () => {
    // The defect: the line read "at $149.99 per year" while Checkout applied the coupon and charged
    // $119.99 — a deal advertised at the rate you get for turning it down.
    render(await Landing());

    expect(screen.getByText(/\$119\.99 per year/i)).toBeInTheDocument();
    expect(screen.queryByText(/\$149\.99 per year/i)).not.toBeInTheDocument();
  });

  it("names the places left without a figure when the founding rate is unknown", async () => {
    pricing.current = { ...PRICED, founding: { total: 100, remaining: 88, amount: null } };
    render(await Landing());

    expect(screen.getByText(/88 founding places left of 100/i)).toBeInTheDocument();
    expect(screen.queryByText(/per year/i)).not.toBeInTheDocument();
  });

  it("reads the last place as one place, not one places", async () => {
    pricing.current = { ...PRICED, founding: { total: 100, remaining: 1, amount: "$119.99" } };
    render(await Landing());

    expect(screen.getByText(/1 founding place left of 100/i)).toBeInTheDocument();
  });

  it("says the offer is taken once the places are gone, and drops the badge", async () => {
    pricing.current = { ...PRICED, founding: { total: 100, remaining: 0, amount: "$119.99" } };
    render(await Landing());

    expect(screen.getByText(/all 100 founding places are taken/i)).toBeInTheDocument();
    expect(screen.queryByText(/founding member/i)).not.toBeInTheDocument();
    // Monthly is a separate price and is unaffected by the promotion running out.
    expect(screen.getByText("$14.99")).toBeInTheDocument();
  });

  it("shows the card without an amount when Stripe has nothing to tell us", async () => {
    // Unconfigured or unreachable, both arrive here as "no figures". What must not happen is a
    // placeholder where a price goes, which is exactly what "Monthly" was.
    pricing.current = { prices: [], founding: null };
    render(await Landing());

    expect(screen.queryByText("per month")).not.toBeInTheDocument();
    expect(screen.queryByText(/founding/i)).not.toBeInTheDocument();
    // The card itself, its note and its action all survive: the visitor still reaches Checkout,
    // which knows the real price.
    expect(screen.getByText(/unlimited foundations/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start with pro/i })).toBeInTheDocument();
  });

  it("prices Pro with no founding offer configured at all", async () => {
    pricing.current = { prices: [{ interval: "month", amount: "$14.99" }], founding: null };
    render(await Landing());

    expect(screen.getByText("$14.99")).toBeInTheDocument();
    expect(screen.queryByText(/founding/i)).not.toBeInTheDocument();
  });
});
