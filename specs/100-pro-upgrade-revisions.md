# Spec 100 — The upgrade moment, and revising a foundation

> **In one sentence:** Make the free limit something a founder sees coming rather than collides with,
> and give them the thing that makes hitting it bearable — reopening the interview, changing an
> answer, and seeing exactly which files that moves before anything is written.

|                |                                                          |
| -------------- | -------------------------------------------------------- |
| **Status**     | ✅ Done                                                   |
| **Issue**      | #100 — "Uppgraderingsögonblicket: var foundern möter Pro, och vad hen ser" · #101 — "Pro: ändra ett svar och generera om — med diff mot förra versionen" |
| **Branch**     | `100-pro-upgrade-revisions` (from `feature/pro`)         |
| **Feature**    | Pro                                                       |
| **Depends on** | [74-pro-entitlements.md](74-pro-entitlements.md) — the plan, the free ceiling and the repair window · [99-stripe-checkout.md](99-stripe-checkout.md) — makes Pro purchasable. **Not yet merged into `feature/pro`**; `/implement` needs it there first, the same way this branch needed 74. |

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

**Why two issues in one spec.** #100 asks for Pro-locked surfaces shown "disabled with an
explanation", and names revisions as one of them — which cannot be built until revisions exist. #101
is that feature, and its own last task ("free: one revision inside the repair window; Pro:
unlimited") is a paywall decision. Splitting them would mean one spec waiting on the other and a
locked state written twice. They are one slice: *what happens when a founder wants to change
something after their free foundation.*

The halves are still separable at PR time if this grows too large — §IV asks for small PRs, and the
acceptance criteria below are grouped so that "the upgrade moment" could ship first.

---

## User story

_Who wants this, and what they get out of it._

As a **founder who has used their free foundation** I want **to know that before I start another
one, and to be offered Pro at the moment it actually stops me** so that **the limit reads as a price
list rather than an ambush**.

As a **founder whose understanding of their own product changed** I want **to reopen the interview,
fix one answer, and see exactly which files that moves before anything is written** so that **a
foundation is something I can steer rather than a lottery ticket I already spent**.

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today, the limit:** `checkAllowance` refuses at `submitInterviewAction` and
  `retryGenerationAction` — which is already the right place, at generate rather than at project
  creation, so a founder out of allowance *can* click through a whole interview and is stopped at the
  end. Nothing tells them in advance, and the refusal is an inline error string rather than a screen
  that offers anything.
- **Today, revisions:** none. `project_models` are already versioned and immutable
  (`DATABASE_DESIGN.md`), and spec 65's memoisation means an unchanged rerun costs nothing — so the
  machinery for "generate again from a changed answer" mostly exists. What is missing is the way back
  into the interview, and any way to see what changed.
- **The problem, and it is live:** the landing page still badges Pro "Coming soon" with the action
  "Not available yet" (`features/landing/copy.ts:201,206`). Spec 99 made Pro purchasable. The moment
  99 reaches production the pricing section is **lying to visitors**, and it is the one screen whose
  entire job is to be believed.
- **Already in place:** spec 74's settings plan card, the locked import state and `ProPreview`, and
  spec 99's upgrade buttons and billing portal. Roughly half of #100's task list is built — what is
  left is the *advance notice*, the *upgrade screen*, and the landing page.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

**The wall stays at generate.** A founder who is out may still create a project and answer every
question; they meet Pro when they press the button that would cost a Claude call. That is already how
the code behaves, so this spec's job is to make it *legible* — a standing line on the project and
interview screens saying where they stand, and a real upgrade screen where there is currently an
inline error string.

**A revision is a regeneration with a diff in front of it.** Reopen the completed interview
prefilled, change answers, resolve the model, and show the founder which files the change moves —
added, changed, removed — before anything is written. §0 requires that approval step anyway; this
makes it useful rather than ceremonial.

**Not touched:** `checkAllowance` and the entitlement model. Free gets its repairs inside the window
that spec 74 already built, Pro gets no limit, and neither of those is a new rule — this spec only
gives the founder a way to *use* the repairs they already have.

**The diff classifies paths; the reader shows content.** Both artifacts hold every file's full text,
so added / changed / removed / unchanged is exact rather than approximate, and the preview already
has a file reader the founder can open any of them in. A line-level diff renderer is a separate piece
of UI work and buys less than it costs here — knowing *which* files a changed answer moves is the
decision they are making.

**Nothing is shown locked that does not exist.** #100 lists "history" among the Pro-locked surfaces
to display disabled. There is no history feature and no spec for one. A padlock on something that was
never built is how a product starts feeling like a mockup, so it is left out until it is real.

**The landing card still names no figure.** Spec 99 keeps every amount in Stripe so it can change
without a deploy; putting one in static marketing copy would recreate exactly the duplication that
decision avoided. The card stops saying "Coming soon" and its action becomes a real call to start.

### Where the diff goes, and why not where the spec first said

This spec was drafted assuming the diff must come *before* generation. Reading the code changed that:
the product already reviews after generating and before **delivering** — spec 63's import review
loads the completed artifact, diffs it against the founder's files, and takes conflict decisions
before the download. §0 requires approval before anything is *written*, and nothing is written to the
founder's machine until they download.

Putting a content-accurate diff ahead of generation would also mean paying for the Claude call to
compute it, which is the opposite of the point. So the revision diff lives on the preview screen,
comparing the latest completed generation with the one before it — the same shape as the import
review, in the place the founder already goes to look at their foundation.

**Reopening the interview needed no work.** `app/app/projects/[id]/interview/page.tsx` already loads
saved answers and passes `regenerating` when the project is `ready`, and `InterviewRuntime` already
relabels itself for it. #101's first task was built before this spec existed.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

### The upgrade moment (#100)

- [x] The project list and the interview screen state where the founder stands before they start —
      not only once they are refused.
- [x] A founder with no allowance left can still create a project and complete the entire interview.
      They are stopped at generate, and nowhere earlier.
- [x] That refusal is a real screen that says what Pro gives and that existing projects and downloads
      are never affected — not an inline error string.
- [x] The landing page stops badging Pro "Coming soon" and stops saying "Not available yet".
- [x] Loading, error and empty are real components, not conditionals in JSX (§III).
- [x] No screen in the path — free interview → generate → refusal → upgrade → generate — is a dead
      end.

### Revisions (#101)

- [x] A completed interview can be reopened with its answers prefilled.
- [x] Changing an answer and regenerating produces a preview of what moves — added, changed and
      removed files — which the founder approves before anything is written (§0).
- [x] An unchanged regeneration makes no Claude call and spends no allowance, and says so rather than
      silently doing nothing (spec 74 built the behaviour; this makes it visible).
- [x] A founder's own files in an imported project are never touched by a revision.
- [x] Free gets the repairs spec 74 defines; Pro is unlimited. No new entitlement rule is introduced.
- [x] Pro-locked surfaces are shown disabled with an explanation rather than hidden.

### Paying for real (added 2026-07-30, after the first live-ish run)

- [x] A completed payment turns into Pro **without** depending on webhook delivery: Checkout returns
      through a route that reconciles with Stripe's API before any screen renders.
- [x] A founder who is on free and believes they have paid can resolve it themselves, from Settings,
      without a support ticket or a SQL statement.
- [x] Nothing grants Pro on the strength of the redirect. Every write still comes from something
      Stripe said, through `applySubscriptionState`.
- [x] The reconciliation applies a *cancellation* as readily as a purchase — it is a sync, not an
      upgrade button in disguise.
- [x] Settings never claims a plan the database does not hold.
- [x] The plan card distinguishes renewing, cancelled, trialing, failed payment, paused and ended —
      and names the date each of them turns on. A cancelled subscription never reads as renewing.
- [x] A misconfigured or unreachable Stripe degrades to the honest disabled state and a named
      variable in the log, never to a crash on the button a founder pressed to pay.
- [x] Going live is a written checklist, not folklore: live keys, live price, live webhook endpoint,
      portal, VAT decision, and one real payment proved end to end.

- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — `packages/engine/src/revision.test.ts` (6): the diff classification, including the
  case a naive implementation drops — a file the previous generation had and the new one does not.
  Walking only the new tree misses it silently, and a founder who is not told a document disappeared
  finds out months later, from its absence.
- **New tests** — `apps/web/src/features/generation/AllowanceNotice.test.tsx` (4): nothing renders
  for an unlimited plan, the remaining count renders while there is one, and a spent founder is told
  the interview is still open — the behaviour issue #100 asks for by name.
- **New tests** — `apps/web/src/features/landing/copy.test.ts` (2): the pricing section describes Pro
  as neither "coming soon" nor unavailable, and names no figure. The first would have caught the live
  inconsistency this spec fixes; the second holds spec 99's "the amount lives in Stripe".
- Reopening a prefilled interview → already covered by the existing interview tests, because it was
  already built (see _Design decision_).
- Full suite result + typecheck/lint status.

### Result (2026-07-29)

```
pnpm -r typecheck   Done — clean across schemas, engine, web
pnpm -r lint        Done — no new issues
pnpm -r test        schemas   35 passed
                    engine   219 passed
                    web      364 passed | 0 skipped (50 files)
pnpm test:scripts     13 passed
pnpm build          Done — /app/upgrade and /api/stripe/webhook both in the route manifest
```

Run against a live local Supabase, so the RLS and billing suites executed rather than skipping. An
earlier run in this session reported 43 tests skipped across 8 files; that was Docker having stopped,
not a code change, and `/analyze` brought the database back up and confirmed them green rather than
taking the note's word for it.

`pnpm build` is in the bar for this spec specifically: the whole point was a Pro path that *works*,
and typecheck does not prove a route renders in a production build.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

1. **`packages/engine/src/revision.ts`** (new) — `diffGenerations(previous, next)`, pure. Classifies
   every path as added / changed / removed and counts the rest, ordered the way a founder reads it.
   Exported from `index.ts`. It walks **both** trees, not just the new one, which is what makes a
   removed document visible.
2. **`apps/web/src/lib/data/store.ts`** — `previousCompletedJob(projectId, beforeJobId)`. Filters on
   `created_at <` the current job rather than merely excluding its id: excluding by id alone would
   hand back a *newer* completed job and call it the previous version.
3. **`apps/web/src/features/preview/RevisionDiff.tsx`** (new) — the diff list. A removed path is
   struck through and not a link, because the reader would 404 on it. Empty state is its own branch,
   and says the regeneration cost nothing.
4. **`apps/web/src/app/app/projects/[id]/page.tsx`** — loads the previous artifact and renders the
   diff. This page, not the preview: see the deviation note below.
5. **`apps/web/src/app/app/upgrade/page.tsx`** (new) — the upgrade screen. Reuses spec 99's
   `UpgradeButtons` / `ManageBillingButton` / `BillingUnavailable` rather than growing a second
   checkout surface, and handles the already-Pro case so the link is never a dead end.
6. **`apps/web/src/features/generation/AllowanceNotice.tsx`** (new) — the standing line. Renders
   `null` for an unlimited plan: a banner about a wall nobody is near teaches founders to ignore
   banners.
7. **`app/app/projects/page.tsx`, `app/app/projects/[id]/interview/page.tsx`** — render the notice.
   The interview page passes `projectId`, so a founder inside their repair window is told they have
   one rather than being warned they are out.
8. **`features/interview/actions.ts`, `features/generation/actions.ts`** — return `upgrade: true`
   alongside the message. Running out and failing are different events and must not look alike.
9. **`features/interview/InterviewRuntime.tsx`** — renders that as an accent panel with a link to the
   upgrade screen instead of `InlineError`. Answers are already saved by the time this shows, so
   leaving the page loses nothing.
10. **`features/landing/copy.ts`, `app/page.tsx`** — the Pro card loses its "Coming soon" badge, its
    dashed border and its disabled button, and gains a real call to action.

**No change needed:** reopening a prefilled interview, and the free-vs-Pro revision rule. Both were
already built — see _Design decision_.

---

## Data model

_Any database change. Most specs have none — say so plainly._

**No schema changes expected.** `project_models` are already versioned and immutable, which is what a
revision needs, and `generation_usage` already records what was charged. If the diff turns out to need
persisting rather than recomputing, that is a table and it ships with RLS and denial tests in the same
migration (§II) — but recomputing from two model versions should be enough.

---

## Security

Nothing new is exposed: every screen here is inside `/app`, scoped by the session's organization, and
the revision path runs through the same server actions and the same `checkAllowance` gate as a first
generation. The one thing to hold: a founder must not be able to reach another organization's
interview by id when reopening it, which is the existing `getProject(org.id, id)` scoping and must
stay that way.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- Founder is out of allowance and starts a project → allowed all the way through the interview,
  refused at generate with an offer.
- Founder upgrades mid-interview → returns to the interview and generates; nothing they answered is
  lost.
- Revision with no answers changed → no Claude call, no allowance spent, and the founder is told that
  rather than watching a progress screen that changes nothing.
- Revision on an imported project → the founder's own files are untouched, and conflicts resolve
  through the machinery spec 63 already built.
- Revision that removes a file the previous foundation had → shown as removed in the diff, and only
  written after approval.
- Free founder inside the repair window → allowed; outside it, or past the count, refused with the
  reason spec 74's `allowanceMessage` already distinguishes.

---

## Implementation notes

**Two of #101's tasks were already done.** Reopening a completed interview prefilled is built —
`interview/page.tsx` passes saved answers and a `regenerating` flag, and `InterviewRuntime` relabels
itself for it. So is the free-vs-Pro revision rule, which is spec 74's repair window. Reading the code
before planning turned #101 from "a new capability" into "the diff that was missing from one", which
is most of why this spec came in as small as it did.

**The diff moved from the preview to the project page.** The spec's own _Design decision_ said the
preview screen. The preview is a full-height file browser — a card inside it fights the layout — and
the project page is where a founder lands after generating and already loads the artifact. It is still
before the download, which is the only point where anything reaches their machine, so §0's approval
requirement is met in either place. Recorded rather than quietly done, because the spec said otherwise
and the spec is the source of truth (§IV).

**`AllowanceNotice` takes the whole `Entitlement`, not a count.** It reads `unlimited` to decide
whether to render at all and `remaining` for the number, which means adding a plan later cannot leave
it silently saying the wrong thing to someone it has never heard of — the union does not let it.

**`/analyze` found two things, and one of them was a habit.** The route map in `UI_ARCHITECTURE.md`
did not list `/app/upgrade` — the third consecutive spec to add something and not document it, after
74 and 99 both missed `DATABASE_DESIGN.md`. Spec 99's notes said the next `/analyze` should look for
it; it did, and found it. The pattern was documenting what a change *modifies* and forgetting what it
*adds*, so the fix went wider than this spec: `/app/upgrade` plus the two import routes that had been
missing since spec 63, and a paragraph on where the paywall sits.

The second was duplication. The same accent panel had been hand-rolled three times — the import
screen, the import result, and the end of the interview — with identical classes and identical
meaning, and the third was a raw `<div>` sitting next to `InlineError`, which is a component. Two of
this spec's own criteria pointed at that and were ticked anyway. It is now `UpgradeNotice` in
`components/ui/states.tsx`, beside the other state components, with its own reason for existing: a
plan boundary is not an error and must not borrow the danger tone, and it is not a `Notice` either,
because running out of free foundations is neither a caution nor a mistake. It is a price.

**Docs that had drifted, fixed here rather than deferred.** `SYSTEM_OVERVIEW.md` and `CLAUDE.md` both
described a local file-backed store in `.data/` that has not existed since spec 14 — `lib/data/` holds
Supabase clients and nothing else. `SYSTEM_OVERVIEW.md` also had no mention of Stripe in its external
services table despite spec 99 shipping it; it now carries the failure posture and a short section on
how plans and billing fit together. `DEVELOPER_GUIDE.md` gained the Stripe setup that turns "the code
is there" into "a developer can run the paid path" — product and price, the four env vars,
`stripe listen`, the test card, and the SQL for granting yourself Pro without paying.

**Two lint/verification notes.** The upgrade screen briefly imported `Button` without using it, which
`pnpm -r lint` caught as a new warning; §VI says lint adds *no new* issues, so it was removed rather
than tolerated. And `revision.ts` first imported `GeneratedFile` from `@airrow/schemas`, which the app
resolves and the engine does not — the engine reaches shared types by relative path
(`../../schemas/src/types.ts`), which is the convention `import.ts` already follows.

---

### Fixed after the first deploy (2026-07-30)

Two things this spec shipped were only visible on a deployment, and both were found by using it.

**1. `column generation_jobs.reused_authoring does not exist` — a 500 on the interview screen.**
Digest `1549084546` in the preview deployment's runtime log, on
`GET /app/projects/[id]/interview`. The column arrives with `20260729120000_pro_plan.sql`, which had
not been pushed to the cloud database: Vercel deploys code and nothing deploys the schema. So every
allowance read — `countGenerations`, `projectUsage`, and therefore `AllowanceNotice` on both the
project list and the interview — failed on a column the code knows about and the database does not.

The durable fix is `pnpm dlx supabase db push`, and it is now written into
`INFRASTRUCTURE_SETUP.md` where the first push already lives, with the symptom named so the next
person recognises it. The code fix is narrower and deliberately so: `jobCharges` in `store.ts` falls
back to `select id, status` when that one column is missing, which keeps the *read* surfaces up — a
column that does not exist means no job can have reused a payload, so the ledger counts exactly what
it counted before the column existed, and `isMissingPlanColumn` generalised into `isMissingColumn(error,
column)` so a caller has to name the column it is prepared to do without. An unrelated error still
throws, which is the point: this is not a blanket catch, and a stale schema is not made harmless.
Generation still writes the flag and billing still needs tables from the same batch, so the migration
is not optional — the shim only keeps the screens that merely *report* the allowance from taking the
whole app down with them.

**2. "Start with Pro" went to the new-project form.** The pricing section's Pro action reused
`primaryHref`, so the one visitor who had actually met the free limit was handed the single screen
that cannot lift it — and would have met the same wall again thirty questions later.
`features/landing/pro-cta.ts` now decides from the founder's entitlement rather than from which card
they pressed: nothing generated yet → `/app/projects/new` (nobody is asked to pay before the product
has done anything for them), a foundation already spent → `/app/upgrade` directly, signed out → the
guest interview, since Pro cannot be bought without an account either way. Already-Pro also lands on
`/app/upgrade`, which recognises the case and offers the billing portal, so no branch is a dead end.

It takes the whole `Entitlement` for the same reason `AllowanceNotice` does, so the link cannot drift
from what the founder is told one section higher up the page.

**And the copy was still lying, in the future tense.** `pricing.body` said "Pro lifts the limit when
it lands". Spec 100 swept the page for "coming soon" and "not available" and this survived, so the
test that was supposed to catch exactly this drift did not — it now checks for the promise as well as
the disclaimer. The criterion above was ticked with the sentence still on the page, which is the
argument for testing the copy rather than reading it.

**3. "Upgrade to Pro" was not clickable.** The deployment had `STRIPE_PRICE_MONTLY` set — no `H` — so
`stripeConfigured()` was false and `BillingUnavailable` rendered: a disabled button whose only
explanation was a `title` attribute. Invisible on a phone, invisible to anyone who does not think to
hover a control that looks broken, and nothing in the server log said anything at all. The deployment
was indistinguishable from one where Pro had never been built.

Fixing the variable name is the deployment's job. Three things here make sure the next typo announces
itself:

- `missingStripeConfig()` in `lib/stripe.ts` names the absent variables, and `stripeConfigured()`
  warns once per server instance with that list. Names only — a value never reaches a log (§II).
- `BillingUnavailable` puts the reason on the page, in a `Notice`, beside the still-disabled button.
  The plan boundary stays visible (the criterion above), but it is no longer the only thing on screen.
- `STRIPE_WEBHOOK_SECRET` joined the required set. Nothing about *taking* money needs it, which is
  exactly the problem: the webhook is the only writer of `organizations.plan`, so a deployment that
  can charge a card and cannot verify the event that follows takes a founder's money and grants them
  nothing. Refusing to sell is the only safe failure.

**4. "Buy Pro" then threw `No such price: ':price_1Tyq…'`.** The variable name was fixed and the
*value* carried a stray colon from the paste. Two separate faults, and the second one got further:
Checkout was called, Stripe refused, the action's promise rejected, and the founder met a Next runtime
error page on the button they had pressed to pay us.

- `lib/stripe.ts` now trims every value and checks it against the prefix Stripe guarantees
  (`sk_`/`rk_`, `price_`, `whsec_`). A malformed value is treated as not configured — so the screen
  falls back to the honest disabled state instead of a crash — and `missingStripeConfig()` reports it
  differently from an absent one, because those are different mistakes. Nothing is silently repaired:
  stripping the colon would be guessing at which price to charge, and guessing wrong is worse than
  refusing.
- `fromStripe` in `features/billing/actions.ts` wraps both Stripe calls, including customer creation.
  These actions exist to *answer* — `BillingActions` renders `state.error` and only navigates on a URL,
  which is the entire reason they do not redirect themselves — and a rejected promise broke that
  contract. What Stripe said goes to the server log; the founder gets a sentence they can act on and
  the assurance that nothing was charged.

**5. Paid, and Settings said both things at once.** The card went through and the plan stayed free, so
the page read "You&rsquo;re on Pro" directly above "Free · 0 of 1 foundation left". Two sentences from
one screen, one checked against the database and the other inferred from `?upgraded=1` — which is the
Checkout redirect, the thing spec 99 exists to say proves nothing. The founder has no way to know which
half to believe, and the half that was wrong was the reassuring one.

The banner now reads `org.plan`: "Payment confirmed. You're on Pro." only when the plan says so,
otherwise a `Notice` that says the payment arrived, that the plan switches when Stripe confirms it, and
that nothing is lost if it does not. Three tests in `app/app/settings/page.test.tsx` hold it, including
the one that would have caught this: with `upgraded=1` and a free plan, the page must not claim Pro.

**Why the plan had not moved** is not a code fault, and both causes are worth recording because they
look identical from the outside: nothing was listening (`stripe listen` was not running locally, and
the Stripe CLI was not installed), and the database was still missing `20260729120000_pro_plan.sql`, so
`applySubscriptionState` could not have written `organizations.plan` even if an event had arrived. The
webhook handles that correctly — it releases its `stripe_events` claim so Stripe's retry is a real
second attempt — but a retry into an unmigrated database is a founder who paid and stays on free
indefinitely. `DEVELOPER_GUIDE.md` gained a "Paid, and still on Free" runbook in that order: listener,
delivery response, schema, then resend the event.

**6. And then the rule itself had to change.** The fix above told the founder the truth and left them
stuck in it. Three failures in a row — no listener, an unmigrated database, a mistyped variable — were
each enough on their own to turn a completed payment into a founder on free, and every one of them
lived in webhook *delivery*. A payment path whose only route to the entitlement is an inbound HTTP call
we do not control has a single point of failure by construction, and "run this SQL" is not a product.

**Amendment to spec 99 (recorded here, per the constitution's amendment rule).** Spec 99 said the
webhook is the only non-migration writer of `organizations.plan`. It now reads: *the plan is written
only from something Stripe told us*, which is the webhook **or** a direct, server-side read of Stripe's
API — both through `applySubscriptionState`, and neither ever from the browser. The sentence spec 99
was actually defending is untouched: a Checkout redirect proves nothing and grants nothing. Asking
Stripe with our own secret key is not the redirect; it is the same evidence the webhook carries,
pulled instead of pushed.

What that bought, in order of how much it matters:

- **`features/billing/sync.ts`** — `syncPlanFromStripe(orgId)`. Reads the organization's own recorded
  customer, lists its subscriptions, picks the one that decides the plan and applies it. It writes only
  when Stripe has something to say (`unknown` is deliberately distinct from `free`), applies a
  cancellation exactly as readily as a purchase, and never throws: it runs on the screen where someone
  is confirming a payment, and taking that screen down would turn a delay into an outage.
- **`app/app/upgrade/return/route.ts`** — Checkout's `success_url`. The plan is reconciled *before*
  anything renders, so the ordinary case is now correct with or without the webhook. Inside `/app`, so
  the auth gate covers it and `requireSession` scopes it to the caller's own organization.
- **"Already paid? Check again"** on Settings, shown only to an organization that has a customer record
  and is still on free. The founder's own way out of the exact state this spec's author sat in, without
  a support ticket.
- **`features/billing/subscription-state.ts`** — the webhook's reading of a subscription, lifted out so
  both writers share it. Two places deciding a plan slightly differently is the kind of drift that is
  only discovered by the person it charges.

**The webhook is still required and is still primary.** Renewals, failed payments and cancellations
arrive when nobody is looking at a screen, and no sync runs then. What changed is that it is no longer
the *only* way a payment can become a plan.

**7. And the plan card still said "Renews automatically" to someone who had just cancelled.** Stripe
keeps a cancelled subscription `active` until the last day of the paid period, so reading the status
alone never had the answer — the flag beside it does, and the card was reading the wrong one first.
The row was stale on top of that, for the same reason as everything else in this section: the
`customer.subscription.updated` event had nowhere to land.

- **`features/billing/plan-standing.ts`** — one derivation of where a paid workspace stands, from all
  three fields Stripe gives us. `cancelAtPeriodEnd` is checked *before* the status, which is the whole
  bug. Cancelled, Trial, Payment failed, Paused, Ended, Not started and Renews each say what happens
  next and when, and a status Stripe has not invented yet promises nothing about money. Pure, so the
  wording is tested without a database or a browser (10 tests).
- **The billing portal returns through the reconciliation too** (`?from=portal`), so a cancellation is
  visible the moment the founder comes back rather than whenever a webhook manages to arrive. That
  return says "Updated from Stripe" rather than "Payment confirmed" — greeting someone who just
  cancelled with a payment confirmation is the same class of mistake as §5.
- **"Check again" is offered on Pro as well**, beside Manage billing. Being stale is not a state that
  only free organizations get to be in.

**Going live is now written down.** `INFRASTRUCTURE_SETUP.md` §6 covers what test mode does not carry
over — live product and price, live keys, a live webhook endpoint and its own signing secret, the
customer portal Stripe requires you to switch on before `Manage billing` works — plus the two things
code cannot decide: VAT (Checkout is created without `automatic_tax`, which is a deliberate decision to
make rather than a default to inherit) and what `/terms` says about renewal and cancellation. It ends
with one real payment proved end to end, and a refund.

**Verification (2026-07-30)**

```
pnpm -r typecheck   Done — clean across schemas, engine, web
pnpm -r lint        Done — no new issues
pnpm -r test        schemas   35 passed
                    engine   219 passed
                    web      418 passed (57 files)
pnpm test:scripts     13 passed
pnpm build          Done
```

New tests: `lib/data/store.usage-compat.test.ts` (4) — the fallback, that it still excludes failed
jobs, and that any other error stays loud; `features/landing/pro-cta.test.ts` (4) — the four
destinations; `app/smoke.test.tsx` (+2) — the signed-in landing page routes the Pro action by
entitlement, which is the level the bug actually lived at; `features/landing/copy.test.ts` (+1) — the
future-tense promise; `features/billing/BillingUnavailable.test.tsx` (2) — the reason is on the page,
including that nothing already generated is affected; `lib/stripe.test.ts` (+5) — the webhook secret
is required, a misspelled variable is reported by name, and a price id with a stray colon is rejected
before Stripe sees it; `features/billing/actions.test.ts` (+2) — a rejected Stripe call is reported
inline with the detail in the log, for the checkout session and for the customer behind it;
`app/app/settings/page.test.tsx` (+5) — coming back from Checkout claims Pro only when the plan says
so, says nothing about a payment when nobody came back from one, and offers "check again" to exactly
the organization that has been to Checkout and is still on free; `features/billing/sync.test.ts` (7) —
the reconciliation grants from what Stripe reports, applies a cancellation the same way, prefers a paid
subscription over an abandoned attempt, writes nothing when there is nothing to write, and reports
rather than throws when Stripe is unreachable; `features/billing/actions.test.ts` (+1) — Checkout
returns through the reconciling route rather than straight to Settings;
`features/billing/plan-standing.test.ts` (10) — every state a paid workspace can be in, including the
one that started it: a cancelled subscription must never read as renewing.

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- Foundation history and restore — a related idea, no spec, and named here only because #100 asks
  whether to show it locked. That question is a marker above, not a commitment.
- Push to GitHub and repository drift watch — the other Pro capabilities, each its own issue.
- Any change to the entitlement model. Free stays at one foundation plus its repairs; Pro stays
  unlimited.
- Pricing. If the landing card names a figure, that decision is recorded above and the figure still
  belongs in one place.
