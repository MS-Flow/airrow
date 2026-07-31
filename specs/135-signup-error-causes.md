# Spec 135 — Signup says which wall you walked into

> **In one sentence:** Every signup failure currently reads "That email is already registered, or
> signup failed" — a sentence that guesses at one cause, blames the founder for it, and hides the
> evidence the server already had.

|                |                                                      |
| -------------- | ---------------------------------------------------- |
| **Status**     | 🔄 In progress                                        |
| **Issue**      | #135 — "Signup rapporterar varje fel som en redan registrerad e-post, även en rate limit" |
| **Branch**     | `135-signup-error-causes` (from `feature/ui`)         |
| **Feature**    | ui                                                    |
| **Depends on** | [spec 18](18-supabase-auth.md) (the signup flow), [spec 113](113-branded-auth-email.md) (the confirmation mail this rate-limits) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

As a **founder whose signup just failed** I want **to be told what actually stopped it** so that **I know
whether to sign in, wait a few minutes, or that it was not my fault at all.**

---

## Background

- **Today:** `signUp` returns the provider's real message
  ([auth.ts:95](../apps/web/src/lib/auth.ts#L95)), and `signupAction` throws it away —
  `redirect("/signup?error=exists")` ([signup/page.tsx:33](../apps/web/src/app/signup/page.tsx#L33)) —
  whose copy is *"That email is already registered, or signup failed. Try signing in."*
  ([:41-44](../apps/web/src/app/signup/page.tsx#L41-L44)).
- **The problem:** one sentence for every cause, and it names the one that blames the founder. The
  advice it gives — sign in instead — is right for exactly one of them.
- **Found by:** testing spec 122's invite flow. Two accounts created in quick succession, then a third
  from a fresh address: refused, with that message. The address was new; the likely cause is Supabase
  Auth's hourly limit on confirmation mail. "Likely" is the tell — the evidence was discarded before it
  reached the screen, so nobody can be sure. It lands hardest on exactly the flow meant to bring people
  in: a founder testing their own invite link reads a sentence implying they made a mistake.
- **Already in place:** `signIn` shows the shape to copy — it separates `unconfirmed` from a wrong
  password because "saying so saves a support round"
  ([auth.ts:104-112](../apps/web/src/lib/auth.ts#L104-L112)).

---

## Design decision

**A discriminated union, not a string.** `SignUpResult`'s error carries a `reason`
(`already-registered` | `rate-limited` | `unknown`) decided in `auth.ts`, where the provider's codes are
already in hand. The screen maps a reason to a sentence; it never sees provider text. That keeps
Supabase's wording — which changes without notice and is written for developers — out of the product.

**Three sentences, three different pieces of advice.** "Try signing in" belongs only to the address that
already exists. A rate limit is temporary and says so, and offers no sign-in advice, because there is no
account to sign in to. Anything else says plainly that it failed and that trying again is reasonable —
without inventing a cause.

**Match on code first, message second.** Supabase sends `error.code` and an HTTP status; the message is
the least stable of the three. Matching the message as a fallback keeps this working on an older client
that omits the code, and a cause we cannot place lands on `unknown` rather than on a guess.

**Not touched:** what signup does on success, the confirmation flow, and the rate limit itself. This spec
changes what the founder is told, not what happens.

---

## Acceptance criteria

- [x] An address that already exists says so, and suggests signing in.
- [x] A rate-limited signup says it is temporary, and does **not** suggest signing in.
- [x] Any other failure gets a neutral sentence that does not claim the address is taken.
- [x] No provider message reaches the screen.
- [x] The existing outcomes — `signed-in`, `confirmation-required` — are unchanged.
- [x] Typecheck passes; lint adds no new issues; tests green.

### Verification

- **New tests** — [`auth.test.ts`](../apps/web/src/lib/auth.test.ts): six table-driven cases for
  `signUpFailure` (both duplicate codes, the rate-limit code, HTTP 429, and each by message on a client
  that sends no code), plus the one that names the bug — an unrecognised error becomes `unknown` rather
  than "already registered". Two more assert `signUp` returns a reason, including the exact failure that
  started this: a fresh address refused by `over_email_send_rate_limit`.
- **New tests** — [`signup/page.test.tsx`](../apps/web/src/app/signup/page.test.tsx) (6): each reason
  renders its own sentence; the rate-limited one is asserted **not** to contain "try signing in"; the old
  `?error=exists` still renders, for a link somebody already holds.
- **Result:** `pnpm -r typecheck` clean · `pnpm -r lint` clean · `pnpm -r test` **511 passed, 53 skipped**
  (the `*.db.test.ts` suites — local Supabase not running).

---

## Exact changes (file:line)

1. **`apps/web/src/lib/auth.ts`** — add `SignUpFailure` and a `signUpFailure(error)` classifier; widen
   `SignUpResult`'s error arm from `message` to `reason` ([:72-97](../apps/web/src/lib/auth.ts#L72-L97)).
2. **`apps/web/src/app/signup/page.tsx`** — pass the reason through the redirect
   ([:33](../apps/web/src/app/signup/page.tsx#L33)) and give `messages` one entry per reason
   ([:41-44](../apps/web/src/app/signup/page.tsx#L41-L44)).

**No change needed:** `signIn`, the confirmation screen, and every route that reads a session.

---

## Data model

**No schema changes.**

---

## Security

Distinguishing "this address exists" from "too many attempts" confirms that an address is registered —
which today's copy and the sign-in screen already do. No new disclosure, recorded here as a deliberate
choice rather than an accident. Provider error text stops at the server, so nothing internal is echoed to
a visitor.

---

## Edge cases

- **An older Supabase client with no `error.code`** → the message match catches the two known causes;
  anything else is `unknown`.
- **A rate limit hit on the *resend*, not the signup** → out of scope here; the confirmation screen is a
  separate surface.
- **Both causes at once** (existing address *and* rate limited) → whichever Supabase reports wins;
  neither answer misleads.

---

## Out of scope

- Raising or configuring the rate limit, and any retry/backoff in the UI.
- Email enumeration hardening — a deliberate non-goal here, since the current copy already discloses it
  and changing that is a product decision of its own.
