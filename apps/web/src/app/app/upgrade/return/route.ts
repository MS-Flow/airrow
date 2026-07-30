// Where Stripe sends a founder after Checkout (spec 100).
//
// It exists so that the plan is already correct by the time they see a screen. Checkout used to
// return straight to Settings, which could only report what the webhook had managed to write yet —
// and if the webhook had not landed (no listener, unregistered endpoint, a database behind its
// migrations) the founder read "Free" one line under a payment they had just made.
//
// So the return asks Stripe itself, applies the answer, and only then renders anything. The redirect
// is still not the proof — `syncPlanFromStripe` re-reads the subscription server-side and the
// browser's word is never taken for it.
//
// Inside `/app`, so the middleware's auth gate covers it: a signed-out request never reaches the
// sync, and `requireSession` scopes it to the caller's own organization.
import { NextResponse } from "next/server";
import { syncPlanFromStripe } from "@/features/billing/sync";
import { requireSession } from "@/lib/auth";

export async function GET(req: Request) {
  const { org } = await requireSession();
  await syncPlanFromStripe(org.id);

  // Where they came from changes only what Settings *says*, never what was written. Someone returning
  // from the billing portal may have just cancelled, so greeting them with "Payment confirmed" would
  // be the same class of mistake this route exists to fix.
  const from = new URL(req.url).searchParams.get("from");
  const target = from === "portal" ? "/app/settings?refreshed=1" : "/app/settings?upgraded=1";
  return NextResponse.redirect(new URL(target, req.url));
}
