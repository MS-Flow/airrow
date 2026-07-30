// Where a paid workspace actually stands, in one sentence and one badge (spec 100).
//
// Settings used to say one of two things: "Renews automatically" or "Cancelled — Pro runs until the
// end of the period you've paid for". That reads as a complete answer and is not one. A founder who
// had just cancelled was still told their subscription renews automatically, because the row it was
// read from had not been updated — and the copy offered no state between "fine" and "cancelled" for a
// card that failed, a trial that is running, or a subscription Stripe has paused.
//
// So the standing is derived from all three fields Stripe gives us, and every branch says what
// happens next and when. Pure, so the wording is testable without a database or a browser.
import type { SubscriptionRecord } from "@/lib/data/store";

export type PlanTone =
  /** Continues on its own. */
  | "renewing"
  /** Has an end date and will not renew. */
  | "ending"
  /** Needs the founder to do something, or Stripe is mid-retry. */
  | "attention";

export interface PlanStanding {
  /** Two or three words, for a badge. */
  label: string;
  tone: PlanTone;
  /** What happens next, and when. Always a full sentence — this is the part people read. */
  detail: string;
}

/** `2026-08-30` from an ISO timestamp; null when Stripe gave us no date for this state. */
function day(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null;
}

const SAFE = "Everything you have generated stays yours either way.";

/**
 * @param subscription the row as last reconciled with Stripe — by the webhook, or by
 * `syncPlanFromStripe` when the founder came back from Checkout or the billing portal.
 */
export function planStanding(subscription: SubscriptionRecord): PlanStanding {
  const ends = day(subscription.currentPeriodEnd);

  // Checked before the status, deliberately: a cancelled subscription is `active` right up to the
  // last day of the period, so reading the status alone is exactly how "Renews automatically" ended
  // up under a subscription the founder had just switched off.
  if (subscription.cancelAtPeriodEnd) {
    return {
      label: "Cancelled",
      tone: "ending",
      // One sentence. The badge has already said which state this is, and the reassurance the other
      // branches carry is noise here: nobody reading a date they chose needs to be told twice.
      detail: ends
        ? `Pro runs until ${ends} and does not renew.`
        : "Pro runs until the end of the period you have paid for and does not renew."
    };
  }

  switch (subscription.status) {
    case "trialing":
      return {
        label: "Trial",
        tone: "renewing",
        detail: ends
          ? `Your trial runs to ${ends}, and the subscription starts automatically after it.`
          : "Your trial is running, and the subscription starts automatically after it."
      };

    case "past_due":
    case "unpaid":
      return {
        label: "Payment failed",
        tone: "attention",
        // Pro deliberately stays on here (`planForStatus`), so the sentence has to explain a state
        // that is neither fine nor over — otherwise the badge reads as a threat.
        detail:
          "Stripe could not charge your card and is retrying. Pro stays on while it does. Update the card in billing to keep it."
      };

    case "paused":
      return {
        label: "Paused",
        tone: "ending",
        detail: `This subscription is paused at Stripe and is not being charged. ${SAFE}`
      };

    case "canceled":
    case "incomplete_expired":
      return {
        label: "Ended",
        tone: "ending",
        detail: `This subscription has ended and nothing further will be charged. ${SAFE}`
      };

    case "incomplete":
      return {
        label: "Not started",
        tone: "attention",
        detail:
          "A checkout was started for this workspace and never completed, so nothing has been charged."
      };

    default:
      // `active`, and anything Stripe adds later that is none of the above. Saying "renews" for an
      // unknown status is safe in the one direction that matters: it promises nothing about money.
      return {
        label: "Renews automatically",
        tone: "renewing",
        detail: ends
          ? `Your card is charged again on ${ends}. Cancel any time in billing; Pro then runs to the end of the period you have paid for.`
          : "Your card is charged each period. Cancel any time in billing."
      };
  }
}

/** The badge tone the design system uses for each standing. */
export const PLAN_BADGE_TONE: Record<PlanTone, "success" | "neutral" | "danger"> = {
  renewing: "success",
  ending: "neutral",
  attention: "danger"
};
