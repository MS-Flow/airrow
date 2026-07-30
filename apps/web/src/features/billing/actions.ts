"use server";

// Starting a subscription, and managing one (spec 99).
//
// Both actions resolve the organization from the session and never take one from the client (§II).
// Neither writes `organizations.plan`: Checkout returning successfully proves the browser reached a
// URL, not that money moved. Only the webhook grants Pro.
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth";
import { getSubscription, linkStripeCustomer } from "@/lib/data/store";
import { stripe, stripeConfigured, stripePrices } from "@/lib/stripe";

export interface BillingRedirect {
  url?: string;
  error?: string;
}

const UNAVAILABLE = "Pro isn't available yet — payment isn't configured on this deployment.";

/**
 * Where Stripe sends the founder back to.
 *
 * Built from the request's own host rather than a configured base URL, so preview deployments,
 * localhost and production each return to themselves without another environment variable to keep
 * in step.
 */
async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${proto}://${host}`;
}

/**
 * The Stripe customer for this organization, created once and reused.
 *
 * Recorded before Checkout rather than after: a founder who opens Checkout, abandons it and comes
 * back would otherwise collect a customer per attempt, and the webhook would have several ids
 * pointing at one workspace.
 */
async function customerFor(orgId: string, email: string, name: string): Promise<string> {
  const existing = await getSubscription(orgId);
  if (existing) return existing.customerId;

  const customer = await stripe().customers.create(
    {
      email,
      name,
      // The organization id travels with the customer so a human debugging a payment in the Stripe
      // dashboard can find the workspace without a database query.
      metadata: { organization_id: orgId }
    },
    // Keyed on the organization, so a double-submitted upgrade or a retried request returns the
    // customer that already exists instead of minting a second one.
    { idempotencyKey: `airrow-customer-${orgId}` }
  );
  await linkStripeCustomer(orgId, customer.id);

  // Read back rather than trusting what we just created. `linkStripeCustomer` ignores a duplicate
  // insert, so if two requests raced here only one id was recorded — and Checkout must use *that*
  // one. Returning the local id would send the founder to pay against a customer the webhook cannot
  // resolve to an organization, which takes their money and never grants Pro.
  const recorded = await getSubscription(orgId);
  return recorded?.customerId ?? customer.id;
}

export async function startCheckoutAction(formData: FormData): Promise<BillingRedirect> {
  if (!stripeConfigured()) return { error: UNAVAILABLE };
  const { org, user } = await requireSession();

  // The price is chosen from the configured list, never taken from the form. A posted price id would
  // let anyone subscribe at any price in the Stripe account, including a $0 one.
  const requested = String(formData.get("interval") ?? "month");
  const prices = stripePrices();
  const price = prices.find((p) => p.interval === requested) ?? prices[0];
  if (!price) return { error: UNAVAILABLE };

  const customer = await customerFor(org.id, user.email, org.name);
  const base = await origin();

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: price.id, quantity: 1 }],
    success_url: `${base}/app/settings?upgraded=1`,
    cancel_url: `${base}/app/settings`,
    // Repeated on the subscription because `checkout.session.completed` and the subscription events
    // arrive separately, and the later ones carry only what the subscription itself holds.
    subscription_data: { metadata: { organization_id: org.id } }
  });

  return session.url ? { url: session.url } : { error: "Stripe did not return a checkout URL." };
}

/**
 * Stripe's own portal for card, receipts and cancellation.
 *
 * Deliberately not rebuilt here: PCI surface, dunning emails and invoice history are Stripe's job,
 * and every screen we wrote instead would be one more thing to keep correct.
 */
export async function openBillingPortalAction(): Promise<BillingRedirect> {
  if (!stripeConfigured()) return { error: UNAVAILABLE };
  const { org } = await requireSession();

  const subscription = await getSubscription(org.id);
  if (!subscription) return { error: "There's no billing account for this workspace yet." };

  const session = await stripe().billingPortal.sessions.create({
    customer: subscription.customerId,
    return_url: `${await origin()}/app/settings`
  });
  return { url: session.url };
}
