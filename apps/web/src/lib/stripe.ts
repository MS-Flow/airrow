// Server-only Stripe client (spec 99). Mirrors `lib/data/supabase.ts`: built once, from the
// environment, and never imported from a client component.
//
// Airrow runs without Stripe keys — the app starts, settings shows Pro as unavailable, and nothing
// throws. That is why `stripeConfigured()` exists separately from `stripe()`: the UI asks whether
// the path exists, and only code that is about to make a call constructs anything.
import Stripe from "stripe";

let client: Stripe | null = null;

/**
 * Everything the paid path needs end to end.
 *
 * The webhook secret belongs in this list even though nothing about *taking* money needs it: the
 * webhook is the only writer of `organizations.plan`, so a deployment that can charge a card and
 * cannot verify the event that follows takes a founder's money and never grants them Pro. Refusing
 * to sell is the only safe failure here.
 */
const REQUIRED_STRIPE_VARS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_MONTHLY",
  "STRIPE_WEBHOOK_SECRET"
] as const;

/** Which of them this deployment is missing. Names only — a value never reaches a log (§II). */
export function missingStripeConfig(): string[] {
  return REQUIRED_STRIPE_VARS.filter((name) => !process.env[name]);
}

let warned = false;

/**
 * Whether payment is wired up at all. Cheap, side-effect free, safe to call on every render.
 *
 * Warns once per server instance when it is not, naming the variables that are absent. Without that
 * line, a deployment with `STRIPE_PRICE_MONTLY` set instead of `STRIPE_PRICE_MONTHLY` renders a
 * disabled Upgrade button, logs nothing, and looks identical to a deployment that was never meant to
 * sell anything — which is exactly how one typo cost an afternoon.
 */
export function stripeConfigured(): boolean {
  const missing = missingStripeConfig();
  if (missing.length === 0) return true;
  if (!warned) {
    warned = true;
    console.warn(
      `Stripe is not configured — missing ${missing.join(", ")}. The upgrade path stays disabled.`
    );
  }
  return false;
}

export function stripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured — set STRIPE_SECRET_KEY.");
  client = new Stripe(key);
  return client;
}

/**
 * The prices on offer, in the order they should be shown.
 *
 * No amount appears anywhere in this repository: Checkout is handed a price id and Stripe owns the
 * figure, so changing it is a dashboard edit rather than a deploy. Yearly is optional — leaving
 * `STRIPE_PRICE_YEARLY` unset ships monthly only, which is a pricing decision made in configuration
 * instead of in code.
 */
export interface StripePrice {
  id: string;
  interval: "month" | "year";
}

export function stripePrices(): StripePrice[] {
  const prices: StripePrice[] = [];
  const monthly = process.env.STRIPE_PRICE_MONTHLY;
  const yearly = process.env.STRIPE_PRICE_YEARLY;
  if (monthly) prices.push({ id: monthly, interval: "month" });
  if (yearly) prices.push({ id: yearly, interval: "year" });
  return prices;
}

export function stripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("Stripe is not configured — set STRIPE_WEBHOOK_SECRET.");
  return secret;
}

/**
 * Which plan a Stripe subscription status entitles the organization to.
 *
 * `past_due` and `unpaid` deliberately stay Pro. Stripe retries a failed payment for days, and
 * cutting off a founder whose card expired on the first failure — while Stripe is still trying, and
 * before they have even been emailed — is a bug wearing the costume of a policy. Pro ends when
 * Stripe says the subscription is over, not when one charge fails.
 */
export function planForStatus(status: string): "free" | "pro" {
  return status === "active" || status === "trialing" || status === "past_due" || status === "unpaid"
    ? "pro"
    : "free";
}
