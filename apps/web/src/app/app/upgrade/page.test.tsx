// The upgrade screen names its prices (spec 179, amendment 1).
//
// The figure on the button has to be the figure Checkout charges. While the founding offer is running
// that is the discounted annual rate, not the list price — a button reading one number and billing
// another is worse than a button reading none, which is what this screen showed until now.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Pricing } from "@/features/billing/prices";

const plan = vi.hoisted(() => ({ current: "free" as "free" | "pro" }));

vi.mock("@/lib/auth", () => ({
  requireSession: () =>
    Promise.resolve({
      user: { id: "u1", email: "f@example.com", name: "F" },
      org: { id: "org1", name: "Workspace", plan: plan.current }
    })
}));

vi.mock("@/features/billing/sync", () => ({
  planWithStripe: () => Promise.resolve({ plan: plan.current })
}));

vi.mock("@/features/generation/allowance", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  checkAllowance: () =>
    Promise.resolve({ allowed: false, plan: "free", denial: "free-spent", used: 1, remaining: 0 })
}));

const pricing = vi.hoisted((): { current: Pricing } => ({
  current: { prices: [], founding: null }
}));

vi.mock("@/features/billing/prices", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  readPricing: () => Promise.resolve(pricing.current)
}));

vi.mock("@/lib/stripe", () => ({
  stripeConfigured: () => true,
  stripePrices: () => [
    { id: "price_monthly", interval: "month" },
    { id: "price_yearly", interval: "year" }
  ]
}));

import UpgradePage from "./page";

describe("the upgrade screen", () => {
  beforeEach(() => {
    plan.current = "free";
    pricing.current = {
      prices: [
        { interval: "month", amount: "$11.99" },
        { interval: "year", amount: "$119.99" }
      ],
      founding: { total: 100, remaining: 40, amount: "$95.99", listAmount: "$119.99" }
    };
  });

  it("names what each button costs", async () => {
    render(await UpgradePage());

    expect(screen.getByRole("button", { name: /\$11\.99 a month/i })).toBeInTheDocument();
  });

  it("prices the yearly button at the founding rate while places remain", async () => {
    render(await UpgradePage());

    expect(screen.getByRole("button", { name: /\$95\.99 a year/i })).toBeInTheDocument();
    // The list price appears too, and only struck through — the payable figure is still the
    // founding one, which is the rule spec 179 set and spec 182 narrowed rather than dropped.
    const struck = screen.getByText("$119.99");
    expect(struck).toHaveClass("line-through");
    expect(screen.queryByRole("button", { name: /\$119\.99 a year/i })).not.toBeInTheDocument();
  });

  it("charges the list price once the founding places are gone, with nothing struck through", async () => {
    pricing.current = {
      ...pricing.current,
      founding: { total: 100, remaining: 0, amount: "$95.99", listAmount: "$119.99" }
    };
    render(await UpgradePage());

    expect(screen.getByRole("button", { name: /\$119\.99 a year/i })).toBeInTheDocument();
    // The struck figure always carries this label, so its absence is the absence of a strikethrough.
    expect(screen.queryByText(/usual price/i)).not.toBeInTheDocument();
  });

  it("shows the founding price alone when the list price could not be read", async () => {
    pricing.current = {
      ...pricing.current,
      founding: { total: 100, remaining: 40, amount: "$95.99", listAmount: null }
    };
    render(await UpgradePage());

    expect(screen.getByRole("button", { name: /\$95\.99 a year/i })).toBeInTheDocument();
    expect(screen.queryByText(/usual price/i)).not.toBeInTheDocument();
  });

  it("keeps the plain labels when Stripe cannot be asked", async () => {
    // No figures rather than wrong ones, and the screen still sells: the buttons work, because
    // Checkout knows the real price even when this render did not.
    pricing.current = { prices: [], founding: null };
    render(await UpgradePage());

    expect(screen.getByRole("button", { name: "Upgrade to Pro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upgrade yearly" })).toBeInTheDocument();
  });

  it("offers billing management, not a price, to someone already paying", async () => {
    plan.current = "pro";
    render(await UpgradePage());

    expect(screen.getByRole("button", { name: /manage billing/i })).toBeInTheDocument();
    expect(screen.queryByText(/\$95\.99/)).not.toBeInTheDocument();
  });
});
