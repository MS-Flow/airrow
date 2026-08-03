# Spec 182 — Knowing where people fall out

> **In one sentence:** Instrument the whole path from a first visit to a paid subscription, so that
> after launch we can name *which step* is losing people instead of guessing — and, on the way past it,
> make the founding offer read as a discount by showing the price it discounts from.

|                |                                      |
| -------------- | ------------------------------------ |
| **Status**     | 🔄 In progress                       |
| **Issue**      | #182 — "2/8 · Instrument the funnel: PostHog + conversion events" |
| **Branch**     | `182-posthog-funnel` (from `feature/infrastructure`) |
| **Feature**    | infrastructure                       |
| **Depends on** | [spec 153](153-cookie-consent.md) (the analytics that exists today, and the cookieless promise this change keeps) · [spec 150](150-admin-console.md) (the Postgres-derived statistics this sits beside) · [spec 99](99-stripe-checkout.md) / [spec 100](100-pro-upgrade-revisions.md) (checkout and the webhook, where `paid` is truthfully known) · **amends** [spec 179](179-pro-price-founding-offer.md) (the list price may now appear, struck through) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

_Who wants this, and what they get out of it._

As **the person who runs Airrow** I want **every step from landing on the site to paying to be counted,
with the ratio between each pair of steps visible on one screen** so that **when launch traffic arrives I
can tell a hero-copy problem from a pricing problem from an interview that is too long, on the day it
happens rather than a month later.**

As a **visitor** I want **the site to keep the promises its cookie and privacy policies make** so that
**what I was told when I arrived is still true while I am there.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today:** the only measurement of strangers is Vercel Web Analytics, mounted once in
  [app/layout.tsx](../apps/web/src/app/layout.tsx#L28) and filtered to public pages in
  [components/analytics.tsx](../apps/web/src/components/analytics.tsx) (spec 153). It counts *page views*
  and nothing else. Everything past the account boundary is known only from Postgres — projects, jobs,
  plans — surfaced in `/app/admin/stats` (spec 150).
- **The problem:** page views and account rows are the two ends of a rope with nothing in between. We
  cannot say how many people who saw the landing page started the interview, how many of those abandoned
  and *at which question*, how many who generated a foundation ever took it away, or which channel any of
  them came from. Every projection and tripwire in the GTM plan is a ratio between two of those numbers.
- **Already in place:** the events all have an obvious server-side home — `startCheckoutAction`
  ([billing/actions.ts:118](../apps/web/src/features/billing/actions.ts#L118)), the Stripe webhook and
  `applySubscriptionState` ([billing/sync.ts](../apps/web/src/features/billing/sync.ts)),
  `runGenerationJob` ([generation/runner.ts:109](../apps/web/src/features/generation/runner.ts#L109)),
  the ZIP route ([api/projects/[id]/zip/route.ts](../apps/web/src/app/api/projects/[id]/zip/route.ts)),
  and the interview runtime ([interview/InterviewRuntime.tsx](../apps/web/src/features/interview/InterviewRuntime.tsx)).
  Nothing needs to be restructured to have somewhere to put a call.
- **The obstacle nobody should discover during implementation:** spec 153 is not neutral about this. It
  **explicitly declined** a heavier analytics tool, put "knowing where visitors come from" in _Out of
  scope_ with the reasoning that campaign attribution "needs a heavier tool, which would need a banner,
  which is the trade this spec deliberately declines" — and shipped legal copy that now says, in the
  visitor's own words, that we use Vercel Web Analytics, that it is cookieless, and *"this is why you are
  not asked to consent to it."* That copy is enforced by
  [legal-consistency.test.tsx](../apps/web/src/app/(public)/(legal)/legal-consistency.test.tsx). Issue 182
  asks for something adjacent to what spec 153 traded away. **Resolved in favour of spec 153**: the
  instrumentation is built to fit inside that promise rather than to overturn it — see _Design decision_.
  This is worth knowing before implementation, because the obvious PostHog quickstart breaks it in one
  line of config.
- **Second, unrelated thing in this spec:** the pricing card names the founding price but never the price
  it is a discount from ([page.tsx:263-278](../apps/web/src/app/(public)/page.tsx#L263-L278)), so a
  reader sees a price, not an offer. Requested to be fixed here rather than in its own issue.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

**Server-side first, identified only after the account exists, and honest about the trade.**

Three parts, in order of how much they cost the visitor:

1. **Conversion events are sent from the server**, from the code that already knows the fact is true —
   the generation runner, the ZIP route, the Stripe webhook. A server-sent event needs no script, no
   cookie and no device storage, cannot be blocked by a content blocker, and cannot lie: `paid` fires
   where `applySubscriptionState` fires, which is the only place the constitution lets a plan be written
   from something Stripe said. Server events carry an `organization_id`-derived distinct id — never an
   email, never a name.
2. **Anonymous funnel steps on the public side** (`pageview`, `interview_started`, per-question step)
   need a browser-side identity to be *joinable into a funnel*, which is the whole point. This is where
   the trade lives — see the clarification below.
3. **UTM parameters are captured on first touch and attached to every client-side event in that page
   session**, so the top of the funnel is attributable per channel. They do **not** reach the server
   events, and cannot under the stance below — see _Implementation notes_, deviation 1.

**The consent stance: cookieless, and therefore still no banner.** PostHog runs with
`persistence: "memory"` — no cookie, no `localStorage`, nothing written to or read from the device. This
keeps spec 153's decision intact rather than reversing it: every word of the cookie policy stays true,
the ePrivacy Art. 5(3) reasoning still holds, and no banner is added.

The price is real and is stated here so nobody reads the dashboard as more than it is: **pre-signup
identity lasts one page session.** A visitor who leaves and comes back is two visitors, so visit→start
and start→signup are *underestimates* — a floor, not a measurement. Every ratio below the account
boundary is exact, because those events are server-sent from rows that already exist. This is the right
trade for launch: the four events the issue is actually judged on (`signup`, `foundation_generated`,
`zip_downloaded`, `paid`) are unaffected by it, and the cookie-based version can be added later — with
the banner it would then require, as its own issue — without redoing any of this work.

**Also in this spec, by explicit request: the founding offer shows what it saves.** The pricing card
today names only the discounted figure, so the offer reads as a price rather than as a discount. It
becomes a struck-through list price beside the founding one — ~~$119.99~~ **$89.99** per year — on the
public pricing card *and* on `/app/upgrade`. This **amends spec 179**, whose `FoundingOffer.amount`
comment reasons that the list price must never appear beside a founding badge. That reasoning was about
*mislabelling*: naming `STRIPE_PRICE_YEARLY`'s figure as what the button charges, which would advertise
the deal at the non-deal rate. A struck-through list price beside the live one does the opposite — it
says plainly which figure is charged and which one is not — so the rule it amends is narrowed, not
dropped: **the amount presented as payable is still always the founding amount.** Both figures still come
from Stripe; neither is ever hardcoded.

This is scope that does not belong to an analytics issue, and it is here because you asked for it here
rather than because the two are related. If it turns out to want its own PR, it lifts out cleanly — it
touches `prices.ts`, the pricing card and the upgrade screen, and shares no file with the instrumentation.

**Not touched:** the consent banner question — spec 153's answer survives unchanged, and this spec is
careful to stay inside it. Vercel Web Analytics stays exactly as it is, filter included. It is free, it already
answers "how many reached the site", and removing it would put the legal pages' rewrite on this spec's
critical path for no gain. Postgres remains the source of truth for anything billable or entitling —
PostHog is *observation*, never a system of record, and `checkAllowance` never reads it. Spec 150's
`/app/admin/stats` is not given a PostHog section here.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] PostHog is configured from server-side env only for the server key; nothing secret reaches the
      client bundle. The app runs normally with the keys **absent** — no crash, no error, events dropped.
- [x] Every event in the issue fires, with a stable name from one shared union: `pageview`,
      `interview_started`, `interview_step` (carrying the question id), `signup`, `foundation_generated`,
      `zip_downloaded`, `github_pushed`, `checkout_started`, `paid`. — *`github_pushed` is defined and
      unwired, per _Exact changes_ 5; the other eight fire, each with a test that it does and a test
      that it does not fire on the paths that produce nothing.*
- [x] `paid` distinguishes **monthly** from **founding** (spec 179's capped offer), and fires only from
      the same path that may write `organizations.plan` — never from a Checkout redirect. — *and a third
      value, `yearly`, because an undiscounted annual subscription is neither of the two named.*
- [x] `foundation_generated`, `zip_downloaded`, `checkout_started` and `paid` are sent **server-side**,
      so a content blocker cannot make the funnel's bottom half disappear.
- [x] No PII beyond what the privacy policy already covers: **no email, no name, no answer content, no
      generated document body** is ever an event property. Identity is an opaque id.
- [ ] ~~UTM parameters present on the first public request survive to the events that matter, so a
      `paid` event can be attributed to a channel.~~ **Partly met, and the rest is not buildable under
      the consent stance this spec chose.** See _Implementation notes_.
- [ ] One dashboard shows the **five ratios** (visit→start, start→signup, signup→generate,
      generate→download, download→paid) — percentages, not five totals side by side. — *PostHog-side
      configuration, done once the keys are live; the recipe is in `INFRASTRUCTURE_SETUP.md` §9.*
- [x] The cookie and privacy policies still describe reality after the change, and
      `legal-consistency.test.tsx` is updated in the **same** change rather than after it.
- [x] Nothing in the product's behaviour depends on an event being delivered: a failed or slow PostHog
      call never fails a generation, a download, a checkout or a webhook.
- [x] **No cookie and no device storage is added** by the analytics — `persistence: "memory"`, asserted
      by a test, so spec 153's promise cannot be broken by a later config tweak going unnoticed.
- [x] **No consent banner is added**, and neither legal page needs its no-banner reasoning changed.
- [x] The **founding offer shows both figures**: the yearly list price struck through beside the
      founding price, on the public pricing card **and** on `/app/upgrade`.
- [x] Both figures come from Stripe. When the list price cannot be read, the founding price renders
      **alone** rather than beside a placeholder — the same no-number-beats-a-wrong-number rule
      `prices.ts` already follows everywhere.
- [x] The struck-through figure is never the one presented as payable, and the upgrade button still says
      exactly what pressing it charges.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — the event-name union and property shape. The union is enforced at *compile* time, so
  there is no runtime test that "every emitter uses a name from it"; what is tested is `sanitize`, which
  is the runtime half.
- **New tests** — a captured-events mock asserting *what is not sent*: no email, no name, no answer text
  in any property of any event. This is the test that has to fail loudly if someone adds a "helpful"
  property later.
- **New tests** — **every emitter, proven to emit**: `checkout_started` (including on a failed
  Checkout), `foundation_generated` (and *not* on a failed or refused run), `zip_downloaded` (and not
  on 401/404/409), `signup` (and not for a returning founder), `interview_started` / `interview_step`
  (and never carrying what was typed).
- **New tests** — the client is a no-op when the key is absent (the local-dev and preview default).
- **New tests** — `paid` fires from `applySubscriptionState` and not from the checkout return path;
  monthly vs founding is distinguished.
- **New tests** — the client is configured with `persistence: "memory"`, and the legal pages still say
  what they said: `legal-consistency.test.tsx` extended so the no-banner reasoning is asserted to have
  *survived*, not been rewritten.
- **New tests** — `prices.ts`: the yearly list price is carried alongside the founding amount; when the
  list price is unreadable the founding amount still renders alone; the payable figure is the founding
  one on both surfaces.
- **Manual** — end-to-end **in production**, per the issue's own acceptance bar: one real journey
  through the funnel, each event visible in PostHog, the five ratios rendering on the dashboard.
  Previews and local development carry **no key** and therefore send nothing — the launch dashboard has
  exactly one source, at the cost that nothing can be verified before it is live. The first production
  journey is therefore also the verification, and is done by us rather than waited for.
- Full suite result + typecheck/lint status.

### Implementation notes (2026-08-03)

**102 new tests, in eight files**, plus fixture and assertion updates in six existing ones. Twenty-one
of them — every emitter — were added *after* `/analyze`, which found the emitters typechecked and were
never exercised. That review's other findings are recorded as deviations 2 and 3 below.

- `features/analytics/events.test.ts` (13) — the wall. Most of them assert what is *not* sent: an
  email, a name, an interview answer, a nested object smuggling a record through an allowed key. This
  is the file that has to fail the day somebody adds a "helpful" property.
- `features/analytics/server.test.ts` (7) and `client.test.ts` (8) — silent without a key; the client
  configured with `persistence: "memory"`, session recording off, autocapture off. The persistence
  assertion carries a comment telling a future reader **not to update the test** if it fails: the
  cookie policy's no-banner reasoning is downstream of that one line.
- `features/billing/paid.test.ts` (12) — the transition rule, tier by tier. A hand-applied monthly
  coupon reads as monthly, not as a founding place.
- `api/stripe/webhook/route.test.ts` (+6) — a conversion once, a redelivery never, a renewal never, a
  cancellation never; the row read *before* the write; and a 200 even when the analytics helper is
  handed a subscription with no items.
- **The emitters** — `features/analytics/signup.test.ts` (6, new), `api/projects/[id]/zip/route.test.ts`
  (4, new), plus `billing/actions.test.ts` (+3), `generation/runner.test.ts` (+4) and
  `InterviewRuntime.test.tsx` (+3). Each proves the event fires *and* that it does not fire on the
  paths that produce nothing: a failed generation, refused answers, a 401/404/409 download, a
  returning founder signing in. `checkout_started` is the deliberate opposite — it fires even when
  Stripe refuses, because `checkout_started → paid` is the ratio it exists for and counting only the
  successes would report a 100% conversion rate.
- `features/billing/sync.test.ts` (+2), `(public)/page.test.tsx` (+3), `app/upgrade/page.test.tsx`
  (+1), `legal-consistency.test.tsx` (+3) — the second `paid` path, the strikethrough on both
  surfaces, and the two policies still agreeing with each other.

**Result:** `pnpm -r typecheck` clean · `pnpm -r lint` clean · `pnpm -r test` **1450 passed, 0 failed**
(113 schemas · 305 engine · 1032 web; 103 skipped, unchanged) · `pnpm test:scripts` **115 passed, 1
failed** · `pnpm build` succeeds, and `.next/app-build-manifest.json` no longer lists the PostHog chunk
against `/layout` (deviation 3).

**Known pre-existing failure:** `scripts/capture-ui-kit-previews.test.mjs` → "adds the field once, and
updates rather than duplicating on a re-run". Verified to fail on a clean stash of this branch, so it
is not this change's; it belongs to spec 165's capture script.

#### Three things went differently from the plan

**1. UTM cannot reach `paid`, and no amount of care makes it.** The criterion asked for campaign
attribution that survives to the payment. Under `persistence: "memory"` a browser identity dies with
the page load, so a campaign landed on cannot be carried to a checkout that happens on a later page
load, days later, from a Stripe webhook. What is built is real and is the part that answers the
channel question: UTM is read from the landing URL, held in module memory, and attached to every
client-side event in that session — so `visit → start` is attributable per channel. `paid` is not.

Closing it needs storage, and there are exactly two places to put it, neither of which belongs in this
change: **a cookie** (which is a banner, and reverses spec 153 — its own issue, with the trade already
written down here), or **a column** on the organization (a schema change, which this spec's _Data
model_ rules out). Recorded rather than worked around: an attribution number that looks complete and
is silently missing its paid half would be worse than one that is honestly absent.

**2. The `/app` path predicate moved, and `components/analytics.tsx` changed after all.** _Exact
changes_ said that file needed none. It now imports `isPrivatePath` from
`features/analytics/events.ts` instead of holding its own copy. Two analytics tools asking the same
question in two files is the duplication §IV calls a bug, and spec 153's own comment records that the
naive version of this check (`startsWith("/app")`, which eats `/apply`) was a real shipped defect —
exactly the kind that comes back when the rule is written twice. Behaviour is unchanged and the
existing tests for it still pass untouched.

**3. `posthog-js` is loaded dynamically.** The first version imported it statically in a component
mounted from the *root* layout, and the note here called the cost hypothetical. `/analyze` measured it
instead: `.next/app-build-manifest.json` listed a **227.8 kB** chunk against `/layout`, meaning every
page — the landing page most of all — put all of it on the critical path, for every visitor, including
deployments with no key that send nothing. The import now happens *after* the key check, so an
unconfigured deployment fetches none of it. Events raised before the download settles are held in a
bounded queue and flushed on arrival, so an interview that mounts and fires immediately is not lost on
a slow connection.

#### Also on this branch, and not part of this spec

The interview's `coreEntities` question was reworded from *"What does it keep track of, and what does
it connect to?"* to *"What are the core pages, and what does it connect to?"*, with its help text and
placeholder brought into line ([questions.ts:460](../packages/schemas/src/questions.ts#L460)). Asked
for directly and carried here rather than given its own issue.

It is a **change of meaning, not of wording**: the field id, its cap and its place in the ordering are
untouched, but what founders write into it moves from entities-and-relationships to screens. That
answer is passed verbatim to the authoring provider
([author.ts:397](../apps/web/src/features/generation/author.ts#L397)) and is one of the inputs the
data-model sections of the generated documents are written from — so those sections will now be
written from a list of pages. Worth a look at a real generated foundation before this reaches
customers; it is not something a test can judge.

#### The one invariant this brushes against

§I says external calls are server-side only, "never from client components", and `client.tsx` beacons
to PostHog from the browser. It is **not** a new exception: spec 153 already ships `@vercel/analytics`
the same way from the same layout, without an amendment, because §I's list is about the calls that
carry our data and our credentials — Claude, Supabase, the GitHub App. This one is write-only, carries
no key that reads anything, and reaches no workspace. `CLAUDE.md` says exactly that, and cites spec 153
rather than declaring a new licence.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

Sketch only — `/implement` grounds each line and adds the exact positions.

1. **`apps/web/src/features/analytics/events.ts`** (new) — the event-name union and each event's property
   type. One file, so "what may be sent" is a thing a reviewer can read in full.
2. **`apps/web/src/features/analytics/server.ts`** (new) — the single server-side capture function.
   Fire-and-forget, never throws into its caller, no-ops without a key. The only place `posthog-node` is
   imported.
3. **`apps/web/src/features/analytics/client.tsx`** (new) — the browser side, initialised with
   `persistence: "memory"` and nothing that touches the device. `posthog-js` is imported dynamically,
   after the key check; events raised before it lands wait in a bounded queue (deviation 3).
4. **Emitters**, one call each, no logic moved: `features/generation/runner.ts` (`foundation_generated`)
   · `app/api/projects/[id]/zip/route.ts` (`zip_downloaded`) · `features/billing/actions.ts`
   (`checkout_started`) · `features/billing/sync.ts` → `applySubscriptionState` (`paid`) ·
   `features/auth/*` (`signup`) · `features/interview/InterviewRuntime.tsx` (`interview_started`,
   `interview_step`).
5. **`github_pushed` is defined and left unwired.** Repo push does not exist yet: `recordDelivery`
   accepts `"zip" | "github"` ([store.ts:938](../apps/web/src/lib/data/store.ts#L938)) but `"zip"` is
   the only value any caller passes ([zip/route.ts:46](../apps/web/src/app/api/projects/[id]/zip/route.ts#L46)).
   The name goes in the union so the funnel has a place for it; wiring it belongs to the spec that
   ships the push. A dashboard tile for an event that can never fire would be a false zero.
6. **`apps/web/.env.example`** + **`docs/guides/INFRASTRUCTURE_SETUP.md`** — the new keys and how to get
   them, in the same change as the code that reads them. Both are **production-only**; the guide says so,
   because a preview that quietly reports is the failure mode this choice accepts a cost to avoid.
7. **`features/billing/prices.ts`** — `FoundingOffer` gains the yearly **list** amount beside its
   discounted one (nullable, on the module's existing rule: unreadable means absent, never guessed).
   The comment at [:26](../apps/web/src/features/billing/prices.ts#L26) is rewritten to record the
   amendment rather than deleted — it is the reasoning, and the reasoning changed shape.
8. **`app/(public)/page.tsx`** ([:263-278](../apps/web/src/app/(public)/page.tsx#L263-L278)) — the
   founding line renders the list price struck through beside the founding price, via `savingFrom`.
   **`features/landing/copy.ts` is not touched**: the sentence is unchanged, only the figures beside
   it, and the existing `perYear` constant already says everything the copy has to.
9. **`upgradeAmounts`** ([prices.ts:186](../apps/web/src/features/billing/prices.ts#L186)) and
   **`app/app/upgrade/page.tsx`** — the same pair of figures at the point of purchase. `upgradeAmounts`
   currently returns one amount per interval; it returns the list price alongside it, and the *payable*
   figure stays exactly what it is today.

10. **`features/analytics/signup.ts`** (new) + `auth/callback/route.ts` and `auth/confirm/route.ts` —
    there is no single line where a signup happens (the workspace comes from the `handle_new_user`
    trigger), so the event is emitted from the two routes where an account first becomes usable,
    guarded on the same freshness test `attachPendingReferral` already applies.
11. **`features/interview/InterviewRuntime.tsx`** gains a `mode: "guest" | "account"` prop, set by
    `GuestInterview.tsx` and `AuthedInterview.tsx`. Passed rather than inferred from `uploads` being
    undefined, which happens to be true today and would silently re-label the funnel the day it isn't.

**No change needed:** the legal pages' no-banner reasoning — the cookieless stance is what keeps it
true, and only the processor lists gained an entry. `checkAllowance` and the plan-resolution path read
nothing from any of this.

**Changed after all:** `components/analytics.tsx` — see _Implementation notes_, deviation 2.

---

## Data model

**No schema changes.** Events live in PostHog, not in our database — which is also what keeps them
un-joinable to anything under RLS. The distinct id is derived from ids we already have; no new column,
no new table, and nothing about a visitor is written to Postgres by this change.

---

## Security

Adds one third-party processor that receives product events and an opaque id — no email, no name, no
answer content, no document bodies, and nothing reachable from it can read a workspace. The server key is
server-side only and never enters a client bundle; the client key is public by design and writes only.
A new processor means the privacy policy's processor list and the DPA/sub-processor position both change,
which ships in this spec, not after it. No cookie and no device storage is added, so no consent surface
is created and spec 153's no-banner reasoning still holds. The pricing change exposes one figure that is
already public on the Stripe-backed card and adds no new reader of anything.

---

## Edge cases

- **Keys absent** (local dev, a fork, a preview without secrets) → every capture is a no-op; nothing logs
  an error on every request.
- **PostHog is down or slow** → the generation, the download, the checkout and the webhook all complete
  normally. A webhook must never 500 because an analytics host timed out — Stripe would retry it.
- **Content blocker / no JS** → the client-side steps are lost, the server-side ones are not. The bottom
  of the funnel stays measurable, which is why it is server-side.
- **Guest interview, then signup** → the pre-account steps and the account's later events do **not**
  join: the guest's identity is a page session, the account's is a workspace id. So visit→signup is a
  floor, which the dashboard has to say on its own face. This is the concrete, accepted cost of the
  cookieless stance.
- **The same person opens the site twice** → two visitors, because identity lasts one page session.
  The two top-of-funnel ratios are floors; the dashboard says so on its own face rather than leaving a
  reader to assume precision that is not there.
- **Stripe webhook replays / duplicate events** → `paid` must not be counted twice for one subscription.
- **Preview and local deployments** → no key, so nothing is sent. Verification happens in production.
- **The yearly list price is unreadable but the coupon is not** → the founding price renders alone, with
  no strikethrough and no empty struck-through element. A dangling `~~ ~~` is worse than no saving shown.
- **The founding offer sells out** → no strikethrough anywhere; the list price becomes the only price
  and is presented plainly, not as a discount from itself.

---

## Out of scope

- **A consent banner and its cookie.** Not needed, because nothing here touches the device — spec 153's
  reasoning holds unchanged. The day cross-visit attribution is worth a banner, that is its own issue,
  starting from this spec's stated cost rather than from scratch.
- **`github_pushed` being wired.** Defined only; repo push does not exist yet (see _Exact changes_ 5).
- **Replacing Vercel Web Analytics.** Two tools briefly overlapping on page views is cheaper than a
  migration on the launch critical path.
- **Session recording, heatmaps, feature flags, A/B tests.** PostHog offers them; none is enabled here,
  and session recording in particular would reach interview answers, which are customer IP.
- **Surfacing any of this inside `/app/admin/stats`.** The dashboard is PostHog's own, per spec 153's
  same reasoning about a token and a cache.
- **Retro-filling the funnel from existing Postgres rows.** Measurement starts the day it ships.
