// Server-only Stripe client (spec 99). Mirrors `lib/data/supabase.ts`: built once, from the
// environment, and never imported from a client component.
//
// Airrow runs without Stripe keys — the app starts, settings shows Pro as unavailable, and nothing
// throws. That is why `stripeConfigured()` exists separately from `stripe()`: the UI asks whether
// the path exists, and only code that is about to make a call constructs anything.
import Stripe from "stripe";

let client: Stripe | null = null;

/**
 * Every variable this file reads, and what a well-formed value starts with.
 *
 * The prefixes are Stripe's own and they are checked here rather than discovered at the API, because
 * a value that is *present but wrong* is the expensive kind of wrong: `STRIPE_PRICE_MONTHLY` pasted
 * with a stray colon reached Checkout as `:price_…` and came back as a server exception on the button
 * a founder had just pressed to pay us.
 */
const STRIPE_VARS = {
  // `rk_` too: a restricted key is a legitimate choice for a deployment that only needs Checkout.
  STRIPE_SECRET_KEY: ["sk_", "rk_"],
  STRIPE_PRICE_MONTHLY: ["price_"],
  STRIPE_PRICE_YEARLY: ["price_"],
  STRIPE_WEBHOOK_SECRET: ["whsec_"]
} as const;

type StripeVar = keyof typeof STRIPE_VARS;

/**
 * Everything the paid path needs end to end.
 *
 * The webhook secret belongs in this list even though nothing about *taking* money needs it: the
 * webhook is the only writer of `organizations.plan`, so a deployment that can charge a card and
 * cannot verify the event that follows takes a founder's money and never grants them Pro. Refusing
 * to sell is the only safe failure here.
 */
const REQUIRED_STRIPE_VARS: StripeVar[] = [
  "STRIPE_SECRET_KEY",
  "STRIPE_PRICE_MONTHLY",
  "STRIPE_WEBHOOK_SECRET"
];

/**
 * A usable value, or `null` when the variable is absent or does not look like what it claims to be.
 *
 * Trimmed, because a trailing space or newline survives a copy-paste into a dashboard field and is
 * invisible in one. Not otherwise repaired: stripping a stray colon would be guessing at what
 * somebody meant, and a wrong guess about which price to charge is worse than refusing to charge.
 */
function stripeVar(name: StripeVar): string | null {
  const value = process.env[name]?.trim();
  if (!value) return null;
  return STRIPE_VARS[name].some((prefix) => value.startsWith(prefix)) ? value : null;
}

/**
 * What is wrong with this deployment's Stripe configuration, one entry per variable.
 *
 * Names and shapes only — a value never reaches a log (§II). A variable that is set but malformed is
 * reported differently from one that is absent, because those are different mistakes and looking for
 * the wrong one is how an afternoon goes.
 */
export function missingStripeConfig(): string[] {
  return REQUIRED_STRIPE_VARS.flatMap((name) => {
    if (stripeVar(name)) return [];
    const expected = STRIPE_VARS[name].map((p) => `"${p}"`).join(" or ");
    return process.env[name]?.trim()
      ? [`${name} (set, but does not start with ${expected})`]
      : [name];
  });
}

let warned = false;

/**
 * Whether payment is wired up at all. Cheap, side-effect free, safe to call on every render.
 *
 * Warns once per server instance when it is not, naming what is wrong with each variable. Without
 * that line, a deployment with `STRIPE_PRICE_MONTLY` set instead of `STRIPE_PRICE_MONTHLY` renders a
 * disabled Upgrade button, logs nothing, and looks identical to a deployment that was never meant to
 * sell anything — which is exactly how one typo cost an afternoon.
 */
export function stripeConfigured(): boolean {
  const problems = missingStripeConfig();
  if (problems.length === 0) return true;
  if (!warned) {
    warned = true;
    console.warn(
      `Stripe is not configured — check ${problems.join(", ")}. The upgrade path stays disabled.`
    );
  }
  return false;
}

export function stripe(): Stripe {
  if (client) return client;
  const key = stripeVar("STRIPE_SECRET_KEY");
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
  const monthly = stripeVar("STRIPE_PRICE_MONTHLY");
  const yearly = stripeVar("STRIPE_PRICE_YEARLY");
  if (monthly) prices.push({ id: monthly, interval: "month" });
  if (yearly) prices.push({ id: yearly, interval: "year" });
  return prices;
}

export function stripeWebhookSecret(): string {
  const secret = stripeVar("STRIPE_WEBHOOK_SECRET");
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
