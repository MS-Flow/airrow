# Spec 113 — The verification email comes from Airrow

> **In one sentence:** The first email a founder ever receives from us should say Airrow, on our own
> domain, with words we wrote — not Supabase's default from a database vendor they never heard of.

|                |                                                      |
| -------------- | ---------------------------------------------------- |
| **Status**     | 🔄 In progress                                        |
| **Issue**      | #113 — "Verifieringsmejlet ska komma från Airrow, inte från Supabase" |
| **Branch**     | `113-branded-auth-email` (from `feature/infrastructure`) |
| **Feature**    | infrastructure                                        |
| **Depends on** | nothing blocking — but the dev-environment check needs a working dev hostname (see _Edge cases_) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

_Who wants this, and what they get out of it._

As a **founder signing up for Airrow** I want **the verification email to come from Airrow, on Airrow's
domain, and to arrive reliably** so that **I trust the product enough to finish signing up instead of
hunting through spam for a message from a vendor I do not recognise.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today:** `[auth.email.smtp]` in [supabase/config.toml](../supabase/config.toml) is commented out
  entirely, and `supabase/templates/` does not exist. With no SMTP of our own, Supabase sends through its
  built-in service — its domain, its sender name, its subject, its template. None of it is ours.
- **The problem:** two things follow from that, and the second is worse than the cosmetic one.
  Supabase's built-in mailer is explicitly not for production and is hard rate-limited (compare
  `email_sent = 2` per hour in the local config). A founder whose email never arrives does not come back.
- **Already in place:** the signup flow itself works and already handles the confirm state — a hosted
  project ships *Confirm email* on, so signup creates the account without a session and the UI routes to
  "Confirm your email" ([apps/web/src/app/signup/page.tsx](../apps/web/src/app/signup/page.tsx)).
  Everything past that point depends on an email we do not control.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

**Resend as the provider, wired in as plain SMTP.** Supabase's `[auth.email.smtp]` speaks SMTP, so Resend
needs no integration code — a host, a port, and an API key as the password. It authenticates the sending
domain through DNS records, and its free tier covers our volume with room to spare. Nothing about this
choice leaks into application code, so swapping providers later is a config change, not a refactor.

**The repo owns the template; a script pushes it to cloud.** `supabase/templates/*.html` plus
`[auth.email.template.confirmation]` in `config.toml` governs the **local** stack only — the hosted
project's subject and body are dashboard fields. Rather than documenting a paste step, a script under
`scripts/` reads the versioned template and pushes it to the linked project through the Supabase
Management API (`PATCH /v1/projects/{ref}/config/auth`, the `mailer_subjects_confirmation` /
`mailer_templates_confirmation_content` fields — `/implement` confirms the exact names against the current
API). The repo is the source of truth and the cloud copy is derived from it.

That is deliberately the same shape as [spec 77](77-auto-apply-migrations.md), and for the same reason: a
fact that lives in two places and is kept in step by someone remembering a command is a fact that will
drift. Spec 77 was written because that had already cost us once. A documented paste step would be
cheaper and would reproduce the bug.

**One environment problem this uncovers.** The confirmation link's host comes from the project's Site URL,
a single per-project value — and Production and Preview share one Supabase project today. Signing up on
`dev.airrow.app` would therefore mail a link pointing at production. The fix is not a second project: it
is passing `emailRedirectTo` per request, derived from the request host, which is exactly the pattern
[spec 67](67-github-login-import.md) already established for the OAuth callback. `signUp` does not pass it
today ([apps/web/src/lib/auth.ts:83-87](../apps/web/src/lib/auth.ts#L83-L87)), so that is a real code
change in this spec rather than a configuration detail.

**Not touched:** the other transactional emails (password reset, email change, invites) — the same SMTP
carries them, but their content is its own issue. Nothing about marketing or notification email. And no
template engine: this is an HTML file, not a system.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [ ] The verification email is sent from an Airrow address on our own domain, with Airrow as the sender
      name — verified by receiving one, not by reading config. _(Code and config in place; needs the
      Resend account, the DNS records and the dashboard SMTP fields — see Implementation notes.)_
- [x] Subject and body are ours and versioned in the repo, not Supabase's default.
      [supabase/templates/confirmation.html](../supabase/templates/confirmation.html), wired through
      `[auth.email.template.confirmation]`.
- [x] The link in the email resolves to the environment the founder signed up on — `airrow.app` from
      production, `airrow-dev.vercel.app` from dev — and never to `localhost`. `emailRedirectTo` is
      derived per request and the host checked against an allow-list, so an unlisted one falls back to
      production rather than being followed. 13 tests in
      [apps/web/src/lib/site-url.test.ts](../apps/web/src/lib/site-url.test.ts).
- [x] The template that cloud sends is the one committed in the repo, and keeping them in step is not a
      manual step: [scripts/sync-auth-email-templates.mjs](../scripts/sync-auth-email-templates.mjs)
      pushes it, and refuses to push an empty template or one that lost its confirmation link.
- [ ] The sending domain is authenticated — SPF and DKIM, plus DMARC if the provider supports it — so the
      mail is not filed as spam. _(DNS step; the exact records come from Resend once the domain is added.)_
- [ ] Sending is no longer capped by Supabase's built-in limit. _(Follows from the SMTP switch above.)_
- [x] SMTP credentials live in the Supabase project configuration and, where CI needs them, in GitHub
      Secrets — never in the repo, never in logs, never in generated output. `config.toml` reads
      `env(RESEND_API_KEY)`; the sync script takes its token from the environment and never echoes it.
- [x] [docs/guides/INFRASTRUCTURE_SETUP.md](../docs/guides/INFRASTRUCTURE_SETUP.md) documents the setup in
      the same change (constitution §IV), separating the dashboard steps from what is versioned. New §6
      _Auth email (Resend)_ carries the six setup steps and says plainly that the dashboard template is
      derived; the *Email confirmation* note now points at it instead of standing alone.
- [x] Local development is unaffected: `enable_confirmations = false` and the local inbox still apply to
      the local stack, and no real email is sent from a developer machine. `[auth.email.smtp]` stays
      **commented out**, so `[local_smtp]` on port 54324 keeps catching mail — see the correction in
      Implementation notes.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **Manual, and it has to be:** sign up with a real address against the dev environment and read the
  received message — sender, subject, body, and the link's target host. Nothing short of receiving it
  proves the delivery path.
- **New tests** — `apps/web/src/lib/auth.test.ts`: `signUp` passes an `emailRedirectTo` built from the
  request host, and rejects or refuses to build one for a host that is not allow-listed. The file already
  mocks `supabase.auth.signUp`, so the assertion is on the options it receives. This is the one part of
  the change that is real code rather than configuration, and it is the part that can silently send a
  founder to the wrong environment.
- **New tests** — the sync script under `scripts/`, run by `pnpm test:scripts` (spec 53): the template is
  read and the request body is assembled as expected, with the network call injected. What cannot be
  tested without touching the live project is the call itself.
- Deliverability checked against the provider's own domain report (SPF/DKIM/DMARC all passing).
- Full suite result + typecheck/lint status.

---

## Implementation notes

**What shipped** — the whole code-and-config half; what remains is account and DNS work.

1. [apps/web/src/lib/site-url.ts](../apps/web/src/lib/site-url.ts) (new) — derives the origin from the
   request and checks the host against an allow-list. Pure `allowedOrigin` + a thin `requestOrigin`
   shell, so the security-relevant part is testable without a request.
2. [apps/web/src/lib/auth.ts](../apps/web/src/lib/auth.ts) — `signUp` takes and passes
   `emailRedirectTo`, matching how `signInWithGitHub` already takes its `redirectTo`.
3. [apps/web/src/app/signup/page.tsx](../apps/web/src/app/signup/page.tsx) — derives it and passes it.
4. [apps/web/src/app/auth/confirm/route.ts](../apps/web/src/app/auth/confirm/route.ts) (new) — where the
   link lands, plus `confirm` in the login page's error map for an expired or reused link.
5. [supabase/templates/confirmation.html](../supabase/templates/confirmation.html) (new) +
   `[auth.email.template.confirmation]` and two `additional_redirect_urls` entries in
   [supabase/config.toml](../supabase/config.toml). `[auth.email.smtp]` is documented there but
   commented out — see the correction below.
6. [scripts/sync-auth-email-templates.mjs](../scripts/sync-auth-email-templates.mjs) (new) + its test.
7. `docs/guides/INFRASTRUCTURE_SETUP.md` §6 and `apps/web/.env.example`.
8. [apps/web/vercel.json](../apps/web/vercel.json) — the `noindex` host rule, plus the runbook lines that
   named the wrong dev hostname. Outside the original scope; see the note below for why it is here.

**Three decisions the spec did not anticipate.**

- **A separate `/auth/confirm` route, not `/auth/callback`.** Reusing the GitHub callback would have
  worked today: for an email signup `githubEmailVerified` finds no GitHub identity and falls back to
  `email_confirmed_at`, which is set. But that route exists to apply a rule Supabase does not — the
  provider must have verified the address — and it *deletes the account* when the rule fails
  ([route.ts](../apps/web/src/app/auth/callback/route.ts)). Pointing a second flow with different rules
  at that logic is the kind of coupling that is fine until someone edits one of the two flows.
- **The allow-list replaced the existing header-reading helper rather than sitting beside it.**
  `callbackUrl()` in `features/auth/actions.ts` derived the OAuth callback from the Host header with no
  check at all. Writing a second deriving function would have duplicated it (CLAUDE.md forbids that) and
  left the older path unchecked, so both now go through `@/lib/site-url`. The OAuth path gains the
  allow-list as a side effect — a tightening, not a behaviour change for any host we answer on.
- **Unlisted hosts fall back to production instead of erroring.** Sending a founder to the canonical
  site is a nuisance; sending them nowhere is a broken signup. Previews are allowed by `.vercel.app`
  suffix because their hostnames cannot be enumerated in advance, and the lookalike cases
  (`airrow.app.evil.example.com`, `notairrow.app`, `evil-vercel.app`) are tested.

**Deliberately left for the dashboard, and unprovable in a diff:** creating the Resend account, adding
`airrow.app` there, publishing the DKIM records, filling the SMTP fields, and adding the production
redirect URL. §6 of the runbook is the checklist. Until they are done the app still signs founders up —
mail simply keeps coming from Supabase, exactly as before, so nothing regresses in the meantime.

**No open dependency on the dev hostname.** The dev environment is `airrow-dev.vercel.app` (verified
serving 200 on 2026-07-30), not the `dev.airrow.app` branch domain the runbook describes, which is not
attached. Both are allow-listed, so end-to-end verification can run on dev as it stands.

**Carried in from outside this spec's scope: the dev environment was indexable.**
[apps/web/vercel.json](../apps/web/vercel.json) sent `X-Robots-Tag: noindex` only for host
`dev.airrow.app` — a host that does not exist — so the header never applied anywhere, and
`airrow-dev.vercel.app` returned no `X-Robots-Tag` at all. Unpublished copy and half-built screens were
open to search engines, with a dev URL free to compete with `airrow.app` in results.

Found while establishing which hostname the confirmation link should use, and fixed here on request. The
`has` condition became a host regex (`dev.airrow.app` or any `*.vercel.app`) rather than a second list
entry, because Vercel **AND**s multiple `has` items — two host entries would have required both at once
and matched nothing. Stating it as "everything except production is noindex" is also the invariant that
does not rot: the original rule named one hostname and silently did nothing when reality moved.

`vercel.json` takes no comments, so the reasoning lives here and in
[INFRASTRUCTURE_SETUP.md](../docs/guides/INFRASTRUCTURE_SETUP.md) §3, whose branch→URL table claimed
`dev.airrow.app` as the stable dev URL — the stale line that let the rule be written against the wrong
host in the first place. That table, §5's verification step, and the migrations section's aside now all
name the real hostname.

**Not verified yet:** the header itself. It is Vercel routing, so it only proves out on a deploy — and
this branch's own preview is a `*.vercel.app` host, which the new rule covers. `curl -I` on the preview
URL after pushing is the check; `/analyze` should not close this spec until that has been run.

**Corrected during `/analyze`: `[auth.email.smtp]` must not be enabled in `config.toml`.** The first cut
set `enabled = true` there and claimed the block was "inert" without a key. It is not. That file
configures the **local** stack, where enabling SMTP overrides `[local_smtp]` — the mail catcher on port
54324 — so a developer with no `RESEND_API_KEY` would get failed sends instead of a local inbox, and one
with a key would mail real people from their laptop. Exactly the opposite of the criterion it was meant
to satisfy. The block is now commented out with the reason, the hosted project is configured through the
dashboard as it always was, and `.env.example` and §6 say the same thing.

Worth naming how this was missed: Docker was unavailable, so `supabase start` could never have caught it,
and nothing in the test suite reaches the local stack's mail configuration. It was found by reading the
diff against `[local_smtp]` — which is the argument for `/analyze` reading the diff rather than trusting
the implementation's own summary.

**Verification run** (2026-07-30, local): `pnpm -r typecheck` clean · `pnpm -r lint` clean ·
`pnpm -r test` **525 passed / 28 skipped** (42 files in `apps/web`, 8 in `packages/engine`, 2 in
`packages/schemas`) · `pnpm test:scripts` **61 passed** (3 files) — no failures; the skips are
pre-existing. `node scripts/sync-auth-email-templates.mjs --dry-run` assembles both fields from the
committed template and sends nothing.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

Shape settled; `/implement` grounds each line in exact `file:line`.

1. **`supabase/templates/confirmation.html`** (new) — the confirmation email, ours. Plain HTML, no engine.
2. **`supabase/config.toml`** — `[auth.email.template.confirmation]` pointing at it, and
   `[auth.email.smtp]` for Resend with the key read from the environment, never inline
   ([:242-250](../supabase/config.toml) is the commented block to replace).
3. **`scripts/sync-auth-email-templates.mjs`** (new) + its test — read the template, push subject and body
   to the linked project via the Management API. The repo stays the source of truth.
4. **`apps/web/src/lib/auth.ts`** — `signUp` passes `emailRedirectTo` derived from the request host
   ([:83-87](../apps/web/src/lib/auth.ts#L83-L87)), following the OAuth-callback pattern spec 67 set.
5. **`supabase/config.toml`** — add the confirmation callback to `additional_redirect_urls`
   ([:165-169](../supabase/config.toml)) so the local hosts are accepted.
6. **`docs/guides/INFRASTRUCTURE_SETUP.md`** — document the Resend setup, the DNS records and who adds
   them, the three env values, and the sync script. The *Email confirmation* note under
   _Notes & constraints_ is rewritten rather than left standing.

**Dashboard rather than diff:** creating the Resend account, verifying the domain, and adding the DNS
records. The spec names them because a reviewer cannot see them in the diff — and the DNS step is not ours
to perform (see _Edge cases_).

---

## Data model

**No schema changes.** Auth email delivery is configuration; it stores nothing of ours.

---

## Security

Two credentials able to act as Airrow enter the picture: the **Resend API key** (used as the SMTP password,
so anyone holding it can send mail that looks exactly like ours) and, for the sync script, a **Supabase
Management API token** that can rewrite the project's auth configuration. Both live in the environment —
the Resend key in the Supabase project's SMTP fields and `apps/web/.env.local`, the management token
wherever the script is run — and never in `config.toml`, which is committed. The blast radius of the first
is our domain reputation; of the second, our auth configuration.

`emailRedirectTo` is derived from the request host, which is attacker-influenceable, so it must be checked
against an allow-list before use — an open redirect here would mail a founder a link to someone else's
site carrying a valid confirmation token. Supabase's own `additional_redirect_urls` is the backstop, but
the check belongs in our code too (defence in depth, as with tenancy). The template renders only values
Supabase supplies and must not be extended to interpolate anything user-controlled.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- **DNS is available again.** Access to `airrow.app` was recovered on 2026-07-30, so the DKIM/SPF records
  Resend asks for can be added directly — no hand-off, no support ticket. Verified the same day:
  `airrow.app` serves 200 from Vercel and `www.airrow.app` 307s to the apex. `/implement` should still
  write the exact record list into the runbook, because adding them is dashboard work a reviewer cannot
  see in the diff.
- **The dev environment is `airrow-dev.vercel.app`, not `dev.airrow.app`.** The branch domain the runbook
  describes ([INFRASTRUCTURE_SETUP.md](../docs/guides/INFRASTRUCTURE_SETUP.md) §3) is not attached — it
  answers `404` — while `airrow-dev.vercel.app` serves the app and is stable. Both are allow-listed, so
  this keeps working if the branch domain is attached later. Attaching it belongs to
  [spec 12](12-vercel-domains.md).
- **A founder signs up twice** → the second mail must not be swallowed by a rate limit that is stricter
  than the founder's patience.
- **The provider is down** → signup still creates the account; the founder can request a new mail rather
  than being stuck with an unusable account.
- **A developer runs the app locally** → mail goes to the local inbox, never to a real address.

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- Password reset, email change and invite emails — same infrastructure, own issue.
- Marketing and notification email.
- Building a template system. One HTML file per message is the ceiling here.
- A separate staging Supabase project, unless the third criterion forces it.
