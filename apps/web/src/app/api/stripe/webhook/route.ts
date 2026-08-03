// The Stripe webhook (spec 99) — the primary path by which `organizations.plan` changes, and the only
// one that runs when nobody is looking at a screen: renewals, failed payments, cancellations.
//
// Spec 100 added a second writer, `features/billing/sync.ts`, for the moment a founder *is* looking:
// it asks Stripe's API directly and applies the same state through the same function. What has not
// changed is the rule underneath both — the plan follows what Stripe says, never what a redirect
// claims.
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
  getSubscription,
  orgForStripeCustomer,
  releaseStripeEvent,
  type SubscriptionState
} from "@/lib/data/store";
import { capturePaid } from "@/features/billing/paid";
import {
  stripeCustomerId as customerId,
  toSubscriptionState as toState
} from "@/features/billing/subscription-state";
import { stripe, stripeConfigured, stripeWebhookSecret } from "@/lib/stripe";

/** Stripe signs the bytes it sent. Next's parsed body would be a different string. */
export const runtime = "nodejs";

/**
 * What a single event means for the organization, or null when it means nothing.
 *
 * The subscription travels back beside the state it produced, because two things are decided from it
 * and only one of them is the plan: `paid` also needs to know whether this was monthly, yearly or a
 * founding place, and that is on the subscription rather than in the row we store (spec 182).
 *
 * `invoice.payment_failed` is deliberately absent. Stripe retries a failed charge for days and moves
 * the subscription to `past_due` itself, which arrives as `subscription.updated` and which
 * `planForStatus` keeps on Pro. Downgrading on the first failed charge would cut off a founder whose
 * card expired before Stripe has finished trying — or emailed them.
 */
interface Applied {
  state: SubscriptionState;
  subscription: Stripe.Subscription;
}

function applied(subscription: Stripe.Subscription): Applied | null {
  const state = toState(subscription);
  return state ? { state, subscription } : null;
}

async function stateFor(event: Stripe.Event): Promise<Applied | null> {
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
      return applied(await stripe().subscriptions.retrieve(id));
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return applied(event.data.object);

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
    const outcome = await stateFor(event);
    if (!outcome) return NextResponse.json({ received: true, applied: false });
    const { state, subscription } = outcome;

    // Scoped by the customer the payment belongs to. There is no session here — this lookup *is*
    // the authorization, and an unknown customer changes nothing.
    const orgId = await orgForStripeCustomer(state.customerId);
    if (!orgId) return NextResponse.json({ received: true, applied: false });

    // Read before the write, so `paid` can tell a new customer from a renewal or a redelivery — the
    // difference between a funnel and a count of Stripe's traffic (spec 182).
    const previous = await getSubscription(orgId);
    await applySubscriptionState(orgId, state);
    capturePaid(orgId, previous, state, subscription);
    return NextResponse.json({ received: true, applied: true });
  } catch (error) {
    await releaseStripeEvent(event.id);
    throw error;
  }
}
