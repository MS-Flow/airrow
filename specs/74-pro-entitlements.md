# Spec 74 — Pro: a plan and entitlement model, and a free tier of one foundation

> **In one sentence:** Turn the free generation ceiling from a cost control into a business model —
> an organization gets a **plan**, the plan decides what it may do, the free tier becomes one complete
> foundation, importing an existing project becomes Pro, and a founder who has spent their free
> foundation is offered Pro instead of a dead end.

|                |                                                          |
| -------------- | -------------------------------------------------------- |
| **Status**     | ⏳ Not started                                            |
| **Issue**      | #74 — "Pro: plan- och entitlement-modell, och en gratisnivå på en foundation" |
| **Branch**     | `74-pro-entitlements` (from `feature/pro`)               |
| **Feature**    | Pro                                                       |
| **Depends on** | [65-authored-documents.md](65-authored-documents.md) — introduced `FREE_GENERATION_LIMIT`, the `generation_usage` ledger and the "failed jobs don't cost allowance" rule this spec must preserve · [63-import-existing-projects.md](63-import-existing-projects.md) and [67-github-login-import.md](67-github-login-import.md) — build the import this spec puts behind the plan |

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

As a **founder who has generated their free foundation and wants a second one** I want **a plan I can
upgrade to, and to know before I start where the free line is** so that **hitting the limit is a
decision I get to make rather than the product quietly ending for me**.

And as a **founder with an existing repository** I want **to see what Airrow makes of my code before
I pay for anything** so that **upgrading is a judgement about something I have already seen work,
not a bet**.

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today:** the ceiling is a single constant. `FREE_GENERATION_LIMIT = 2` in
  [`apps/web/src/features/generation/allowance.ts:14`](../apps/web/src/features/generation/allowance.ts#L14),
  read by `checkAllowance` ([:30](../apps/web/src/features/generation/allowance.ts#L30)), which is
  called from `submitInterviewAction`
  ([`features/interview/actions.ts:62`](../apps/web/src/features/interview/actions.ts#L62)) and
  `retryGenerationAction` ([`features/generation/actions.ts:18`](../apps/web/src/features/generation/actions.ts#L18)) —
  so a founder hears "no" before landing on a progress screen rather than after. A founder who is out
  gets `ALLOWANCE_REACHED_MESSAGE`
  ([:48](../apps/web/src/features/generation/allowance.ts#L48)), which promises Pro "coming soon" and
  then has nowhere to send them.
- **The problem:** that ceiling exists because every generation makes a Claude call Airrow pays for
  and signup is open. It is a cost control, not a business model. This spec makes it one. The number
  is also stated in more than one voice — the code says two, the landing page says "two" in prose
  (`features/landing/copy.ts:180-184`), and the settings page renders it again
  (`app/app/settings/page.tsx:91`) — so changing it today means changing it in several places, which
  §IV forbids (a fact lives in exactly one file).
- **Already in place:** `countGenerations(orgId)`
  ([`lib/data/store.ts:380`](../apps/web/src/lib/data/store.ts#L380)) counts through
  `projects.organization_id` and **excludes failed jobs**, so an outage on our side never costs a
  founder part of their allowance — a property any paid plan must keep. `isAdminUser(userId)`
  ([:396](../apps/web/src/lib/data/store.ts#L396)) already models "not subject to the limit at all",
  set by migration only. The `generation_usage` ledger
  (`supabase/migrations/20260727160000_generation_allowance.sql`) outlives the projects it refers to,
  so deleting a project does not hand an allowance back. RLS on it is already covered by
  `lib/data/schema.rls.test.ts:64`.
- **Import, today:** ungated and free to anyone signed in. Two entry points — a ZIP
  (`importProjectAction`) and a public GitHub repository (`importRepoAction`) — converge on
  `completeImport` in [`features/import/actions.ts:60`](../apps/web/src/features/import/actions.ts#L60),
  which is where that file already puts everything the two sources share, so that "the limits, the
  analysis, the prefill and the digests are one implementation with one behaviour". Crucially,
  `analyzeImport` runs **locally in the engine** — it makes no Claude call and costs Airrow nothing.
  Persistence (`createProject` → `createImportSource` → `saveInterviewAnswers`) starts on the line
  after it.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

An organization carries a `plan`, and `checkAllowance` becomes "does this organization have
entitlement — free or paid". Every existing caller keeps calling the same function and never learns
that plans exist. The free tier drops to **one** complete foundation, and the single source of truth
for that number is one exported constant that the settings page, the landing page and the
out-of-allowance message all read.

Because one free generation makes a founder's first attempt all-or-nothing, this spec also lands the
two things that keep that from being hostile: memoisation on the inputs hash (an unchanged
regeneration makes no Claude call and spends nothing — deferred from spec 65), and a free repair
window — **at most two repairs on the same project, within 24 hours of its first generation**. Two
rules rather than one is a deliberate cost: the count makes the ceiling absolute (three Claude calls
per free organization, ever) and the clock keeps a dormant account from banking repairs indefinitely.

**Import is Pro, but the analysis is free.** A free founder may drop a ZIP or pick a repository and
see everything Airrow derived from it — detected stack, structure, what the foundation would add,
which files conflict. Creating the project from it requires Pro. This is the one place in the product
where the wall's position matters more than its existence: the analysis is the moment a founder with
an existing repo learns that Airrow understood their code, it costs us nothing to give away, and
asking them to pay before it would be asking them to buy blind. So `completeImport` splits at the
line it already has — `analyzeImport` and validation stay free, and the plan is checked immediately
before `createProject`, where the first durable write happens.

**Ships alone, ahead of payment.** `plan` becomes real and readable, and `'pro'` is settable only by
migration — enough to verify the Pro path end to end without a payment provider. The out-of-allowance
message therefore stays honest about Pro not being purchasable yet; rewriting it into a working
upgrade belongs to the Stripe issue, along with the webhook that becomes the only non-migration
writer of `plan`.

**Not touched:** the generation pipeline, the engine, and the generated output. Nothing about what a
founder receives changes — only how many times they may receive it and what happens when they run
out.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [ ] `organizations` carries a `plan` column (`'free' | 'pro'`), default `'free'`, added by an
      idempotent migration that replays cleanly from zero.
- [ ] The plan is decided **server-side from the database only**. A client that claims to be Pro
      cannot generate anything.
- [ ] RLS on the plan data has both an access test and a denial test; a member of another
      organization cannot read or write it.
- [ ] `checkAllowance` returns an entitlement shape that names *why* a founder is or is not allowed,
      as a discriminated union rather than booleans-with-meaning (§I).
- [ ] No existing caller of `checkAllowance` needs to change its logic to account for plans.
- [ ] The free limit is one foundation, defined in exactly one place; the settings page, the landing
      page and the out-of-allowance message all derive their number and prose from it.
- [ ] A regeneration whose inputs hash is unchanged makes no Claude call and spends no allowance.
- [ ] A founder gets at most two free repairs on a project, and only within 24 hours of that
      project's first generation; the third repair, and any repair after the window closes, is
      refused with the ordinary out-of-allowance path.
- [ ] A free organization can therefore never cause more than three Claude calls.
- [ ] A failed generation still never costs allowance (the spec-65 property, re-proven by test).
- [ ] `ALLOWANCE_REACHED_MESSAGE` says plainly that existing projects and downloads are unaffected,
      and is honest that Pro is not yet purchasable. (Rewriting it into a working upgrade is the
      Stripe issue's job, not this one's.)
- [ ] An organization that generated more than one foundation under the old limit keeps every one of
      them, keeps its downloads, and is never told it owes anything — it simply has nothing
      remaining.
- [ ] A free organization can run an import as far as the analysis and see its full result, from
      **both** entry points (ZIP and GitHub repository).
- [ ] A free organization cannot create a project from an import: nothing is persisted — no project,
      no import source, no prefilled answers — and the refusal names Pro as the reason.
- [ ] The import gate is enforced in one place that both entry points pass through, not once per
      action.
- [ ] The import screens show the Pro requirement *before* the founder uploads, and show it as a
      locked, explained state rather than a hidden one (§III: explicit states).
- [ ] A Pro organization's import behaves exactly as it does today — this spec changes who may
      import, never what import does.
- [ ] An organization that imported a project before this ships keeps it, keeps its downloads, and
      can still generate from it under whatever allowance it has.
- [ ] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — `apps/web/src/features/generation/allowance.test.ts`: extend the existing suite to
  cover free vs. pro entitlement; the repair window closing on **both** edges independently — a third
  repair inside 24 hours is refused, and a first repair after 24 hours is refused (clock anchored
  with `vi.setSystemTime` in UTC, §V); and admin bypass still winning over both.
- **New tests** — `apps/web/src/lib/data/schema.rls.test.ts`: access **and** denial for the plan
  column, per §II.
- **New tests** — `apps/web/src/lib/data/allowance.db.test.ts`: an unchanged regeneration spends
  nothing; a Pro organization passes the point where a free one is refused.
- **New tests** — `apps/web/src/features/import/actions.test.ts`: a free organization gets the
  analysis back and **no** `createProject` call; a Pro organization completes the import; both
  entry points are asserted, so the gate cannot be added to one and forgotten on the other.
- Landing/settings single-source criterion → a test that asserts the rendered copy contains the
  constant, so the prose cannot drift from the number.
- Locked import state → a component test on the import page asserting the Pro explanation renders for
  a free organization, alongside the existing `app/app/projects/import/page.test.tsx`.
- Full suite result + typecheck/lint status.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

Left for `/implement`. The shape is known: a migration adding `organizations.plan`, a store reader
beside `isAdminUser` ([`lib/data/store.ts:396`](../apps/web/src/lib/data/store.ts#L396)), the
entitlement type and `checkAllowance` rewrite in
[`features/generation/allowance.ts`](../apps/web/src/features/generation/allowance.ts), the
memoisation hook where a job is created, a plan check in `completeImport`
([`features/import/actions.ts:60`](../apps/web/src/features/import/actions.ts#L60)) placed between
the prefill validation and `createProject`, a locked state on
[`app/app/projects/import/page.tsx`](../apps/web/src/app/app/projects/import/page.tsx), and copy
updates in [`app/app/settings/page.tsx`](../apps/web/src/app/app/settings/page.tsx) and
[`features/landing/copy.ts`](../apps/web/src/features/landing/copy.ts).

**No change needed:** `submitInterviewAction` and `retryGenerationAction` — they already ask one
question ("may this organization generate?") and should keep asking exactly that.
`importProjectAction` and `importRepoAction` likewise: they read their own source and hand off, and
the gate belongs at the join, not in each of them.

---

## Data model

_Any database change. Most specs have none — say so plainly._

One new column on `organizations`: `plan text not null default 'free'`, constrained to the known
values. Added by a new idempotent migration in `supabase/migrations`, never by hand-editing the
dashboard (§II). Access control ships in the same change.

The column is the **entitlement answer** — "may this organization generate?" — which is why it lives
where the tenancy already does and why `checkAllowance` stays a single cheap read with no join.
Billing *state* (provider customer id, subscription status, current period end, cancel-at-period-end)
is a different concern with a different owner, and the Stripe issue adds a `subscriptions` table for
it. That table will not replace this column; it will be the only thing besides a migration that
writes to it. So this migration is not undone later — it is the half that outlives the provider, and
swapping Stripe for something else would leave it untouched.

Repair tracking needs no new table: the count and the clock are both derivable from the existing
`generation_usage` rows for the project, joined as `countGenerations` already does.

---

## Security

Plan and entitlement are read server-side from the database on every generation and every import
attempt; the client never supplies a plan, an organization id, or a usage count, and a forged request
gains nothing because the server re-reads both. The import gate sits in the server action, not in the
page that renders the locked state, so a founder who posts straight to the action is refused exactly
like one who never saw the screen. The plan column is writable only by migration or the billing
webhook's service path — never by an ordinary member of the organization, which the denial test
proves.

Letting a free organization run the analysis widens nothing: it already runs entirely in the request
on files the founder supplied, and §II's "nothing but paths, sizes and digests is persisted" holds
because on the free path *nothing at all* is persisted.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- **The new limit applies to every organization immediately** — no grandfathering. An account that
  used one of the old two generations has nothing remaining the day this ships. It keeps every
  project and every download and owes nothing; only the next generation is refused. The alternative
  (an older org keeping a higher ceiling) would make the limit a function of signup date, which is
  the harder thing to explain and the harder thing to remove later.
- Organization that generated two under the old limit → same: everything kept, nothing owed, nothing
  remaining.
- Generation fails (our outage, bad model response) → costs nothing, unchanged from spec 65.
- Regeneration with identical answers → no Claude call, no allowance spent, and it does **not** count
  against the two repairs. Only work we actually pay for is counted.
- Regeneration with changed answers, first or second on that project, within 24 hours of its first
  generation → allowed, spends nothing.
- Third repair, or any repair after the window closes → refused via the ordinary out-of-allowance
  path. The founder is told which of the two limits they met, because "no" without a reason reads as
  a bug.
- Project created but never generated → no clock is running; the window starts at the first
  generation, not at project creation.
- Pro subscription lapses → every project stays readable and downloadable **forever**; only new
  generations stop. The organization returns to `plan = 'free'` with its usage count untouched, so a
  founder who subscribed after spending their free foundation does not get another one by
  cancelling. §0's no-lock-in promise means we never take back what was generated.
- Free organization uploads a broken or empty ZIP → the existing archive error wins; they are told
  the file is unreadable, not that they need Pro. A plan refusal for a file we could not read would
  be a lie.
- Free organization's import analysis succeeds → they see the full result and are then told Pro is
  needed to create the project. Nothing is written, so re-running it later on Pro produces the same
  analysis rather than a half-made project.
- Free organization posts directly to `importProjectAction` / `importRepoAction`, skipping the UI →
  refused at `completeImport`, the same as everyone else.
- Organization that imported before this shipped → keeps the project, the import source and the
  prefilled answers, and generating from it is governed by the ordinary allowance. We do not
  retroactively lock what a founder already imported (§0, no lock-in).
- Pro organization whose subscription lapses, with imported projects → same rule as everywhere else:
  the projects stay readable and downloadable, only new imports and new generations stop.
- Admin account → unlimited, unchanged; the admin flag wins over any plan, for imports too.
- Local mode with no Supabase → the plan reads as `free` and nothing crashes. [NEEDS CLARIFICATION:
  does local mode gate imports at all? Local mode exists so the whole product runs with no
  integrations, and a `free` plan there would make importing untestable locally — the likely answer
  is that local mode behaves as unlimited, the same way it already sidesteps auth.]

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- Payment collection, Stripe Checkout, the billing portal, the `subscriptions` table and webhook
  handling — the follow-up issue that becomes the only non-migration writer of the `plan` this spec
  creates, and that turns `ALLOWANCE_REACHED_MESSAGE` into a working upgrade.
- The upgrade screen and where the paywall appears in the flow — a separate issue, so that this one
  stays the model and not the marketing.
- The remaining Pro-only capabilities (revisions with a diff, GitHub push, repository drift watch) —
  each its own issue. Import is the exception and lands here, because a `plan` column that only the
  generation limit reads is an abstraction with one use; gating a second, unrelated capability in the
  same change is what proves the model carries weight (§I: an abstraction is earned by ≥2 concrete
  uses).
- Any change to what import *does* — the analysis, the conflict resolution, the digests and the
  merged download are spec 63, 67, 68 and 75's, and this spec only decides who reaches them.
- Pricing. This spec must not encode an amount anywhere.
