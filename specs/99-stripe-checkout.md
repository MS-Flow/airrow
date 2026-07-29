# Spec 99 — Stripe Checkout and the billing portal for Pro

> **In one sentence:** Make Pro purchasable — Stripe Checkout takes the payment, a webhook is the only
> thing that writes `organizations.plan`, and the founder manages the card, the receipts and the
> cancellation in Stripe's own portal rather than in something we built.

|                |                                                          |
| -------------- | -------------------------------------------------------- |
| **Status**     | ⏳ Not started                                            |
| **Issue**      | #99 — "Stripe Checkout och billing portal för Pro"       |
| **Branch**     | `99-stripe-checkout` (from `feature/pro`)                |
| **Feature**    | Pro                                                       |
| **Depends on** | [74-pro-entitlements.md](74-pro-entitlements.md) — creates `organizations.plan`, the entitlement this spec learns to write, and the column-level privilege that keeps members out of it. **Must be merged into `feature/pro` before this is implemented.** |

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

[NEEDS CLARIFICATION: monthly and yearly, or monthly only to start? The issue says both with roughly
two months off the year. Two prices is barely more work in Checkout, but it is a pricing commitment
this spec would be encoding.]

[NEEDS CLARIFICATION: what is the price? Spec 74 deliberately encodes no amount anywhere and this spec
should not be the first to hardcode one — the intent is a Stripe price id in configuration, not a
figure in the code. Confirm that, and confirm who owns the number.]

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [ ] A founder can go from a refusal message to a completed Stripe Checkout and back, and generate
      immediately afterwards, without re-entering the flow they were in.
- [ ] `organizations.plan` is written **only** by the webhook (and migrations). No server action, no
      route handler, and no Checkout return URL sets it.
- [ ] A webhook request with an invalid or missing signature is rejected before anything is read from
      its body.
- [ ] The same event delivered twice produces one upgrade. Stripe retries, so this is not optional.
- [ ] `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
      and `invoice.payment_failed` are each handled, and an unrecognised event type is ignored
      without erroring.
- [ ] A failed payment does **not** downgrade immediately — Stripe retries for days, and cutting a
      paying founder off on the first failure is a bug, not a policy.
- [ ] A lapsed or cancelled subscription returns the organization to `free` with its usage count
      untouched, and every project stays readable and downloadable (spec 74's rule, unchanged).
- [ ] Card, receipts and cancellation are reached through Stripe's billing portal from settings. We
      build none of those screens.
- [ ] Secrets live server-side only: never in a client bundle, never in a log, never in generated
      output.
- [ ] With no Stripe keys configured the app runs, settings shows Pro as unavailable, and nothing
      throws — the same posture every other integration has.
- [ ] The out-of-allowance messages from spec 74 stop saying Pro "isn't purchasable yet" and become a
      real next step.
- [ ] Every new table has RLS with access **and** denial tests (§II).
- [ ] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — the webhook handler: invalid signature rejected; a replayed event upgrades once;
  `payment_failed` does not downgrade; an unknown event type is a no-op.
- **New tests** — RLS access and denial on the `subscriptions` table, and a denial test proving a
  member still cannot write `plan` through the new surface.
- Fixtures are recorded Stripe payloads, not live calls — §V forbids the network in a test.
- Full suite result + typecheck/lint status.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

Left for `/implement`, and deliberately: spec 74 is not yet merged into `feature/pro`, so the
`file:line` anchors this would cite do not exist on this branch yet. Filling them in now would mean
inventing them.

---

## Data model

_Any database change. Most specs have none — say so plainly._

A `subscriptions` table hanging off `organization_id` (§II), holding the provider's customer and
subscription ids, status, current period end and cancel-at-period-end. RLS scoped through org
membership with denial tests, shipped in the same migration.

`organizations.plan` is **not** replaced by it. Spec 74 settled that: the column is the entitlement
answer and survives a change of payment provider; this table is Stripe's state and would not.

[NEEDS CLARIFICATION: does the webhook write through the DataStore like everything else, or does it
need its own service-role path? It runs without a session — there is no user to scope by — which is
the one case the DataStore's org-scoping assumptions were not written for.]

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
- Subscription cancelled mid-period → [NEEDS CLARIFICATION: does Pro end immediately or at period end?
  `cancel_at_period_end` is Stripe's default and is the kinder answer — confirm.]
- Organization deleted while subscribed → the subscription row cascades; the Stripe subscription does
  not cancel itself. [NEEDS CLARIFICATION: is that acceptable for now, or must account deletion cancel
  the subscription? Billing someone for an account that no longer exists is the kind of thing that
  ends up in a chargeback.]
- No Stripe keys configured → Pro shows as unavailable, nothing throws.
- Admin account → unaffected; the admin flag already wins over any plan.

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- Pricing itself. The figure is a decision, not an implementation, and it belongs in configuration.
- Team seats, per-seat billing and invoicing — a later feature, and a different data model.
- Taxes, VAT handling and invoice customisation beyond what Stripe's portal gives us for free.
- The remaining Pro capabilities (revisions with a diff, GitHub push, repository drift watch) — each
  its own issue.
