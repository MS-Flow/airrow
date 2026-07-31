# Spec 144 — A way to reach us, and a way to say what it was worth

> **In one sentence:** A founder in the dashboard gets a support page that reaches a real inbox, and a
> founder who just received a foundation gets a star-and-text review at the bottom of the project page —
> both mailed to us, the review also stored so the landing page can one day show real words from real
> founders.

|                |                                                      |
| -------------- | ---------------------------------------------------- |
| **Status**     | ✅ Done                                               |
| **Issue**      | #144 — "Supportsida i dashboarden och en review efter genereringen — båda mejlas till oss, reviewn sparas för landningssidan" |
| **Branch**     | `144-support-review` (from `feature/ui`)              |
| **Feature**    | ui                                                    |
| **Depends on** | [spec 113](113-branded-auth-email.md) (Resend account, the verified sending domain and the `RESEND_API_KEY` this reuses), [spec 122](122-invite-a-friend.md) (the org-scoped-table-with-denial-tests shape this copies), [spec 23](23-landing-copy-footer.md) (where published reviews will eventually surface) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

_Who wants this, and what they get out of it._

As a **founder whose generation went wrong** I want **to write to Airrow from inside the app, without
hunting for an address** so that **I get help instead of giving up quietly.**

As a **founder who just received a foundation** I want **to say what I thought in a few words and some
stars, right where I am** so that **the feedback costs me ten seconds rather than an email — and my
words can help the next founder decide.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today:** the dashboard's navigation is exactly two items — `Projects` and `Settings`
  ([nav-items.ts:9-12](../apps/web/src/components/shell/nav-items.ts#L9-L12)) — and it feeds both the
  sidebar and the command palette ([app/layout.tsx:30-47](../apps/web/src/app/app/layout.tsx#L30-L47)).
  There is no route that reaches us.
- **Today:** `hello@airrow.app` is printed in the legal pages
  ([legal/meta.ts:11](../apps/web/src/features/legal/meta.ts#L11)) but no mailbox receives it — inbound
  mail for the domain is not routed anywhere.
- **Today:** the project page ends with the sections and the delete dialog
  ([projects/[id]/page.tsx](../apps/web/src/app/app/projects/%5Bid%5D/page.tsx)); the moment a founder
  first sees a finished foundation is also the moment we ask them nothing.
- **The problem:** we have no inbound channel and no first-party evidence. A founder who is stuck leaves
  without telling us why, and the landing page can only make claims in our own voice.
- **Already in place:** spec 113 created the Resend account, verified `airrow.app` and put DKIM/SPF on
  the **`send.airrow.app`** subdomain deliberately, "so it cannot disturb inbound mail for `airrow.app`"
  ([INFRASTRUCTURE_SETUP.md §6](../docs/guides/INFRASTRUCTURE_SETUP.md)) — the apex is free for an
  inbound MX. `RESEND_API_KEY` already exists as a secret and in
  [apps/web/.env.example:34-40](../apps/web/.env.example#L34-L40), but only as SMTP credentials for
  Supabase Auth; **the app itself has never sent an email** — there is no `lib/email.ts`.
- **The conflict, and how it is resolved:** spec 113 put the domain's DNS at Vercel's nameservers, and
  Cloudflare Email Routing only works on a zone that uses **Cloudflare's** nameservers. **Decided
  (amended 2026-07-31, after the first ticket proved it — see _Amendment_ below): DNS stays at Vercel,
  and receiving is two MX records pointed at a forwarder.** Nothing from §4 or §6 is touched, so the
  verified sending domain cannot be collateral damage of the receiving half.

### Amendment — the forwarder, not the zone move (2026-07-31)

The clarify pass chose Cloudflare Email Routing and accepted its price: moving the `airrow.app` zone
off Vercel's nameservers, re-creating every record inside Cloudflare, and carrying spec 113's verified
sending domain through the switch. That decision is **reversed here**, and this is the record of it
(§IV: decisions are written down, not reconstructed).

What changed is that the cost stopped being theoretical. The first real ticket sent from `/app/support`
showed in Resend as `last_event: sent` and arrived nowhere — `support@airrow.app` has no MX record, so
the message was accepted and dropped. The fix needed is *receiving*, and receiving is three DNS records:
ImprovMX (or Forward Email) takes the domain's `MX` and forwards to Gmail, free, on whatever
nameservers the zone already uses. Vercel even ships a one-click preset that writes them.

Cloudflare's requirement is Cloudflare's, not email's. Paying for it with a nameserver migration — with
`airrow.app` in the awkward registrar position §4 describes — buys nothing the MX records do not.
**Rejected alongside it:** Resend Inbound. Resend can receive, but delivers a webhook carrying metadata
only (the body is a second API call), so forwarding two addresses would become a route handler we own.
It becomes the right answer the day replies should land inside the app as ticket threads.

**The app is unaffected either way** — no code in this spec knows how the inbox is reached, which is
why the reversal costs a runbook rewrite and nothing else.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

One email path, two writers. Both surfaces **write their row first and mail second**: `lib/email.ts` is
the single place that calls Resend, built like the authoring provider — it never throws, and returns a
discriminated union (`sent | skipped | failed`), so a missing key or a dead third party degrades the
log and never the founder's confirmation. Inbound is not our code at all: a forwarder on the domain's
`MX` records sends `support@` and `hello@` to Gmail for free, and `Reply-To` carries the founder's
address so a reply from Gmail lands with them.

The review is stored with `consent_public` and a `published_at` column that **nothing in this change ever
writes**. Publishing belongs on the admin page that a later spec builds; until it exists every review
stays unpublished, and the landing page's use of them is a later issue against a schema that is already
ready for both.

**Not touched:** Supabase Auth's SMTP configuration and `scripts/sync-supabase-auth.mjs` (spec 113's
path stays exactly as it is — this adds an HTTP-API sender alongside it, not instead of it), the landing
page itself, and any in-app way to answer a ticket. We answer from Gmail.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] `/app/support` exists, is a Server Component, requires a session, and is added to `NAV_ITEMS` as a
      third item so the sidebar **and** the command palette pick it up without separate wiring.
- [x] The support form takes a category, a subject, a description and an optional project; name and
      email come from the session and are shown, never typed.
- [x] A submitted ticket is written to `support_tickets` (scoped by `organization_id`) **before** the
      email is attempted, and the page lists the workspace's own tickets. _(Corrected during
      `/analyze` from "the signed-in founder's own": the list is org-scoped like every other read, which
      is §II rather than a per-user filter. On a personal workspace the two are the same set.)_
- [x] A review card appears at the bottom of `/app/projects/[id]` **only** when the project is `ready`,
      with 1–5 stars (required) and free text (optional).
- [x] The review is stored in `project_reviews` with rating, body, `consent_public` and a display name;
      submitting again updates the same row — unique on `project_id`, no duplicates.
- [x] Both a ticket and a review are emailed via Resend from `noreply@airrow.app` to the support inbox,
      with `Reply-To` set to the founder's address.
- [x] **An email failure never breaks the flow:** with no `RESEND_API_KEY`, on a network error, or on a
      4xx/5xx, the row is saved, the founder gets their confirmation, and the failure is logged as an id
      plus a status — never message content (§II).
- [x] All sending is server-side only, through one module. No key and no message body reaches the
      client bundle. _(Corrected during `/analyze`: the first draft said "no inbox address" either,
      which contradicts this spec's own edge case — the `mailto:` fallback prints `support@airrow.app`
      on the page deliberately. It is a published address, not a secret; the key is the secret.)_
- [x] Zod validates both forms at the server boundary — rating 1–5, length limits on every text field —
      and the client-side validation is convenience only.
- [x] A server-side rate limit caps tickets at **5 per organization per day**; over it the founder gets a
      plain message, no row and no email. Reviews need no separate cap — one per project is the limit.
- [x] No review is ever published by this change: `published_at` stays null, is never written by app
      code, and no review reaches any public surface. Publishing ships with the admin page in a later
      spec.
- [x] One idempotent migration adds both tables with RLS **and denial tests**: a member of organization A
      can neither read nor write another organization's tickets or reviews. _(Replayed from zero with
      `supabase db reset`; all 9 tests green against the local database.)_
- [x] `docs/guides/INFRASTRUCTURE_SETUP.md` gains an inbound-mail section: the forwarder's `MX` + SPF
      records on Vercel's DNS and the aliases for `support@` and `hello@`, with the rejected
      alternatives (Cloudflare's zone move, Resend Inbound) and why.
- [x] Resend still reports the sending domain **Verified**, and a signup verification email — spec
      113's path, which this must not break — still arrives. _(Now trivially true: §8 touches no record
      §4 or §6 created. Confirmed against Resend's API on 2026-07-31 —
      `status: verified, sending: enabled`.)_
- [x] `hello@airrow.app` — the address already printed in the legal pages — actually delivers once the
      runbook is followed. _(Runbook §8.1–8.2: two MX records, an SPF TXT and an alias — dashboard
      work, and done: `support@airrow.app` delivers to Gmail as of 2026-07-31.)_
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — `apps/web/src/features/support/actions.test.ts`: validation rejects a rating outside
  1–5 and an over-long body; a failing mailer still returns success and leaves the row written.
- **New tests** — `apps/web/src/lib/email.test.ts`: returns `skipped` with no key, `failed` on a non-2xx,
  and never throws.
- **New tests** — RLS access **and** denial for `support_tickets` and `project_reviews`, alongside the
  existing data-layer integration tests.
- **New test** — the review card is absent for a project that is not `ready`.
- **Manual** — §8 end to end: mail to `support@airrow.app` arrives in Gmail, and a ticket sent from
  `/app/support` reads **`delivered`** in Resend's log — not `sent` — with the founder's address in
  `Reply-To`. `sent` with an empty inbox is precisely the failure that produced the amendment above,
  so it is the assertion worth making.
- **Manual** — Resend's domain page still reads _Verified_ and a fresh signup's verification email
  still arrives (spec 113 unbroken). Near-tautological now that §8 adds records rather than moving
  any, which is the point of the amendment.
- Full suite result + typecheck/lint status.

### Implementation notes (2026-07-31, closed out the same day)

**Written:** `apps/web/src/lib/email.test.ts` (8) — skipped without a key and no network call made,
`failed` on a non-2xx and on a thrown fetch, the id on success, a success body of the wrong shape
survived, CR/LF stripped from subject and `Reply-To` while the body keeps its newlines, and the inbox
overridable. `apps/web/src/features/support/actions.test.ts` (14) — the row is written and the mail
replies to the founder; a failed mail changes nothing the founder sees; a short body, an unknown
category, a rating of 7 and an over-long review are all refused **before** anything is written; the
daily limit writes no row and sends no mail; a project id is attached only after `getProject` accepts
it; a project that is not `ready` and another workspace's project are both refused.
`apps/web/src/app/app/projects/[id]/page.test.tsx` (6) — the card is there when `ready`, absent (and
not even queried for) while interviewing, generating or failed, prefilled from an existing review, and
carries both outcomes. `apps/web/src/lib/data/support.db.test.ts` (9) — RLS access and denial on both
tables, the two write denials that matter (a ticket inserted around the rate limit, a founder
publishing their own review), the rating check, the one-per-project constraint, and the cascade rules.

**Result** (re-run under `/analyze` with Docker and local Supabase up): `pnpm -r typecheck` clean ·
`pnpm -r lint` clean · `pnpm -r test` **928 passed, 0 skipped, 0 failed** (69 schemas · 223 engine ·
636 web) · `pnpm test:scripts` 88 passed.

**The migration was replayed from zero** with `supabase dlx db reset` — every migration in
`supabase/migrations` applied in order, this one last, with no error. The nine RLS, denial, constraint
and cascade tests then ran green against that database, so the access-control claims are proven rather
than asserted. The first `/implement` pass could only report them as written: Docker was not running,
and the `.db.test.ts` suites skip themselves when the database is unreachable.

**Two deviations from the sketch.** `ReviewCard.tsx` sits in `features/support/` rather than
`features/projects/`, with the action and the data module it belongs to. `isMissingTable` /
`rowsOrAbsent` moved from `referrals.ts` into `lib/data/supabase.ts` — two callers now need the same
missing-table tolerance, and a second copy of it is the kind of duplication that drifts.

**One incidental change:** `vitest.setup.ts` gains a `ResizeObserver` stub — jsdom has none, and
Radix's `Checkbox` measures itself on mount, so the first component test to use the design system's
checkbox would otherwise have failed on a missing browser API rather than on anything about the
component.

**What no diff can prove, and where it lives instead:** the forwarder's three DNS records and the two
aliases — `INFRASTRUCTURE_SETUP.md` §8, seven steps, none of which touches an existing record. Same
shape spec 113 closed with: the code half is testable, the DNS half is a runbook someone follows once.
**Followed on 2026-07-31, and it works**: mail to `support@airrow.app` now reaches Gmail.

**Proven in production on the way out.** The hosted database got the migration
(`supabase db push`, one migration applied, `20260731150000` now local *and* remote), and a real ticket
written from `/app/support` reached Resend at 19:33 UTC — `to: support@airrow.app`,
`reply_to:` the founder, `last_event: sent`. Every layer this spec built is therefore confirmed
end to end against real infrastructure. `sent` rather than `delivered` is the receiving half that §8
now covers, and finding it that way is what produced the amendment above.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

1. **`packages/schemas/src/index.ts`** — `SUPPORT_CATEGORIES`, `supportTicketSchema`,
   `projectReviewSchema` beside `profileUpdateSchema`
   ([:130](../packages/schemas/src/index.ts#L130)). The boundary contract lives once, with the other
   form schemas, and both the page and the action read it from there.
2. **`supabase/migrations/20260731150000_support_and_reviews.sql`** — `support_tickets` and
   `project_reviews`, RLS on both, `select` for members, everything else `service_role` only.
3. **`apps/web/src/lib/data/supabase.ts`** — `isMissingTable` and `rowsOrAbsent` move here from
   `referrals.ts`, which had the only copy. The support page and the project page need the same
   tolerance, and a second copy of it is the kind of duplication that drifts.
4. **`apps/web/src/lib/data/support.ts`** — the data layer for both tables, beside `store.ts` exactly
   as `referrals.ts` is: `listTickets`, `countRecentTickets`, `createTicket`, `getReview`,
   `saveReview`. `saveReview` upserts on `project_id` rather than reading first, so a double-submitted
   form cannot become two reviews. Nothing here writes `published_at`.
5. **`apps/web/src/lib/email.ts`** — the app's only outbound mail, over Resend's HTTP API. Returns
   `sent | skipped | failed`, never throws, strips CR/LF out of the subject and `Reply-To`.
6. **`apps/web/src/features/support/actions.ts`** — `submitTicketAction` and `submitReviewAction`.
   Both validate, write, then mail; a project id from the form is accepted only after `getProject`
   proves it belongs to this workspace.
7. **`apps/web/src/features/support/queries.ts`** — `supportOverview`: the history and what is left of
   the day's allowance, read together so the page cannot contradict itself.
8. **`apps/web/src/app/app/support/page.tsx`** — an RSC with a plain form. No client component of its
   own: the design system's `Select` is already one, and Radix posts the field it owns.
9. **`apps/web/src/features/support/ReviewCard.tsx`** — the one client component, for the stars.
   Placed with the feature rather than under `features/projects/` (the sketch above) because the
   action, the data module and the card are the same slice of the product.
10. **`apps/web/src/components/shell/nav-items.ts`** + **`sidebar.tsx`** — a third nav item and its
    icon. The command palette needs no change: it builds itself from `NAV_ITEMS`
    ([app/layout.tsx:31](../apps/web/src/app/app/layout.tsx#L31)).
11. **`apps/web/src/app/app/projects/[id]/page.tsx`** — the card at the end of the `ready` block,
    above the delete zone, with `getReview` read only when the project is `ready`.
12. **Docs** — `INFRASTRUCTURE_SETUP.md` §8 (the zone move and Email Routing) with pointers added in
    §4 and §6, the two tables in `DATABASE_DESIGN.md`, the route in `UI_ARCHITECTURE.md`, and the
    three env vars in `apps/web/.env.example`.

**No change needed:** the command palette, the sidebar's active-link logic, and spec 113's SMTP path —
`scripts/sync-supabase-auth.mjs` and `supabase/config.toml` are untouched, and the app's HTTP sender
shares only the key.

---

## Data model

Two new org-scoped tables in one idempotent migration:

- **`support_tickets`** — `id`, `organization_id`, `user_id`, `project_id` (nullable), `category`,
  `subject`, `body`, `status`, `created_at`.
- **`project_reviews`** — `id`, `organization_id`, `project_id` (**unique**), `user_id`,
  `rating smallint check (rating between 1 and 5)`, `body`, `consent_public boolean not null default
  false`, `display_name`, `published_at`, `created_at`, `updated_at`.

**One review per project, editable** — the unique constraint on `project_id` is the whole rule. A founder
who regenerates revises the verdict they already gave rather than adding a second one, which keeps the
same person from appearing twice on the landing page.

`published_at` is written by **nothing in this change** — no app code, no server action, no migration
default. The admin page in a later spec is where publishing gets built, and it is the only thing that
will ever set it. RLS is scoped through org membership on both tables, with denial tests shipping in the
same change. Public reading of published reviews is **not** built here; when it is, it becomes a view
exposing `rating`, `body`, `display_name` and `published_at` only.

---

## Security

Founder-written text is untrusted: stored as text, mailed as `text/plain` so no template can carry
injected markup, rendered sanitized in the app, and never executed. Subject and `Reply-To` are built
from validated fields so a newline in an input cannot inject a header. The API key and the inbox address
stay server-side; logs carry ticket ids and delivery status only. Rate limiting and length caps bound
what an abuser can send, and no review can become public without both the founder's consent flag and our
own publication. The mail we send ourselves stays `text/plain` — it only ever reaches our own inbox, so
spec 113's branded HTML template would buy nothing and would give injected markup a place to render.

---

## Edge cases

- **Resend is down or unconfigured** → row saved, confirmation shown, failure logged; a visible
  `mailto:support@airrow.app` fallback stays on the page.
- **Project deleted after a review** → the review row cascades away with the project.
- **A founder submits a review twice** → the same row is updated and the email says "updated review".
- **A ticket about a project the founder no longer owns** → `project_id` is nullable; the ticket survives.
- **Rate limit reached** → plain message, no email, no row.
- **Project not `ready`** (interviewing, generating, failed) → no review card at all.

---

## Out of scope

- Answering tickets inside the app, attachments, and any ticket status the founder can change — we
  answer from Gmail.
- **Displaying** reviews on the landing page. This spec makes them collectable and consentful; a later
  issue makes them visible.
- **Publishing** a review. `published_at` exists so the admin page does not need a migration; the admin
  page — and the act of publishing — is a later spec.
- Setting up `support@airrow.se` / `hello@airrow.se`. Decided (clarify, 2026-07-31): `airrow.app` only.
  The code points there ([site-url.ts:16](../apps/web/src/lib/site-url.ts#L16),
  [legal/meta.ts:11](../apps/web/src/features/legal/meta.ts#L11)), and a `.se` zone would be a second
  entrance to the same inbox, not a second truth in the code — its own issue if it is ever wanted.
