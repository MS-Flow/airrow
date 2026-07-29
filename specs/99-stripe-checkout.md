# Spec 99 — Stripe Checkout and the billing portal for Pro

> **In one sentence:** Make Pro purchasable — Stripe Checkout takes the payment, a webhook is the only
> thing that writes `organizations.plan`, and the founder manages the card, the receipts and the
> cancellation in Stripe's own portal rather than in something we built.

|                |                                                          |
| -------------- | -------------------------------------------------------- |
| **Status**     | 🔄 In progress                                            |
| **Issue**      | #99 — "Stripe Checkout och billing portal för Pro"       |
| **Branch**     | `99-stripe-checkout` (from `feature/pro`)                |
| **Feature**    | Pro                                                       |
| **Depends on** | [74-pro-entitlements.md](74-pro-entitlements.md) — creates `organizations.plan`, the entitlement this spec learns to write, and the column-level privilege that keeps members out of it. Merged into `feature/pro` (PR #107) and present on this branch. |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Canonical single-file spec format for Airrow. One file per issue: specs/NNN-kort.md. It holds the WHAT,
the HOW (exact file:line changes), acceptance criteria, verification and edge cases together — do NOT
split into separate plan.md / tasks.md files.
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
Mark anything undecided inline with [NEEDS CLARIFICATION: …] so /clarify can find it.
Keep the section names as they are — the slash commands and the constitution refer to them by name.
-->

---

## User story

_Who wants this, and what they get out of it._

As a **founder who has just been told their free foundation is spent** I want **to pay and carry on
from where I was** so that **the limit is a checkout rather than the end of the product**.

And as a **founder who no longer wants to pay** I want **to cancel without writing to anyone** so that
**subscribing never feels like a trap**.

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today:** spec 74 gives an organization a `plan`, and everything downstream of it works — the
  generation gate, the import gate, the settings card, the refusal messages. `'pro'` is settable only
  by a migration, so the whole paid path is real and testable and reachable by exactly nobody.
- **The problem:** every refusal message currently ends by saying Pro "isn't purchasable yet". That is
  honest, and it is also the product ending for anyone who hits it.
- **Already in place:** `organizations.plan` with a check constraint; the column-level revoke that
  stops a member writing it (spec 74's migration); `checkAllowance` reading the plan server-side on
  every generation and import.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

Stripe Checkout for the purchase and Stripe's billing portal for everything after it. **The webhook is
the only non-migration writer of `plan`** — not the Checkout redirect, which the browser controls and
which a founder can reach without paying. Billing state that is Stripe's (customer id, subscription
status, period end, cancel-at-period-end) goes in a `subscriptions` table beside the column, not
inside it: spec 74 decided the column is the entitlement answer and stays a single cheap read.

**Not touched:** `checkAllowance` and every gate that calls it. They already ask "is this organization
Pro?", and this spec only changes how the answer gets to be yes.

**No amount appears in this repository.** Checkout is handed a Stripe *price id* read from the
environment, and the amount lives in the Stripe dashboard where it can change without a deploy. That
also settles the monthly/yearly question without committing to it: two optional price ids, and the UI
offers whichever are configured. Ship with monthly set and yearly empty, and turning yearly on later
is an environment variable rather than a change here.

**A subscription cancelled mid-period runs to the end of the period.** Stripe's
`cancel_at_period_end` is the default and the kinder answer: a founder who cancels on day 2 has paid
for the month and keeps it. `customer.subscription.deleted` is what actually ends Pro, and Stripe
sends it when the period closes.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] A founder can go from a refusal message to a completed Stripe Checkout and back, and generate
      immediately afterwards, without re-entering the flow they were in.
- [x] `organizations.plan` is written **only** by the webhook (and migrations). No server action, no
      route handler, and no Checkout return URL sets it.
- [x] A webhook request with an invalid or missing signature is rejected before anything is read from
      its body.
- [x] The same event delivered twice produces one upgrade. Stripe retries, so this is not optional.
- [x] `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
      and `invoice.payment_failed` are each handled, and an unrecognised event type is ignored
      without erroring.
- [x] A failed payment does **not** downgrade immediately — Stripe retries for days, and cutting a
      paying founder off on the first failure is a bug, not a policy.
- [x] A lapsed or cancelled subscription returns the organization to `free` with its usage count
      untouched, and every project stays readable and downloadable (spec 74's rule, unchanged).
- [x] Card, receipts and cancellation are reached through Stripe's billing portal from settings. We
      build none of those screens.
- [x] Secrets live server-side only: never in a client bundle, never in a log, never in generated
      output.
- [x] With no Stripe keys configured the app runs, settings shows Pro as unavailable, and nothing
      throws — the same posture every other integration has.
- [x] The out-of-allowance messages from spec 74 stop saying Pro "isn't purchasable yet" and become a
      real next step.
- [x] Every new table has RLS with access **and** denial tests (§II).
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — `apps/web/src/app/api/stripe/webhook/route.test.ts` (16): missing and invalid
  signatures rejected with nothing written and nothing explained; verification runs against the raw
  body; the event is claimed *before* it is applied; a redelivery is a 200 no-op; `payment_failed`
  does not downgrade; `past_due` stays Pro; `deleted` ends it; an unknown type and an unknown
  customer are both no-ops.
- **New tests** — `apps/web/src/lib/stripe.test.ts` (11): which statuses entitle Pro, an unknown
  status defaulting *down*, and the configuration gates.
- **New tests** — `apps/web/src/lib/data/billing.db.test.ts` (4): the primary key that makes claiming
  an event atomic, one-subscription-per-organization, and the cascade on org deletion.
- **New tests** — `apps/web/src/lib/data/schema.rls.test.ts` (3): a member reads their own
  subscription and not another org's, cannot write it, and cannot read `stripe_events` at all.
- Stripe's SDK is mocked throughout — §V forbids the network, and the signature algorithm is Stripe's
  code. What is asserted is that we call it, before anything else, and honour the answer.
- Full suite result + typecheck/lint status.

### Result (2026-07-29)

```
pnpm -r typecheck   Done — clean across schemas, engine, web
pnpm -r lint        Done — no new issues
pnpm -r test        schemas   35 passed
                    engine   213 passed
                    web      351 passed | 0 skipped (49 files)
pnpm test:scripts     13 passed
```

Run against a live local Supabase, so the RLS and billing suites executed rather than skipping.
`20260729140000_stripe_billing.sql` was applied through `supabase migration up`.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

1. **`supabase/migrations/20260729140000_stripe_billing.sql`** (new) — `subscriptions` (one row per
   organization, holding the provider ids, status, period end and cancel-at-period-end) and
   `stripe_events` (delivered event ids, for idempotency). `subscriptions` is readable by org members
   and writable by nobody but `service_role`; `stripe_events` has RLS enabled with **no policy at
   all**, the same deny-everything shape `admin_emails` uses — a founder has no business reading the
   webhook's bookkeeping.
2. **`apps/web/src/lib/stripe.ts`** (new) — the server-only client, built from the environment and
   throwing if asked for without keys, mirroring `lib/data/supabase.ts`. Plus `stripeConfigured()`,
   so the UI can ask whether the path exists without constructing anything.
3. **`apps/web/src/lib/data/store.ts`** — `getSubscription(orgId)`, `linkStripeCustomer`,
   `applySubscriptionState` (writes `subscriptions` **and** `organizations.plan` together), and
   `claimStripeEvent(eventId)` returning false when the id has been seen before.
4. **`apps/web/src/features/billing/actions.ts`** (new) — `startCheckoutAction` creates or reuses the
   Stripe customer and returns a Checkout URL; `openBillingPortalAction` returns a portal URL. Both
   resolve the organization from the session and never take one from the client.
5. **`apps/web/src/app/api/stripe/webhook/route.ts`** (new) — verifies the signature against the raw
   body before parsing, claims the event id, then applies the state change.
6. **`apps/web/src/features/billing/BillingCard.tsx`** (new) and
   **`apps/web/src/app/app/settings/page.tsx`** — the plan card gains an upgrade button on free and a
   "manage billing" link on Pro, and shows unavailable when Stripe is not configured.
7. **`apps/web/src/features/generation/allowance.ts`** and
   **`apps/web/src/features/import/ProPreview.tsx`** — retire the "isn't purchasable yet" wording
   spec 74 deliberately shipped.
8. **`apps/web/.env.example`** — the four Stripe variables, documented like every other integration.

**No change needed:** `checkAllowance` and every gate that calls it. They ask "is this organization
Pro?" and this spec only changes how the answer comes to be yes.

---

## Data model

_Any database change. Most specs have none — say so plainly._

A `subscriptions` table hanging off `organization_id` (§II), holding the provider's customer and
subscription ids, status, current period end and cancel-at-period-end. RLS scoped through org
membership with denial tests, shipped in the same migration.

`organizations.plan` is **not** replaced by it. Spec 74 settled that: the column is the entitlement
answer and survives a change of payment provider; this table is Stripe's state and would not.

A second table, `stripe_events`, holds the ids of events already applied. Stripe redelivers, so
without it a retried `checkout.session.completed` is a second upgrade. It is not org-scoped and has
no policy: RLS enabled with nothing granted denies everyone, which is the same shape `admin_emails`
uses and the right one for the webhook's own bookkeeping.

**The webhook writes through the DataStore, like everything else.** It has no session, but that does
not make it a special path — the DataStore already runs on the service-role key and does its scoping
in code rather than through RLS, so "which organization" is just a different lookup: the one that
owns this Stripe customer id. That is a server-side authorization decision, merely not a
session-based one. A route handler reaching around the DataStore to touch Supabase directly would
break §I's one-way flow for no gain, and would put the only write path to `plan` outside the layer
every other write lives in.

---

## Security

Payment secrets and the webhook signing secret are server-side only and never reach a client bundle,
a log or generated output. Plan is read from our own database, never from a Checkout redirect or any
client-supplied parameter — a founder who lands on the success URL without paying gains nothing.

The webhook is an unauthenticated public endpoint by necessity, so its signature check is its entire
authorization: it is verified before the body is parsed, and a request that fails it is rejected
without side effects.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- Founder reaches the success URL without completing payment → nothing happens; the plan is whatever
  the webhook last wrote.
- Webhook arrives before the founder is redirected back → the upgrade is already applied; the return
  screen reads the database and finds Pro.
- Webhook arrives late, after the founder has already retried → idempotency on the event id means one
  upgrade, not two.
- Payment fails on renewal → no immediate downgrade; Stripe's retry schedule runs its course.
- Subscription cancelled mid-period → Pro runs to the end of the paid period. The founder has paid
  for the month and keeps it; `customer.subscription.deleted` at period close is what ends it.
- Cancelled and then resubscribed before the period ends → `subscription.updated` clears
  `cancel_at_period_end` and the organization was never not-Pro. Nothing to undo.
- Organization deleted while subscribed → the `subscriptions` row cascades, and the Stripe
  subscription does not cancel itself. Left as-is *for now* and deliberately: there is no general
  account-deletion flow to hook into. The only deletion path today is `purgeUnverifiedSignup`, which
  removes accounts seconds old that have never had a subscription. When account deletion is built, it
  must cancel at Stripe first — billing someone for an account that no longer exists is how you get a
  chargeback. Recorded here so that issue inherits it rather than rediscovering it.
- No Stripe keys configured → Pro shows as unavailable, nothing throws.
- Admin account → unaffected; the admin flag already wins over any plan.

---

## Implementation notes

**Two decisions taken during implementation, both about not trusting the browser.**

The price is chosen server-side from the configured list and never read from the submitted form. A
posted price id would let anyone subscribe at any price that exists in the Stripe account, including
a £0 test price — the form carries an *interval*, and the id is looked up.

The Checkout success URL sets nothing. It is a page the browser can reach by typing it, so it says
"you're on Pro, reload in a moment if this still says Free" and lets the webhook be the thing that
decided. The temptation to flip the plan there — it would feel instant — is exactly the bug this
endpoint exists to avoid.

**A test from spec 74 was inverted rather than deleted.** It asserted that the out-of-allowance
message admits Pro is not purchasable. That was true when written and this spec makes it false, so
the test now asserts the message names Settings and does *not* say "purchasable yet" or "coming
soon". A message that outlives the fact it describes is the failure mode; the test still guards
against it, from the other side.

**`invoice.payment_failed` is handled by being ignored.** The issue listed it as an event to handle,
and it is subscribed to — but the handling is deliberately "do nothing". Stripe moves the
subscription to `past_due` itself and sends that as `subscription.updated`, which `planForStatus`
keeps on Pro. Acting on the failed invoice directly would downgrade a founder whose card expired
before Stripe has finished retrying or even emailed them.

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- Pricing itself. The figure is a decision, not an implementation, and it belongs in configuration.
- Team seats, per-seat billing and invoicing — a later feature, and a different data model.
- Taxes, VAT handling and invoice customisation beyond what Stripe's portal gives us for free.
- The remaining Pro capabilities (revisions with a diff, GitHub push, repository drift watch) — each
  its own issue.
