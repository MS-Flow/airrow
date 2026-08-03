// What Pro costs, read from Stripe so the landing page can say it (spec 179).
//
// Spec 99 put every figure in the Stripe dashboard so a price change needs no deploy, and that was
// read as "therefore the card cannot show one" — which left the pricing section advertising Pro as
// "Monthly", with no number anywhere on it. The two are not the same thing: Stripe can be *asked*.
// So the amount still lives in exactly one place, and this is the code that goes and gets it.
//
// Server-only, and one layer below the route (§I): the landing RSC calls this, this calls
// `lib/stripe.ts`, and the Stripe SDK never appears in a component.
import { unstable_cache } from "next/cache";
import { stripe, stripeConfigured, stripeCouponFounding, stripePrices } from "@/lib/stripe";

/** One purchasable price, formatted for display. */
export interface DisplayPrice {
  interval: "month" | "year";
  /** Already formatted, e.g. `$14.99`. The raw minor-unit amount never leaves this module. */
  amount: string;
}

/** The launch offer: how many places are left, and what those places actually cost. */
export interface FoundingOffer {
  total: number;
  remaining: number;
  /**
   * The yearly amount **after** the coupon, formatted — what pressing the button charges.
   *
   * `null` when it cannot be worked out — no yearly price configured, or a coupon Stripe describes
   * with neither `percent_off` nor `amount_off`. The line then renders without a figure, which is the
   * same rule the rest of this module follows: no number beats a wrong one.
   */
  amount: string | null;
  /**
   * The yearly **list** price the offer discounts from, formatted — the struck-through figure.
   *
   * Spec 179 refused to carry this at all, reasoning that naming `STRIPE_PRICE_YEARLY`'s own figure
   * beside a founding badge advertises a deal at the rate you get for *not* taking it. Spec 182
   * narrows that rather than dropping it, because the objection was about **mislabelling**: a lone
   * list price next to a founding badge is a lie about what the button charges, and a struck-through
   * one beside the live figure is the opposite — it says plainly which is charged and which is not.
   * What survives unchanged is the rule underneath: `amount` is still the only figure ever presented
   * as payable.
   *
   * `null` when the yearly price could not be read, and the card then shows the founding figure
   * alone. A saving nobody can see is better than an empty strikethrough beside a real price.
   */
  listAmount: string | null;
}

export interface Pricing {
  prices: DisplayPrice[];
  /** `null` when no coupon is configured, or when Stripe could not be asked. */
  founding: FoundingOffer | null;
}

/**
 * What every failure returns: no figures at all.
 *
 * Deliberately not a partial or a placeholder. A card with no amount on it is an honest empty state;
 * a card showing a stale or invented figure is a price we cannot honour, and the whole reason the
 * amount lives in Stripe is that exactly one place is allowed to know it.
 */
export const NO_PRICING: Pricing = { prices: [], founding: null };

/**
 * The list price beside the founding one, or nothing to strike through.
 *
 * A saving is only worth showing while it is *a* saving: once the places are gone the list price is
 * simply the price, and drawing a line through the number somebody is about to pay would be a
 * discount that does not exist. Equal figures are treated the same way — a coupon Stripe applied as
 * zero is not an offer.
 */
export function savingFrom(founding: FoundingOffer | null): string | null {
  if (!founding || founding.remaining === 0) return null;
  if (!founding.amount || !founding.listAmount) return null;
  return founding.listAmount === founding.amount ? null : founding.listAmount;
}

/** How long a price may be stale. One Stripe call an hour per deployment, whatever the traffic. */
const REVALIDATE_SECONDS = 3600;

/**
 * Stripe's minor units as something to put on a card.
 *
 * Trailing zeroes are dropped, because `$15.00` reads like a form field and `$15` reads like a price.
 * The currency comes from Stripe rather than being assumed, so the day we sell in anything but USD
 * this formats it instead of mislabelling it.
 */
export function formatAmount(minorUnits: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: minorUnits % 100 === 0 ? 0 : 2
  }).format(minorUnits / 100);
}

/**
 * Seats left on the offer.
 *
 * Clamped at zero: `times_redeemed` can exceed `max_redemptions` in Stripe's own reporting, and a
 * card reading "-2 seats left" is worse than one reading sold out.
 */
export function seatsRemaining(total: number, redeemed: number): number {
  return Math.max(0, total - redeemed);
}

/** A price as Stripe holds it, before it is turned into something to read. */
interface RawPrice {
  interval: "month" | "year";
  unitAmount: number | null;
  currency: string;
}

/**
 * A coupon applied to an amount, in minor units.
 *
 * `percent_off` is rounded rather than truncated, so a coupon Stripe would charge as $95.99 is not
 * advertised as $95.98. `null` for a coupon carrying neither kind of discount — Stripe permits one
 * (a currency-scoped coupon with the discount defined elsewhere), and inventing a figure for it would
 * be exactly the wrong-number-on-a-pricing-page this module exists to avoid.
 */
export function discounted(
  unitAmount: number,
  coupon: { percent_off: number | null; amount_off: number | null }
): number | null {
  if (coupon.percent_off !== null) return Math.round(unitAmount * (1 - coupon.percent_off / 100));
  if (coupon.amount_off !== null) return Math.max(0, unitAmount - coupon.amount_off);
  return null;
}

async function readPrices(): Promise<RawPrice[]> {
  return Promise.all(
    stripePrices().map(async ({ id, interval }) => {
      const { unit_amount, currency } = await stripe().prices.retrieve(id);
      return { interval, unitAmount: unit_amount, currency };
    })
  );
}

/**
 * @param yearly the annual price the coupon is attached to, so the offer can name what it costs.
 */
async function readFounding(yearly: RawPrice | undefined): Promise<FoundingOffer | null> {
  const id = stripeCouponFounding();
  if (!id) return null;

  const coupon = await stripe().coupons.retrieve(id);
  // No cap means no scarcity to report. The coupon still discounts; there is just no counter.
  if (!coupon.valid || coupon.max_redemptions === null) return null;

  const rate =
    yearly?.unitAmount != null ? discounted(yearly.unitAmount, coupon) : null;

  return {
    total: coupon.max_redemptions,
    remaining: seatsRemaining(coupon.max_redemptions, coupon.times_redeemed),
    amount: rate === null || !yearly ? null : formatAmount(rate, yearly.currency),
    // Formatted from the same price and the same currency as the discounted figure, so the pair on
    // the card can never be two amounts from two reads (spec 182).
    listAmount:
      yearly?.unitAmount == null ? null : formatAmount(yearly.unitAmount, yearly.currency)
  };
}

/**
 * The offer, or none — a coupon that cannot be read must not cost the card its price.
 *
 * Its own catch, because the two reads fail independently. A deleted or mistyped
 * `STRIPE_COUPON_FOUNDING` threw into `fetchPricing`'s catch and took the monthly amount down with
 * it: a pricing card with no figure anywhere on it, because a *promotion* was misconfigured. An
 * absent offer is a state the card already draws; an absent price is the bug this module exists to
 * fix, and a coupon id is exactly the kind of value that goes stale in an environment file.
 */
async function foundingOrNone(yearly: RawPrice | undefined): Promise<FoundingOffer | null> {
  try {
    return await readFounding(yearly);
  } catch (error) {
    console.error("Stripe founding coupon read failed:", error instanceof Error ? error.message : error);
    return null;
  }
}

async function fetchPricing(): Promise<Pricing> {
  try {
    const raw = await readPrices();
    const founding = await foundingOrNone(raw.find((p) => p.interval === "year"));
    // A price with no `unit_amount` is tiered or metered. We do not sell one, and guessing at a figure
    // for it would put a number on the card that nobody is actually charged.
    const prices = raw.flatMap(({ interval, unitAmount, currency }) =>
      unitAmount === null ? [] : [{ interval, amount: formatAmount(unitAmount, currency) }]
    );
    return { prices, founding };
  } catch (error) {
    // The landing page is the first thing anyone sees; a Stripe outage must cost us a number on a
    // card, not the page. Message only, never the value of anything (§II).
    console.error("Stripe pricing read failed:", error instanceof Error ? error.message : error);
    return NO_PRICING;
  }
}

const cachedPricing = unstable_cache(fetchPricing, ["landing-pricing"], {
  revalidate: REVALIDATE_SECONDS
});

/**
 * What each interval's upgrade button should say it costs, and what it costs without the offer.
 *
 * `amount` is the **payable** figure and nothing else: yearly reports the founding rate while places
 * remain, because a button that reads one figure and charges another is worse than a button that
 * reads none. Once the offer is gone it falls back to the list price, which is then what Checkout
 * actually bills.
 *
 * `wasAmount` is the figure to strike through beside it, and is `null` on every interval that is not
 * currently discounted — which is every interval but yearly, and yearly too once the places are
 * gone. It is never the payable one (spec 182).
 *
 * `null` throughout when Stripe could not be asked, and the buttons read exactly as they did before
 * any of this existed.
 *
 * @param intervals the configured intervals, in the order they should be offered.
 */
export function upgradeAmounts(
  { prices, founding }: Pricing,
  intervals: string[]
): { interval: string; amount: string | null; wasAmount: string | null }[] {
  const discountedYear = founding && founding.remaining > 0;
  return intervals.map((interval) => ({
    interval,
    amount:
      interval === "year" && discountedYear
        ? founding.amount
        : (prices.find((p) => p.interval === interval)?.amount ?? null),
    wasAmount: interval === "year" ? savingFrom(founding) : null
  }));
}

/**
 * The figures for the pricing card, or nothing to show.
 *
 * Cached rather than fetched per request: the landing page is public and unauthenticated, so a call
 * per visitor turns anyone with a load generator into a bill and a rate limit. An hour is short
 * enough that a dashboard edit still lands the same afternoon without a deploy.
 *
 * The configuration check comes first so an unconfigured deployment neither constructs a Stripe
 * client nor occupies a cache entry.
 */
export async function readPricing(): Promise<Pricing> {
  if (!stripeConfigured()) return NO_PRICING;
  try {
    return await cachedPricing();
  } catch (error) {
    // Belt as well as braces. `fetchPricing` already swallows everything Stripe can do, but the cache
    // wrapper itself can throw before that code is ever reached — it needs a request scope, and there
    // are renders that do not have one. That threw straight through the page, which is the one
    // outcome no figure on a card is worth.
    console.error("Stripe pricing read failed:", error instanceof Error ? error.message : error);
    return NO_PRICING;
  }
}
