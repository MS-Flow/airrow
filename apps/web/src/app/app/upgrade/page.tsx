// The upgrade screen (spec 100).
//
// A refusal used to be an inline error string at the end of an interview — the product simply
// stopping, in red, next to a button that no longer worked. This is the screen that string now sends
// the founder to: what Pro gives, what it does not take away, and a way to buy it.
//
// Reached deliberately rather than redirected into. A founder who has just answered thirty questions
// should not be thrown somewhere else; they follow a link when they are ready.
import Link from "next/link";
import { Check } from "lucide-react";
import { PageContainer } from "@/components/shell/page-container";
import { Card, CardBody } from "@/components/ui/card";
import {
  BillingUnavailable,
  ManageBillingButton,
  UpgradeButtons
} from "@/features/billing/BillingActions";
import { readPricing, upgradeAmounts } from "@/features/billing/prices";
import { planWithStripe } from "@/features/billing/sync";
import {
  FREE_GENERATION_LIMIT,
  FREE_REPAIR_LIMIT,
  REPAIR_WINDOW_HOURS,
  checkAllowance
} from "@/features/generation/allowance";
import { requireSession } from "@/lib/auth";
import { stripeConfigured, stripePrices } from "@/lib/stripe";

export const metadata = { title: "Upgrade to Pro" };

/** Concrete, and each line is something that exists. A list of adjectives converts nobody. */
const PRO_GIVES = [
  "Unlimited foundations, and unlimited regeneration of the ones you have",
  "Import a project you have already started, from a ZIP or a GitHub repository",
  "Everything the free plan includes, unchanged"
];

export default async function UpgradePage() {
  const { user, org } = await requireSession();
  // Reconciled first, for the same reason Settings is: offering Pro to somebody who already pays for
  // it is the one thing this screen must never do, and a stale row is all it would take.
  const { plan } = await planWithStripe(org);
  const allowance = await checkAllowance({ orgId: org.id, plan, userId: user.id });
  const alreadyPro = plan === "pro";

  // The figures, from Stripe and through the same cached read the landing card uses (spec 179,
  // amendment 1).
  const options = upgradeAmounts(
    await readPricing(),
    stripePrices().map((p) => p.interval)
  );

  return (
    <PageContainer className="max-w-2xl py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-fg">
        {alreadyPro ? "You're on Pro" : "Keep generating with Pro"}
      </h1>

      {alreadyPro ? (
        <p className="mt-2 text-base leading-relaxed text-fg-muted">
          Unlimited foundations, and importing projects you have already started. Manage your card,
          receipts and cancellation below.
        </p>
      ) : (
        <p className="mt-2 text-base leading-relaxed text-fg-muted">
          You&rsquo;ve used {allowance.used === 0 ? "none" : allowance.used} of your{" "}
          {FREE_GENERATION_LIMIT}{" "}
          {FREE_GENERATION_LIMIT === 1 ? "free foundation" : "free foundations"}. Pro removes the
          limit.
        </p>
      )}

      <Card className="mt-8">
        <CardBody className="p-8">
          <ul className="grid gap-3">
            {PRO_GIVES.map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-base text-fg-muted">
                <Check className="mt-0.5 size-4 shrink-0 text-fg" />
                {line}
              </li>
            ))}
          </ul>

          {/* The first thing anyone fears at a paywall is losing what they already made. Said here,
              in the place where the fear happens, rather than only in a help page. */}
          <p className="mt-6 border-t border-border pt-5 text-sm leading-relaxed text-fg-muted">
            <span className="font-medium text-fg">Nothing you already have is affected.</span> Every
            project you have generated stays readable and downloadable — on Pro, on free, and after a
            cancellation. Airrow has no lock-in: your foundation is plain files you keep.
          </p>

          {alreadyPro ? (
            <ManageBillingButton />
          ) : stripeConfigured() ? (
            <UpgradeButtons options={options} />
          ) : (
            <BillingUnavailable />
          )}
        </CardBody>
      </Card>

      {alreadyPro ? null : (
        <p className="mt-6 text-sm leading-relaxed text-fg-faint">
          Not ready? A foundation you have already generated can still be regenerated{" "}
          {FREE_REPAIR_LIMIT} times free within {REPAIR_WINDOW_HOURS} hours of its first run, and a
          regeneration that changes nothing never costs anything.{" "}
          <Link
            href="/app/projects"
            className="text-fg-muted underline underline-offset-4 hover:text-fg"
          >
            Back to your projects
          </Link>
          .
        </p>
      )}
    </PageContainer>
  );
}
