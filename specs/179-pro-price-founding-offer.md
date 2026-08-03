# Spec 179 — A real price on the Pro card, and a founding-member annual deal

> **In one sentence:** The landing pricing card stops saying "Monthly" and shows the actual amount,
> read server-side from Stripe, alongside a capped founding-member annual offer — so a visitor can see
> what Pro costs before deciding whether to want it.

|                |                                                              |
| -------------- | ------------------------------------------------------------ |
| **Status**     | ✅ Done (code); two dashboard steps listed below            |
| **Issue**      | #179 — "1/8 · Show a real price on the Pro card + founding-member annual deal" |
| **Branch**     | `179-pro-price-founding-offer` (from `feature/pro`)          |
| **Feature**    | Billing / landing                                            |
| **Depends on** | [spec 99](99-stripe-checkout.md), [spec 100](100-pro-upgrade-revisions.md), [spec 74](74-pro-entitlements.md) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
Clarified 2026-08-03: cap mechanism, caching, F1b scope, fallback and guard test are all settled below.
-->

---

## User story

As a **visitor deciding whether Airrow is worth paying for** I want **to see what Pro actually costs,
and what the launch offer is**, so that **I can decide now instead of guessing that an unnamed price
means "expensive" and leaving**.

And as **the person selling it**, I want that figure to still live in Stripe, so the launch-day price
is a dashboard edit rather than a deploy.

---

## Background

- **Today:** the landing Pro card renders the literal string `"Monthly"` where the free card renders
  `"$0"` — [copy.ts:206](apps/web/src/features/landing/copy.ts#L206), rendered at
  [page.tsx:242-244](apps/web/src/app/(public)/page.tsx#L242-L244). The comment there is explicit that
  the omission is deliberate: spec 99 put the amount in Stripe so it could change without a deploy, and
  duplicating it in marketing copy would undo that.
- **The problem:** "the amount lives in Stripe" was read as "therefore we cannot show it". The two are
  not the same — Stripe can be *asked* what the price is at render time. What ships today is a pricing
  section with no price on it, which reads as unfinished.
- **Already in place:**
  - `stripePrices()` returns the configured price ids and intervals from `STRIPE_PRICE_MONTHLY` /
    `STRIPE_PRICE_YEARLY` — [stripe.ts:116-123](apps/web/src/lib/stripe.ts#L116-L123). It carries ids
    only; no amount is fetched anywhere yet.
  - `stripeConfigured()` / `missingStripeConfig()` already give the "Stripe isn't wired up" answer the
    UI needs — [stripe.ts:63-93](apps/web/src/lib/stripe.ts#L63-L93).
  - Checkout already picks the price server-side from the configured list and never trusts a posted id
    — [actions.ts:101-116](apps/web/src/features/billing/actions.ts#L101-L116).
  - `/app/upgrade` already renders one button per configured interval —
    [BillingActions.tsx:26-52](apps/web/src/features/billing/BillingActions.tsx#L26-L52) — so a yearly
    price id, once set, is already purchasable there without new UI.
  - The webhook and `applySubscriptionState` already flip `organizations.plan`; nothing about pricing
    changes that path.

---

## Design decision

Keep the invariant ("no price literal in the repo") and satisfy the requirement ("show the price") by
**reading the amounts from Stripe server-side and rendering them**, through a cached read so an
unauthenticated public page cannot turn into one Stripe API call per visitor.

**The cap is Stripe's to count, not ours.** The founding offer is the existing annual price plus a
**coupon with `max_redemptions: 100`**, applied server-side when Checkout is created. Stripe owns the
number, so it cannot drift from what we display and cannot be raced by two simultaneous buyers; the
101st gets a coupon-exhausted error we translate into plain language. The same object gives the seat
counter its figure for free — `times_redeemed` against `max_redemptions` — which is why F1b ships here
rather than as a follow-up.

**Where it lives:** a new `features/billing/prices.ts`, reading through the existing server-only
`lib/stripe.ts` client and called from the landing RSC. That is the one-way data flow the constitution
requires (§I) — the route stays thin, the Stripe call stays in the feature layer beside
`sync.ts`, the SDK stays in `lib/`.

**Caching:** a Next cached function with `revalidate: 3600` around the read. One Stripe call per hour
per deployment however much traffic arrives, shared across serverless instances via the data cache, and
a dashboard price edit reaches the site within the hour — still no deploy, which is what spec 99 was
protecting.

**Not touched:** `organizations.plan` writes (webhook + `features/billing/sync.ts` only), `checkAllowance`,
the Checkout action's rule that the price is chosen from the configured list and never posted, and
`/app/upgrade`'s existing interval buttons.

---

## Acceptance criteria

- [x] The landing Pro card shows a real monthly amount (currency + figure + interval), fetched from
      Stripe at render time on the server.
- [x] No price literal is committed anywhere in the repo — not in `features/landing/copy.ts`, not in
      a component, not in a test fixture that would drift.
- [x] The founding annual offer is capped at 100 redemptions by a Stripe coupon, applied server-side
      at Checkout creation; the 101st attempt fails cleanly with an explanation rather than a server
      error.
- [x] The Pro card carries founding-member copy: the seat cap, a badge, and the "this price never
      returns" promise.
- [x] **(F1b)** The Pro card shows how many founding seats remain, derived from the coupon's
      `times_redeemed` against `max_redemptions`, through the same cached read as the price.
- [x] With Stripe unconfigured or unreachable, the pricing section still renders: the amount line and
      the seat counter are absent, the card, its note, its feature list and its CTA are not. No crash,
      no placeholder figure, no invented number.
- [x] Typecheck passes; lint adds no new issues; tests green (one known pre-existing failure, below).
- [x] **Dashboard, not code:** the monthly and annual prices exist in Stripe ($11.99 / $119.99 USD,
      created 2026-08-03) and are purchasable through the existing Checkout path.
- [x] **Dashboard, not code:** the founding coupon exists with `max_redemptions: 100` and its id is in
      `STRIPE_COUPON_FOUNDING`. Done 2026-08-03 — see _Amendment 3_. Where it is absent, the card
      prices Pro and shows no founding offer, which is the designed behaviour for a deployment running
      no promotion, not a failure.
- [ ] **Dashboard, not code:** Checkout → webhook → plan flip verified end-to-end in Stripe test mode,
      for both the monthly and the founding annual price.

### Verification

- **New tests** — `apps/web/src/features/billing/prices.test.ts`: formatting a Stripe amount into
  display text (minor units → currency string), seats-remaining arithmetic including the sold-out and
  over-redeemed cases, the unconfigured case, and the API-failure case. Stripe is mocked; no test
  touches the network (§V).
- **New tests** — `apps/web/src/app/(public)/page.test.tsx`: the Pro card renders the fetched amount
  and the seat counter, and renders neither — while keeping name, note, list and CTA — when no price
  is available.
- **Guard test** — a regex over `apps/web/src/features/landing/copy.ts` asserting it contains no
  currency figure other than the free card's `$0`. Narrow on purpose: it fails the moment a literal is
  pasted back in, which is the exact regression that left the card saying "Monthly".
- **New test** — `apps/web/src/features/billing/actions.test.ts`: Checkout for the annual interval
  attaches the founding coupon, and an exhausted coupon surfaces the offer-gone message rather than
  `STRIPE_FAILED`.
- **Manual (test mode)** — Checkout for each price → webhook received → `organizations.plan` reads
  `pro`; and a 101st founding-annual attempt against a coupon whose redemptions are exhausted.
- Full suite result + typecheck/lint status.

### Implementation notes (2026-08-03)

**Written.** `apps/web/src/features/billing/prices.ts` (new, 14 tests),
`apps/web/src/app/(public)/page.test.tsx` (new, 6 tests), plus edits to `lib/stripe.ts`,
`features/billing/actions.ts` (+6 tests), `features/landing/copy.ts`,
`app/(public)/page.tsx`, `.env.example` and `INFRASTRUCTURE_SETUP.md`.

**Verification run:**

- `pnpm -r typecheck` — clean.
- `pnpm -r lint` — clean, no new issues.
- `pnpm -r test` — **932 passed, 103 skipped, 0 failed** across 91 files (web), 113 (schemas),
  292 (engine).
- `pnpm test:scripts` — **1 pre-existing failure**, unrelated to this spec:
  `scripts/capture-ui-kit-previews.test.mjs > adds the field once, and updates rather than duplicating
  on a re-run`. That is spec 165's UI-kit capture helper over `packages/schemas/src/ui-kits.ts`; this
  change touches nothing under `scripts/` or `packages/`.

**Deviations from the plan above, and why:**

1. **`STRIPE_COUPON_FOUNDING` is checked for presence, not prefix.** The plan said to prefix-check it
   "like every other variable". Stripe coupon ids have no prefix — they are whatever the person
   creating one typed, or an opaque string like `IMcqUvVL` when they typed nothing. `STRIPE_VARS` now
   accepts an empty prefix list to mean "presence is all this can honestly verify", which keeps one
   mechanism rather than adding a second path. It is correctly absent from `REQUIRED_STRIPE_VARS`.
2. **The guard test already existed.** `copy.test.ts` has carried "names no price, because the amount
   lives in Stripe" — a regex allowing `$0` — since spec 99. It is exactly the shape the clarification
   picked, so it was kept and its comment updated rather than a second one written.
3. **Archer's prompt needed a change nobody predicted.** `features/chat/knowledge.ts` read
   `SECTIONS.pricing.pro.amount` to tell visitors about pricing, so removing the `"Monthly"` literal
   broke the chat knowledge base and its test. It now names the intervals and points at the card and
   at Checkout. Archer still carries **no figure**, and now for a sharper reason: its prompt is built
   from static copy, so any number in it would be the stale second source of truth the whole design
   avoids.
4. **`fromStripe` took a third parameter.** An optional `explain` mapper, passed only by Checkout, so
   an exhausted coupon reads as "the last founding place went" instead of "try again in a moment" —
   advice that can never come true. A mistyped coupon id still reads as a Stripe failure, because that
   is our bug and not the founder's missed chance; both directions are tested.
5. **`CLAUDE.md` needed a clause, caught by `/analyze`.** Its line 62 enumerated how Stripe is
   reached — "via the DataStore and server actions" — and this change adds a path it did not cover: a
   cached feature-layer *read* called straight from the landing RSC. Not a layering violation
   (`features/billing/sync.ts` already calls Stripe outside the DataStore, and RSCs already call
   feature modules directly), but §IV wants the context file correct in the same change, and the house
   precedent is spec 141 amending the same sentence when a second Claude caller appeared. Left alone,
   a future agent would read it as "an RSC may not read Stripe".

**Still to do, and only in the Stripe dashboard — no code is waiting on them:**

- Create the founding coupon with `max_redemptions: 100` and set `STRIPE_COUPON_FOUNDING`. Until it
  exists the card prices Pro and shows no offer, which is the designed behaviour for a deployment
  running no promotion.
- Set `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY` to the ids of the two prices created on
  2026-08-03, then run one test-mode Checkout per price and confirm the webhook flips
  `organizations.plan`.

---

## Amendment 1 — the founding price, and `/app/upgrade` (2026-08-03)

_Two changes, and the first is a defect in what shipped above._

**1. The founding line showed the list price, not the founding price.** The card rendered
`"88 founding places left of 100 at $119.99 per year"` — `$119.99` being `STRIPE_PRICE_YEARLY`'s own
amount. But the whole design is that Checkout attaches a coupon to that price, so the first 100 pay
**less than the figure the card names**. Advertising a founding deal at the undiscounted rate is the
same class of bug as the "Monthly" this spec exists to fix: a pricing surface saying something that is
not what happens at checkout. The coupon is already fetched, and it carries `percent_off` /
`amount_off` — so the founding amount is computed from the two numbers we already have, and the card
names what the founder will actually be charged.

**2. `/app/upgrade` names its prices.** Its buttons read "Upgrade to Pro" and "Upgrade yearly" with no
figure anywhere on the screen — the same omission the landing card just stopped making, on the screen
someone reaches *after* deciding to pay. Each button now carries its amount, and the yearly one carries
the founding amount while the offer is running, because that is what pressing it charges.

**Not extended:** the seat counter stays on the landing page. `/app/upgrade` is reached by someone who
has already decided; a scarcity count there is pressure at the till, not information.

### Added acceptance criteria

- [x] The landing founding line names the amount **after** the coupon, never the list price.
- [x] A coupon Stripe describes with neither `percent_off` nor `amount_off` yields no founding amount,
      and the line renders without a figure rather than with the wrong one.
- [x] `/app/upgrade` shows each configured interval's amount on its button, and the yearly button shows
      the founding amount whenever the offer is live.
- [x] With Stripe unreachable, `/app/upgrade` renders exactly as it does today — labels, no figures.
- [x] `readPricing` cannot throw into a render, including when the cache wrapper itself fails.

### Amendment verification

`upgradeAmounts` is shared by `/app/upgrade` and `/app/settings` — both render `UpgradeButtons`, and
the amount rule (yearly at the founding rate while places remain, list price once they are gone) had
to be identical on both or the two screens would quote different figures for the same button.

- **New tests** — `apps/web/src/app/app/upgrade/page.test.tsx` (5): the amount on each button, the
  founding rate while places remain, the list price once sold out, plain labels when Stripe is
  unreachable, and billing management rather than a price for someone already paying.
- **Extended** — `prices.test.ts` (26 total): `discounted` for percent, fixed amount, rounding, the
  floor at zero and a coupon with no discount; `upgradeAmounts` for all four states; and the cache
  wrapper throwing.
- **Extended** — `page.test.tsx` (8 total): the founding line quotes the founding rate and *not* the
  list price, and renders figure-free when the rate is unknown.
- **A third defect, found by the suite rather than by review.** Adding the read to Settings turned all
  20 of its tests red: `unstable_cache` throws when there is no request scope, and it threw *outside*
  `fetchPricing`'s catch — straight through the page. `readPricing` now catches around the cache call
  too. The "no crash" criterion above was not actually true until this change.
- `pnpm -r typecheck` clean · `pnpm -r lint` clean · `pnpm -r test` **952 + 113 + 305 passed, 0
  failed**. `pnpm test:scripts` unchanged: the one pre-existing spec-165 failure.

---

## Amendment 2 — the signed-out Pro button asked for nothing (2026-08-03)

_A defect on the card this spec exists to fix, found by using it._

Pressing **"Start with Pro"** while signed out opened `/start` — the guest interview — so the visitor
who had just read a price, a founding badge and a seat count was handed thirty questions and a **free**
foundation. Nowhere on that path is there a way to pay. `proCtaHref`'s own comment defended it ("Pro
cannot be bought without an account, so the interview is the honest answer"), but the two halves do not
join: that Pro needs an account is a reason to **ask for the account**, not a reason to start something
else. With a real figure now on the card the mismatch is worse than it was — the card makes a
commercial promise and the button silently declines it.

Signed out, the CTA now goes to **`/signup`**. Not `/app/upgrade`: `middleware.ts` matches `/app/:path*`
and would bounce a signed-out visitor to `/login` with the reason stripped (`url.search = ""`), so the
screen they land on would explain nothing. Signup is the actual next step, and it links to sign-in for
anyone who already has an account.

**Unchanged:** the free card and the hero still open `/start` through `startCtaHref` — the guest
interview is exactly right for the free action, and it is the priced card that must not lead there.
The signed-in branches of `proCtaHref` are untouched.

### Added acceptance criteria

- [x] Signed out, the pricing section's Pro action goes to `/signup`, never to the guest interview.
- [x] The free card's action and the page's other CTAs still go to the guest interview when signed out.

### Amendment verification

- **Extended** — `pro-cta.test.ts` (5): the signed-out destination is `/signup`, plus a test asserting
  it is *not* `GUEST_INTERVIEW_PATH`. The second one is not a duplicate of the first: it names the
  regression, so a later change that repoints signup elsewhere cannot quietly restore the old bug.
- **Updated** — `smoke.test.tsx`: the signed-out landing render asserts `/signup` on the Pro link.
- `pnpm -r typecheck` clean · `pnpm --filter web lint` clean · `pnpm --filter web test` **953 passed,
  103 skipped, 0 failed**.

---

## Amendment 3 — the founding coupon exists, and a stale id no longer costs the card its price (2026-08-03)

**1. The coupon.** Created in live mode: id `founding-100`, **25 % off**, `duration: forever`,
`max_redemptions: 100`. Against the $119.99 annual price that is **$89.99 a year** — the figure the
offer was decided at. Percent rather than a fixed `amount_off` so the founding rate stays proportional
if the list price is ever edited in the dashboard, which is the property the whole "no figure in the
repo" design is protecting. `forever` rather than `once` because the card promises the rate "stays
that rate for as long as you keep it"; a `once` coupon renews year two at the list price and would
make that sentence false. It reaches the **yearly** price only — `actions.ts` attaches it on
`interval === "year"` and nowhere else, so monthly is untouched by construction rather than by the
coupon's own configuration.

**2. A defect the coupon uncovered.** `STRIPE_COUPON_FOUNDING` already held `3RYluW9u` — an id no
longer in the Stripe account. `readFounding` therefore threw, and the throw landed in `fetchPricing`'s
single catch, which returns `NO_PRICING`: **both list prices disappeared from the landing card because
a promotion was misconfigured.** The blast radius was wrong. A missing coupon is already a state this
spec designed for ("absence of the offer is not a broken deployment"), and a coupon id — typed by
hand, never prefix-checkable — is exactly the value most likely to go stale. The coupon read now has
its own catch and yields `null`, so a bad id reads as "no offer running" and the prices survive it.

### Added acceptance criteria

- [x] The founding coupon exists in live Stripe with `max_redemptions: 100` and `duration: forever`,
      discounting the annual price to $89.99.
- [x] A `STRIPE_COUPON_FOUNDING` pointing at a coupon that does not exist yields no offer, and the
      monthly and annual amounts still render.

### Amendment verification

- **New test** — `prices.test.ts` (28 total): the coupon read rejecting leaves `prices` intact and
  `founding` null, with its own log line.
- **Docs** — `.env.example` and `INFRASTRUCTURE_SETUP.md` now state `duration: forever` and why, and
  record that a dangling id behaves as no offer.
- `pnpm -r typecheck` clean · `pnpm --filter web lint` clean · `pnpm --filter web test` **954 passed,
  103 skipped, 0 failed**.

**Left for the first real purchase:** Stripe rounds a 25 % discount on $119.99 to the cent itself
(2999.75 → $30.00 off), which agrees with `discounted`'s `Math.round`. Worth confirming against the
first founding invoice that the charge reads $89.99 and not $90.00 — a one-cent disagreement between
the card and the receipt is the same class of bug as the two this spec has already fixed.

---

## Exact changes (file:line)

_Expanded by `/implement`. Grounded in current code:_

1. **`apps/web/src/lib/stripe.ts`** — `stripePrices()` returns ids and intervals only
   ([:116](apps/web/src/lib/stripe.ts#L116)); it keeps that job. Add `STRIPE_COUPON_FOUNDING` to
   `STRIPE_VARS` and a `stripeCouponFounding()` reader beside it. Presence-checked only, not
   prefix-checked — see deviation 1 below. It is **not** added to `REQUIRED_STRIPE_VARS`: a deployment
   without the founding coupon should sell Pro normally, not refuse to sell.
2. **`apps/web/src/features/billing/prices.ts`** *(new)* — the cached read. Asks Stripe for the amount
   and currency of the ids `stripePrices()` returns, and for the founding coupon's `times_redeemed` /
   `max_redemptions`. Wrapped in a Next cached function with `revalidate: 3600`. Returns a typed
   result, never throws into the render: an unconfigured or failing Stripe yields "no amounts", which
   the card already knows how to draw.
3. **`apps/web/src/features/landing/copy.ts`** — replace the `"Monthly"` literal at
   ([:206](apps/web/src/features/landing/copy.ts#L206)) and the comment above it explaining why there
   is no figure; add founding-member copy (badge, cap, "never returns"). The comment block at
   ([:155-157](apps/web/src/features/landing/copy.ts#L155-L157)) is also stale — it still describes Pro
   as "coming soon" with no price.
4. **`apps/web/src/app/(public)/page.tsx`** — the pricing section at
   ([:208-258](apps/web/src/app/(public)/page.tsx#L208-L258)) renders `SECTIONS.pricing.pro.amount`
   as static text; it becomes a fetched value, plus the founding badge and seat counter. The page is
   already an RSC and already awaits `checkAllowance`, so a server-side read fits without a new layer.
   The amount line and counter are **omitted** when there is nothing to show — an absent element, not
   a conditional string (§III: explicit states).
5. **`apps/web/src/features/billing/actions.ts`** — attach the founding coupon to the Checkout session
   when the chosen price is the yearly one, beside the existing `line_items` at
   ([:116](apps/web/src/features/billing/actions.ts#L116)). The coupon id comes from the environment,
   never from the form — the same rule that already governs the price id at
   ([:101-105](apps/web/src/features/billing/actions.ts#L101-L105)). An exhausted coupon comes back
   from Stripe as a specific error and must be translated into the offer-is-gone message rather than
   the generic `STRIPE_FAILED` at ([:23](apps/web/src/features/billing/actions.ts#L23)).
6. **`apps/web/.env.example`** and **`docs/guides/INFRASTRUCTURE_SETUP.md`** — document
   `STRIPE_COUPON_FOUNDING` and note that `STRIPE_PRICE_YEARLY` is now the founding annual price.
7. **Stripe dashboard (not code)** — create the monthly price, the annual price, and the founding
   coupon with `max_redemptions: 100`. Record the ids as environment variables; they are
   configuration, never committed. **Done 2026-08-03:** monthly **$11.99/month** and annual
   **$119.99/year**, both USD — not the $14.99 / $149.99 the issue proposed. Recorded here as a dated
   note of what was created, not as a source of truth: the live figure is whatever Stripe says, and
   the card reads it from there. The founding coupon is still outstanding.

**No change needed:** `/app/upgrade` already renders a button per configured interval
([BillingActions.tsx:42-52](apps/web/src/features/billing/BillingActions.tsx#L42-L52)), so the annual
price becomes purchasable there the moment `STRIPE_PRICE_YEARLY` is set. The webhook and
`applySubscriptionState` are indifferent to which price or coupon was used — a discounted subscription
reports the same status, so `planForStatus` needs nothing. `stripePrices()` keeps its shape: the
founding offer reuses `STRIPE_PRICE_YEARLY` rather than adding a third price variable, because the cap
lives on the coupon and there is only ever one annual price.

---

## Data model

**No schema changes.** The price and the seat count are both read from Stripe at render — the coupon's
`times_redeemed` is the counter's source of truth, so nothing about the offer is stored in Postgres and
there is no table to give RLS. `organizations.plan` keeps its existing two writers (the webhook and
`features/billing/sync.ts`, both through `applySubscriptionState`); nothing here writes it.

---

## Security

This exposes only what a price tag exposes: an amount already public in Checkout, plus a seat count
that is marketing by design. The Stripe secret key stays server-side in `lib/stripe.ts`; no key, price
id or coupon id reaches the client bundle, and the read is a GET against Stripe with no user input in
it. The coupon id is read from the environment and attached server-side — a client that posts one is
ignored, exactly as a posted price id already is, so nobody can discount their own subscription.

The one real risk is the public, unauthenticated landing page becoming an amplifier for Stripe API
calls, which is why the read is cached at one call per hour per deployment rather than per request.

---

## Edge cases

- **Stripe unconfigured** (no `STRIPE_SECRET_KEY`) → the pricing section renders without a figure and
  without an error; `stripeConfigured()` already answers this without constructing a client.
- **Stripe configured but the API call fails or times out** → same as unconfigured: no amount line, no
  counter, the rest of the card intact. The failure is logged (names and shapes only, §II) and the
  page still renders.
- **`STRIPE_COUPON_FOUNDING` unset** → no founding badge, no counter; the annual price still sells at
  its normal figure. Absence of the offer is not a broken deployment.
- **`STRIPE_COUPON_FOUNDING` set to a coupon that does not exist** → identical to unset, since
  amendment 3. It used to take both list prices off the card with it.
- **All 100 founding seats taken** → the card reads as sold out and stops advertising the offer;
  monthly and annual both remain purchasable, annual at its undiscounted figure.
- **A founding member cancels** → the seat does **not** return to the pool. A Stripe coupon counts
  redemptions, not active subscribers, and `times_redeemed` never decrements. This is the honest
  reading of "the first 100 customers" anyway, and re-opening a seat would contradict the badge the
  other 99 bought under.
- **Two buyers race for seat 100** → Stripe decides; the loser's session creation fails with the
  coupon-exhausted error and sees the offer-is-gone message. Nothing in our code counts, so nothing in
  our code can double-sell.
- **The counter is up to an hour stale** → it can only read *high*: `times_redeemed` is cached, so a
  visitor may see "12 left" when 9 remain. They are never refused a seat that the card said was there
  unless the last few went inside the hour, and then Stripe refuses at Checkout with the message
  above. The number is a signal, not a reservation — the card must never promise a specific seat.
- **Price changed in the Stripe dashboard** → the site shows the new figure within the cache TTL, with
  no deploy.
- **Someone already on Pro views the landing page** → the card still shows the price; the CTA already
  routes via `proCtaHref` and `/app/upgrade` handles the already-Pro case.

---

## Out of scope

- Currency localisation or per-region pricing — USD only, one currency, read from Stripe rather than
  assumed.
- Any change to what Pro *includes* (`PRO_INCLUDED`) or to `checkAllowance`.
- ~~Showing the price anywhere other than the landing pricing card~~ — **amended 2026-08-03**, see
  _Amendment 1_ below. The seat counter stays landing-only.
- The remaining 7 items in the GTM playbook build order; this issue is 1 of 8 and blocks them, but
  contains none of them.
- Proration, upgrade/downgrade between monthly and annual, and refunds — Stripe's defaults stand.
