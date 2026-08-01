# Spec 153 — Measuring visits without asking for anything

> **In one sentence:** Cookieless, aggregate-only analytics on the public site, and a cookie policy
> rewritten to say so honestly — no consent banner, because nothing is stored on anyone's device.

|                |                                      |
| -------------- | ------------------------------------ |
| **Status**     | ✅ Done                              |
| **Issue**      | #153 — "Cookie-samtycke, en omskriven cookiepolicy, och besökssiffror vi faktiskt får mäta" |
| **Branch**     | `153-cookie-consent` (from `feature/ui`) |
| **Feature**    | ui                                   |
| **Depends on** | [spec 150](150-admin-console.md) (the decision to split this out, and the statistics screen these numbers sit beside) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

_Who wants this, and what they get out of it._

As **the person who runs Airrow** I want **to know how many people reach the site and how many of them
sign up** so that **I can tell whether the next effort belongs in the product or in being found at all.**

As a **visitor** I want **not to be asked to agree to things that are not happening** so that **the one
time we do ask for something, it means something.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today:** the cookie policy states there are no analytics or tracking cookies, and that *"is why you
  are not asked to accept a banner"* ([cookies/page.tsx](../apps/web/src/app/(legal)/cookies/page.tsx)).
  The privacy policy says *"We add no analytics, advertising or session-recording services"*
  ([privacy/page.tsx](../apps/web/src/app/(legal)/privacy/page.tsx)). Only `airrow-theme` and Supabase's
  `sb-*` are set. Both statements are currently true.
- **The problem:** spec 150's statistics can only describe accounts and what they did. They cannot say
  how many people arrived and left — the figure that separates "the product is wrong" from "nobody is
  finding us".
- **Already in place:** the app is hosted on Vercel (spec 9), so the analytics that fits is one npm
  package and one component in the root layout ([app/layout.tsx](../apps/web/src/app/layout.tsx)) — no
  script tag, no key, no third-party host to add to the policy's processor list beyond the one already
  there.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

**Cookieless analytics, and therefore no banner.** Vercel Web Analytics stores nothing on the visitor's
device. Consent banners are mandatory because of ePrivacy Article 5(3), which is triggered by *storing or
reading information on a device* — and something that does neither does not trigger it. So the cookie
policy's existing conclusion ("no banner needed") stays true; only its *reason* changes, from "we measure
nothing" to "we measure without touching your device".

This **reverses the framing of the issue**, which asked for an accept-all / necessary-only banner. Adding
one anyway would be a click on every first visit for a requirement we do not have, and it would teach
visitors that our banners are noise — which is precisely what we would not want on the day we ask for
something real. Recorded on the issue as well as here (§IV), because it is the kind of decision that gets
silently re-litigated later.

**Not touched:** the existing necessary cookies (`airrow-theme`, `sb-*`), which need no consent and keep
their entries in the policy. Spec 150's Postgres-derived statistics are unchanged — this adds a visitor
number *beside* them, it does not move any of them.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] Vercel Web Analytics is mounted once, on the public site, and reports page views.
- [x] **No cookie and no device storage is added.** Nothing new is written to `document.cookie`,
      `localStorage` or `sessionStorage` by this change.
- [x] **No consent banner**, and the cookie policy explains why in terms of what the analytics does
      rather than by claiming we measure nothing.
- [x] The cookie policy is rewritten: it names the analytics, says it is cookieless and aggregate-only,
      says what it does and does not collect, and states the legal basis for not asking.
- [x] The privacy policy's "We add no analytics, advertising or session-recording services" is corrected —
      it becomes false the moment this ships — and Vercel appears as a processor for analytics as well as
      hosting.
- [x] The two policies agree with each other. A reader must not be able to find one saying we measure
      nothing and the other saying we measure visits.
- [x] Nothing about a visitor is joined to an account, a workspace or a project. The analytics answers
      "how many", never "who".
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — the analytics component is present in the rendered public layout.
- **New tests** — the legal pages: the cookie policy names the analytics and does not still claim there
  is none; the privacy policy no longer claims we add no analytics.
- **Manual** — a fresh browser on the deployed site sets no new cookie and no new storage entry
  (devtools → Application), and Vercel's dashboard records the visit.
- Full suite result + typecheck/lint status.

### Implementation notes (2026-08-01)

**14 tests, in two files.**

- `apps/web/src/components/analytics.test.tsx` (5) captures `beforeSend` and asserts what it lets
  through: public pages counted, everything under `/app` dropped, a route invented later under `/app`
  dropped too (the filter is a prefix, so it fails closed), and an unparseable URL dropped rather than
  guessed at. **One of these caught a real bug in the first version**: `startsWith("/app")` also
  swallows `/apply` and `/approach`, so the check is now on the path segment.
- `apps/web/src/app/(legal)/legal-consistency.test.tsx` (9) asserts *claims* rather than markup: neither
  policy still denies the analytics, the cookie policy names it and calls it cookieless, the no-banner
  reason is the new one, and the promises that did **not** change (no advertising, no session recording,
  your project data is your IP) survived the rewrite. This file exists because the sentences this change
  had to fix were true when written and no typecheck would ever have caught them going stale.

**Result:** `pnpm -r typecheck` clean · `pnpm -r lint` clean · `pnpm -r test` **993 passed, 0 failed**
(69 schemas · 223 engine · 701 web) · `pnpm test:scripts` 88 passed.

**Deviation from the plan:** none in shape, one in scope — the last `[NEEDS CLARIFICATION]` (does the
analytics run on `/app`?) was resolved rather than asked, because the spec's own reasoning already
answered it: Postgres says everything worth knowing about what account holders do (spec 150), so the
public-page question is the only one this is here for. It is enforced in `beforeSend` rather than by
mounting per route, which keeps it one decision in one place and excludes new private routes the day
they exist.

**Not proven by any test:** that Vercel actually receives the events, and that no cookie appears in a
real browser. Both need the deployed site — the manual check above.

---

## Exact changes (file:line)

1. **`apps/web/package.json`** — `@vercel/analytics` (^2.0.1). One package, no key, no script tag, and
   it is served from our own host rather than a third-party CDN.
2. **`apps/web/src/components/analytics.tsx`** — `SiteAnalytics`, the one client component. A client
   component only because `beforeSend` is a function and a Server Component cannot hand one across the
   boundary.
3. **`apps/web/src/app/layout.tsx`** — mounted once in the root layout, beside `{children}`.
4. **`apps/web/src/app/(legal)/cookies/page.tsx`** — the opening claim split in two (no advertising or
   tracking cookies, *and* we now count visits without cookies), plus a new **How we count visits**
   section carrying the reasoning for why no banner is asked for.
5. **`apps/web/src/app/(legal)/privacy/page.tsx`** — "We add no analytics…" corrected, and Vercel's
   processor entry extended from hosting to hosting-and-analytics, linking to the cookie policy.

**No change needed:** `FOOTER_LINKS` — there is no consent to revisit, so there is no "Cookie settings"
entry to add. The existing "Cookies" link already reaches the full explanation.

---

## Data model

**No schema changes.** The visitor numbers live in Vercel's dashboard, not in our database — which is
also what keeps them un-joinable to any account.

The admin statistics screen (spec 150) is **not** given a visitor section here: the numbers live in a
third-party dashboard, and pulling them into `/app/admin/stats` means a Vercel API token, a server-side
fetch and a cache. That is its own change, worth doing only once the numbers have proven useful.

---

## Security

Adds one first-party-served script from our own host to public pages, which collects aggregate page views
and no identifiers, and reaches nothing behind the session. No new cookie, no device storage, no key in
the client bundle, and nothing that can be joined to a founder, a workspace or a project.

---

## Edge cases

- **Visitor blocks the script** (ad blocker, `DNT`, no JS) → the page is unaffected; the visit is simply
  not counted. Analytics must never be load-bearing for rendering.
- **Signed-in founder inside `/app`** → not counted. `beforeSend` drops it in the browser before
  anything is sent, so a workspace path never leaves the device.
- **Preview deployments** → they report to the same project. Harmless for counts, but worth knowing
  before reading a spike as real.

---

## Out of scope

- **A consent banner and a consent cookie.** Not needed for a cookieless tool — see _Design decision_.
  The day we adopt anything that reads or writes on the visitor's device, the banner becomes mandatory
  and is its own issue, starting from this decision.
- **Knowing where visitors come from.** Referrer and campaign attribution need a heavier tool, which
  would need a banner, which is the trade this spec deliberately declines. Its own issue if wanted.
- **Surfacing visitor numbers inside `/app/admin/stats`** — see _Data model_.
- **Any profiling, cross-site tracking, or sharing with advertisers.** Never in scope, at any point.
