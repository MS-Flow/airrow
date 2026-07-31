# Spec 140 — Two real ways in, and a password field that helps

> **In one sentence:** The auth screens offer four providers of which one works, and ask for a password
> without ever saying what makes an acceptable one — so we ship Google for real, delete the two we never
> intend to build, and make the signup password field teach as it is typed.

|                |                                                      |
| -------------- | ---------------------------------------------------- |
| **Status**     | 🔄 In progress                                        |
| **Issue**      | #140 — "Auth pages: real Google sign-in, drop the dead providers, and a password field that helps" |
| **Branch**     | `140-auth-google-password` (from `feature/ui`)        |
| **Feature**    | ui                                                    |
| **Depends on** | [spec 18](18-supabase-auth.md) (email + password signup), [spec 67](67-github-login-import.md) (the OAuth shape Google copies), [spec 19](19-premium-ui-system.md) (which introduced the placeholder buttons this removes), [spec 135](135-signup-error-causes.md) (the one-sentence-per-cause error contract) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

As a **founder creating an Airrow account** I want **to sign in with Google, and to be shown what a good
password looks like while I type it** so that **I get in with an account I already have, or leave with a
password that will not be the weakest thing about my workspace.**

---

## Background

- **Today:** [`ProviderButtons.tsx`](../apps/web/src/features/auth/ProviderButtons.tsx) renders four
  providers. GitHub is real ([:24-32](../apps/web/src/features/auth/ProviderButtons.tsx#L24-L32)); Google,
  "Continue with Email" and "Send a magic link" are a `PROVIDERS` array rendered `disabled` with a "Soon"
  badge ([:12-16](../apps/web/src/features/auth/ProviderButtons.tsx#L12-L16)), designed but inert since
  spec 19.
- **Today:** the signup password field is a bare `<Input type="password">` whose only guidance is the
  placeholder *"At least 8 characters"* and `minLength={8}`
  ([signup/page.tsx:120-130](../apps/web/src/app/signup/page.tsx#L120-L130)). `signupSchema` extends
  `loginSchema`, so that `password: z.string().min(8).max(200)` is the *same rule for signing in*
  ([schemas/src/index.ts:134-141](../packages/schemas/src/index.ts#L134-L141)).
- **The problem, part one:** two buttons promise flows nobody intends to build. A "Soon" badge on
  something that is never coming is a slower version of a lie, and it makes the third — Google, which we
  do want — look equally hypothetical.
- **The problem, part two:** the founder is told a length and nothing else, learns the real rule only by
  being rejected, cannot see what they typed, and has no second field to catch a typo in the one
  credential that cannot be recovered by re-reading it.
- **The problem, part three** (reported 2026-07-31, folded into this issue): GitHub's consent screen
  reads *"Airrow by sebastianbreuker"* for every founder, because the OAuth App is registered under a
  **personal** GitHub account and GitHub attributes an app to its owner on every screen it shows.
  Confirmed as owner attribution, not a signed-in-account line — which is why the correct identity is
  still the one created. Nothing in our code puts it there: `signInWithGitHub` sends `client_id`,
  `redirect_uri`, `state` and an empty `scopes` and nothing else
  ([auth.ts:162-170](../apps/web/src/lib/auth.ts#L162-L170)). It is a **configuration** defect, and the
  worst moment for it is the one where a stranger is deciding whether to trust us with their account.
- **Already in place:** [`signInWithGitHubAction`](../apps/web/src/features/auth/actions.ts#L15) is the
  exact shape Google needs — a server action, redirect origin validated through `@/lib/site-url`, failure
  routed to `/login?error=…` with its own sentence in `ERRORS`
  ([login/page.tsx:29-40](../apps/web/src/app/login/page.tsx#L29-L40)). Spec 67 also already decided the
  hard part: an email the provider has **not verified** never links to an existing account.

---

## Design decision

**Google copies GitHub exactly, including its refusal.** A `signInWithGoogleAction` beside the GitHub one,
a `signInWithGoogle` in `@/lib/auth`, the same `${await requestOrigin()}/auth/callback` target through the
validated-origin helper, and the same rule from spec 67 — an unverified provider email is not an identity
and must not claim an existing Airrow account. Failure gets its own `?error=google` sentence; the
provider's own words never travel (spec 135).

**The consent screen is transferred, not rebuilt.** GitHub's OAuth App settings carry a *Transfer
ownership* action that moves the app to an organization **keeping `client_id` and `client_secret`
intact** — so Supabase needs no reconfiguration and not one existing founder is asked to re-authorize.
Creating a fresh app under `MS-Flow` would achieve the same screen while invalidating both credentials
and every existing authorization, which is a migration, not a fix. After the transfer the screen reads
*"Airrow by MS-Flow"*.

**Google gets the account chooser GitHub cannot have.** GitHub has no account-switching parameter — its
consent screen uses whatever github.com session the browser holds, full stop. Google does: passing
`prompt=select_account` makes it always offer the chooser instead of silently assuming the first signed-in
account. Founders with a personal and a work Google account are the normal case, so we ask every time.

**The dead providers are deleted, not hidden.** With email and magic link gone, `PROVIDERS` holds only
Google — which is now real — so the entire disabled-button branch and the "Soon" badge go with them. The
component ends up as two working buttons and nothing else.

**The password field is one client component, on signup only.** Requirements checklist, strength bar,
show/hide toggle and the repeat field are a single interactive unit, so they live in one `"use client"`
component dropped into the otherwise-server `/signup` page; the form still posts to the existing server
action. `/login` keeps its plain single field: a strength meter there tells an attacker something and the
returning founder nothing.

**Two gates, and they are honest about being different.** The **schema** enforces structure — at least 8
characters plus an uppercase, a lowercase and a number. Deterministic, cheap, and it
keeps `packages/schemas` free of a dictionary dependency every consumer would then carry. The **browser**
adds a `zxcvbn` score gate on top: below the threshold, submit is refused with a reason. So a crafted POST
that skips the client can still land a structurally valid but guessable password — accepted knowingly,
because the alternative puts a scoring corpus into the pure shared package, and the founder we are
protecting here is the one using the form, not the one bypassing it.

**`@zxcvbn-ts/core`, loaded on first keystroke.** Character-class scoring calls `Passw0rd!` and
`Qwerty123!` strong, which are precisely the passwords a meter exists to catch — so the bar is driven by a
real estimator. It is dynamically imported when the founder starts typing, keeping it off the initial
`/signup` bundle; until it resolves, the checklist works and the bar simply has not filled yet.

**The length floor stays at 8.** The lift in this spec comes from the required classes and the score
gate, not from a longer minimum — so `loginSchema`'s `min(8)` and `signupSchema`'s length agree, and the
two rules differ only in the structure signup additionally demands.

**No special-character rule** (revised after review). It was specified and built, then removed: demanding
a symbol is the requirement that most reliably produces `Passw0rd!` — a dictionary word with a
predictable suffix — while the long passphrase without one is the stronger password. The zxcvbn gate
judges that properly and a regex never could, so the checklist keeps the three rules a founder can act on
and drops the one that teaches a habit the estimator then punishes. The checklist stays visibly useful,
which was the point of showing it.

**Each field owns its reveal toggle** (added after review). Two independent eyes rather than one shared
one: revealing the repeat while the original stays hidden is exactly the comparison the second field
exists for, and a button inside one box that silently changed the other would be a surprise. Their
accessible names say which field they act on, since two buttons both called "Show password" would leave a
screen-reader user guessing.

**Not touched:** `loginSchema`'s password rule, and therefore every account that already exists. Accounts
created under the old rule must keep signing in; the new class requirements apply to *new* passwords only,
and we are not forcing a reset.

---

## Acceptance criteria

- [ ] Google sign-in completes end to end from both `/login` and `/signup`, and lands the founder on `/app`.
      _(Blocked on the OAuth client — step 8. Everything up to the credential is built and tested.)_
- [x] A cancelled or failed Google flow returns to `/login` with a sentence specific to that cause, and
      creates nothing.
- [x] A Google account whose email Google has not verified does not link to an existing Airrow account,
      and says so — matching spec 67's GitHub behaviour.
- [x] No provider message reaches the screen.
- [x] Google's consent screen offers the account chooser rather than assuming the first signed-in account.
      _(`prompt=select_account` asserted in `auth.test.ts`; visible on the manual round trip.)_
- [ ] GitHub's consent screen attributes the app to **MS-Flow**, not to a personal account. _(Step 10 —
      configuration, walked through below.)_
- [ ] The transfer keeps the existing `client_id`/`client_secret`: Supabase is unchanged and no existing
      founder is asked to re-authorize. Verified by signing in with an account that already authorized.
- [x] "Continue with Email" and "Send a magic link" are gone from both `/login` and `/signup`, and no
      disabled "Soon" button remains.
- [x] `/signup` shows the password requirements *before* the founder types, and each ticks off live as it
      is satisfied.
- [x] A strength bar reflects password quality with a word beside it, and a password scoring below the
      threshold cannot be submitted from the browser.
- [x] The show/hide toggle reveals the typed password, never submits the form, and its accessible name
      changes with its state.
- [x] A mismatched "Repeat password" is reported inline as it is typed and blocks submit.
- [x] Structure (length, uppercase, lowercase, number) and the repeat-password match are enforced in
      `signupAction` — a crafted POST that skips the client is refused on both.
- [x] Both password fields carry their own reveal toggle, each acting only on its own field.
- [x] The score gate is browser-only by design, and the spec says so rather than implying the server
      checks it.
- [x] `@zxcvbn-ts/core` is dynamically imported, not in `/signup`'s initial bundle; the form is usable
      before it loads.
- [x] `loginSchema` still accepts every password valid under the old rule; existing accounts sign in
      unchanged.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

- **New** — [`PasswordFields.test.tsx`](../apps/web/src/features/auth/PasswordFields.test.tsx) (9): the
  checklist visible before typing and ticking off live; an incomplete password blocked; a *structurally
  valid* one the estimator rates guessable blocked too (`Passw0rd!`, the case that justifies the
  dependency); the block clearing when both gates pass; reveal/re-hide without submitting; mismatch
  reported inline and blocking; silence on a repeat field nobody has filled; and the two field `name`s
  matching what the schema parses.
- **New** — [`password.test.ts`](../packages/schemas/src/password.test.ts) (25): each rule failed in
  isolation, the mismatch `.refine` pointing at `confirmPassword`, and the property that matters —
  **the schema accepts a password exactly when the checklist has no items left**, which is what stops the
  browser and the server drifting apart. Plus the regression that `loginSchema` still accepts `password`
  and `12345678`, because existing accounts use them.
- **Updated** — [`auth.test.ts`](../apps/web/src/lib/auth.test.ts) (28 total): `signInWithGoogle` sends
  `prompt=select_account`; `oauthProviderOf` resolves the session's provider; and the bug the provider
  argument exists to prevent — **a verified GitHub identity must not vouch for an unverified Google one**
  on an account that has linked both.
- **Updated** — [`ProviderButtons.test.tsx`](../apps/web/src/features/auth/ProviderButtons.test.tsx) (4):
  both providers real and submitting, the removed two asserted absent by name, no disabled button left.
- **Updated** — [`signup/page.test.tsx`](../apps/web/src/app/signup/page.test.tsx) (7): a mismatch gets
  its own sentence rather than the generic one.
- **Updated** — [`design-tokens.test.ts`](../apps/web/src/components/design-tokens.test.ts): a one-entry
  allowlist for the Google mark; see _Implementation notes_.
- **New** — [`actions.test.ts`](../apps/web/src/features/auth/actions.test.ts) (8): the redirect target is
  the exact allow-list path and **carries no query string**, for both providers, plus each provider naming
  itself when it will not start. The regression guard for implementation note 2; verified failing before
  the fix.
- **Updated** — [`route.test.ts`](../apps/web/src/app/auth/callback/route.test.ts): a failed exchange now
  reports the neutral `oauth`, and a Google identity whose address Google has not verified reports
  `google_unverified` rather than GitHub's copy.
- **Manual check, outstanding** — the Google round trip and the GitHub consent screen, neither of which a
  unit test can prove and both of which need the configuration steps below.
- **Result (2026-07-31, re-run after the `/analyze` fix):** `pnpm -r typecheck` clean · `pnpm -r lint`
  clean · `pnpm -r test` **836 passed, 53 skipped** (web 544 + engine 223 + schemas 69; the skips are the
  `*.db.test.ts` suites — local Supabase not running) · `pnpm test:scripts` **88 passed**. No
  pre-existing failures.

---

## Exact changes (file:line)

_Expanded by `/implement`._

1. **`apps/web/src/lib/auth.ts`** — `signInWithGoogle`, mirroring `signInWithGitHub`
   ([:162-170](../apps/web/src/lib/auth.ts#L162-L170)), with
   `queryParams: { prompt: "select_account" }` so Google always offers the chooser. Scopes stay at the
   default identity scopes — Airrow wants a name and a verified address, nothing else, which is the same
   posture `scopes: ""` states for GitHub.
2. **`apps/web/src/features/auth/actions.ts`** — `signInWithGoogleAction`, mirroring
   ([:15-18](../apps/web/src/features/auth/actions.ts#L15-L18)).
3. **`apps/web/src/features/auth/ProviderButtons.tsx`** — Google becomes a real form; `PROVIDERS` and the
   disabled branch are deleted ([:12-16](../apps/web/src/features/auth/ProviderButtons.tsx#L12-L16),
   [:34-49](../apps/web/src/features/auth/ProviderButtons.tsx#L34-L49)); header comment updated, since
   it currently documents the placeholders.
4. **`apps/web/src/app/login/page.tsx`** — a `google` entry in `ERRORS`
   ([:29-40](../apps/web/src/app/login/page.tsx#L29-L40)).
5. **`apps/web/src/features/auth/PasswordFields.tsx`** *(new, client)* — the field, checklist, bar,
   toggle and repeat field. The bar **reuses [`components/ui/progress.tsx`](../apps/web/src/components/ui/progress.tsx)**
   rather than hand-rolling a second one (invariant III, reuse before create) — which needs `Progress` to
   accept a colour on its *indicator*, since `className` currently reaches only the Root and the
   indicator is a fixed `bg-accent` ([:14-20](../apps/web/src/components/ui/progress.tsx#L14-L20)).
   Extending the shared component, not forking it. The component itself stays in `features/auth`: one
   use does not earn a shared abstraction (invariant I).
6. **`apps/web/src/app/signup/page.tsx`** — swap the password block for the new component
   ([:120-130](../apps/web/src/app/signup/page.tsx#L120-L130)); parse and enforce `confirmPassword` in
   `signupAction` ([:16-38](../apps/web/src/app/signup/page.tsx#L16-L38)).
7. **`packages/schemas/src/index.ts`** — give `signupSchema` its own password rule plus `confirmPassword`
   with an equality `.refine`, without touching `loginSchema`
   ([:134-141](../packages/schemas/src/index.ts#L134-L141)).
8. **Google as a Supabase auth provider** — client id/secret in env, never in code; the callback URL
   registered for every origin the allow-list accepts. **No OAuth client exists yet.** It has to be
   created in the Google Cloud console (OAuth consent screen + Web application client), and the runner
   has asked to be **walked through it step by step at the point it is needed** — so `/implement` stops
   at this step and guides it interactively rather than assuming it was done. Everything that does not
   depend on real credentials (the action, the button, the error copy, the tests against a mocked
   client) is built and verified first, so the walkthrough is the last thing standing between the branch
   and a working flow.
9. **`apps/web/package.json`** — add `@zxcvbn-ts/core` and `@zxcvbn-ts/language-common`, imported only
   through a dynamic `import()` inside the client component. **`supabase/config.toml`** gains
   `[auth.external.google]` alongside the existing GitHub block: providers are configured in-repo here,
   not only in a dashboard, so the dashboard is not the source of truth for one provider and the file for
   the other.
10. **The GitHub OAuth App's owner** *(configuration, no code)* — GitHub → Settings → Developer settings
    → OAuth Apps → Airrow → **Transfer ownership** → `MS-Flow`. An org owner accepts the transfer.
    `client_id` and `client_secret` survive it, so nothing in Supabase or `.env` changes; confirm by
    signing in with an account that had already authorized and checking it is *not* re-prompted. While
    there, set the app's logo and homepage URL — the same screen renders them, and a blank avatar beside
    a stranger's name is most of why this looked wrong. Like step 8, this is a walkthrough at
    implementation time rather than an assumption that it was done.

11. **The redirect target stays a bare path.** `signInWithGitHubAction` and `signInWithGoogleAction` share
    a `callbackUrl()` that appends nothing to `/auth/callback`, because Supabase's redirect allow-list
    matches exact paths — see implementation note 2. Pre-session failures use a provider-neutral `oauth`
    error in [`login/page.tsx`](../apps/web/src/app/login/page.tsx)'s `ERRORS`.
12. **`apps/web/src/lib/auth.ts` + [`auth/callback/route.ts`](../apps/web/src/app/auth/callback/route.ts)**
    — *the assumption below, corrected during `/implement`.* The callback is **not** provider-agnostic:
    it calls `githubEmailVerified`, which looks for an identity whose `provider === "github"`
    ([auth.ts:183-188](../apps/web/src/lib/auth.ts#L183-L188)). A Google sign-in has no such identity, so
    Google's own `email_verified` claim would never be read — the check would quietly fall through to the
    `email_confirmed_at` fallback, which is exactly the "explicit `false` always blocks" guarantee spec 67
    put there. The route also hardcodes `?error=github` and `github_unverified`, so a Google failure would
    tell the founder GitHub did not complete. Generalise to `providerEmailVerified(user, provider)`,
    resolve the provider from `app_metadata.provider`, and key the error copy off it. The fallback
    behaviour spec 113 relies on is preserved verbatim — only *which* identity is inspected becomes an
    argument.

**No change needed:** the exchange itself (`exchangeCodeForSession`), the unverified-signup purge, and
`attachPendingReferral` — all already provider-neutral.

---

## Implementation notes

Four things the plan did not anticipate, all recorded here rather than reconstructed later (§IV).

1. **The callback was not provider-agnostic.** Covered above as step 11 — the assumption was checked and
   turned out to be false, so the spec was corrected before the code was written.
2. **A failure can happen before there is a session to ask — and the obvious fix was a trap.**
   `oauthProviderOf` reads `app_metadata.provider`, which only exists once the code has been exchanged,
   so a *failed* exchange has nothing to name the provider with. The first implementation put
   `?provider=…` on the redirect target. **`/analyze` caught that this would have broken sign-in for
   both providers.** Supabase matches `redirectTo` against a redirect allow-list — `additional_redirect_urls`
   in [`config.toml:165-171`](../supabase/config.toml) locally, `REDIRECT_URLS` in
   [`sync-supabase-auth.mjs:55-62`](../scripts/sync-supabase-auth.mjs) for the hosted project — and every
   entry in both is an **exact path with no query string and no wildcard**. A target carrying `?provider=`
   stops matching, Supabase refuses the redirect, and because the GitHub action had been routed through
   the same helper, a change that only meant to *add* Google would have taken GitHub down with it.

   Every unit test still passed, because they assert what we hand to `signInWithOAuth` and the failure
   happens inside Supabase. Fixed by dropping the parameter: pre-session failures use a neutral `oauth`
   error that names no provider, and the security-relevant gate uses the session, which was always
   authoritative. **The regression test is
   [`actions.test.ts`](../apps/web/src/features/auth/actions.test.ts)** — asserted to fail before the fix
   (4 failures, both providers) and pass after. One vaguer sentence on a rare path, in exchange for a
   whole class of runtime breakage.
3. **`@zxcvbn-ts/core` v4 has no `zxcvbn` singleton.** The v2 API in every tutorial
   (`zxcvbnOptions.setOptions` + `zxcvbn()`) is gone; v4 exports a `ZxcvbnFactory` class constructed with
   the dictionary. Same dependency, different call.
4. **The Google mark needed the token guard's permission.**
   [`design-tokens.test.ts`](../apps/web/src/components/design-tokens.test.ts) enforces invariant III by
   scanning for hex literals, and a four-colour brand logo is exactly what it is built to catch. Rather
   than loosen the rule, the mark moved to
   [`components/brand/google-mark.tsx`](../apps/web/src/components/brand/google-mark.tsx) — beside the
   other brand assets — and the guard gained a **one-entry allowlist of exact paths**. A pattern would
   have quietly permitted our own colours through anything named `*-mark`; a list of one keeps adding the
   second a deliberate act. Google's colours are fixed by Google's terms and must not follow our theme.

Two smaller ones: `Progress` gained an `indicatorClassName` (its `className` reaches the track, and this
bar changes colour with what it measures), and `Input` now types its props as `ComponentPropsWithRef` so
the password fields can hold the element they set constraint validity on. Both extend the shared
component rather than forking it (§III).

**Docs moved with the code (§IV).**
[`SYSTEM_OVERVIEW.md`](../docs/architecture/SYSTEM_OVERVIEW.md) now names Google alongside GitHub and
records the new password rule; [`SYSTEM_ARCHITECTURE.md`](../docs/architecture/SYSTEM_ARCHITECTURE.md)
said *"email magic link + GitHub OAuth"* — describing a flow that never existed, since magic link was
always the inert button spec 19 designed. Corrected, with a note saying so, rather than quietly
overwritten.

**Submit is blocked through the browser's own constraint validation** rather than by disabling a button
this component does not own. It keeps `/signup` a plain server-action form, and it degrades correctly:
with JavaScript off none of it runs and `signupAction` still refuses.

---

## Data model

**No schema changes.** Google identities are held by Supabase Auth, exactly as GitHub's are.
`supabase/config.toml` gains an `[auth.external.google]` block — configuration, not schema, and the
secret is an `env()` reference as GitHub's already is.

---

## Security

Adds a second OAuth provider on the same validated-redirect path as GitHub, and carries spec 67's rule
with it: an unverified provider email links to nothing, because otherwise anyone able to set that address
on a Google account could claim an existing workspace. Provider error text stops at the server. The password
bar is deliberately split: `signupAction`'s schema decides structure, while the `zxcvbn` score gate is
browser-only — so a client-bypassing POST can still set a structurally valid but guessable password. That
is a recorded trade-off, not an oversight; enforcing the score server-side would put a scoring corpus into
`packages/schemas`, and the founder at risk is the one filling in the form. Requiring four character
classes for new accounts strengthens the weakest link in a workspace without locking out accounts created
under the old rule.

Moving the OAuth App off a personal account is the security half of a cosmetic-looking fix: production
sign-in credentials owned by one individual leave with that individual, and cannot be rotated or revoked
by anyone else. Org ownership puts them where the rest of Airrow's access already lives.

---

## Edge cases

- **A founder with an email+password account signs in with Google on the same verified address** → the
  identities link to the **same account and the same organization**, exactly as spec 67 decided for
  GitHub ([:115-117](67-github-login-import.md)) — the same projects meet them whichever way they came in.
  Locked there by `auth.link.db.test.ts`; the same guarantee is asserted for Google.
- **Password manager autofill** → fills both fields at once; the checklist, bar and match state must
  reflect it without the founder typing a character.
- **Paste into the repeat field** → treated as typing; no paste-blocking, which only trains worse passwords.
- **JavaScript disabled** → the form still posts and the server still refuses a weak or mismatched
  password; the founder loses the live feedback, not the protection.
- **A password at exactly the threshold** → accepted, and the bar says so — the boundary must not disagree
  between the browser and the schema.
- **Google returns no email at all** → treated as a failure with its own sentence; nothing is created.
- **A founder is signed into GitHub as somebody else in that browser** → GitHub offers no account
  chooser, so this stays true after the transfer. Out of our reach, and named here so it is not
  re-reported as the same bug.
- **The org transfer is accepted while a founder is mid-flow** → the authorize URL already issued still
  resolves; `client_id` did not change.

---

## Out of scope

- Forcing existing accounts to rotate a password that would fail the new rule.
- Password reset / "forgot password", which is its own flow and its own issue.
- Breach-corpus checks (Have I Been Pwned k-anonymity) — a good idea, a network call on the signup path,
  and a separate decision.
- Any further provider (Microsoft, SSO), and email enumeration hardening — still the deliberate non-goal
  spec 135 recorded.
- The **GitHub App** used for repository delivery. It is a separate registration from the OAuth App that
  signs founders in, and step 10 does not touch it — but whoever runs that step should check its owner
  too, since the same personal-account problem plausibly applies. That is its own issue.
