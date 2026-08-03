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
import {
  applySubscriptionState,
  getSubscription,
  type OrgPlan,
  type SubscriptionRecord
} from "@/lib/data/store";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { capturePaid } from "./paid";
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
/**
 * How long a reconciled row is trusted before a screen asks Stripe again.
 *
 * The webhook is what keeps this current in normal operation, and when it is working this window is
 * never reached in any way a founder would notice. It exists for when it is *not* working, which is
 * every failure this spec section is about — and one Stripe call per minute per workspace, on the one
 * screen that shows billing, is a cheap price for a page that is never wrong.
 */
export const PLAN_FRESH_FOR_MS = 60_000;

export interface FreshPlan {
  /** The entitlement to render with — reconciled if it needed to be. */
  plan: OrgPlan;
  /** The subscription behind it, re-read when a sync changed anything. */
  subscription: SubscriptionRecord | null;
}

/**
 * The plan a billing screen should render, reconciled with Stripe when what we hold has gone stale.
 *
 * This is what makes the page correct on its own. A cancellation made in the Stripe dashboard, or a
 * payment whose webhook never arrived, used to sit there until somebody pressed a button — and a
 * founder should not have to know that the button exists, or that we depend on an event that may
 * never come.
 */
export async function planWithStripe(org: { id: string; plan: OrgPlan }): Promise<FreshPlan> {
  const known = await getSubscription(org.id);
  // No customer means no payment was ever started: there is nothing Stripe could tell us.
  if (!known) return { plan: org.plan, subscription: null };

  const age = Date.now() - Date.parse(known.updatedAt);
  if (Number.isFinite(age) && age < PLAN_FRESH_FOR_MS) return { plan: org.plan, subscription: known };

  const synced = await syncPlanFromStripe(org.id);
  if (synced === "unknown") return { plan: org.plan, subscription: known };
  return { plan: synced, subscription: await getSubscription(org.id) };
}

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
    // `record` is the row as it stood before the write, which is what makes this a transition rather
    // than a repeat: a founder who opens Settings twice pays once (spec 182).
    capturePaid(orgId, record, state, subscription);
    return state.plan;
  } catch (error) {
    // Logged, not surfaced: the caller falls back to whatever the database already said, which is the
    // state the webhook is responsible for anyway.
    console.error("Plan sync from Stripe failed:", error instanceof Error ? error.message : error);
    return "unknown";
  }
}
