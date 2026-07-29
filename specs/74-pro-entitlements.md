# Spec 74 — Pro: a plan and entitlement model, and a free tier of one foundation

> **In one sentence:** Turn the free generation ceiling from a cost control into a business model —
> an organization gets a **plan**, the plan decides what it may do, the free tier becomes one complete
> foundation, importing an existing project becomes Pro, and a founder who has spent their free
> foundation is offered Pro instead of a dead end.

|                |                                                          |
| -------------- | -------------------------------------------------------- |
| **Status**     | ✅ Done                                                   |
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

- [x] `organizations` carries a `plan` column (`'free' | 'pro'`), default `'free'`, added by an
      idempotent migration that replays cleanly from zero.
- [x] The plan is decided **server-side from the database only**. A client that claims to be Pro
      cannot generate anything.
- [x] RLS on the plan data has both an access test and a denial test; a member of another
      organization cannot read or write it.
- [x] **A member cannot write their _own_ organization's plan either.** Added during implementation:
      the denial test found that they could. See _Implementation notes_.
- [x] `checkAllowance` returns an entitlement shape that names *why* a founder is or is not allowed,
      as a discriminated union rather than booleans-with-meaning (§I).
- [x] No existing caller of `checkAllowance` needs to change its logic to account for plans.
- [x] The free limit is one foundation, defined in exactly one place; the settings page, the landing
      page and the out-of-allowance message all derive their number and prose from it.
- [x] A regeneration whose inputs hash is unchanged makes no Claude call and spends no allowance.
- [x] A founder gets at most two free repairs on a project, and only within 24 hours of that
      project's first generation; the third repair, and any repair after the window closes, is
      refused with the ordinary out-of-allowance path.
- [x] A free organization can therefore never cause more than three Claude calls.
- [x] A failed generation still never costs allowance (the spec-65 property, re-proven by test).
- [x] The out-of-allowance message says plainly that existing projects and downloads are unaffected,
      and is honest that Pro is not yet purchasable. (Rewriting it into a working upgrade is the
      Stripe issue's job, not this one's.)
- [x] An organization that generated more than one foundation under the old limit keeps every one of
      them, keeps its downloads, and is never told it owes anything — it simply has nothing
      remaining.
- [x] A free organization can run an import as far as the analysis and see its full result, from
      **both** entry points (ZIP and GitHub repository).
- [x] A free organization cannot create a project from an import: nothing is persisted — no project,
      no import source, no prefilled answers — and the refusal names Pro as the reason.
- [x] The import gate is enforced in one place that both entry points pass through, not once per
      action.
- [x] The import screens show the Pro requirement *before* the founder uploads, and show it as a
      locked, explained state rather than a hidden one (§III: explicit states).
- [x] A Pro organization's import behaves exactly as it does today — this spec changes who may
      import, never what import does.
- [x] An organization that imported a project before this ships keeps it, keeps its downloads, and
      can still generate from it under whatever allowance it has.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

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
- **New tests** — `apps/web/src/features/generation/runner.test.ts`: a reused run is recorded as
  `reused: true` and a live call as `false`, which is what stops the ledger charging for a Claude
  call nobody made.
- Landing/settings single-source criterion → the numbers are imported from
  `features/generation/limits.ts` rather than written in prose, so drift is a type error rather than
  something a test has to notice.
- Locked import state → `app/app/projects/import/page.test.tsx` asserts the Pro explanation renders
  above the file picker for a free organization and not at all for a Pro one.
- Full suite result + typecheck/lint status.

### Result (2026-07-29)

```
pnpm -r typecheck   Done — clean across schemas, engine, web
pnpm -r lint        Done — no new issues
pnpm -r test        schemas   35 passed
                    engine   213 passed
                    web      317 passed | 0 skipped (46 files)
pnpm test:scripts     13 passed
```

Run against a live local Supabase, so the DB-backed suites — `schema.rls.test.ts`,
`allowance.db.test.ts` and the five others that guard themselves with `describe.skipIf(!dbUp)` —
actually executed rather than skipping. Nothing is skipped and there are no known pre-existing
failures.

The migration was applied three times against that database (twice by hand, once through
`supabase migration up`) and was clean on every pass, which is the idempotence claim demonstrated
rather than asserted. Two migrations from `develop` — `20260726120000_import.sql` and
`20260727093000_import_digest_version.sql` — had never been applied to that local database and were
applied with `--include-all` to get there; that gap was pre-existing and unrelated to this change.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

1. **`supabase/migrations/20260729120000_pro_plan.sql`** (new) — `organizations.plan` with a guarded
   check constraint, and `generation_jobs.reused_authoring`. No new RLS policy: `organizations`
   already has a select-only policy and no insert/update grant for `authenticated`, so a member can
   read their plan and has no path to write one. Adding a policy would imply writes are possible and
   merely filtered.
2. **`apps/web/src/features/generation/limits.ts`** (new) — the three numbers, in a module with no
   imports. `allowance.ts` is server-only, but the landing page states the same numbers in prose;
   this is what lets both read one source without dragging Supabase into a client bundle.
3. **`apps/web/src/features/generation/allowance.ts`** — rewritten. `Entitlement` is a union
   discriminated on `allowed`, carrying `grant` (`free` | `repair` | `pro` | `admin`) or `denial`
   (`free-spent` | `repairs-spent` | `window-closed`). `checkAllowance` takes a query object; `now`
   is injected so the window is testable without touching the clock. `allowanceMessage` replaces the
   single `ALLOWANCE_REACHED_MESSAGE` so each refusal names the limit it met.
4. **`apps/web/src/lib/data/store.ts`** — `plan` on `OrgRecord` (anything not exactly `'pro'` reads
   as free); `chargedUsage(column, id)` replaces the inline filter in `countGenerations` and is
   shared with the new `projectUsage(projectId)`; `AuthoringProvenance` gains `reused`.
5. **`apps/web/src/features/generation/runner.ts`** — passes `reused: reused !== null`.
6. **`features/interview/actions.ts`, `features/generation/actions.ts`** — pass the org's plan and
   the project id; render `allowanceMessage(denial)`.
7. **`features/import/actions.ts`** — `completeImport` takes the `OrgRecord` and checks the plan
   between the prefill validation and `createProject`. A free organization gets `{ requiresPro,
   preview }`; the preview is the evidence, notes and counts, deliberately **without**
   `analysis.answers` — the prefilled interview is what Pro buys.
8. **`features/import/ProPreview.tsx`, `AnalysisEvidence.tsx`** (new) — the free result and the
   evidence list. The latter is now used by both the free preview and the import review page, which
   is what stops the promise and the product drifting apart.
9. **`ImportForm.tsx`, `RepoImport.tsx`** — render `ProPreview` instead of the form once the
   analysis has run without a plan behind it.
10. **`app/app/projects/import/page.tsx`** — states the Pro requirement above the picker, and says
    the analysis is still free.
11. **`app/app/settings/page.tsx`, `features/landing/copy.ts`** — read the constants.

**No change needed:** `submitInterviewAction` and `retryGenerationAction` still ask one question
("may this organization generate?"). `importProjectAction` and `importRepoAction` likewise: they read
their own source and hand off, and the gate belongs at the join, not in each of them.

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
like one who never saw the screen.

The plan column is writable only by migration or the billing webhook's service path — never by a
member of the organization, their own included. That is not inherited from the table: `authenticated`
holds `update` on `organizations`, so the column had to be revoked explicitly at column level. Two
denial tests hold that line, one for the member's own row and one for another org's. See
_Implementation notes_ — this was a live escalation the tests caught before merge, not a hypothetical.

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
- Local development → no bypass exists, and none is added. The marker here asked whether local mode
  should behave as unlimited; the premise turned out to be stale. `lib/auth.ts` resolves every
  session through Supabase Auth and the DataStore reads only Supabase — there is no
  file-backed path left to special-case. A developer flips their own row
  (`update organizations set plan = 'pro'`), which is the same mechanism admin accounts already use
  and leaves no code path that could grant Pro by accident. Worth noting: `CLAUDE.md` and
  `SYSTEM_OVERVIEW.md` still describe a local file-backed store, which no longer exists — out of
  scope here, but it is stale AI context and should get its own issue (§IV).

---

## Implementation notes

**A member could have granted themselves Pro.** The denial test was written expecting to pass, and
it failed. `20260725100000_schema.sql:197` grants `insert, update, delete on public.organizations to
authenticated`, and the "org members update organizations" policy admits any member of the row. That
was harmless while the table held a name and a slug; putting an *entitlement* on the same row made it
a privilege escalation, because Supabase's PostgREST endpoint is reachable with a user's own JWT
without going near the app. Any signed-in founder could have run
`update organizations set plan = 'pro'`.

RLS cannot express "this row, but not this column", so the fix is column-level privilege: revoke the
table-wide `insert, update` from `authenticated` and grant back every column except `plan`. The row
policies are untouched, so nothing a member could legitimately edit changes, and an inserted row
takes the column default and can never arrive paid.

Worth recording plainly, because the reasoning that produced the bug looked sound: the first version
of this migration carried a comment explaining that no policy was needed since `organizations` was
select-only — true in `20260724132100_init.sql`, and falsified by a migration a day later. Reading
one migration is not reading the schema. This is the §II denial-test requirement earning its keep.

**One design change from the plan.** The spec said memoisation was deferred from spec 65. Half of it
had already landed: `features/generation/memo.ts` and the `generation_jobs_memo_idx` from
`20260727090000_authoring_provenance.sql` already skip the Claude call when the inputs hash matches.
What was missing was the money half — the job row was still inserted, the usage trigger still fired,
and the founder was still charged a foundation for a call nobody made. Hence
`generation_jobs.reused_authoring` rather than new hashing: the ledger now excludes reused runs the
same way, and for the same reason, that it already excludes failed ones.

**Two findings from `/analyze`, fixed before close-out.** `ImportPreview` carried a `stackDetected`
field that was populated and never rendered — dead data crossing the server→client boundary, removed.
And `DATABASE_DESIGN.md`, which §II names as the canonical schema, documented neither new column;
worse, its RLS section asserted that *every* policy reduces to org membership, which this change made
untrue. It now documents both columns and carries a short section on why the plan is protected by
column-level privilege rather than a policy — stated as the general rule it implies, since the next
entitlement column will face the same problem.

**`chargedUsage` filters in TypeScript, not in the query.** The first version expressed "failed or
reused" as a PostgREST `.or("status.eq.failed,reused_authoring.eq.true")` string. That is the kind of
expression that stays syntactically valid while quietly meaning something else, and getting it wrong
would charge every founder for every memo hit. Fetching `status` and `reused_authoring` and filtering
in code costs one extra column and is obviously correct.

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
