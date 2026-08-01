# Spec 150 — The operator's console: who they are, what they built, where they stopped

> **In one sentence:** An admin-only area at `/app/admin` that turns running Airrow from an exercise in
> writing SQL into five screens — users, projects, tickets, reviews and the numbers that say where
> founders get stuck — and, on the way, finishes the two half-built things spec 144 left for it.

|                |                                      |
| -------------- | ------------------------------------ |
| **Status**     | ✅ Done                              |
| **Issue**      | #150 — "Adminsida: användare, projekt, supportärenden, reviews och siffrorna som säger var folk fastnar" |
| **Branch**     | `150-admin-console` (from `feature/ui`) |
| **Feature**    | ui                                   |
| **Depends on** | [spec 144](144-support-review.md) (`support_tickets`, `project_reviews`, and the `published_at` this spec is the sole writer of) · [spec 122](122-invite-a-friend.md) (`plan_grants`, `referrals`, `referral_codes`) · [spec 74](74-pro-entitlements.md) / [spec 99](99-stripe-checkout.md) / [spec 100](100-pro-upgrade-revisions.md) (`checkAllowance`, and the rule that only Stripe writes `organizations.plan`) · [spec 128](128-reject-invalid-answers.md) (`rejected_answers`, which is what separates "we broke" from "the answers were unbuildable") |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

_Who wants this, and what they get out of it._

As **the person who runs Airrow** I want **to see who the users are, what they built, where they stopped
and what they thought — and to act on it without writing SQL** so that **support takes minutes instead of
hours, and the next thing we build is chosen from data rather than from a hunch.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today:** `is_admin` exists on `profiles`, set by the signup trigger from the seeded `admin_emails`
  list ([20260727180000_admin_colleague.sql](../supabase/migrations/20260727180000_admin_colleague.sql)),
  and the only thing in the app that reads it is `isAdminUser`
  ([store.ts:552](../apps/web/src/lib/data/store.ts#L552)), consumed by `checkAllowance` to skip the free
  ceiling ([allowance.ts:110](../apps/web/src/features/generation/allowance.ts#L110)). There is no admin
  screen, no admin route, and no admin data path.
- **The problem:** every operator question — who signed up, why they got stuck, what a ticket is about,
  which review may be shown — is answered by opening Supabase Studio and writing SQL. So nobody does it,
  and decisions get made on feel.
- **Already in place, missing its last step:** spec 144 stores reviews with `consent_public` and a
  `published_at` that it promised **nothing** would ever write until this spec exists (144, _Out of
  scope_), and `support_tickets` carries a `status` column with `check (status in ('open','closed'))`
  that no code can currently change.
- **Already in place:** `NAV_ITEMS` ([nav-items.ts:9-13](../apps/web/src/components/shell/nav-items.ts#L9-L13))
  is one static list feeding both the sidebar ([sidebar.tsx:141](../apps/web/src/components/shell/sidebar.tsx#L141))
  and the command palette ([app/layout.tsx:31](../apps/web/src/app/app/layout.tsx#L31)) — which is exactly
  why an admin entry cannot simply be appended to it. `requireSession()`
  ([auth.ts:60](../apps/web/src/lib/auth.ts#L60)) is the single gate every `/app` page already passes
  through, which makes it the natural place for a suspension check to bite.
- **Found while grounding this plan — `is_admin` is currently forgeable.**
  `20260725100000_schema.sql` grants `select, insert, update, delete` on `public.profiles` to
  `authenticated` ([:195](../supabase/migrations/20260725100000_schema.sql#L195)) under the policy
  `own profile … using (id = auth.uid())` ([:138](../supabase/migrations/20260725100000_schema.sql#L138)).
  RLS is doing its job — the row genuinely *is* theirs — but the privilege is table-wide, so any signed-in
  founder can run `update public.profiles set is_admin = true where id = auth.uid()` with the anon key and
  grant themselves the flag. Today that buys an unlimited generation allowance
  ([allowance.ts:110](../apps/web/src/features/generation/allowance.ts#L110)); the moment this spec exists
  it would buy every other workspace's interview answers. **The same shape would let a suspended founder
  clear their own `suspended_at`.** `20260729120000_pro_plan.sql` already solved exactly this for
  `organizations.plan` by narrowing to column-level grants, and this change does the same for `profiles`.
  Recorded here rather than split out because the gate this spec builds is worth nothing until it is
  fixed.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

Five tabs under `/app/admin`, inside the existing app shell, gated by a `requireAdmin()` that sits beside
`requireSession()` and is called **again inside every admin read and every admin action** — a hidden menu
item is not an authorization check, and a protected page whose server action is unprotected is not
protected. All cross-organization reads live in exactly one module, `lib/data/admin.ts`, so the place
where Airrow deliberately steps over the tenancy boundary is one file a reviewer can read end to end,
rather than special cases sprinkled through `store.ts`. Statistics are SQL views/RPCs owned by `postgres`
and granted to `service_role` alone — aggregates belong in Postgres, and PostgREST is the wrong tool for
them.

**Decided during `/clarify` (2026-07-31):**

- **One spec, one PR.** All five surfaces ship together on `150-admin-console` → `feature/ui`. The
  issue's three-step order is kept as the **build and commit order** — gate + users, then tickets +
  reviews, then projects + statistics — so the diff is still readable in sequence, but it is one
  coherent slice and issue 150 closes once.
- **Extra generations get their own table**, `generation_credits`, counted by `checkAllowance`. Not a
  `'support'` source on `plan_grants`: a week of unlimited Pro is a different thing from the one
  generation a founder actually needs back, and the credit carries the reason and the grantor that a
  plan grant has nowhere to put. `organizations.plan` is still never written (specs 74/99/100/122).
- **Suspension bites in two places.** `profiles.suspended_at` is the truth and is read where the session
  is checked (`requireSession`), so an already-open session dies at the next server call; Supabase Auth's
  admin API additionally bans the account, so no fresh token can be fetched. Reactivation lifts both. The
  app's own check is what protects data — the Auth ban is what stops the account coming back.
- **`/app/admin` sits inside the founder shell**, as the issue's own wording has it. `NAV_ITEMS` becomes
  session-aware — one builder that takes the session and returns the list — rather than a second list for
  admins, so the sidebar and the command palette keep sharing exactly one source.
- **Visitor analytics is not built here.** This page's statistics come only from rows that exist because
  the product works. Measuring anonymous visits — Vercel's cookieless Web Analytics, a consent banner
  with *accept all* / *necessary only*, and a rewritten, EU-compliant cookie policy linked from that
  banner — is wanted, and becomes **its own issue against `feature/ui`, running in parallel**. It touches
  the landing page and the legal texts rather than the admin page, so binding the two would put cookie
  law and SQL aggregates in one review and let either block the other. Admin gains the visitor numbers
  when that issue lands.

**Not touched:** `organizations.plan` stays Stripe's alone (specs 74/99/100/122) — extra generations are a
separate, auditable grant. `admin_emails` keeps its "migration writes it, nothing reads it but the
trigger" posture; this page does not manage admins. Existing tables' RLS policies are not rewritten with
"admins see everything" clauses — that would make every policy harder to read and easy to get wrong.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

**The gate**

- [x] `/app/admin` exists, requires a session **and** `is_admin`. A signed-in non-admin gets `notFound()`
      — not a redirect that reveals the route exists.
- [x] The admin nav entry renders **only** for admins, in both the sidebar and the command palette:
      `NAV_ITEMS` becomes a session-aware builder, so the two keep sharing one source and neither grows
      wiring of its own.
- [x] Every cross-organization read lives in `lib/data/admin.ts`, is server-side, and re-checks `is_admin`
      itself before reading anything.
- [x] A denial test proves a non-admin reaches neither the page nor any admin server action.

**Users**

- [x] The user list shows: name, email, account id, signed up, last seen, verified; workspace and its
      `plan` plus whether an active `plan_grant` currently covers it; project count, charged generation
      count, last generation; how they arrived (invite via `referrals`, and who invited them, or direct);
      and Stripe subscription status when there is one. Searchable, sortable by signup and last activity.
- [x] A suspended user **cannot keep using an already-open session** — `profiles.suspended_at` is read
      where the session is checked, not only at login — **and** cannot obtain a new one: the account is
      banned via Supabase Auth's admin API in the same action. Reactivation lifts both. Nothing is
      deleted.
- [x] Granting extra generations writes one `generation_credits` row **per generation** (who, when, why),
      each consumed independently, counted by `checkAllowance` below the Pro and admin short-circuits, and
      **does not touch `organizations.plan`**.
- [x] Every list on the page — users, projects, tickets — paginates and searches **in the database**, with
      a fixed page size. No list fetches everything and filters in JavaScript.
- [x] A user row shows its own audit history — suspensions, reactivations and credits — inline, without
      anyone opening Supabase Studio.

**Projects**

- [x] All projects, filterable by status (`interviewing` · `generating` · `ready` · `failed`) and by
      origin, showing name, workspace, status, created, updated, generation count.
- [x] Origin is shown: imported (`import_sources.kind` = `zip` | `repo`) or started from scratch.
- [x] Interview answers render question-by-question in readable form, not raw jsonb.
- [x] A `failed` project shows the error and distinguishes "we broke" from `rejected_answers` (spec 128),
      naming the job, the stage it stopped at and the stages it completed. _(Amended during `/analyze`:
      this said "with a link to the job and its steps". There is nowhere to link — the founder-facing
      `/app/projects/[id]/generating` is org-scoped and an operator is not a member of that
      organization, so a link would 404. An admin job view is a bigger thing than this criterion was
      asking for; the job, its stage and its stepping are shown inline instead, which is what the
      criterion was for. Recorded rather than quietly dropped, per §IV.)_

**Support tickets**

- [x] All `support_tickets`, newest first, filterable by status and category, showing who, workspace,
      project, category, subject, full body, when.
- [x] A ticket can be closed and reopened from the page.
- [x] From a ticket: shortcuts to the user's account, the project, and granting extra generations.

**Reviews**

- [x] A review can be published and unpublished. The admin action is the **only** thing in the codebase
      that ever *sets* `published_at`, as spec 144 promised; the consent-withdrawal path below is the one
      other writer and it can only ever *clear* it. Publication stays ours alone; withdrawal stays the
      founder's alone.
- [x] A review **without** `consent_public` cannot be published — not through the UI and not through a
      direct POST to the server action.
- [x] The founder's chosen display name is shown as it would appear publicly; the list filters by rating
      and by "awaiting decision", so it reads as a queue rather than an archive, and each review shows its
      own publication history.
- [x] A founder who withdraws `consent_public` on an **already published** review unpublishes it in the
      same action — `published_at` is cleared automatically, with no operator step in between.

**Statistics**

- [x] Signups per day/week; activation (created a project → completed the interview → used a generation);
      distribution over `projects.status`; how far into the interview the stuck ones got (answers counted
      in `interviews.answers`); failed generations split into ours vs. rejected answers; invites
      (`referral_codes` → `referrals` → `matured_at` → weeks of Pro in `plan_grants`); Pro bought /
      cancelled / active (`subscriptions`); review average and distribution; tickets per category over
      time.
- [x] Every number is comparable against the previous period.
- [x] Series are built with `generate_series` so empty days are zeros, not gaps.
- [x] Aggregates are computed **in the database**, not by fetching rows and counting in JavaScript.

**Security, privacy, and the bar**

- [x] No third-party script, no new cookie, nothing that would make a consent banner necessary — the
      statistics here are Postgres only. Visitor measurement and the consent banner it requires are a
      separate, parallel issue (see _Out of scope_), and this change must not pre-empt it.
- [x] New tables have RLS **with denial tests**; new views/aggregates are reachable by `service_role` and
      **not** by `authenticated`.
- [x] Suspension, reactivation, granted generations and publication decisions each write an auditable row
      (who, what, when, why).
- [x] The privacy policy gains a line about staff access to project data for delivery and support, in
      **this** change ([privacy/page.tsx](../apps/web/src/app/(legal)/privacy/page.tsx)).
- [x] Nothing shown on this page reaches the logs (§II: ids and metadata only).
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — `apps/web/src/lib/data/admin.db.test.ts`: RLS access **and** denial on every new table;
  `authenticated` cannot select the statistics views; a non-admin calling an admin read gets nothing.
- **New tests** — admin action tests: publishing a review without `consent_public` is refused at the
  server boundary; granting generations writes a row and leaves `organizations.plan` untouched;
  suspend/reactivate round-trips.
- **New tests** — `checkAllowance` counts a granted credit; a credit cannot be spent twice; a Pro
  workspace's credit is left unconsumed and is still there after the plan reverts to free.
- **New test** — withdrawing consent on a published review clears `published_at` in the same action.
- **New tests** — each list paginates and searches in the database (row counts and query shape asserted,
  not the rendered page).
- **New test** — the admin nav item is absent from `NAV_ITEMS` for a non-admin session.
- **New test** — a suspended user's session is refused by the shared session gate.
- Full suite result + typecheck/lint status.

### Implementation notes (2026-07-31)

**99 tests written, across seven files.**

- `apps/web/src/lib/data/admin.db.test.ts` (13), against local Supabase. The first three matter most,
  and they are about the hole in _Background_: a founder cannot set their own `is_admin`, a suspended
  founder cannot clear their own `suspended_at`, and the rename that had to keep working still does.
  Then: `generation_credits` and `admin_audit_log` refuse `authenticated` every privilege (read, insert,
  and un-spending a credit); the audit log's action and subject checks; the `auth.users` view denied to
  a founder and working for the service role; **all seven statistics functions denied one by one** —
  Postgres grants `execute` to `public` by default, so a function added later without a revoke is
  exactly the regression this catches; the daily series returning seven rows for seven days; credits
  cascading with the workspace but surviving the admin who granted them.
- `apps/web/src/lib/data/admin.test.ts` (36). Every exported read and write refuses a non-admin **and
  writes nothing before it refuses**, named one by one rather than looped over the module's exports so a
  new function without a check fails rather than going untested. The publication rule: no consent → no
  write at all, consent → `published_at` set, unpublishing always allowed, missing review reported. And
  the paging, asserted on the *query* rather than the result — every list calls `.range()`, the window
  moves with the page, it asks for one row more than it shows, the search becomes an `ilike` filter, and
  `,`/`%`/`()` are stripped from the term because PostgREST reads a comma in `or` as another filter.
  A version that fetched everything and sliced it in JavaScript would pass every other test here.
- `apps/web/src/features/admin/actions.test.ts` (18). Each action refuses a non-operator **and does
  nothing at all when refused** — a server action is a POST endpoint reachable without its page, so this
  is the gate that matters. Plus: suspension and reactivation write the right audit action; a grant
  writes credits and an audit row and never reaches `organizations.plan`; a count of 5000 is capped at
  10 and `"abc"` becomes 1; and a publication the data layer refused writes **no** audit row, because a
  refused action is not an event that happened.
- `apps/web/src/lib/auth.admin.test.ts` (8). A non-admin gets `notFound()` and specifically *not* a
  redirect; a suspended account has no session even though Supabase still says its token is valid; a
  suspended admin is refused as suspended, before the admin flag is ever consulted.
- `apps/web/src/features/generation/allowance.test.ts` (+10). A credit is the **last** resort: never
  touched while the free foundation, a free repair, an earned week or Pro would do; reported without
  being spent by `checkAllowance`; spent exactly once by `claimAllowance`; and the concurrency case
  where two runs race for the last credit and the loser gets its original refusal back.
- `apps/web/src/features/admin/answers.test.ts` (8) — the interview renders as the questions the founder
  was asked and the labels they chose, in the interview's own order, dropping stale ids and surviving
  anything jsonb might hold. `apps/web/src/lib/data/support.review.test.ts` (3) — withdrawal clears
  `published_at`, consent leaves it alone, and neither path ever writes it to a non-null value.

**Result:** `pnpm -r typecheck` clean · `pnpm -r lint` clean · `pnpm -r test` **1077 passed, 0 failed**
(69 schemas · 223 engine · 785 web) · `pnpm test:scripts` 88 passed. No pre-existing failures.

**The migration was replayed from zero** with `supabase db reset` — every migration in order, this one
last, no error — and the whole denial posture was then checked by hand against that database *before*
any application code was written, so the access-control claims are proven rather than asserted.

**One thing this spec fixes that it did not set out to fix.** `is_admin` was writable by its own
account, and had been since `20260725100000_schema.sql`. It is recorded in _Background_, fixed in the
migration, documented in `DATABASE_DESIGN.md` under a new heading ("`profiles` was the same bug"), and
covered by three denial tests. Every other guarantee in this spec depended on it.

**Two deviations from the plan.** The statistics are seven SQL **functions** rather than views —
`admin_totals` and the daily series take a window as arguments, which a view cannot. And `AdminTabs` is
a row of links rather than Radix `Tabs`: a real tab widget would need all five surfaces' data loaded at
once, which is the opposite of what these screens do — each paginates and filters through its own search
params as a Server Component.

**Charts.** No charting library. The statistics page is stat tiles and bars built from the design
system's tokens, so light and dark are the same code (§III). Every chart is a single series, which is
why identity is carried by a written label beside every mark and there is no categorical palette
anywhere on the page — nothing for a colourblind reader to have to tell apart by hue. Status tokens
appear in exactly one place, the project-status and failure-split bars, where the categories genuinely
*are* statuses and are labelled as well as coloured.

**Not proven by any test, and named here instead:** the Supabase Auth ban half of suspension calls
`auth.admin.updateUserById`, which is a network call to the Auth server rather than a database write.
The `suspended_at` half — the one that actually protects data, because it is read on every request — is
covered. The ban is what stops a *new* token being issued, and confirming it needs the running Auth
service: sign in as a test account, suspend it, and confirm both that the open session dies at the next
request and that signing in again is refused.

### What `/analyze` found, and what it changed (2026-08-01)

The cross-check failed on its first pass. Two of the criteria ticked above were not actually met, and
one of them was a defect rather than an omission. Recorded here because a spec that only shows the
version that passed teaches nothing.

**1. The origin filter ran in JavaScript, and the pager then lied.** `adminProjects` filtered
`imported`/`scratch` *after* the database had already sized the page, and `Pager` inferred "is there a
next page" from `items.length === pageSize`. So on any page where the filter removed even one row, the
Next link vanished: an operator filtering to imported projects was shown a partial list presented as the
whole one. Worse, it silently broke the criterion two lines above it — *"paginates and searches in the
database"*.

The code comment justifying it was **wrong on the facts**: it claimed PostgREST cannot express "has no
related row" without an embedded resource. It can, *with* one, and both directions were then verified
against the running stack rather than reasoned about — `import_sources!inner(kind)` for imported,
`import_sources(kind)` plus `import_sources=is.null` for from-scratch. The filter now happens in the
query, the embed replaces a second round trip, and `Page<T>` carries an explicit `hasMore` decided where
the extra row was fetched. `Pager` consumes that instead of re-deriving it, so the inference cannot come
back.

**2. The user list was not sortable at all.** The criterion says *"searchable, sortable by signup and
last activity"*; `adminUsers` hard-coded `order("created_at")` and the screen had no control. Sorting by
last activity is the interesting half, and it is why this needed a schema change rather than a
parameter: `last_sign_in_at` lives in `auth.users`, and ordering a page *after* fetching it sorts
twenty-five rows rather than the list. So `admin_user_accounts` became **`admin_accounts`**, a view
joining `profiles` to the two `auth.users` columns the console shows — one object that search, sort and
paging all go through in a single query. `nullsFirst: false` is deliberate: a null last-activity means
"never", and Postgres would otherwise rank everyone who has never signed in above everyone who just did.

**3. "A link to the job and its steps"** was amended, not implemented — see the criterion above.

**Added by this pass:** 13 tests (47 in `admin.test.ts`, up from 36; 15 in `admin.db.test.ts`, up from
13), covering both origin directions and the no-filter case, that a full page survives the filter, the
four ordering shapes, `hasMore` distinguishing "exactly full" from "more to come", and the new view's
join and exact column list.

**Re-verified after the fixes:** migration replayed from zero again, `pnpm -r typecheck` clean ·
`pnpm -r lint` clean · `pnpm -r test` **1090 passed, 0 failed** (69 schemas · 223 engine · 798 web) ·
`pnpm test:scripts` 88 passed. The two PostgREST filter shapes and the `admin_accounts` view were also
exercised through the real REST API, not just SQL.

---

## Exact changes (file:line)

_Expanded by `/implement`. All five surfaces ship in one PR to `feature/ui` (decided during `/clarify`),
built and committed in the issue's three-step order so the diff reads in sequence:_

1. **Gate + users + suspension + extra generations** — `requireAdmin()`, `lib/data/admin.ts`, the
   session-aware `NAV_ITEMS`, `profiles.suspended_at`, `admin_audit_log`, `generation_credits` and its
   `checkAllowance` arm. Solves support for real.
2. **Tickets + reviews** — closes the two half-finished things from spec 144: the `status` nothing could
   change, and the `published_at` nothing was allowed to write.
3. **Projects + statistics** — the largest, and the one that benefits from being built last, on top of
   the admin data module the first two steps established.

**The files, in dependency order:**

1. **`supabase/migrations/20260801130000_admin_console.sql`** — the whole schema half, idempotent:
   `generation_credits`, `admin_audit_log`, `profiles.suspended_at`, the `admin_user_accounts` view over
   `auth.users` (for last sign-in and verification, which PostgREST cannot reach), six statistics
   functions, and the **column-level narrowing of `profiles`** described in _Background_.
2. **`apps/web/src/lib/data/credits.ts`** — the `generation_credits` table, beside `referrals.ts` and for
   the same reason: `creditsAvailable`, `consumeCredit`, `grantCredits`, `listCredits`. Org-scoped, not
   cross-org, so it is deliberately *not* in `admin.ts` — `checkAllowance` reads it for the founder
   themselves.
3. **`apps/web/src/lib/data/store.ts`** — `profileFlags(userId)` returning `{ isAdmin, suspendedAt }`,
   tolerant of the column being absent the way `getOrgForUser` is of `organizations.plan`
   ([:266](../apps/web/src/lib/data/store.ts#L266)). `isAdminUser` delegates to it.
4. **`apps/web/src/lib/auth.ts`** — `getSession` returns null for a suspended account, so an open session
   dies at the next server call; `requireAdmin()` beside `requireSession()`, calling `notFound()`.
5. **`apps/web/src/features/generation/allowance.ts`** — a `credit` grant as the **last** resort, after
   the free foundation and after the repair window, so a credit is never spent where something free
   would have done. Only `claimAllowance` consumes one.
6. **`apps/web/src/lib/data/admin.ts`** — every cross-organization read, each function taking the actor's
   id and passing it through one `assertAdmin` before it reads anything.
7. **`apps/web/src/features/admin/actions.ts`** — suspend, reactivate, grant credits, ticket status,
   publish/unpublish. Each re-gates with `requireAdmin()` and writes an `admin_audit_log` row.
8. **`apps/web/src/features/support/actions.ts`** — clear `published_at` when consent is withdrawn.
9. **`apps/web/src/components/shell/nav-items.ts`** + **`sidebar.tsx`** + **`app/app/layout.tsx`** —
   `navItems({ isAdmin })` replaces the constant; the sidebar takes the list as a prop so both consumers
   still read one source.
10. **`apps/web/src/app/app/admin/*`** — `layout.tsx` (the gate + the tab row), then `page.tsx` (users),
    `projects/`, `tickets/`, `reviews/` and `stats/`.
11. **Docs** — the privacy policy's staff-access line, `DATABASE_DESIGN.md`, `UI_ARCHITECTURE.md`.

### Constitution check

- **§I one-way flow** — routes → `features/admin/actions.ts` → `lib/data/admin.ts` → Supabase. No route
  touches the database directly.
- **§II tenancy** — this is the one module that crosses the boundary, which is why it is one module. The
  `organization_id` scoping every other read does is replaced here by an `is_admin` check in the same
  position, so nothing is unscoped by accident.
- **§II RLS + denial tests** — three new objects (`generation_credits`, `admin_audit_log`,
  `admin_user_accounts`), all with RLS or an explicit grant posture, all with denial tests.
- **§II logs** — the admin screens read interview answers; nothing on this path is logged.
- **§III design** — tokens only, and the existing `Table`, `Card`, `Badge`, `Select` and `states`
  components rather than new ones.
- **No invariant is broken by this plan.** The one thing it *changes* is `profiles`' grant surface, which
  moves toward the constitution rather than away from it.

---

## Data model

Decided during `/clarify`; shapes below are the sketch `/implement` fills in.

- **`generation_credits`** — `id`, `organization_id`, `reason`, `granted_by` (the admin's user id),
  `granted_at`, `consumed_at`. **One row is one generation** — granting three writes three rows, each
  with its own `consumed_at`. There is no `amount` column: a quantity plus a single `consumed_at` cannot
  express "granted 3, used 1", and a partially-spent row is a state that has to be kept consistent and
  tested. Counting is then `count(*) where consumed_at is null`, and every spent credit says exactly when
  it went. `checkAllowance` consults them as a way past the free ceiling — below the Pro and admin
  short-circuits, so a Pro workspace never touches them. `plan_grants` is left alone: its `source` check
  keeps allowing `'referral'` only, because a week of Pro and a returned generation are different things
  (spec 122). **No write to `organizations.plan`.**
- **`profiles.suspended_at`** — nullable timestamp, the truth about suspension, read by the shared
  session gate. The Supabase Auth ban is applied alongside it but is not the record.
- **`admin_audit_log`** — one row per operator action: actor, subject, action, reason, timestamp.
  Covers suspension, reactivation, granted credits, ticket status changes and publication decisions. It
  is **read back in the app**, inline on the thing it concerns — a user row shows its own suspension and
  credit history, a review shows its publication history — rather than as a sixth tab. A log that can
  only be read in Supabase Studio would reintroduce exactly the problem this page exists to solve.
- **Statistics** — SQL views or RPC functions in an idempotent migration, owned by `postgres`, granted to
  `service_role` only, with `generate_series` for the daily series.

All of it follows §II: idempotent migrations, access control in the same change as the resource, denial
tests included.

---

## Security

This is the most sensitive surface in the product. It crosses the tenancy boundary by design, so the
gate sits in the data layer and in every action rather than in the view; interview answers are customer
IP and must never reach a log; and the privacy policy is updated in the same change, because a page that
shows every founder's answers is not compatible with a policy that is silent about it.

---

## Edge cases

- **Admin views their own workspace** → shown like any other; no special-casing.
- **Suspended user with a valid token** → next server call refuses them; already-downloaded artifacts are
  unaffected.
- **Review published, then consent withdrawn** → unpublished immediately and automatically. Spec 144
  upserts on `project_id`, so a resubmitted review with the box unticked *is* a withdrawal;
  `published_at` is cleared in the same action that saves it. The founder's consent is theirs, and a
  public quote standing without it is the failure that matters (§0, founder-in-control). Note this is the
  one place outside the admin page that writes `published_at` — it only ever clears it, never sets it.
- **Project deleted after a ticket referenced it** → `project_id` is nullable (spec 144); the ticket
  survives and the link degrades gracefully.
- **A workspace with no activity** → zeros, not blank cells.
- **Granted generations on a workspace that then buys Pro** → the credit stays, unconsumed. Pro
  short-circuits `checkAllowance` above the free path, so an unused credit is never even consulted while
  the subscription is active and cannot be spent by accident; after a cancellation it is simply there
  again. What we granted as compensation is not taken back because someone paid.
- **A credit granted to a workspace that never generates again** → it sits unconsumed indefinitely. No
  expiry, deliberately: a deadline on an apology is a second thing to explain.

---

## Out of scope

- **Deleting an account or a workspace from here.** Irreversible and tangled with GDPR routine — its own
  issue, with its own thought.
- **Answering a ticket inside the app** — we answer from Gmail (spec 144).
- **Reading the contents of imported files.** We do not store them and the policy says we do not read
  them; the page shows structure, never file contents.
- **More admin roles than `is_admin`.** A role model gets built the day we are more than two.
- **Editing a founder's answers or a review's text.** We show and publish; we do not rewrite what someone
  said.
- **Visitor analytics, the cookie-consent banner, and the cookie-policy rewrite.** Decided during
  `/clarify`: wanted, but **its own issue against `feature/ui`, running in parallel** — Vercel's
  cookieless Web Analytics, a banner offering *accept all* or *necessary only*, and an EU-compliant
  cookie policy linked from it. It is landing-page and legal work, not admin work; keeping them apart
  stops cookie law and SQL aggregates landing in one review. This spec adds no script and no cookie, and
  the admin statistics gain visitor numbers once that issue ships.

---

## Open questions

**None.** Everything the issue and the two `/clarify` passes raised is decided and folded into _Design
decision_, _Data model_, _Edge cases_ and _Out of scope_ above. The second pass settled the credit
consumption model (one row per generation), the audit log (`admin_audit_log`, read back inline),
list pagination (server-side, all three lists), consent withdrawal (auto-unpublish) and what happens to a
credit when a workspace buys Pro (it waits).
