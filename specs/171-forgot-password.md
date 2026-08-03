# Spec 171 — Forgot password, and changing your credentials

> **In one sentence:** A founder who forgets their password can get back in through an emailed link, and
> one who is already signed in can change their password or their login address from Settings.

|                |                                                                        |
| -------------- | ---------------------------------------------------------------------- |
| **Status**     | ✅ Done — bar green; two manual checks named below stay open             |
| **Issue**      | #171 — "Forgot password, and changing your password or email once you're in" |
| **Branch**     | `171-forgot-password` (from `feature/ui`)                               |
| **Feature**    | UI                                                                     |
| **Depends on** | [`18-supabase-auth`](18-supabase-auth.md) · [`113-branded-auth-email`](113-branded-auth-email.md) · [`140-auth-google-password`](140-auth-google-password.md) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!-- Status legend: ⏳ Not started · 🔄 In progress · ✅ Done -->

---

## User story

As a **founder** I want **to reset a forgotten password by email, and to change my password or login
address from Settings** so that **losing or wanting to change a credential is a two-minute detour rather
than the end of my account.**

---

## Background

- **Today:** `/login` offers email + password, GitHub and Google, and nothing else
  ([login/page.tsx:74-94](../apps/web/src/app/(public)/login/page.tsx#L74-L94)). There is no way to
  recover a forgotten password — `lib/auth.ts` has `signUp`, `signIn`, `signOut` and `updateName`, and no
  password or email mutation at all ([lib/auth.ts:211-383](../apps/web/src/lib/auth.ts#L211-L383)).
- **The problem:** a founder who forgets their password has lost the account. Settings makes it explicit
  and final — the email field is `disabled` under "Email is managed by your account sign-in and can't be
  changed here" ([settings/page.tsx:100-106](../apps/web/src/app/app/settings/page.tsx#L100-L106)) — and
  there is no password control beside it.
- **Already in place:** the whole of the machinery this needs.
  - `/auth/confirm` is the pattern for an emailed link: exchange the code for a session, redirect, and
    treat an expired link as ordinary ([auth/confirm/route.ts](../apps/web/src/app/auth/confirm/route.ts)).
  - `requestOrigin()` derives the redirect target per request, because one Supabase project serves dev and
    production ([lib/site-url.ts](../apps/web/src/lib/site-url.ts), spec 113).
  - `PasswordFields` already renders the checklist, strength bar, reveal toggle and repeat field
    ([features/auth/PasswordFields.tsx](../apps/web/src/features/auth/PasswordFields.tsx)), against
    `PASSWORD_RULES` in `packages/schemas`.
  - `scripts/sync-supabase-auth.mjs` pushes the branded email templates and the redirect allow-list to the
    hosted project, and says in as many words that the password-reset template is "a row plus its HTML
    file" away ([:31-41](../scripts/sync-supabase-auth.mjs#L31-L41)).

---

## Design decision

Three flows over one shared password form. `/forgot-password` sends the mail; the link lands on a new
`/auth/reset` route handler that exchanges the code, marks the session as a recovery with a short-lived
httpOnly cookie, and drops the founder on `/app/password`. That page and the Settings card render the
**same** component and post to the **same** server action, and the action decides server-side whether the
current password is required: it is, unless the recovery cookie says the founder just proved control of
the mailbox. Changing the login address goes through the same action shape and does not take effect until
the new address confirms.

**Not touched:** `/auth/confirm` is reused verbatim for the email-change confirmation rather than given a
sibling — the code exchange is identical, and `attachPendingReferral` already refuses accounts older than
ten minutes, so an established founder confirming a new address can never spend an invite
([referrals/attach.ts:22-49](../apps/web/src/features/referrals/attach.ts#L22-L49)). No new middleware
matcher entry: `/app/password` is inside `/app` and therefore already gated, and `/auth/reset` is
deliberately outside it like the other two auth routes, because there is no session on arrival.

---

## Acceptance criteria

- [x] `/login` links to `/forgot-password`; the page takes an address and mails a reset link — **tested**
- [x] The response is identical whether or not the address has an account — no enumeration oracle.
      `sendPasswordReset` returns `void`, so no caller can branch on the outcome — **tested**
- [x] The link's `redirectTo` is derived per request via `requestOrigin()`, so a dev signup gets a dev
      link — **tested**
- [x] `/auth/reset` exchanges the code and lands on the change-password screen; an expired or reused link
      returns to `/login` with a reason and an offer to send another — **tested**
- [x] The new password is validated by the signup rule (`PASSWORD_RULES`), with the same checklist,
      strength bar and repeat field the signup form uses — **tested** (schema + reused `PasswordFields`)
- [x] After a reset the founder is signed in and every other session is revoked — **tested**
      (`signOut({ scope: "others" })`)
- [x] Settings has a **Password** card that changes the password, requiring the current one — **tested**
- [x] The current password is verified **server-side**, and a recovery cookie is the only thing that
      waives it — never a form field — **tested**
- [x] Settings has an **Email** card; the address changes only after the new address confirms, and the
      screen says so before submitting — **tested**
- [x] An account with no password (GitHub/Google only) is offered "set a password" by email rather than a
      current-password field it cannot fill — **tested**
- [x] Recovery is not a way around a suspension: `/app/password` goes through `requireSession()`, whose
      per-request read redirects a suspended account to `/app/suspended` — **tested** (that the page calls
      it; the redirect itself is spec 164's own test)
- [x] The reset and email-change emails are Airrow's own templates, pushed by
      `scripts/sync-supabase-auth.mjs` alongside the confirmation one, with the new redirect targets in
      both allow-lists (hosted script + local `config.toml`) — **tested**
- [x] Typecheck passes; lint adds no new issues; tests green (one pre-existing engine failure, below).
- [ ] End to end against a running app: request a link, open the mail, set a password, sign in with it —
      **manual** (needs a deployment with SMTP; the hosted project also needs
      `node scripts/sync-supabase-auth.mjs` run once so the new templates and `/auth/reset` are allowed).
- [ ] The GitHub/Google-only "email me a link to set one" path, end to end — **manual**. It sends the
      ordinary recovery mail, and whether Supabase issues one for an account with no `email` identity
      cannot be proved against a mock. If it does not, the fallback is `generateLink`/an invite flow.

### Verification

- **New tests**
  - `packages/schemas/src/password.test.ts` — the new-password and email-change schemas.
  - `apps/web/src/lib/auth.test.ts` — `sendPasswordReset` passes the derived `redirectTo`; `updatePassword`
    revokes other sessions; `changeEmail` passes `emailRedirectTo`; `hasPassword` reads the email identity.
  - `apps/web/src/app/auth/reset/route.test.ts` — code exchanged → redirect to `/app/password` with the
    recovery cookie set; missing/invalid code → `/login?error=reset`, no cookie.
  - `apps/web/src/features/auth/credentials.test.ts` — the actions: wrong current password refuses;
    absent current password refuses without the recovery cookie and succeeds with it; the cookie is
    cleared after use; a mismatched repeat refuses.
  - `apps/web/src/app/(public)/forgot-password/page.test.tsx` — the same answer for a known and an unknown
    address.
  - `scripts/sync-supabase-auth.test.mjs` — the recovery/email-change templates are pushed, and every
    redirect target is in the allow-list.
- Suspension: covered by `requireSession()` on `/app/password` — the per-request database read is the
  enforcement (spec 164), asserted in the page test.
- **Run 2026-08-02:** `pnpm -r typecheck` ✓ · `pnpm -r lint` ✓ · `pnpm --filter web test` ✓ (101 files,
  990 tests) · `pnpm --filter @airrow/schemas test` ✓ (94) · `pnpm test:scripts` ✓ (89).
  **Pre-existing failure, untouched by this change:** `packages/engine/src/security-command.test.ts` →
  "keeps the report out of version control, and says why" — a wrapping mismatch between the test's
  expected string and `template/commands/security.md`. No file under `packages/engine/` or `template/` is
  modified here.
- `next build` ✓ — `/forgot-password`, `/auth/reset` and `/app/password` all bundled.

## Implementation notes

- **The recovery cookie is the whole design.** One password form serves two arrivals, and what separates
  them is `airrow_recovery` — httpOnly, 15 minutes, set only by `/auth/reset` after a real code exchange
  and cleared the moment it is spent. The alternative considered and rejected was a second screen outside
  `/app`: it would have been reachable by a signed-in founder directly, which is a password change with no
  current password at all.
- **Two message maps, not one.** Settings renders both cards from one query string, so a shared map put
  every answer under both of them — "open the link we sent to the new address" appeared above the password
  form. Every email-side key now carries the `email-` prefix its action redirects with. Found by the test
  that asserts a single `role="alert"`.
- **`/auth/confirm` is reused for the email change** rather than given a sibling: the exchange is
  identical, and `attachPendingReferral` ignores accounts older than ten minutes, so an established
  founder confirming a new address cannot spend an invitation. One fewer entry in both allow-lists.
- **Found by `/analyze`, and fixed:** a successful reset redirected to `/app?status=password-changed`,
  and the dashboard takes no `searchParams` ([app/page.tsx:16](../apps/web/src/app/app/page.tsx#L16)) — so
  the one confirmation a locked-out founder needs, *it worked and the other sessions are gone*, was
  dropped on arrival. Both paths now land on Settings, where the Password card renders it, and a test
  asserts the target rather than only the side effects.
- **`sendPasswordReset` returns `void` deliberately.** A `Result` would have let some later caller render
  the difference between "sent" and "no such account", which is the oracle this flow exists to avoid. The
  failure is logged for us, without the address.
- **Deployment step:** the hosted Supabase project needs `node scripts/sync-supabase-auth.mjs` once —
  until then `/auth/reset` is not in its allow-list and reset links are refused on arrival.
- **Closed with two boxes unticked, deliberately.** Both are end-to-end checks that need a deployment
  with SMTP; ticking them would put a claim in the record that nobody has verified. Same shape as
  [spec 18](18-supabase-auth.md), whose manual criteria stayed open when it closed. Everything provable
  without a live mailbox is tested and green.

---

## Exact changes (file:line)

1. **`packages/schemas/src/index.ts`** — export `newPasswordSchema`; add `passwordResetRequestSchema`,
   `passwordChangeSchema` (password + confirm, matched) and `emailChangeSchema` beside `signupSchema`.
2. **`apps/web/src/lib/auth.ts`** — add `sendPasswordReset`, `verifyPassword`, `hasPassword`,
   `updatePassword` and `changeEmail`, in the shape of the existing result unions.
3. **`apps/web/src/app/(public)/forgot-password/page.tsx`** (new) — the request form and its
   `?status=sent` state, modelled on `/signup`'s `check-inbox` screen.
4. **`apps/web/src/features/auth/recovery.ts`** (new) — the `airrow_recovery` cookie: shape, read, clear.
5. **`apps/web/src/app/auth/reset/route.ts`** (new) — exchange, set the marker, redirect.
6. **`apps/web/src/features/auth/credentials.ts`** (new) — `changePasswordAction`, `changeEmailAction`
   and `sendPasswordSetupAction`, with the closed set of two return targets.
7. **`apps/web/src/features/auth/CredentialCards.tsx`** (new) — the Password and Email cards and their
   two message maps.
8. **`apps/web/src/features/auth/PasswordFields.tsx`** — an optional `label`, so "New password" can sit
   beside a current-password field without both being called the same thing.
9. **`apps/web/src/app/app/password/page.tsx`** (new) — the recovery landing; the same card, and a notice
   when the marker is absent because the link was spent.
10. **`apps/web/src/app/app/settings/page.tsx`** — the disabled email field gives way to the two cards.
11. **`apps/web/src/app/(public)/login/page.tsx`** — the "Forgot password?" link and a `reset` error.
12. **`supabase/templates/recovery.html`**, **`email-change.html`** (new) — from `confirmation.html`.
13. **`supabase/config.toml`** — the two template blocks and the local redirect URLs.
14. **`scripts/sync-supabase-auth.mjs`** — two `TEMPLATES` rows and the `/auth/reset` allow-list entries.
15. **`docs/architecture/UI_ARCHITECTURE.md`**, **`docs/guides/INFRASTRUCTURE_SETUP.md`**,
    **`specs/README.md`**, **`specs/18-supabase-auth.md`** — the new routes on the map; the runbook's
    "the email template" now names all three; this spec listed; #18's "no password reset" gap closed.

**No change needed:** `middleware.ts` — `/app/password` is already matched by `/app/:path*`, and
`/auth/reset` is correctly outside it.

---

## Data model

**No schema changes.** Passwords and addresses live in `auth.users`, which Supabase owns; `profiles` holds
neither, so nothing in the DataStore needs a matching write and no RLS surface changes.

---

## Security

Opens two credential mutations to the signed-in founder and one unauthenticated mail-send. The mutations
require the current password, verified server-side against Supabase; the only waiver is a short-lived
httpOnly recovery cookie set exclusively by `/auth/reset` after a real code exchange — a form field never
decides it. The send answers identically for known and unknown addresses, so it cannot be used to
enumerate accounts, and a successful reset revokes every other session.

---

## Edge cases

- Unknown address → the same "check your inbox" screen; nothing sent, nothing revealed.
- Expired / already-used link → `/login?error=reset`, with the way to request another.
- Rate-limited by Supabase → says so plainly, without claiming the address does or doesn't exist.
- GitHub/Google-only account → "set a password" by email; no current-password field.
- Suspended account resets its password → succeeds, then `/app/suspended` like every other `/app` route.
- New email already belongs to another account → the change is refused and the old address stays live.
- Founder abandons an email change → nothing happens; the address changes only on confirmation.
- Recovery cookie present but stale (>15 min) → expired by the browser; the current password is required.

---

## Out of scope

- Two-factor / TOTP, passkeys, and device/session management beyond the revoke-on-reset above.
- Unlinking a GitHub or Google identity.
- Email deliverability changes; sending stays the Resend SMTP configured by spec 113.
