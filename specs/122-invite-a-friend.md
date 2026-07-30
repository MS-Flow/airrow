# Spec 122 — Invite a friend, get a week of Pro

> **In one sentence:** A founder who likes Airrow gets a link worth sending — when someone they invited
> generates their first foundation, the inviter gets a week of Pro, without Stripe ever being told a lie.

|                |                                                      |
| -------------- | ---------------------------------------------------- |
| **Status**     | ✅ Done                                               |
| **Issue**      | #122 — "Pro: bjud in en vän — en vecka Pro när den inbjudna genererat sin första foundation" |
| **Branch**     | `122-invite-a-friend` (from `feature/pro`)            |
| **Feature**    | pro                                                   |
| **Depends on** | [spec 74](74-pro-entitlements.md) (plan + entitlements), [spec 99](99-stripe-checkout.md) / [spec 100](100-pro-upgrade-revisions.md) (who may write `organizations.plan`), [spec 113](113-branded-auth-email.md) (the email confirm route) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

_Who wants this, and what they get out of it._

As a **founder who has generated a foundation and liked it** I want **a link I can send to another
founder, that pays me back when they actually use it** so that **telling people about Airrow is worth
something to me, and Airrow grows through the people who already believe in it.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today:** there is no way for a founder to invite anyone. Growth depends entirely on people finding
  us, and when someone does recommend Airrow we never learn that it happened.
- **The problem:** the one thing we can afford to give away is the thing that costs us money — a
  generation. A week of Pro is a few Claude calls; a founder who arrives already recommended is worth
  more than that.
- **Already in place:**
  - `checkAllowance(query)` is the single place an entitlement is decided, and it short-circuits on
    `plan === "pro"` (`apps/web/src/features/generation/allowance.ts`, spec 74).
  - `generation_usage` is written by the `record_generation_usage()` trigger on **insert** of a
    generation job ([20260727160000_generation_allowance.sql:46-49](../supabase/migrations/20260727160000_generation_allowance.sql#L46-L49))
    — not on completion. What excludes a failure is the *read*: `chargedUsage` drops rows whose job is
    `failed` or `reused_authoring`
    ([store.ts:454-470](../apps/web/src/lib/data/store.ts#L454-L470)). So "they generated something"
    is a question for `countGenerations`, never for the presence of a ledger row.
  - `organizations.plan` is written **only** by `applySubscriptionState`, guarded by a column-level
    revoke (`supabase/migrations/20260729120000_pro_plan.sql`, specs 99 + 100).
  - Two ways into an account: `/auth/confirm` (email, spec 113) and `/auth/callback` (GitHub, spec 67).
  - `planStanding(subscription)` writes the sentence Settings shows about a paid plan.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

**The grant is a separate entitlement source, never `organizations.plan`.** That column means "this is
what Stripe told us". Writing a referral week into it would destroy the invariant specs 99 and 100 exist
to protect, and an expired week would then look exactly like a cancelled subscription. Instead a
`plan_grants` row carries the week, and one server-side resolver answers "is this organization Pro?" as
*Stripe's plan **or** an active grant*. `checkAllowance` is still the only caller anyone else knows about.

**The reward is earned by the invited founder's first successful generation, not by verification.**
Verification is cheap and easy to farm; a generated foundation is someone who actually used the product.
The referral is *attached* to the invited workspace at verification — through both `/auth/confirm` and
`/auth/callback`, so choosing GitHub does not silently lose it — and *matures* into a grant when that
workspace's first generation completes, asked as `countGenerations(orgId) > 0` so a failed or memoised
run never earns anyone a week.

**A queued grant activates lazily, rather than being dated at creation.** A grant is created with no
`starts_at`; it is activated at the moment the organization *asks for something it needs Pro for* and
Stripe is not already covering it — `checkAllowance`, and the import gate. Deliberately not on a Settings
render: a founder reading a page must not start their week by looking at it. That is what makes "the week
waits behind a paid subscription" true without anyone having to predict when the subscription ends, and
it survives cancellation, renewal and a payment failure without a second code path.

**An active grant is `grant: "referral"`, not `"pro"`.** `AllowanceGrant` is a discriminated union whose
whole job is to say *why* (§I), and Settings has to tell a week apart from a subscription — one has a
Stripe standing behind it and the other must never be described as if it does.

**Two surfaces, and the second one is the point.** Settings is where the link lives and where the state
is explained — places left, each invited founder's status, when the current week ends. But almost nobody
opens Settings to recommend a product. The prompt that will actually earn invitations sits on the
delivery screen, the moment a founder has just seen their finished foundation. It stays a single quiet
line rather than a banner: a tool founders work in should not advertise to them.

**Not touched:** Stripe, the webhook, `applySubscriptionState`, and the free-foundation and repair rules
in `checkAllowance` all stay exactly as they are. This spec adds a way to *be* Pro; it does not change
what Pro means.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] Every signed-in user has a referral code, and a link containing it, shown in Settings.
- [x] Following an invite link and completing signup attaches the referral to the new account — via
      `/auth/confirm` **and** via `/auth/callback`.
- [x] The referral attaches at most once per invited account, however many times the link is clicked.
- [x] The inviter's grant is created when the invited account's **first** successful generation is
      recorded, and never from a failed job.
- [x] A second generation by the same invited account creates no second grant.
- [x] An organization with an active grant is unlimited in `checkAllowance` (`grant: "referral"`,
      `unlimited: true`), with no caller changed — and may import an existing project, which is the
      other thing Pro buys (spec 74).
- [x] An expired grant is not Pro; the organization falls back to free with every project and download
      still readable.
- [x] A grant earned while the organization is already Pro through Stripe does not start counting down
      until the subscription stops covering it.
- [x] At most 3 referrals per inviting account ever mature into a grant. The 4th invited founder still
      gets their own normal free tier and is told nothing about the cap.
- [x] Self-referral is refused: the same account, and an invited "new" user who already had an account.
- [x] Settings shows how many of the 3 places are left, the status of each invited founder
      (attached / generated), and when the current Pro week ends.
- [x] The delivery screen offers the same link once a foundation has been generated, as one line — and
      not at all to a founder with no places left.
- [x] Settings never presents a referral week as a subscription.
- [x] `organizations.plan` is written by nothing this spec adds.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — [`apps/web/src/lib/data/referrals.test.ts`](../apps/web/src/lib/data/referrals.test.ts)
  (10): crediting on the first charged generation, nothing for an uncharged one, nothing twice, the cap
  recorded rather than dropped, starting a queued week, not starting a second while one runs, the next
  week starting after the last has run out, and `grantStanding` changing nothing.
- **New tests** — [`apps/web/src/lib/data/referrals.db.test.ts`](../apps/web/src/lib/data/referrals.db.test.ts)
  (10, against real Postgres): RLS access **and** denial per table, the invited workspace not reading
  the referral, the write refusals (`insert`/`update` on `plan_grants`, `insert` on `referrals`), the
  self-referral and one-referral-per-workspace constraints, the "starts without ending" check, and the
  cascade on workspace deletion.
- **New tests** — [`apps/web/src/features/referrals/attach.test.ts`](../apps/web/src/features/referrals/attach.test.ts)
  (13): attaching, clearing the cookie, refusing an old account, a malformed cookie and a workspace-less
  account — and that a failure here never breaks the signup around it.
- **New tests** — [`apps/web/src/app/invite/[code]/route.test.ts`](../apps/web/src/app/invite/%5Bcode%5D/route.test.ts)
  (3): the cookie is httpOnly and `lax`, a nonsense code still lands on signup, and `secure` follows the
  connection rather than being hardcoded.
- **Extended** — [`allowance.test.ts`](../apps/web/src/features/generation/allowance.test.ts): an active
  grant lifts the ceiling; `checkAllowance` reports without starting one; `claimAllowance` starts one;
  neither a Pro workspace nor an admin ever touches a grant.
- **New tests** — [`continue/page.test.tsx`](../apps/web/src/app/app/projects/%5Bid%5D/continue/page.test.tsx)
  (4): the link is offered on the delivery screen, says the reward lands when *they* generate, is absent
  once every place is used, and has not displaced the five steps the page exists for.
- **Extended** — [`settings/page.test.tsx`](../apps/web/src/app/app/settings/page.test.tsx): the card
  and its remaining places, the link disappearing at zero, a waiting week described as not counting
  down, and — the one that matters — an earned week never rendered as a subscription.
- **Extended** — the auth routes' own tests, and
  [`import/actions.test.ts`](../apps/web/src/features/import/actions.test.ts): an earned week completes
  an import.
- **Result:** `pnpm -r typecheck` clean · `pnpm -r lint` clean · `pnpm -r test` **515 passed, 0 skipped,
  0 failed** (against local Supabase, so every `*.db.test.ts` suite ran) · `pnpm test:scripts` 80 passed.

---

## Implementation notes

**The migration was executed, not merely reviewed.** `supabase migration up` applied it to a database
that already held every earlier migration — the path a real deployment takes — and the ten RLS and
constraint tests then passed against it. That includes the denial that matters most: `authenticated`
cannot `insert` a `plan_grants` row, so a founder cannot grant themselves Pro from a browser console.

**Three deviations from the plan, all recorded above where they happened:**

1. **Maturation lives in the generate route, not `runner.ts`.** The route already has the organization;
   the runner only knows a project, and inventing a project→organization lookup for one caller was the
   worse trade.
2. **`checkAllowance` was split into `checkAllowance` (reports) and `claimAllowance` (may spend).** Not
   in the original plan, and it is the most important thing in this change: `checkAllowance` runs on the
   projects list, the interview screen and Settings, so a single function that both answered and
   activated would have started a founder's earned week because they opened a page. Caught while wiring
   Settings, not by a test — the test came after.
3. **The invite link is `/invite/<code>`, not `?ref=` on the landing page** (issue #122's wording). A
   server component cannot set a cookie while it renders, and the landing page is outside the middleware
   matcher.

**One flake seen once, in a file this spec does not touch.**
`src/features/import/MergedDownload.test.tsx > opens the file picker on the first click when this
browser has no archive` failed in one full run and passed both alone and in the next full run. Pre-existing
and timing-dependent under a loaded jsdom; not investigated here, and worth its own issue if it recurs.

**Verification gap closed during `/analyze`.** Two acceptance criteria — the Settings copy and the
delivery-screen line — were ticked on a reading of the code, with no test behind either. Both now have
one; the counts above are after that.

**A bug found after `/analyze`, in the first minute of real use.** A dev server pointed at the hosted
project — which will not have this migration until the PR chain merges and `supabase-migrate.yml` runs —
answered `Could not find the table 'public.plan_grants' in the schema cache`, and **Settings would not
load at all**. The projects list, the interview screen, the import screen and the delivery screen would
all have gone the same way, because every one of them reads referrals now.

This is the failure `isMissingColumn` in [`store.ts`](../apps/web/src/lib/data/store.ts) already exists
to prevent at column granularity, and its comment says so in as many words: a database one migration
behind used to take down the very screens whose job is to *tell* a founder where they stand. The fix is
the same shape one level coarser — `isMissingTable` plus `rowsOrAbsent`, which distinguishes "this
workspace has no invitations" (`[]`) from "this deployment has no invitations feature" (`null`). Six
regression tests in `referrals.test.ts`, one page-level test in `settings/page.test.tsx`, and the
tolerance is deliberately narrow: a connection error still throws.

Final counts after the fix: `pnpm -r test` **522 passed, 0 skipped, 0 failed**; typecheck and lint clean.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

1. **`supabase/migrations/20260730120000_referrals.sql`** — the three tables in _Data model_, their RLS
   policies, and `grant select` to `authenticated` with every write reserved to `service_role`. Same
   shape as [20260727160000_generation_allowance.sql:81-94](../supabase/migrations/20260727160000_generation_allowance.sql#L81-L94).
2. **`apps/web/src/lib/data/referrals.ts`** (new) — the whole subsystem, in the data layer beside
   [store.ts](../apps/web/src/lib/data/store.ts): `referralCode(orgId)` (get or create),
   `attachReferral(code, referredOrgId)`, `matureReferral(orgId, now)`, `claimPro(orgId, now)`
   (activates a queued grant — used only by entitlement decisions) and `grantStanding(orgId, now)`
   (read-only, for Settings). A sibling module rather than 200 more lines in a 1000-line store: these
   tables are only ever touched together and by nothing else.
3. **`apps/web/src/features/generation/allowance.ts`** — add `"referral"` to `AllowanceGrant`, and
   between the `plan === "pro"` short-circuit and the free ceiling ([:88-93](../apps/web/src/features/generation/allowance.ts#L88-L93))
   ask `claimPro`. Nothing else in the function changes, so no caller does either.
4. **`apps/web/src/features/import/actions.ts`** ([:125](../apps/web/src/features/import/actions.ts#L125))
   and **`apps/web/src/app/app/projects/import/page.tsx`** ([:46](../apps/web/src/app/app/projects/import/page.tsx#L46))
   — the other half of what Pro buys. Both read `org.plan` directly today; both go through the same
   `claimPro`/`grantStanding` so a founder on a referral week is not told Pro and then refused.
5. **`apps/web/src/app/invite/[code]/route.ts`** (new) — the shareable link. Sets an httpOnly cookie and
   redirects to `/signup`. A route rather than `?ref=` on the landing page, because a server component
   cannot set a cookie during render and the landing page is not in the middleware matcher
   ([middleware.ts:22](../apps/web/src/middleware.ts#L22)) — and `airrow.app/invite/<code>` is the nicer
   thing to paste anyway.
6. **`apps/web/src/app/auth/confirm/route.ts`** ([:26-28](../apps/web/src/app/auth/confirm/route.ts#L26-L28))
   and **`apps/web/src/app/auth/callback/route.ts`** ([:39](../apps/web/src/app/auth/callback/route.ts#L39))
   — read the cookie, attach, clear it. In the callback, guarded on a freshly created account the same
   way the unverified-signup purge already is ([:34](../apps/web/src/app/auth/callback/route.ts#L34)),
   so an existing founder signing in with a stale cookie earns nobody anything.
7. **`apps/web/src/app/api/projects/[id]/generate/route.ts`** ([:38-40](../apps/web/src/app/api/projects/%5Bid%5D/generate/route.ts#L38-L40))
   — mature the referral once the job comes back `completed`. Here rather than inside `runner.ts`,
   which the plan first named: the runner knows a project and this route already knows the
   organization, and inventing a project→organization lookup in the store for one caller is a worse
   trade than one line where the session already is.
8. **`apps/web/src/features/referrals/InviteCard.tsx`** (new, server component) — the Settings card:
   link, places left, per-invite status, and the current week's end date. Reuses
   [CopyBlock](../apps/web/src/features/delivery/CopyBlock.tsx) rather than a second copy button, and
   `Card`/`Badge` from the design system (§III).
9. **`apps/web/src/app/app/settings/page.tsx`** — render the card, and extend the unlimited branch
   ([:136-160](../apps/web/src/app/app/settings/page.tsx#L136-L160)) so a referral week is named as one.
10. **`apps/web/src/app/app/projects/[id]/continue/page.tsx`** ([:87-92](../apps/web/src/app/app/projects/[id]/continue/page.tsx#L87-L92))
    — one line above the footer, only when places are left.

**No change needed:** Stripe, the webhook, `applySubscriptionState`, `planStanding`, `countGenerations`
and the repair window. The grant is a second source of "is this org Pro", not a change to what Pro is.

### Constitution check

- **§I one-way flow** — routes stay thin; all three writes happen in `lib/data/referrals.ts`. `claimPro`
  writes during an entitlement decision, which is a deliberate exception to "reads don't write" and is
  why the read-only `grantStanding` exists for the page that only reports.
- **§II tenancy + RLS** — every table is keyed by `organization_id`, RLS ships in the same migration, and
  the denial tests cover both directions plus the write refusal.
- **§II never trust the client** — the code arrives from a cookie but is resolved server-side; the
  organization is always the session's.
- **§V** — deterministic tests, `now` injected everywhere rather than read from the clock.

---

## Data model

_Any database change. Most specs have none — say so plainly._

Three new tables in one migration (`20260730120000_referrals.sql`), RLS with access **and** denial tests
shipped in the same change (§II). Everything hangs off `organization_id`, like every other resource — the
personal workspace is the unit an entitlement lands on, so making the code the *user's* would mean two
different tenancy keys for one feature.

- **`referral_codes`** — `organization_id` (pk, → `organizations` on delete cascade), `code` (unique,
  random and unguessable), `created_at`. Created on demand, then stable forever: a link already sent
  must not stop working.
- **`referrals`** — `id`, `referrer_organization_id`, `referred_organization_id` (**unique** — this one
  constraint is what makes attachment idempotent, rather than a check that races), `attached_at`,
  `matured_at` (null until the invited founder generates), `plan_grant_id` (null when the referral
  matured but the inviter was already at the cap — recorded rather than dropped, so the cap is
  auditable). `referrer_organization_id <> referred_organization_id` as a table constraint: self-referral
  is refused by the schema, not only by the code above it.
- **`plan_grants`** — `id`, `organization_id`, `source` (`'referral'`), `duration_days`, `starts_at`
  (null while queued), `expires_at` (null while queued), `created_at`.

Every table is readable by members of its organization and **writable by `service_role` only** — the
`authenticated` role gets `select` and nothing else, which is the same shape as the column-level revoke
that protects `organizations.plan`. A founder who can `insert` into `plan_grants` has granted themselves
Pro, so this is the denial test that matters most.

**A queued grant never expires on its own.** It waits until the organization would otherwise be free,
however long that takes — a founder who pays for a year and then cancels still gets the weeks they
earned. That is why `plan_grants` carries no "usable until" column: only `expires_at`, and only from the
moment the week actually starts running. The alternative would make a week vanish silently from an
account that was paying us the whole time, which reads as a bug and is the opposite of a thank-you.

---

## Security

The referral code is random and unguessable, and is only ever resolved to a user server-side; the client
never sends an organization id, a plan, or a grant. Attachment happens exclusively inside the two
verification routes and maturation exclusively in the generation path, so no server action a signed-in
user can call at will creates an entitlement — and the 3-per-account cap bounds the cost of a farm even
if every other guard is bypassed.

---

## Edge cases

- **Invited founder's first job fails** → no `generation_usage` row, so no grant. Their retry earns it.
- **Invited founder never generates** → the referral stays attached and ungranted forever; it does not
  consume one of the inviter's 3 places until it matures.
- **Inviter cancels Pro mid-grant** → the queued grant activates at that point and runs its 7 days.
- **Two invited founders generate on the same day** → two grants; the second activates when the first
  expires (the resolver activates one at a time).
- **Inviter's account is deleted** → grants and referrals go with the organization; nothing is orphaned.
- **Link clicked by someone who is already signed in** → no attachment, no error page; they are simply
  sent on to their workspace.
- **The database has not run this migration yet** → every read answers "no invitations" rather than
  failing. `referralSummary` is null and the card and the delivery-screen line are absent; `claimPro`
  grants nothing, so the free ceiling applies exactly as before. Only a missing *table*
  (`PGRST205`/`42P01`) is tolerated — any other fault still throws.

---

## Out of scope

- Rewarding the invited founder (they get the ordinary free tier — deliberately, this is a thank-you,
  not a discount).
- Stripe credits or coupons as an alternative reward shape (considered and rejected in issue #122).
- Any public leaderboard, invite quota purchasing, or team/multi-seat invitations.
- Any invite surface beyond the two named above — no workspace-wide banner, no email nudges to
  founders who have places left.
