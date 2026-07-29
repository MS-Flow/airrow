# Spec 31 — Mobile UI: every screen works on a phone

> **In one sentence:** Go through Airrow's screens at phone widths and fix what's cramped, cut off or
> unreachable, so a founder who opens Airrow on their phone gets the same product the desktop gets.

|                |                                      |
| -------------- | ------------------------------------ |
| **Status**     | 🔄 In progress                       |
| **Issue**      | #31 — "doublecheck and fix mobile ui" |
| **Branch**     | `31-mobile-ui` (from `feature/ui`)   |
| **Feature**    | UI                                   |
| **Depends on** | [19-premium-ui-system.md](19-premium-ui-system.md) (the design system this fixes), [11-ui-design-flaws.md](11-ui-design-flaws.md) (the shell it corrects), [23-landing-copy-footer.md](23-landing-copy-footer.md) (landing sections in flight) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

_Who wants this, and what they get out of it._

As a **founder who first meets Airrow on my phone** I want **every screen — landing, signup, interview,
generation, preview, project and settings — to be readable, tappable and complete at phone width** so
that **I can judge the product and get through the interview without being told to come back on a
laptop**.

---

## Background

_How things work today and what's wrong with that — grounded in real code._

- **Today:** The shell already has real mobile handling. The sidebar becomes an overlay drawer below
  `md` ([sidebar.tsx:104-109](../apps/web/src/components/shell/sidebar.tsx#L104-L109)) opened from a
  fixed button ([sidebar.tsx:86-93](../apps/web/src/components/shell/sidebar.tsx#L86-L93)); `--rail`
  is 0 below `48rem` so nothing reserves space for it
  ([globals.css:190-194](../apps/web/src/app/globals.css#L190-L194)); landing and app grids stack
  (`md:grid-cols-*` in [page.tsx](../apps/web/src/app/page.tsx),
  [SpecDrivenShowcase.tsx](../apps/web/src/features/landing/SpecDrivenShowcase.tsx)); code and tables
  scroll inside themselves ([table.tsx:6](../apps/web/src/components/ui/table.tsx#L6),
  [CopyBlock.tsx:11](../apps/web/src/features/delivery/CopyBlock.tsx#L11)).
- **The problem:** nobody had walked the screens at phone width. The audit (below) found seven real
  defects, the worst of them on the two screens that decide whether a founder keeps going — the
  preview and the top bar.
- **Already in place:** Tailwind v4 breakpoints, the design tokens, the drawer pattern, and jsdom
  component tests with Testing Library + user-event
  ([smoke.test.tsx](../apps/web/src/app/smoke.test.tsx),
  [theme-switch.test.tsx](../apps/web/src/components/shell/theme-switch.test.tsx)).

### Audit — what is actually broken at 360px

| # | Where | Defect |
| - | ----- | ------ |
| 1 | [PreviewBrowser.tsx:273](../apps/web/src/features/preview/PreviewBrowser.tsx#L273) | The file tree is `max-md:hidden` — on a phone there is **no way to browse the generated repo**, only whatever file the URL opened on. |
| 2 | [PreviewBrowser.tsx:272](../apps/web/src/features/preview/PreviewBrowser.tsx#L272) | `h-[calc(100vh-7rem)]` with an inner scroll container: `100vh` is wrong under a mobile browser's URL bar, and the 7rem assumes the preview header is one row — it wraps to three on a phone. |
| 3 | [top-bar.tsx:54-65](../apps/web/src/components/shell/top-bar.tsx#L54-L65) | Breadcrumbs + a labelled "New project" + theme + avatar need ~215px of the ~256px left after `max-md:pl-14`; the trail truncates to nothing. |
| 4 | [sidebar.tsx:86-93](../apps/web/src/components/shell/sidebar.tsx#L86-L93) | The drawer toggle is a 28px tap target (`p-1.5` around a 16px icon), and the page behind the open drawer still scrolls. |
| 5 | [page.tsx:71-102](../apps/web/src/app/page.tsx#L71-L102) | Landing header: an `h-10` lockup (~151px) plus theme + two buttons overflows the 312px available at 360px. |
| 6 | [page.tsx:119-126](../apps/web/src/app/page.tsx#L119-L126) | The hero's two `lg` CTAs sit in a non-wrapping row and overflow. |
| 7 | [ProjectCard.tsx:42-51](../apps/web/src/features/projects/ProjectCard.tsx#L42-L51), [\[id\]/page.tsx:60-63](../apps/web/src/app/app/projects/[id]/page.tsx#L60-L63), [projects/page.tsx:19-33](../apps/web/src/app/app/projects/page.tsx#L19-L33) | Non-wrapping title rows: a long project name plus a wide status badge squeezes the name to a few characters. |

Checked and **already fine**: `/login`, `/signup`, the legal pages and footer, settings, the interview
question and review screens, the generation progress screen, and the "Continue locally" handoff.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

Fix the audit's seven defects with the responsive vocabulary already in the codebase — Tailwind
breakpoint variants on the existing components, design tokens, and the drawer pattern the sidebar
established. The preview's file tree reuses that same pattern rather than inventing a second one, and
the two drawers share one hook for Escape-to-dismiss and page scroll lock (two concrete uses, so the
abstraction is earned). On a phone the preview stops being a nested scroll container and simply flows
in the page; the fixed-height two-pane layout stays from `md` up.

**Not touched:** no redesign — this is layout, sizing, overflow and reachability only; any change to
what a screen *says* or *shows* belongs to its own issue. No mobile-only components, no separate mobile
routes, no new dependency.

### Decisions taken (were `[NEEDS CLARIFICATION]`)

1. **Scope:** landing, legal and app — everything Airrow serves. The generated repo's own files under
   `template/` are untouched.
2. **Redesign:** out. Responsive corrections only.
3. **Target widths:** 360px is the design floor and the width every criterion is judged at; 390px and
   414px are checked too. Below 360 (320px, iPhone SE) nothing may overflow *horizontally* — rows are
   allowed to wrap instead of staying on one line.
4. **Tap targets:** 44×44 CSS px for the primary navigation affordance (the drawer toggle) and for
   page-level primary CTAs — `Button size="lg"` is already `h-11`. Everything else keeps its current
   size, which clears the WCAG 2.2 AA 24×24 floor (the smallest control in the shell is the 32px
   avatar). Bumping every control to 44px would be the redesign this spec excludes.
5. **Top bar "New project":** stays in the bar, drops its label below `sm` and keeps an accessible
   name — the action stays one tap away and the breadcrumb trail gets its width back.
6. **Preview file tree:** the sidebar's drawer pattern, opened from a "Files" button in the reader's
   own header row; picking a file closes it.
7. **Drawer scroll lock:** yes — the page behind an open drawer does not scroll.
8. **How responsive behaviour is proven:** Vitest + jsdom behaviour tests for what is real behaviour
   (drawer opens/closes, scroll lock, the tree is reachable and selects a file, the icon-only action
   keeps its name), plus a documented manual pass at the target widths in both themes. **Playwright is
   deliberately not added here** — the constitution names it for the E2E critical path and it is not
   installed in this repo; standing up a browser matrix is its own issue, not a rider on a UI fix. See
   _Deviations_.
9. **Tablet (768–1024px):** not in scope. It is the existing desktop layout and must not regress.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [ ] Every route renders with **no horizontal page scroll** at 360px: the `<body>` never scrolls
      sideways; wide content (code blocks, tables, file paths) scrolls inside its own container.
      _(Every known cause is fixed and the build is clean; confirming it takes a device — see
      Implementation notes.)_
- [x] Routes covered: `/`, the legal pages, `/login`, `/signup`, `/start` (the signed-out interview),
      `/app`, `/app/projects`, `/app/projects/new`, the interview, generating, `/app/projects/[id]`,
      its preview and `continue`, and `/app/settings`.
- [x] The generated-repo **preview is usable on a phone** — the file tree is reachable behind a "Files"
      button, picking a file shows its content and closes the drawer, and the reader flows in the page
      instead of inside a mis-measured `100vh` box.
- [x] The **top bar** stays legible at 360px: breadcrumbs truncate rather than push the actions off
      screen, and the primary action, theme switch and user menu all remain reachable.
- [x] The **interview** is fully operable on a phone: question text, option cards, inputs and the
      advance/back controls all fit and are tappable, and no keyboard-only hint is shown to a touch user.
- [x] The drawer toggle is a 44×44 tap target; page-level primary CTAs are `h-11`; nothing is smaller
      than the WCAG 2.2 AA 24×24 floor.
- [x] Text does not overflow its container: long project names, long file paths and long emails
      truncate or wrap instead of stretching the layout.
- [ ] Both **light and dark** themes are checked at phone width; the drawer, its scrim and the sticky
      top bar read correctly in each. _(Every new surface uses existing tokens, so both themes follow
      by construction; the visual pass itself is outstanding — see Implementation notes.)_
- [x] The drawer closes on navigation, on Escape and on tapping the page behind it — and the page
      behind it does not scroll while it is open.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — `apps/web/src/components/shell/sidebar.test.tsx`: the drawer opens from the toggle,
  locks page scroll while open, and closes on Escape, on the scrim, and on navigating; the toggle
  carries `aria-expanded` and a 44px target class contract.
- **New tests** — `apps/web/src/features/preview/PreviewBrowser.test.tsx`: the file tree is reachable
  from the "Files" button, selecting a file renders it and closes the drawer, and the drawer closes on
  Escape.
- **New tests** — `apps/web/src/components/shell/top-bar.test.tsx`: the "New project" action keeps its
  accessible name when its label is hidden below `sm`, and the breadcrumb trail stays truncatable.
- Overflow, wrapping and both themes at 360/390/414px: **manual pass**, recorded under _Implementation
  notes_. jsdom has no layout engine, so a test asserting "no horizontal scroll" would assert nothing.
- Full suite result + typecheck/lint status under _Implementation notes_.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code._

1. **`apps/web/src/lib/use-overlay.ts`** _(new)_ — client hook `useOverlay({ open, onDismiss })`:
   Escape-to-dismiss plus `document.body.style.overflow` lock while open. Replaces the Escape effect
   at ([sidebar.tsx:74-81](../apps/web/src/components/shell/sidebar.tsx#L74-L81)) and serves the
   preview's new drawer — the two uses that earn it.
2. **`apps/web/src/components/shell/sidebar.tsx`** — toggle becomes a 44px target (`size-11`,
   re-centred in the 68px bar at `top-3 left-2`) with `aria-expanded` / `aria-controls`; the drawer
   `<aside>` gets that id; the local Escape effect gives way to `useOverlay`.
3. **`apps/web/src/components/shell/top-bar.tsx`** — the "New project" label is `max-sm:hidden` with
   `aria-label` on the link so the icon-only button keeps its name; header gets `min-w-0` so the
   breadcrumbs' existing `truncate` can act.
4. **`apps/web/src/components/brand/logo.tsx`** — `lg` becomes `h-7 sm:h-10`, so the lockup that the
   landing header, the legal header and the drawer all share stops overflowing at phone width
   ([:19](../apps/web/src/components/brand/logo.tsx#L19)).
5. **`apps/web/src/components/shell/page-container.tsx`** — `px-4 py-8 sm:px-6 sm:py-10`: a phone
   should not spend 48px of 360 on gutters.
6. **`apps/web/src/features/preview/PreviewBrowser.tsx`** — the `<aside>` becomes an off-canvas drawer
   below `md` (scrim + `-translate-x-full`, `md:translate-x-0`, `useOverlay`), opened by a "Files"
   button added to the reader's existing path/Edit row; `select()` closes it; the outer box is
   `md:h-[calc(100dvh-7rem)]` with `md:overflow-y-auto` on both panes, so mobile scrolls the page.
7. **`apps/web/src/app/globals.css`** — `.preview-reader` insets drop to `1.25rem` below `48rem`
   ([:216-229](../apps/web/src/app/globals.css#L216-L229)).
8. **`apps/web/src/app/page.tsx`** — landing header row wraps (`flex-wrap gap-y-2`); the hero CTA row
   wraps and stays centred.
9. **`apps/web/src/app/app/projects/[id]/page.tsx`** — title row `flex-wrap` with `break-words` on the
   name, so a long name keeps its badge instead of squeezing itself away.
10. **`apps/web/src/app/app/projects/page.tsx`** — list header row wraps.
11. **`apps/web/src/features/projects/ProjectCard.tsx`** — name/badge line wraps; the `timeAgo` stamp
    is `max-sm:hidden` so the row keeps its name and its arrow.
12. **`apps/web/src/features/interview/InterviewRuntime.tsx`** — the `⌘↵ to continue` hint is
    `max-sm:hidden`; it addresses a keyboard that a phone does not have.

**No change needed:** the legal layout and `SiteFooter` (already wrapping, and fixed by the lockup
change), `/login` and `/signup` (`max-w-sm` centred column), settings (`flex-wrap` card bodies),
`GenerationProgress`, `CopyBlock` and the "Continue locally" steps (`overflow-x-auto`), and every
`md:grid-cols-*` grid that already stacks.

---

## Data model

**No schema changes.** Presentation only — no table, column, query or server action is touched.

---

## Security

Nothing security-relevant: layout and styling only. No new data reaches the client, no authorization
path changes, and the preview's rendering stays sanitized — the new file-tree drawer moves existing
markup, it adds no `dangerouslySetInnerHTML` and no new untrusted-content path.

---

## Edge cases

- Very narrow viewport (320px, iPhone SE) → rows wrap; nothing scrolls horizontally.
- Landscape phone / short viewport → the preview flows in the page below `md` instead of trapping the
  reader in a `100vh` box, so a short viewport still reaches the end of a file.
- Long project name in breadcrumbs → truncates; in the project header and list rows → wraps, keeping
  its status badge.
- Deep generated file path in the preview tree → the tree pane scrolls; the page does not.
- Drawer open, then a file is picked or a nav link followed → the drawer closes and page scroll is
  released. Unmounting while open must not leave the body locked.
- Text zoom / large system font → rows wrap rather than clip (`flex-wrap`, `break-words`).

---

## Out of scope

- Any visual redesign beyond making the current design fit — new layouts belong in their own issue.
- Playwright and a mobile-viewport E2E matrix (see _Deviations_) — its own issue.
- Uniform 44px tap targets across every control; that is a design-system change, not a fix.
- A native or installable (PWA) experience.
- Mobile-specific copy; landing copy is [23-landing-copy-footer.md](23-landing-copy-footer.md).
- The generated repo's own docs and templates under `template/` — this is Airrow's hosted UI only.

---

## Deviations

- **Constitution §V names Playwright for E2E; this spec adds none.** Playwright is not installed in
  this repo (no `e2e/`, no dependency, no CI job). Responsive layout is proven here by jsdom behaviour
  tests plus a documented manual pass, and standing up the browser matrix is left as follow-up work
  rather than smuggled into a UI fix. Nothing that a Playwright test would have covered is left
  untested by another means, except pixel layout itself.

---

## Implementation notes

**Built** — all twelve changes in _Exact changes_, as planned, plus two the work turned up:

- `PreviewBrowser.select()` now also returns the **page** to the top, not just the reader pane. Below
  `md` the reader is no longer the scroll container, so the old `reader.scrollTo` alone left a phone
  halfway down the previous file.
- `InterviewRuntime`'s text-question footer is `max-sm:justify-end`: with the `⌘↵` hint hidden,
  `justify-between` would have parked "Continue" on the left.

**Verification run** (2026-07-27):

| Command | Result |
| ------- | ------ |
| `pnpm -r typecheck` | clean, all three packages |
| `pnpm -r lint` | clean, no new issues |
| `pnpm -r test` | **142 passed, 24 skipped** (31 files). The skips are the Supabase/RLS integration tests, which need a local database — pre-existing, unrelated to this change. |
| `pnpm test:scripts` | 13 passed |
| `pnpm build` | succeeds; every route compiles with the new utilities |

New tests: `sidebar.test.tsx` (5), `PreviewBrowser.test.tsx` (3), `top-bar.test.tsx` (2) — 10 added.

**Outstanding — the visual pass.** The two unchecked criteria need a real browser at 360/390/414px in
both themes, and the implementing environment had no browser automation. jsdom has no layout engine,
so no test here can stand in for it. Every *known* cause of horizontal overflow found in the audit is
fixed and the reasoning is recorded per change, but "looks right on a phone" is still an unobserved
claim. Whoever runs `/analyze` should walk the routes listed above on a device or in device emulation
before this spec is closed.
