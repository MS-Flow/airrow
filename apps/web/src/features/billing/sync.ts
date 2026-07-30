// Asking Stripe directly what an organization has paid for (spec 100).
//
// Until now the webhook was the only way a payment could become a plan, and that made every part of
// the delivery chain a single point of failure: no listener in development, an endpoint not yet
// registered on a new domain, a database a migration behind, a retry window that runs out. Each of
// those ends the same way — money left the founder's account and the product still says free, with no
// way for them or us to repair it from inside the app.
//
// This is the repair. It is *not* the Checkout redirect: a redirect is the browser's word for what
// happened and proves nothing, which is why spec 99 refused to grant on it. This asks Stripe's API,
// server-side, with our own secret key, and applies the answer through the same
// `applySubscriptionState` the webhook uses. The proof is Stripe's, not the browser's — that is the
// whole of the difference, and it is the reason spec 100 could amend the rule without weakening it.
//
// The webhook remains the primary path and is still required: renewals, failed payments and
// cancellations arrive when nobody is looking at a screen.
import { applySubscriptionState, getSubscription } from "@/lib/data/store";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { decisiveSubscription, toSubscriptionState } from "./subscription-state";

/**
 * What the sync found.
 *
 * `unknown` is deliberately distinct from `free`: "Stripe has nothing to say about this organization"
 * and "Stripe says this organization is not paying" are different answers, and only the second is
 * grounds for changing anything.
 */
export type PlanSync = "pro" | "free" | "unknown";

/**
 * Reconcile an organization's plan with Stripe, and return what Stripe said.
 *
 * Safe to call on any request that has a session: it reads one customer's subscriptions and writes
 * only when there is something to write. Never throws — a failure here must not take down the screen
 * it was called from, since that screen is where the founder is trying to confirm a payment.
 */
export async function syncPlanFromStripe(orgId: string): Promise<PlanSync> {
  if (!stripeConfigured()) return "unknown";

  try {
    // The customer id is ours, recorded before Checkout opened. No customer means this organization
    // has never started a payment, so there is nothing to reconcile and nothing to write.
    const record = await getSubscription(orgId);
    if (!record) return "unknown";

    const { data } = await stripe().subscriptions.list({
      customer: record.customerId,
      status: "all",
      limit: 10
    });
    const subscription = decisiveSubscription(data);
    if (!subscription) return "unknown";

    const state = toSubscriptionState(subscription);
    if (!state) return "unknown";

    await applySubscriptionState(orgId, state);
    return state.plan;
  } catch (error) {
    // Logged, not surfaced: the caller falls back to whatever the database already said, which is the
    // state the webhook is responsible for anyway.
    console.error("Plan sync from Stripe failed:", error instanceof Error ? error.message : error);
    return "unknown";
  }
}
