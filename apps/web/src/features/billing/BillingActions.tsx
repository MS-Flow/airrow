"use client";

// The buttons that leave for Stripe (spec 99).
//
// A client component because both actions return a URL rather than redirecting: an action that
// redirects cannot also report that it failed, and "payment isn't configured" or an expired session
// has to be sayable. So the action answers, and this sends the browser.
import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { openBillingPortalAction, startCheckoutAction, type BillingRedirect } from "./actions";

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

export function UpgradeButtons({ intervals }: { intervals: string[] }) {
  const [state, action] = useActionState<BillingRedirect, FormData>(
    async (_prev, formData) => startCheckoutAction(formData),
    {}
  );
  useStripeRedirect(state);

  return (
    <div className="mt-4 space-y-3">
      {state.error ? <InlineError>{state.error}</InlineError> : null}
      <div className="flex flex-wrap gap-2">
        {intervals.map((interval, i) => (
          <form action={action} key={interval}>
            <input type="hidden" name="interval" value={interval} />
            <SubmitButton
              size="sm"
              variant={i === 0 ? "primary" : "secondary"}
              pendingLabel="Opening Stripe…"
            >
              {INTERVAL_LABEL[interval] ?? "Upgrade"}
            </SubmitButton>
          </form>
        ))}
      </div>
    </div>
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

/** Payment is not wired up on this deployment. Shown, not hidden — the shape of the product is honest. */
export function BillingUnavailable() {
  return (
    <Button size="sm" className="mt-4" disabled title="Payment isn't configured on this deployment">
      Upgrade to Pro
    </Button>
  );
}
