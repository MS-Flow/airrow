# Spec 164 — The console can act: a suspension that bites, a plan you can read, and Pro you can hand out

> **In one sentence:** The operator console from spec 150 can answer questions but not act on the
> answers — a suspension we issued changed nothing, the Stripe line says `active` and no more, Pro
> cannot be given or taken, and the one thing a support ticket always asks ("what did you build me?")
> is the one thing the project screen cannot show.

|                |                                      |
| -------------- | ------------------------------------ |
| **Status**     | ✅ Done                              |
| **Issue**      | #164 — "Adminsidan: avstängningen biter inte, Stripe-raden säger för lite, och Pro går inte att ge" |
| **Branch**     | `164-admin-suspend-and-pro` (from `feature/ui`) |
| **Feature**    | ui                                   |
| **Depends on** | [spec 150](150-admin-console.md) (the console, `lib/data/admin.ts`, `suspended_at`, `admin_audit_log`) · [spec 144](144-support-review.md) (`support_tickets` — the one surface a suspended account keeps) · [spec 122](122-invite-a-friend.md) (`plan_grants`, and "the plan **or** an active grant") · [spec 74](74-pro-entitlements.md) / [spec 99](99-stripe-checkout.md) / [spec 100](100-pro-upgrade-revisions.md) (`subscriptions`, and the rule that only Stripe writes `organizations.plan`) · [spec 75](75-preview-full-tree.md) (`PreviewBrowser`, `project-files.ts` — reused, not rebuilt) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

_Who wants this, and what they get out of it._

As **the person who runs Airrow** I want **to see a founder's whole standing and change it on the spot —
plan, access, and what we actually built for them** so that **a ticket is resolved in one window, and a
suspension means the account is suspended.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today:** the console ships five screens ([spec 150](150-admin-console.md)). The user card shows
  `Stripe: <status>` and nothing else, offers two actions — grant generations, suspend — and the project
  screen shows the interview answers but not the output.
- **The problem, observed:** an account was suspended from `/app/admin` and the person went on using the
  app normally.

### Root cause — found, not guessed

The enforcement was never running on the deployment the colleague was using. The timeline, read off the
database and GitHub (all times UTC, 2026-08-01):

| Time | What happened | Where it is recorded |
| --- | --- | --- |
| 09:45:12 | PR #154 merges the console into `feature/ui` | GitHub |
| 10:10:31 | PR #156 merges `feature/ui` into `develop` | GitHub |
| 10:13, 10:16 | Two tickets closed from the console — so the operator is on a `develop`/preview deployment | `admin_audit_log` |
| 10:17:21 | The colleague signs in | `auth.users.last_sign_in_at` |
| 10:17:30 | `user.suspend` | `admin_audit_log` |
| 10:21:07 | `user.reactivate`, 3m37s later | `admin_audit_log` |
| **15:05:37** | PR #168 merges `develop` into `main` | GitHub |

The suspension check in `getSession` and the console that issues it shipped in the *same* change
(spec 150). At 10:17 that change had reached `develop` but not `main` — the previous `develop → main`
PR was #149, merged the evening before. **The operator was testing on a preview deployment; the
colleague was using production, whose `getSession` had no suspension check at all.** Both writes did
land: the audit log holds the pair, and `suspended_at` is null today because of the reactivation at
10:21, not because the write failed.

Ruled out along the way, each by inspection rather than assumption:

1. `profiles.suspended_at` exists in the database (read directly) — `profileFlags`' missing-column
   fallback never fired.
2. The write landed; the audit pair proves it, and the reactivation explains the null.
3. Every `/api/*` route already goes through `getSession()`
   ([generate](../apps/web/src/app/api/projects/[id]/generate/route.ts#L29) ·
   [job](../apps/web/src/app/api/projects/[id]/job/route.ts#L8) ·
   [zip](../apps/web/src/app/api/projects/[id]/zip/route.ts#L18)), as does every server action and
   `AppLayout` — the gate is genuinely central, it simply was not deployed.

**What this does not excuse.** The Supabase Auth ban is a much weaker instrument than its comment
claims: it stops a new sign-in and a refresh, but an access token already issued stays valid for its
full lifetime, so at 10:17:30 the colleague's nine-second-old token would have carried them for the
better part of an hour on its own. The database check is the thing that bites immediately — the ban
was never the mechanism, and this spec stops pretending it is. Production has carried the check since
15:05 today; the work below is what makes it *provable* and keeps support reachable.
- **A second problem in the same code:** `setUserSuspended` also bans the account in Supabase Auth
  (`ban_duration: "876000h"`), so a suspended founder cannot even sign in to ask why. We suspend people
  to stop something, not to make them unreachable — support has to stay open.
- **Already in place:** `subscriptions.current_period_end` and `cancel_at_period_end` exist and are
  filled correctly by `toSubscriptionState` (including Stripe's `cancel_at`-without-`cancel_at_period_end`
  case) — `adminUsers` selects only `status` and discards the rest. `plan_grants` already carries an
  entitlement that is not `organizations.plan`, and `grantStanding` already returns its `activeUntil`.
  `artifacts` holds the whole `GenerationResult` per job, and `features/preview/` already knows how to
  render a tree and a file.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

Four changes and two fixes, all on surfaces that already exist. Suspension moves from "the session
disappears" to an explicit state the app can name: `profiles.suspended_at` is the only thing that
enforces it, the Supabase Auth ban goes away so the person can still sign in, and everything except
support, sign-out and the public pages refuses on the server. Pro is given and taken through
`plan_grants` with a new `source = 'support'` — never `organizations.plan`, which the next Stripe
webhook would silently overwrite. The Stripe line and the earned week both learn to say a date. The
project screen reads the artifact it already stores and renders it with the preview components that
already exist.

Four decisions, each picked for the same reason — the narrow version is the one that can be proven:

- **A suspended account sees the support page and nothing else.** Not projects in read-only: a
  half-open app is a set of write paths that each have to be gated, and one forgotten gate is this
  spec's original bug all over again. One allowed route is one thing to test.
- **The reason stays internal.** The screen says the account is suspended and links to support; the
  operator's note lives in `admin_audit_log`. That text is written for us, and the explanation a
  founder deserves belongs in the reply to their ticket, phrased for them.
- **A support grant's length is chosen per grant** — 30, 90 or 365 days. `plan_grants` already carries
  `starts_at`/`expires_at`, so a picker costs nothing, and an open-ended grant would need the
  `plan_grants_window_check` loosened for a case support does not have.
- **Admin accounts cannot be suspended from the console at all.** We are two people; counting active
  admins to protect the last one is a concurrency problem bought for nothing, and locking ourselves
  out of the console is repairable only with SQL.

**Not touched:** `organizations.plan` and everything that writes it (`applySubscriptionState`, the
webhook, `syncPlanFromStripe`) · `checkAllowance` and `claimPro`, which already resolve "the plan or an
active grant" and need no knowledge of where a grant came from · the generation-credits path from spec
150 · replying to tickets, which stays in Gmail (spec 144).

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

**Suspension**

- [x] The root cause of the suspension not biting is identified and written down in the spec and the PR
      — not worked around.
- [x] A suspended account cannot read or write anything in the app: pages, server actions, and
      `/api/*`. Proven by tests, not only by clicking.
- [x] A suspended account **can** sign in, reach `/app/support`, submit a ticket, and sign out. The
      daily ticket ceiling (`TICKET_DAILY_LIMIT`) applies exactly as it does to anyone else.
- [x] Everywhere else — including their own projects — a suspended account gets a screen that says the
      account is suspended and links to support: not a silent 404, and not a redirect to `/login` that
      reads as a sign-in failure. That screen does **not** state a reason.
- [x] `profiles.suspended_at` is what enforces the suspension; the Supabase Auth ban is no longer part
      of it.
- [x] Suspending when `suspended_at` is missing from the database fails visibly instead of silently.
- [x] An account with `is_admin` cannot be suspended from the console — the action refuses, and the UI
      does not offer it.
- [x] Reactivating restores full access, and no data was deleted at any point.

**Plan**

- [x] The user card says when Pro ends, whether it is cancelled, whether it has already lapsed, and
      when there is no subscription at all — derived from `current_period_end` and
      `cancel_at_period_end`.
- [x] A paused subscription reads as paused, not as renewing.
- [x] An earned week (spec 122) shows its end date.
- [x] The card says where Pro comes from: bought, earned, or granted by us.
- [x] Pro can be granted and revoked from the console, it does **not** write `organizations.plan`, and a
      Stripe webhook arriving afterwards changes nothing we did.
- [x] The grant's length is chosen when it is given — 30, 90 or 365 days — and the card shows the end
      date it produced.
- [x] Revoking ends the active grant rather than deleting the row.
- [x] Granting Pro to an account that already pays Stripe is either refused or clearly labelled as
      having no effect — the plan short-circuits before a grant is consulted.
- [x] Both granting and revoking write an `admin_audit_log` row with who, when and why.

**What we generated**

- [x] The opened project shows the latest generation's file tree and the contents of a selected file,
      and names the job and time it came from.
- [x] Imported files appear as paths only, never contents.
- [x] No path, file body or interview answer reaches the logs.

**UI**

- [x] No horizontal scrollbar on the admin tab row, and it still works on a phone.
- [x] The breadcrumb reads `Admin` and `Support`.

**Everywhere**

- [x] New and changed table rules ship with RLS denial tests; a test shows a non-admin can neither reach
      the new reads nor invoke the new actions.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

**On "a regression test that fails before the fix".** Worth being exact, because the root cause was a
deployment gap rather than a wrong line of code: `getSession` already refused a suspended profile
before this change, so a test of *that* would have been green on the old code too and would have proved
nothing. What fails on the old code, and is therefore the regression guard, is the behaviour this spec
adds: the refusal now names its destination (`/app/suspended`, not `/login`), it is asserted from
inside a real route handler rather than only at the gate, and `setUserSuspended` is pinned to one
database write with no Auth ban. The `/api/*` test is the one that would have caught the original
report had it existed, because it exercises the wiring rather than the rule.

**New tests**

- `apps/web/src/app/api/projects/[id]/job/route.test.ts` (new) — the integration half: the **real**
  `getSession` inside the **real** handler, with only Supabase Auth and the profile read faked. A
  suspended account gets 401, and the handler reads nothing about the project before refusing.
- `apps/web/src/lib/auth.admin.test.ts` — the unit half: `requireSession` redirects a suspended account
  to `/app/suspended`; `requireSessionEvenIfSuspended` hands support a flagged session and still
  refuses a signed-out visitor.
- `apps/web/src/features/admin/plan.test.ts` (new, 13 cases) — every plan reading: renewal,
  cancellation, pause, no period, lapsed, an unfinished attempt, an earned week, a granted stretch, and
  the paid plan winning over a grant.
- `apps/web/src/lib/data/admin.test.ts` — suspension writes one column and refuses an admin; a missing
  `suspended_at` throws instead of passing silently; grants insert into `plan_grants` and never touch
  `organizations`; refusals for an already-paying and an already-granted workspace; revoking closes the
  window instead of deleting the row; the file view reads only completed jobs, lists imported files as
  paths, and opens only a path it generated. All four new functions join the "refuses a non-admin"
  table.
- `apps/web/src/features/admin/actions.test.ts` — both new actions gate themselves, record an audit row
  on success and **none** on refusal, and reject a grant length the form never offered.
- `apps/web/src/features/support/actions.test.ts` — a suspended founder's ticket is accepted, and is
  rate-limited by the same ceiling as anyone else's.
- `apps/web/src/lib/data/referrals.db.test.ts` — against local Supabase: `source = 'support'` is now
  accepted, an unknown source is still refused by `plan_grants_source_check`, and a member still cannot
  write a support grant for themselves.
- `apps/web/src/components/shell/top-bar.test.tsx` — the trail names Admin, Support and the suspended
  screen.

**Checked by inspection rather than by test:** no `console` call exists anywhere under
`lib/data/admin.ts`, `features/admin/`, `app/app/admin/` or `app/app/suspended/`, so no path, file body
or answer can reach a log. That a Stripe webhook cannot undo a grant is structural — the webhook and
`syncPlanFromStripe` write `organizations.plan` and `subscriptions`, and a grant is a `plan_grants` row
neither of them touches.

**Result** (2026-08-01, re-run after `/analyze`):

- `pnpm -r typecheck` — clean.
- `pnpm -r lint` — clean, no new issues.
- `pnpm --filter web test` — **94 files, 916 tests, all passing**, including the local-Supabase RLS
  suites.
- `pnpm test:scripts` — 3 files, 88 tests, passing.
- `pnpm -r test` — one **pre-existing** failure, untouched by this change:
  `packages/engine/src/security-command.test.ts` › "keeps the report out of version control". It
  asserts `"SECURITY_AUDIT.md\` is in\n\`.gitignore"` against `template/.claude/commands/security.md`,
  which this machine checks out with CRLF (`core.autocrlf=true`), so the embedded `\n` cannot match.
  Green in CI, which runs on Linux with LF. Nothing in this spec touches `packages/engine` or
  `template/`. Worth its own issue as a line-ending-independent assertion.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

Built as planned; line references are to the files as they now stand.

1. **[`lib/auth.ts`](../apps/web/src/lib/auth.ts)** — suspension becomes a state the type system carries instead of an absence.
   `readSession()` (cached, internal) returns a discriminated
   `{ kind: "none" } | { kind: "suspended" } | { kind: "active" }`. **`getSession()` keeps its exact
   current contract** — a `SessionContext` only when active, `null` otherwise — so all thirty-odd
   existing callers, including every `/api/*` handler, stay correct without being touched. On top of
   it: `requireSession()` redirects to `/login` when there is no session and to `/app/suspended` when
   there is a suspended one, and `requireSessionEvenIfSuspended()` is the single deliberate exception,
   named so a reviewer sees it at the call site.
2. **`app/app/suspended/page.tsx`** (new) — the screen. States that the account is suspended, links to
   support, names no reason.
3. **`app/app/layout.tsx`** — reads through the tolerant helper and, when suspended, renders a stripped
   shell: no project list, no command palette, no `ClaimGuestDraft` (claiming a draft is a write), and
   a nav of exactly one entry. The full shell would otherwise hand a suspended account a sidebar of
   routes that all bounce. Two components carry that decision:
   - **`components/shell/nav-items.ts`** — `SUSPENDED_ITEMS`, a constant rather than a filter over
     `BASE_ITEMS`, so a nav entry added later has to be named here to reach a suspended account.
   - **`components/shell/user-menu.tsx`** — a `suspended` prop that leaves only sign-out. Projects and
     Settings both bounce to `/app/suspended`, so offering them in the menu would put the stripped
     sidebar's dead ends one click away again.
4. **`app/app/support/page.tsx`** and **`features/support/actions.ts`** — the tolerant helper, so the
   one open door works end to end. `submitReviewAction` deliberately keeps `requireSession()`: a
   suspended account files tickets, it does not publish reviews.
5. **`lib/data/admin.ts`** — `setUserSuspended` drops the Supabase Auth ban and returns a typed refusal
   when the target is an admin; `adminUsers` selects the two subscription columns it was discarding
   and reports the active grant's end date and source (`AdminUser.subscriptionStatus` becomes
   `subscription`, `grantActive` becomes `grant`); new `grantSupportPro` / `revokeActiveGrant`; new
   `adminProjectFiles` for the opened project's artifact; `recordAdminAction`'s action union gains
   `pro.grant` and `pro.revoke`.
6. **`features/admin/plan.ts`** (new) — a pure `planStanding()` turning plan + subscription + grant
   into one discriminated verdict the card renders. Pure so it is tested without a database, which is
   where every date-and-cancellation case actually gets covered.
7. **`features/admin/actions.ts`** — `grantProAction` and `revokeProAction`, each gated by
   `requireAdmin()` and each writing an `admin_audit_log` row.
8. **`app/app/admin/page.tsx`** — the plan line, where Pro comes from, and the grant/revoke controls.
9. **`app/app/admin/projects/page.tsx`** — the generated tree and the selected file, read-only.
10. **`features/admin/AdminTabs.tsx`** — `overflow-x-auto` → `flex-wrap`.
11. **`components/shell/top-bar.tsx`** — `admin`, `support` and `suspended` in `SEGMENT_LABELS`.
12. **`lib/utils.ts`** — `onDate()`, `timeAgo`'s counterpart for dates that have not happened yet. A
    renewal is a day on a calendar; "in 30d" is not something support can act on. Pinned to UTC so the
    string is identical on a laptop, on Vercel and in CI (§V).
13. **`supabase/migrations/20260801160000_support_pro_grants.sql`** (new) — widen
    `plan_grants_source_check` to `('referral', 'support')`.

**No change needed:** `middleware.ts` — it is documented as the coarse gate and every route behind it
re-reads the session server-side; adding a database round-trip to Edge middleware would slow every
request to re-answer a question the page is about to ask properly. `checkAllowance` and `claimPro` —
they already resolve "the plan or an active grant" and do not care where a grant came from.
`profileFlags`' missing-column tolerance stays, because it sits on every page render; the *write* path
already throws on `PGRST204`, which is what makes a suspension fail visibly.

### Constitution check

- **§I one-way flow** — new reads live in `lib/data/admin.ts`, new writes in `features/admin/actions.ts`;
  pages call actions, never the store.
- **§I discriminated unions** — `SessionRead` and `PlanStanding` are unions, not booleans with meaning.
- **§II tenancy** — `lib/data/admin.ts` is the one module that crosses the boundary and every new
  function in it calls `assertAdmin` first. No org id is taken from a form without being resolved
  server-side.
- **§II plan** — nothing writes `organizations.plan`. Grants are `plan_grants` rows.
- **§II migrations** — one idempotent migration; RLS on `plan_grants` is unchanged and still denies
  `authenticated` every write.
- **§II logs** — the file viewer logs nothing; no path or body reaches `console`.
- **§III sanitized rendering** — generated files render as **text**, never as HTML, so nothing
  untrusted is injected at all.
- **§V tests** — the regression test fails before the fix; the `/api/*` rule is proven at two layers.

---

## Data model

_Any database change. Most specs have none — say so plainly._

One migration, idempotent like every other:

- `plan_grants_source_check` currently allows `source in ('referral')`. It gains `'support'`. Nothing
  else about the table changes — RLS already denies `authenticated` every write, which is what makes a
  grant an entitlement rather than a self-service upgrade, and that stays exactly as it is.
- No new table. Suspension already has its column; the audit log already has its rows.

---

## Security

_Two lines at most: what this opens up and who may reach it — or "nothing security-relevant, because …"._

This adds a way to grant a paid entitlement and a way to read a founder's generated files, both behind
`requireAdmin()` in the page, the action **and** `lib/data/admin.ts`, and both audited. It also removes
the Supabase Auth ban from suspension, which deliberately widens what a suspended account can do from
nothing to exactly one thing — file a support ticket — so the server-side refusal on every other path
is now the whole of the enforcement and has to be proven by test, not assumed.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- A suspended account submits a ticket, hits the daily ceiling → the normal ceiling message, not a
  suspension message. Two different refusals must not be conflated.
- A suspended account holds an open tab and clicks around → the first server call refuses.
- An operator tries to suspend an admin (including themselves) → refused, in the action as well as in
  the UI. If a row is somehow already both suspended and admin, suspension wins — the console is not a
  way out of it.
- A granted week and a Stripe subscription overlap → Stripe's plan decides, the grant is untouched and
  unspent (`claimPro` short-circuits).
- Revoking a grant that already expired → no-op, and the UI says so rather than writing a past date.
- Granting Pro to a workspace that already has an active grant → extends nothing silently; the operator
  is told what is already running and what the new grant would do.
- A project with no generation yet → the file section says so; no empty tree.
- A project whose latest job failed → show the tree of the last job that produced one, and say which.
- A subscription with no `current_period_end` (some statuses carry none) → say the status without
  inventing a date.

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- Replying to a ticket inside the app — still Gmail (spec 144).
- Deleting accounts or workspaces — its own issue, as spec 150 already said.
- Editing a founder's files or answers from the console. We show; we do not rewrite.
- Any admin role beyond `is_admin`.
- Downloading the whole repo as a ZIP from the console — viewing is enough to answer a ticket.
- Read-only access for a suspended account, an open-ended Pro grant, and a suspension reason shown to
  the person it concerns. All three were considered and declined in _Design decision_; each is a small
  change if we ever want it.

---

## Implementation notes

_What actually happened, including what the cross-check found._

**The root cause was a deployment gap, not a wrong line of code.** Written up in full under
_Background_, from `admin_audit_log`, `auth.users` and GitHub's merge times. Two things follow from it
that are worth carrying forward: a change whose enforcement and whose UI ship together cannot be
tested from a preview deployment against production users, and Supabase Auth's ban is not a revocation
— it stops the next token, never the current one.

**`/analyze` found three things `/implement` had left, all now fixed:**

1. **A real defect.** `admin_audit_log.action` is a closed set **in Postgres**
   (`20260801130000_admin_console.sql`), not only in the TypeScript union. Widening
   `recordAdminAction` without widening the constraint would have written the `plan_grants` row and
   then had the audit row rejected — Pro handed out with no trace of who did it, and an error on the
   operator's screen *after* the thing they asked for had already happened. The unit tests could not
   see it: `recordAdminAction` is mocked in the action tests, and the PostgREST double enforces no
   constraints. The migration now widens both constraints, and `admin.db.test.ts` inserts both new
   actions against real Postgres.
2. **A gap between the design decision and the shell.** The sidebar was stripped for a suspended
   account but the user menu still offered Projects and Settings — the same dead ends, one click away.
   `UserMenu` now takes a `suspended` prop that leaves only sign-out, with a test.
3. **Spec ↔ code drift.** `lib/utils.ts`, `components/shell/nav-items.ts` and
   `components/shell/user-menu.tsx` were changed without appearing in _Exact changes_. Listed now.

**Docs updated in the same change (§IV).** `CLAUDE.md` said only `claimAllowance` and the import gate
may start a `plan_grants` row; support is now a third writer, and the sentence distinguishes *starting
a queued referral week* (still those two, so a screen that reports never spends one) from *writing an
already-started support grant*. `DATABASE_DESIGN.md` carries the widened action set, the new
`plan_grants.source` values, and the corrected note on `profiles.suspended_at` being the whole of the
suspension. `UI_ARCHITECTURE.md` gains `/app/suspended` and what the two admin screens now do.

**Deviations from the plan:** none in approach. `features/preview/PreviewBrowser` was deliberately
*not* reused for the console's file view, despite _Depends on_ naming it: it is a client editor with
save and highlight actions, and the console shows without rewriting (_Out of scope_). What is reused is
the data — `loadArtifact`, `getImportSource`, `listImportFiles` — and the file bodies render as text,
so no untrusted HTML is produced and there is nothing to sanitize (§III).

**Left for its own issue:** `packages/engine/src/security-command.test.ts` fails on this machine only,
asserting an embedded `\n` against a `template/` file that `core.autocrlf=true` checks out with CRLF.
Green in CI on Linux. Untouched by this spec.
