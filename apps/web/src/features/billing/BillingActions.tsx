"use client";

// The buttons that leave for Stripe (spec 99).
//
// A client component because both actions return a URL rather than redirecting: an action that
// redirects cannot also report that it failed, and "payment isn't configured" or an expired session
// has to be sayable. So the action answers, and this sends the browser.
import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { InlineError, Notice } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  openBillingPortalAction,
  refreshPlanAction,
  startCheckoutAction,
  type BillingRedirect
} from "./actions";

/** Leaves for Stripe as soon as the action hands back a URL. */
function useStripeRedirect(state: BillingRedirect): void {
  useEffect(() => {
    if (state.url) window.location.href = state.url;
  }, [state.url]);
}

const INTERVAL_LABEL: Record<string, string> = {
  month: "Upgrade to Pro",
  year: "Upgrade yearly"
};

const INTERVAL_PERIOD: Record<string, string> = {
  month: "a month",
  year: "a year"
};

/**
 * One purchasable interval, and what pressing it costs.
 *
 * `amount` is already formatted and already discounted where a coupon applies, because the price this
 * screen shows has to be the price Checkout charges — a button reading one figure and billing another
 * is worse than a button reading none (spec 179, amendment 1). It is `null` whenever Stripe could not
 * be asked, and the button then reads exactly as it did before prices were shown at all.
 *
 * `wasAmount` is the list price the offer discounts from, shown struck through beside `amount` so the
 * founding rate reads as a saving rather than as a price (spec 182). `null` whenever there is no
 * offer running on this interval — which is when there is nothing to strike through.
 */
export interface UpgradeOption {
  interval: string;
  amount: string | null;
  wasAmount: string | null;
}

export function UpgradeButtons({ options }: { options: UpgradeOption[] }) {
  const [state, action] = useActionState<BillingRedirect, FormData>(
    async (_prev, formData) => startCheckoutAction(formData),
    {}
  );
  useStripeRedirect(state);

  return (
    <div className="mt-4 space-y-3">
      {state.error ? <InlineError>{state.error}</InlineError> : null}
      <div className="flex flex-wrap gap-2">
        {options.map(({ interval, amount, wasAmount }, i) => (
          <form action={action} key={interval}>
            <input type="hidden" name="interval" value={interval} />
            <SubmitButton
              size="sm"
              variant={i === 0 ? "primary" : "secondary"}
              pendingLabel="Opening Stripe…"
            >
              {INTERVAL_LABEL[interval] ?? "Upgrade"}
              {amount ? " — " : ""}
              {/* The saving, and only where one exists. `line-through` on its own would read as a
                  price that had been withdrawn, so the struck figure is also dimmed and carries the
                  label a screen reader needs to know which of the two is charged. */}
              {amount && wasAmount ? (
                <span className="opacity-60 line-through">
                  <span className="sr-only">Usual price </span>
                  {wasAmount}
                </span>
              ) : null}
              {amount ? `${wasAmount ? " " : ""}${amount} ${INTERVAL_PERIOD[interval] ?? ""}`.trimEnd() : ""}
            </SubmitButton>
          </form>
        ))}
      </div>
    </div>
  );
}

/**
 * "I have paid — look again."
 *
 * A plain form posting a server action rather than another `useActionState` pair: this one has
 * nothing to report back, it redirects, and the plan it changes is read by the whole shell.
 */
export function RefreshPlanButton({ className = "mt-3" }: { className?: string }) {
  return (
    <form action={refreshPlanAction} className={className}>
      <SubmitButton size="sm" variant="secondary" pendingLabel="Checking with Stripe…">
        Already paid? Check again
      </SubmitButton>
    </form>
  );
}

export function ManageBillingButton() {
  const [state, action] = useActionState<BillingRedirect, FormData>(
    async () => openBillingPortalAction(),
    {}
  );
  useStripeRedirect(state);

  return (
    <div className="mt-4 space-y-3">
      {state.error ? <InlineError>{state.error}</InlineError> : null}
      <form action={action}>
        <SubmitButton size="sm" variant="secondary" pendingLabel="Opening Stripe…">
          Manage billing
        </SubmitButton>
      </form>
    </div>
  );
}

/**
 * Payment is not wired up on this deployment. Shown, not hidden — the shape of the product is honest.
 *
 * The reason is now *on the page*. It used to live in a `title` attribute, which is invisible on every
 * touch device and to anyone who does not think to hover a control that looks broken. What a founder
 * actually met was an "Upgrade to Pro" button that could not be clicked and said nothing about why —
 * indistinguishable from a bug, and in the one place where the product asks to be trusted with a card.
 *
 * The button stays disabled rather than disappearing, so the plan boundary is still visible (spec
 * 100), but it is no longer the only thing on screen.
 */
export function BillingUnavailable() {
  return (
    <div className="mt-4 space-y-3">
      <Button size="sm" disabled>
        Upgrade to Pro
      </Button>
      <Notice title="Pro can't be bought here yet">
        Card payment isn&rsquo;t set up on this deployment, so this button has nothing to open.
        Nothing you have already generated is affected, and your free foundation and its revisions
        work exactly as they do now.
      </Notice>
    </div>
  );
}
