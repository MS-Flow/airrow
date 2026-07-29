// The Stripe webhook (spec 99) — the only thing outside a migration that writes
// `organizations.plan`.
//
// It is a public, unauthenticated endpoint by necessity: Stripe has no session with us. The
// signature check is therefore the whole of its authorization, and it runs against the *raw* body
// before anything is parsed. A request that fails it is rejected with no side effects at all.
//
// Everything else here exists because Stripe delivers at least once and retries for days on a
// non-2xx: an event is claimed before it is applied, and an event we have already seen is a
// successful no-op rather than a second upgrade.
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  applySubscriptionState,
  claimStripeEvent,
  orgForStripeCustomer,
  releaseStripeEvent,
  type SubscriptionState
} from "@/lib/data/store";
import { planForStatus, stripe, stripeConfigured, stripeWebhookSecret } from "@/lib/stripe";

/** Stripe signs the bytes it sent. Next's parsed body would be a different string. */
export const runtime = "nodejs";

/** Whatever Stripe puts a customer id in: a string on the way out, an object on the way back. */
function customerId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (typeof value === "string") return value;
  return value?.id ?? null;
}

function toState(subscription: Stripe.Subscription): SubscriptionState | null {
  const customer = customerId(subscription.customer);
  if (!customer) return null;

  // `current_period_end` is seconds since the epoch and is absent on some statuses. Reading it off
  // the first item rather than the subscription: Stripe moved it there, and the top-level field is
  // not present on newer API versions.
  const periodEnd = subscription.items.data[0]?.current_period_end;

  return {
    customerId: customer,
    subscriptionId: subscription.id,
    status: subscription.status,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    plan: planForStatus(subscription.status)
  };
}

/**
 * What a single event means for the organization, or null when it means nothing.
 *
 * `invoice.payment_failed` is deliberately absent. Stripe retries a failed charge for days and moves
 * the subscription to `past_due` itself, which arrives as `subscription.updated` and which
 * `planForStatus` keeps on Pro. Downgrading on the first failed charge would cut off a founder whose
 * card expired before Stripe has finished trying — or emailed them.
 */
async function stateFor(event: Stripe.Event): Promise<SubscriptionState | null> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const customer = customerId(session.customer);
      if (!customer || session.mode !== "subscription") return null;

      // The session says a payment succeeded but carries none of the subscription's state, so it is
      // read back rather than guessed at.
      const id =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (!id) return null;
      return toState(await stripe().subscriptions.retrieve(id));
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return toState(event.data.object);

    default:
      // Stripe sends far more than we asked for, and new types appear without warning. An unknown
      // event is acknowledged and ignored — erroring on it would make Stripe retry forever.
      return null;
  }
}

export async function POST(req: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing_signature" }, { status: 400 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(body, signature, stripeWebhookSecret());
  } catch {
    // No detail in the response: an attacker probing the endpoint learns only that it said no.
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  // Claimed before it is applied, so two concurrent redeliveries cannot both pass. A 200 on the
  // duplicate is what stops Stripe retrying something we have already done.
  if (!(await claimStripeEvent(event.id, event.type))) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Everything past the claim runs under it: if any of it fails, the claim is handed back so
  // Stripe's retry is a real second attempt rather than a no-op. Without this, one transient
  // database error turns a paid upgrade into a founder who is silently still on free.
  try {
    const state = await stateFor(event);
    if (!state) return NextResponse.json({ received: true, applied: false });

    // Scoped by the customer the payment belongs to. There is no session here — this lookup *is*
    // the authorization, and an unknown customer changes nothing.
    const orgId = await orgForStripeCustomer(state.customerId);
    if (!orgId) return NextResponse.json({ received: true, applied: false });

    await applySubscriptionState(orgId, state);
    return NextResponse.json({ received: true, applied: true });
  } catch (error) {
    await releaseStripeEvent(event.id);
    throw error;
  }
}
