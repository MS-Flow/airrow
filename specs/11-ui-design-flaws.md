# Spec 11 — Fix UI design flaws

> **In one sentence:** Six fixes to the v1 UI — a bigger logo on the landing page, a theme switch in
> both headers, a logo that goes home and a profile menu that goes to your projects, a sidebar
> stripped to what exists, and an interview a visitor can complete **before** signing up, which then
> becomes their first project when they do.

|                |                                                                    |
| -------------- | ------------------------------------------------------------------ |
| **Status**     | ✅ Done                                                            |
| **Issue**      | #11 — "fix ui design flaws"                                        |
| **Branch**     | `11-ui-design-flaws` (from `feature/ui`)                           |
| **Feature**    | UI                                                                 |
| **Depends on** | [`19-premium-ui-system`](19-premium-ui-system.md) — the design system, shell and screens this spec corrects. [`18-supabase-auth`](18-supabase-auth.md) — the session and signup flow that F6 hooks into. |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
F1–F5 are UI corrections. F6 (anonymous interview + claim-on-signup) is a product change with its own
data flow and security surface; it landed in the same branch on the founder's instruction ("fixa allt").
-->

---

## User story

_Who wants this, and what they get out of it._

As a **founder who just landed on airrow.app** I want **to try the whole interview before committing to
an account, and to move around the product without dead ends** so that **I can judge Airrow on the work
it does, not on a signup wall** — and as the **team building Airrow** we want **the shell to show only
what exists** so that **nothing in the UI promises a screen we haven't built.**

---

## Background

_How things work today and what's wrong with that — grounded in real code._

- **Before this spec:** [`19-premium-ui-system`](19-premium-ui-system.md) rebuilt the product on one
  design system. The landing page, the app shell (`Sidebar` + `TopBar` + `UserMenu`) and all routes
  were built on it and merged into `feature/ui`.
- **The problem:** a set of concrete defects the founder found walking the product — F1–F6 below. Four
  were placement/sizing mistakes in the shell; one was navigation that dead-ended; one was a real
  product gap where the signup wall sat in front of the thing that sells the product.
- **Already in place, and reused rather than rebuilt:**
  - **Light theme was fully built.** `globals.css` defines both `:root[data-theme="dark"]` and
    `:root[data-theme="light"]`, and `.brand-asset` compensates the silver logo on light backgrounds.
    [`lib/theme.ts`](apps/web/src/lib/theme.ts) reads the theme from the `airrow-theme` cookie
    server-side so the first paint is correct. It is a **cookie**, not account state — so F2 needed
    placement, not new theming.
  - `AirrowLogo` already took `size="sm" | "md" | "lg"` → `h-5 / h-7 / h-10`.
  - `NAV_ITEMS` is the single source for both the sidebar and the command palette, so F5 was one edit.
  - The interview runtime was already driven by pure schema helpers (`visibleQuestions`,
    `firstUnanswered`, `pruneHiddenAnswers`), touching the server only through two actions — which is
    what made F6 feasible without forking it.

### The flaws

| # | Where | What was wrong | What it is now |
|---|-------|----------------|----------------|
| **F1** | Landing `/` | Header lockup `size="sm"` (`h-5`); hero mark `h-16 md:h-20`. Both read small for the first screen. | Header `size="md"` (`h-7`); hero `h-24 md:h-32`. |
| **F2** | Landing `/` **and** app shell | The theme switch existed only on `/app/settings`, and `setThemeAction` called `requireSession()` — a signed-out visitor could not change theme at all. | Compact switch top-right in both headers; the action is unauthenticated by design. |
| **F3** | App shell | The sidebar logo linked to `/app` — clicking it inside the app did nothing visible, and there was no way back to the landing page. | Logo links to `/`, and `/` renders a signed-in header. |
| **F4** | App shell | `UserMenu` sat in the sidebar footer, not top-right. Its only links were Settings and Sign out. | Avatar menu top-right in the app bar **and** the landing header, with a Projects link. |
| **F5** | Sidebar | `Templates` and `Prompts` sat alongside Projects, pointing at placeholder screens. | Removed from nav, palette and routes. |
| **F6** | Interview | The whole interview was behind the auth gate: middleware guards `/app/:path*`, and the page plus both actions called `requireSession()`. A visitor had to create an account before seeing one question. | `/start` runs the full interview signed out; only **Generate** requires an account, and the answers survive signup. |

### Second round

A second walkthrough after F1–F6 landed produced eight more, six cosmetic and two real defects.

| # | Where | What was wrong | What it is now |
|---|-------|----------------|----------------|
| **F7** | Settings | The theme control offered a third, dead "System — coming soon" option. | Two real options. Dark is what you get until you pick light. |
| **F8** | Sidebar | The logo sat at `px-4` while the nav links sit at `px-3` + `px-2.5` — 6px off the line of "Projects" and "Settings". | The logo mirrors the nav's insets and lines up. |
| **F9** | App top bar | A decorative `⌘K` chip sat top-right, competing with the real actions. | Removed. The shortcut itself still works. |
| **F10** | Landing | Signed in, "Open dashboard" was a muted `ghost` button — the page's real action, styled as an afterthought. | Primary button with an arrow. |
| **F11** | Landing | Pricing invented three tiers, two priced "TBD" — implying a paywall that isn't built. | One free tier stating what's included. |
| **F12** | Landing | The header lockup was still small at `size="md"`. | `size="lg"` (`h-10`). |
| **F13** | App shell | **Sign-out did nothing.** Radix closes the menu on select, which unmounted the form before the browser dispatched its submit event. | `onSelect` prevented; the form survives the click. |
| **F14** | Auth | Every `/app` navigation cost **three** auth round-trips (middleware + layout + page) plus duplicate org and project queries, because layout and page each called `requireSession()` independently. | One `getUser()` per request, one org lookup, one project query; the middleware gate verifies the JWT locally. |

### Third round

| # | Where | What was wrong | What it is now |
|---|-------|----------------|----------------|
| **F15** | Login / signup | The lockup was `size="md"`, small for a page that is nothing but a logo and a card. | `size="lg"`. `/start` follows, since its header is the landing header. |
| **F16** | Landing footer | The lockup used the default `size="sm"` (`h-5`). | `size="md"` — larger, without competing with the header. |
| **F17** | App sidebar | The rail's lockup was also the default `h-5`, and it changed size when the rail collapsed. | Both states render at `h-7`: `size="md"` expanded, the mark at `h-7` collapsed. Collapsing drops the wordmark without resizing the logo. |
| **F18** | Project workspace | A **Documentation** reader sat beside the file browser, rendering the same generated `docs/*.md` the preview already shows — two views of one thing. | Removed. Preview is the single way into the output. |
| **F19** | After generation | Finishing a generation dropped the founder straight into the file tree at `/preview`. | Lands on the project page, which frames what was generated first. |
| **F20** | Dashboard | Four `ComingSoon` panels (Templates, Roadmap, Usage, News) filled the page below the real content. | Removed. |

---

## Design decision

_The approach we picked, and what we deliberately left alone._

**F1–F5** are corrections in the component that owns each defect — `NAV_ITEMS` for the nav,
`Sidebar`/`TopBar` for placement, `AirrowLogo`'s existing `size` prop for the logo — so no screen
re-implements a fix its component should provide.

**F2** extracts the shared option list into `theme-options.ts`, consumed by both the labelled control
in Settings and the new compact header switch, so the two cannot drift. `setThemeAction` lost its
`requireSession()` gate: the theme is a per-browser display preference, and the only value that reaches
storage is one `isTheme()` has already narrowed.

**F6 keeps anonymous answers on the client until the moment of claim.** The guest interview stores its
draft in `localStorage`; nothing is written server-side until an authenticated user claims it. The
alternative — an `interview_drafts` table keyed by an opaque token — would create rows with no
`organization_id`, which the tenancy invariant (constitution §II) has no home for, and would add an
unauthenticated write endpoint. The client-side draft avoids both. The cost is accepted and real: a
draft is per-browser and does not survive clearing site data or switching device.

**The claim is triggered by the draft's presence on the first authenticated load, not by a flag in the
URL.** This started as a `?claim=1` query parameter and was dropped: presence-based claiming is less
code and it also solves the e-mail-confirmation case for free, since the draft is still there whenever
the visitor eventually reaches `/app` in the same browser.

**F13** is a one-line fix with a non-obvious cause, so the reasoning is recorded in the component: a
`<form>` inside a Radix `Item` is torn down by the menu's own close-on-select before the browser gets
to dispatch `submit`. Preventing `onSelect` keeps it mounted; the redirect that follows closes the
menu anyway.

**F14 collapses duplicate work rather than weakening any check.** `getSession()` is wrapped in React
`cache()` so the layout and the page share one `getUser()` and one org lookup instead of two each;
`listProjects` is wrapped for the same reason. Separately, the middleware gate moves from `getUser()`
to `getClaims()`, which verifies the JWT signature locally instead of asking the auth server on every
request. That is sound **because the gate is coarse** — it only chooses between the app and `/login`,
and `getSession()` still performs an authoritative `getUser()` for the value every RSC and action
scopes its data by. The accepted trade-off: at the gate, a revoked session stays admissible until its
short-lived token expires; in the layer that actually reads data, revocation is immediate.

**Not touched:** the design language settled by spec 19 — palette, typography, the logo artwork, and
the information architecture of individual screens. F1 and F12 changed the logo's *size*, not the mark.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

**F1 — Landing logo**
- [x] The landing header renders the lockup at `size="md"` (`h-7`) via the existing prop — no new
      hardcoded height. Verified in the served markup: `class="brand-asset w-auto object-contain h-7"`.
- [x] The hero mark is larger: `h-24 md:h-32`, up from `h-16 md:h-20`.

**F2 — Theme switch in the headers**
- [x] A compact switch sits top-right in the landing header, the `/start` header and the app `TopBar`.
- [x] It works **signed out** — `setThemeAction` no longer calls `requireSession()`, which was the only
      gate. Verified end-to-end: `curl -b "airrow-theme=light" /` and `/start` both return
      `<html data-theme="light">` with no session.
- [x] No flash of the wrong theme: the cookie is still read server-side in `layout.tsx` before render,
      and the switch is a plain form posting to a server action — no client-side theme state exists.
- [x] Settings and the header switch share `theme-options.ts`, so they cannot offer different themes.

**F3 — Logo goes home**
- [x] The sidebar logo navigates to `/`, both expanded and collapsed.
- [x] `/` renders a signed-in header: "Open dashboard" plus the account menu, and the CTA is no longer
      "Sign in".
- [x] **Existing bug, fixed here:** the landing header's secondary button read "Open dashboard" when a
      session existed but linked to `/login` regardless. It now links to `/app`.

**F4 — Profile menu top-right**
- [x] The profile menu is top-right in the app shell; the sidebar footer and its `footer` prop are gone.
- [x] It links to Projects (`/app`) alongside Settings and Sign out, and shows name + e-mail in the
      menu rather than in the bar.
- [x] It also appears top-right on the landing page when signed in — as the issue explicitly asked.
- [x] Reachable on mobile: it lives in the top bar, which is always visible, rather than behind the
      sidebar drawer (an improvement over the old footer placement).

**F5 — Sidebar stripped**
- [x] `Templates` and `Prompts` are gone from the sidebar **and** the command palette — one edit to
      `NAV_ITEMS`, which both read.
- [x] No dead references remain: the `icon` union, the `icons` map in `sidebar.tsx`, the unused lucide
      imports, and the `SEGMENT_LABELS` entries in `top-bar.tsx` are all removed.
- [x] The `/app/templates` and `/app/prompts` routes are deleted — an unlinked route is dead code that
      still has to be kept working. Confirmed absent from the build output.

**F6 — Anonymous interview**
- [x] A signed-out visitor can start from the landing page and answer **every** question, including the
      project name and description that `/app/projects/new` collects.
- [x] The guest interview uses the same `InterviewRuntime` and question schema — persistence and
      submission are injected, so there is no forked copy of the question logic.
- [x] Answers survive a reload while signed out (`localStorage`, version-tagged).
- [x] A signed-out visitor sees **"Log in or sign up to generate"** instead of the generate action;
      a signed-in one sees the normal action.
- [x] After authenticating, the draft is claimed on first `/app` load and the visitor lands on their
      new project with answers intact — the interview is not re-asked.
- [x] The claim re-validates server-side through `guestDraftSchema` → `pruneHiddenAnswers` →
      `validateCompleteAnswers` before any write. Covered by 7 tests.
- [x] The project is created under the session's org, closed over in `claim-action.ts` — never read
      from the payload. Covered by a test that smuggles an `organization_id` into the draft.
- [x] The draft is cleared once claimed (and on failure, so it cannot fail forever).
- [x] E-mail confirmation is handled: presence-based claiming means the draft is picked up whenever the
      visitor first reaches `/app`, however long the confirmation round-trip takes, in the same browser.

**F7–F12 — second-round polish**
- [x] The Settings theme control offers exactly two options; the "System — coming soon" placeholder is
      gone. Dark remains the fallback for a missing, unrecognised or tampered cookie (`readTheme()`).
- [x] The sidebar logo lines up with "Projects" and "Settings" when the rail is expanded, by mirroring
      the nav's `px-3` + `px-2.5` insets rather than by a magic offset.
- [x] The `⌘K` chip is gone from the top bar; the keyboard shortcut still opens the palette
      (`command-palette.test.tsx` still green).
- [x] Signed in, "Open dashboard" is a primary button with an arrow.
- [x] Pricing states a single free tier with what's included. No "TBD" remains in any rendered copy.
- [x] The landing header lockup renders at `size="lg"` — verified in the served markup as `h-10`.

**F13 — sign-out**
- [x] Clicking "Sign out" submits the form. Guarded by a test that **fails without the fix**, verified
      by reverting it (see Verification).

**F14 — auth performance**
- [x] `getSession()` is memoised per request, so the layout and the page share one `getUser()` and one
      org lookup instead of two each.
- [x] `listProjects` is memoised per request, so `/app` queries the project list once, not twice.
- [x] The middleware gate verifies the JWT locally via `getClaims()` where the project's signing keys
      allow it, falling back to the auth server otherwise — never weaker than the `getUser()` it replaces.
- [x] No check was removed: every RSC and action still resolves its org through an authoritative
      `getUser()` before touching data.
- [ ] **Not verified end-to-end.** The latency win is on the *signed-in* path, which needs a real
      account in the Supabase project to exercise. The call-count reduction is structural and visible
      in the code; the wall-clock improvement is not measured. See "Notes for the reviewer".

**F15–F20 — third round**
- [x] `/login`, `/signup` (both states) and `/start` render the lockup at `size="lg"` — verified in the
      served markup as `h-10`.
- [x] The landing footer renders at `size="md"` (`h-7`), verified in the same markup.
- [x] The app sidebar renders the logo at the same height in both rail states — `size="md"` (`h-7`)
      expanded and the mark at `h-7` collapsed — so toggling the rail no longer resizes the logo.
      The lockup's mark spans nearly the full height of its artwork, so equal CSS height means the
      mark itself reads at one size across both states.
- [x] The logo row is `h-14`, the same height as the top bar, so the logo shares a centre line with
      the breadcrumbs and "New project" across the fold. Previously `py-5` made the row 68px tall,
      putting its centre 6px below the top bar's. Size unchanged.
- [x] The documentation reader is gone: route, `DocsReader` feature, both entry points (project page
      and preview toolbar), and the `docs` breadcrumb label. Confirmed absent from the build output.
- [x] Nothing still links to `/app/projects/[id]/docs`.
- [x] Finishing a generation lands on `/app/projects/[id]`, from both the client poll in
      `GenerationProgress` and the server-side redirect in the generating page — the two paths that
      could disagree.
- [x] The dashboard's four `ComingSoon` panels are gone, along with the now-unused import.

**Global**
- [x] No hardcoded hex/px introduced; all corrections go through design tokens and existing props.
- [x] Typecheck clean; lint clean; tests green — 45 passed, 15 skipped (the RLS/data suites, which need
      a local Supabase and were already skipped before this change). Production build passes.

### Verification

_How each criterion above is proven._

- **New tests — `apps/web/src/features/interview/claim.test.ts` (7):** the F6 trust boundary. A complete
  draft becomes a project; a draft with a smuggled `organization_id` cannot redirect the write; an
  older `version`, an incomplete answer set, an out-of-schema value, a too-short project name, and a
  non-object payload are each rejected **without any write**.
- **New tests — `apps/web/src/features/interview/draft.test.ts` (8):** round-trip; stale version and
  unparseable storage are discarded rather than half-restored; blocked storage is reported instead of
  throwing, so the UI can warn. Storage is injected, not ambient — see the note below.
- **New tests — `apps/web/src/components/shell/nav-items.test.ts` (2):** the F5 regression guard, in the
  one list both the sidebar and the palette read.
- **New tests — `apps/web/src/components/shell/user-menu.test.tsx` (3):** the menu's contents and
  destinations, that sign-out reaches the action, and — the actual F13 guard — that the form is **still
  mounted** after the click. Confirmed to fail without the fix by reverting `onSelect` and re-running:
  the mount assertion failed while the call assertion still passed, which is precisely why the guard
  asserts on the form rather than on the call. jsdom runs the action either way; a real browser does
  not, because it never gets to dispatch `submit` against a removed form.
- **Existing tests:** `design-tokens.test.ts` still green — F1/F2 introduced no raw values.
- **Manual checks** (visual, run against the dev server):
  - F1 → header lockup renders `h-7`; hero renders `h-24 md:h-32`.
  - F2 → `/` and `/start` with an `airrow-theme=light` cookie and **no session** both render
    `data-theme="light"`; default with no cookie is `dark`.
  - F5 → `/app/templates` and `/app/prompts` absent from the route list in `pnpm build`.
  - F6 → `/start` returns 200 signed out and renders step 1 **server-side** ("What are you building?",
    "Continue to interview") rather than a blank awaiting hydration.
  - F11/F12 → the served landing markup contains `h-10` for the lockup and no "TBD" anywhere.
- Full suite: 45 passed, 15 skipped. `pnpm -r typecheck` clean. `pnpm -r lint` clean. `pnpm build` green.

---

## Exact changes (file:line)

_What was actually changed._

**F1 — logo size**
1. **`apps/web/src/app/page.tsx`** — header lockup to `size="md"`; hero mark to `h-24 md:h-32`.

**F2 — theme switch**
2. **`apps/web/src/features/settings/actions.ts`** — dropped `requireSession()` from `setThemeAction`, with a comment recording why it is safe.
3. **`apps/web/src/features/settings/theme-options.ts`** *(new)* — the shared option list + `nextTheme()`.
4. **`apps/web/src/features/settings/ThemeToggle.tsx`** — consumes the shared list.
5. **`apps/web/src/components/shell/theme-switch.tsx`** *(new)* — the compact header control.
6. **`apps/web/src/app/page.tsx`**, **`apps/web/src/app/start/page.tsx`**, **`apps/web/src/components/shell/top-bar.tsx`** — mounted top-right. `TopBar` is a client component, so the switch is passed in as a prop from the server layout; the theme cookie is never read on the client.

**F3 — logo goes home**
7. **`apps/web/src/components/shell/sidebar.tsx`** — logo `href="/app"` → `href="/"`.
8. **`apps/web/src/app/page.tsx`** — the signed-in header branch now links to `/app` and renders the account menu.

**F4 — profile menu**
9. **`apps/web/src/app/app/layout.tsx`** — `UserMenu` moved from the `Sidebar` `footer` prop into `TopBar`; `readTheme()` added for the switch.
10. **`apps/web/src/components/shell/top-bar.tsx`** — accepts `themeSwitch` and `userMenu` nodes.
11. **`apps/web/src/components/shell/user-menu.tsx`** — avatar-only trigger, `align="end" side="bottom"`, name/e-mail moved into the menu, Projects item added.
12. **`apps/web/src/components/shell/sidebar.tsx`** — `footer` prop and its container removed.

**F5 — sidebar stripped**
13. **`apps/web/src/components/shell/nav-items.ts`** — both entries removed, `icon` union narrowed.
14. **`apps/web/src/components/shell/sidebar.tsx`** — dead `icons` entries and lucide imports removed.
15. **`apps/web/src/components/shell/top-bar.tsx`** — dead `SEGMENT_LABELS` entries removed.
16. **`apps/web/src/app/app/templates/`, `apps/web/src/app/app/prompts/`** — deleted.

**F6 — anonymous interview**
17. **`apps/web/src/features/interview/guest-route.ts`** *(new)* — `GUEST_INTERVIEW_PATH`, so the landing CTAs and the route cannot disagree.
18. **`apps/web/src/features/interview/draft-schema.ts`** *(new)* — `guestDraftSchema` composed from the **existing** `projectCreateSchema` and `interviewAnswersSchema`, plus `GUEST_DRAFT_VERSION`. Used on both sides of the trust boundary.
19. **`apps/web/src/features/interview/draft.ts`** *(new)* — `localStorage` read/write/clear, all failure-tolerant, plus `storageAvailable()`.
20. **`apps/web/src/features/interview/InterviewRuntime.tsx`** — `projectId` removed entirely; `persist`, `submit`, `submitLabel`, `pendingLabel` and `back` are now injected.
21. **`apps/web/src/features/interview/AuthedInterview.tsx`** *(new)* — binds the runtime to the server actions for a real project.
22. **`apps/web/src/features/interview/GuestInterview.tsx`** *(new)* — step 1 (basics) + the runtime bound to the draft store and the sign-in wall.
23. **`apps/web/src/app/start/page.tsx`** *(new)* — the guest route, outside the middleware matcher; redirects to `/app/projects/new` if already signed in.
24. **`apps/web/src/features/interview/claim.ts`** *(new)* — validation + materialisation, dependency-injected so the boundary is testable without a database.
25. **`apps/web/src/features/interview/claim-action.ts`** *(new)* — the server entry point; closes over the session's org.
26. **`apps/web/src/features/interview/ClaimGuestDraft.tsx`** *(new)* — runs the claim on first authenticated load, guarded against StrictMode double-invocation.
27. **`apps/web/src/app/app/layout.tsx`**, **`apps/web/src/app/page.tsx`** — mounted the claim bridge; landing CTAs point at `/start`.
28. **`apps/web/src/app/app/projects/[id]/interview/page.tsx`** — renders `AuthedInterview`.

**F7–F12 — second-round polish**
29. **`apps/web/src/features/settings/ThemeToggle.tsx`** — the "System — coming soon" placeholder and its `Monitor` import removed.
30. **`apps/web/src/components/shell/sidebar.tsx`** — logo container `px-4` → `px-3`, logo link gains `px-2.5`, matching the nav.
31. **`apps/web/src/components/shell/top-bar.tsx`** — `⌘K` chip and its `Search` import removed.
32. **`apps/web/src/app/page.tsx`** — "Open dashboard" promoted to a primary button with `ArrowRight`; the three `pricing` tiers replaced by an `included` list rendered as one free tier; header lockup `size="md"` → `size="lg"`.

**F13 — sign-out**
33. **`apps/web/src/components/shell/user-menu.tsx`** — `onSelect={(event) => event.preventDefault()}` on the sign-out item, with the cause recorded inline.

**F14 — auth performance**
34. **`apps/web/src/lib/auth.ts`** — `getSession` wrapped in React `cache()`.
35. **`apps/web/src/lib/data/store.ts`** — `listProjects` wrapped in React `cache()`.
36. **`apps/web/src/lib/data/supabase-middleware.ts`** — gate moved from `getUser()` to `getClaims()`, with the coarse-gate reasoning recorded inline.

**F15–F20 — third round**
37. **`apps/web/src/app/login/page.tsx`**, **`signup/page.tsx`** (both states), **`start/page.tsx`** — lockup `size="md"` → `size="lg"`.
38. **`apps/web/src/app/page.tsx`** — footer lockup default → `size="md"`.
39. **`apps/web/src/components/shell/sidebar.tsx`** — rail lockup default → `size="md"`; collapsed mark `h-6` → `h-7`. Both states now `h-7`.
40. **`apps/web/src/app/app/projects/[id]/docs/`**, **`apps/web/src/features/docs/`** — deleted.
41. **`apps/web/src/app/app/projects/[id]/page.tsx`** — the two-card row collapses to the single "Generated files" card; `BookOpen` import kept (still used by a `SECTIONS` entry).
42. **`apps/web/src/app/app/projects/[id]/preview/page.tsx`** — "Docs" toolbar button and its `BookOpen` import removed.
43. **`apps/web/src/components/shell/top-bar.tsx`** — `docs` removed from `SEGMENT_LABELS`.
44. **`apps/web/src/features/generation/GenerationProgress.tsx`**, **`app/app/projects/[id]/generating/page.tsx`** — post-generation destination `/preview` → the project page.
45. **`apps/web/src/app/app/page.tsx`** — the four `ComingSoon` panels and the now-unused import removed.

**Docs**
46. **`docs/architecture/UI_ARCHITECTURE.md`** — route map gains `/start`, loses templates/prompts and the docs reader; shell description records the logo/theme/account placements.

**No change needed:** `lib/theme.ts` and `globals.css` — the light theme and cookie mechanism were
already complete. `packages/schemas` — the guest path reuses the existing question schema and
validators unchanged.

---

## Data model

**No schema changes.** F1–F5 are presentation only. F6 introduces no table: the anonymous draft lives
in the browser until claimed, at which point it becomes an ordinary org-scoped project through the
existing `createProject` path.

---

## Security

F6 is the only security-relevant part: it adds a path where **client-supplied interview answers become
a server-side project**. Those answers are untrusted input and are re-validated server-side —
`guestDraftSchema` → `pruneHiddenAnswers` → `validateCompleteAnswers` — before any write, and the
owning org is closed over from the session in `claim-action.ts` rather than read from the payload, so
a tampered draft cannot plant a project in another tenant's org. Both properties are covered by tests.
No unauthenticated write endpoint is added; the claim runs as the signed-in user.

F2 removed `requireSession()` from `setThemeAction`, which is a deliberate widening: the action writes
one cookie whose value `isTheme()` has narrowed to `"dark" | "light"`, with a safe fallback on read.
There is no account state behind it and nothing to enumerate.

F14 changes *where* the token is validated, not *whether* it is. The middleware gate now verifies the
JWT signature locally (`getClaims()`), which is cryptographic verification rather than trust — and it
falls back to the auth server when local verification isn't available. Every path that reads or writes
tenant data still goes through `getSession()` → `getUser()`, so org scoping is unchanged. The one
behavioural difference is revocation latency **at the gate**: a signed-out-elsewhere session can still
pass the redirect check until its short-lived access token expires, at which point the refresh fails.
It cannot reach data in that window, because the data layer re-checks authoritatively.

---

## Edge cases

_Unusual inputs or states, and what happens._

- Visitor completes the interview signed out, then logs into an **existing** account → the draft becomes
  a new project alongside the others; nothing existing is overwritten.
- Draft written by an older question schema → `z.literal(GUEST_DRAFT_VERSION)` rejects it and the stale
  key is dropped, so the visitor starts clean instead of resuming a half-restored interview. *Tested.*
- Unparseable or tampered storage → discarded on read rather than throwing. *Tested.*
- `localStorage` unavailable (private mode, blocked, quota) → the interview still runs, and the visitor
  is warned on step 1 that answers won't survive a reload. `writeDraft` returns `false` rather than
  pretending. *Tested.*
- Claim fails validation → the draft is cleared anyway, because it would otherwise fail on every
  subsequent load.
- React StrictMode double-invokes effects in dev → the claim is ref-guarded, so it cannot create two
  projects.
- Already signed in and visiting `/start` → redirected to `/app/projects/new`, the strictly better flow.
- Theme switched signed out, then the visitor signs in → the cookie is per-browser, not per-account, so
  the theme carries over and Settings shows the same value.

---

## Out of scope

_Deliberately excluded._

- **Rebuilding Templates and Prompts.** F5 removed them from the nav; designing what they should have
  been is a separate issue.
- **A documentation reading experience.** F18 removed the reader because it duplicated the preview
  browser, not because reading generated docs is a bad idea. If a genuinely different reading view is
  wanted later — table of contents, cross-links, print — that is its own issue, not a revert.
- A `System` theme option — `ThemeToggle` still shows it as "coming soon".
- Redesigning the design language settled by spec 19.
- Generation, preview and delivery flows — untouched. F6 stops once the project exists.
- Cross-device drafts. A signed-out interview is per-browser by construction; carrying it across
  devices would need the server-side draft table this spec deliberately rejected.

---

## Notes for the reviewer

- **`InterviewRuntime` lost its `projectId`.** That is the load-bearing change in F6: the question
  logic became mode-agnostic, so the signed-in and signed-out interviews genuinely share it rather
  than diverging into two copies that drift.
- **The draft tests inject their own `Storage`.** jsdom drops `localStorage` on an opaque origin, and
  Node ≥25 ships an experimental `localStorage` global that shadows jsdom's — the tests would pass or
  fail depending on the Node version. Injecting a small in-memory `Storage` keeps them deterministic
  (constitution §V) and let the test suite also cover the blocked-storage path honestly.
- **F13's guard asserts on the DOM, not on the call.** Asserting only that the action fired would have
  passed against the bug, because jsdom dispatches the submit regardless. The meaningful invariant is
  that the form is still mounted after the click — that is what a real browser needs.
- **F14's win is not measured in wall-clock time.** React `cache()` only deduplicates inside a request
  render, so it cannot be unit-tested (verified: `cache()` in a plain vitest run calls through twice).
  Proving the latency drop needs a signed-in session against the real Supabase project, which would
  mean creating an account in the founder's dev database — not something to do unasked. What is
  established is structural: `requireSession()` was being called independently by the layout and the
  page on every `/app` route, and both now resolve through one memoised call. If you want the number,
  the honest way to get it is a browser timing run against a real account.
