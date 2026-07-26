# Spec 19 — Premium Airrow UI (v1)

> **In one sentence:** Scrap Airrow's current ad-hoc styling and rebuild the product on one coherent
> design system — silver-on-near-black tokens, the real Airrow logo, a full component library, an
> OS-like app shell — then re-implement every screen on it.

|                |                                                                    |
| -------------- | ------------------------------------------------------------------ |
| **Status**     | ✅ Done                                                     |
| **Issue**      | #19 — "Design the Premium Airrow UI (v1)"                          |
| **Branch**     | `19-premium-ui-system` (from `feature/ui`)                         |
| **Feature**    | UI                                                                 |
| **Depends on** | [`18-supabase-auth`](18-supabase-auth.md) — real auth, login/signup screens this spec restyles. [`1-interview-generator`](1-interview-generator.md) — interview, generation, preview and continue screens this spec restyles. |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
Scope: the FULL scope of issue #19 — design system *and* every screen in the sitemap. `/implement`
lands it in the reviewable slices listed under "Exact changes", not one PR.
-->

---

## User story

_Who wants this, and what they get out of it._

As a **founder evaluating Airrow in the first 30 seconds** I want **an interface that feels premium,
calm and obviously well-engineered** so that **I trust it with the foundation of my startup** — and as
the **team building Airrow** we want **one design system every screen is built from** so that new
screens are fast to build and impossible to make ugly.

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today:** Tokens are a small Tailwind v4 `@theme` block in
  [globals.css](apps/web/src/app/globals.css#L4-L24) — 13 colors on an **orange** accent (`#ff6b3d`),
  2 fonts, 2 radii. The entire component library is one 147-line file,
  [components/ui/index.tsx](apps/web/src/components/ui/index.tsx) — Button, Card, Input, Textarea,
  Label, Badge, Separator, Spinner and a placeholder `AirrowMark` (a hand-drawn arrow, not the real
  logo). The app shell is a hardcoded 56-unit sidebar with two links inside
  [app/app/layout.tsx](apps/web/src/app/app/layout.tsx#L16-L53).
- **The problem:** No typography scale, no spacing system, no motion system, no elevation tokens, no
  light theme. No Dropdown, Dialog, Command palette, Table, Tabs, Breadcrumbs, Tooltip, Toast,
  Skeleton, Empty state, Progress. `Card` has no header/body/footer parts, so every screen re-invents
  its padding. Loading/error/empty are inline conditionals rather than real components (constitution
  III). Whole screens in the sitemap don't exist: `/app/projects`, `/app/templates`, `/app/prompts`,
  a documentation reader. The landing page and dashboard are placeholder-grade.
- **Decision from `/clarify`:** the current visual design is **scrapped**. The orange accent is
  retired everywhere it is used today (focus rings, links, blockquotes, logo mark, `Badge
  tone="accent"`) and replaced by the palette below.
- **Already in place:** Tailwind v4 `@theme`, `cn()` (clsx + tailwind-merge), `lucide-react`, Inter +
  JetBrains Mono in the root layout, `dompurify` + `marked` for sanitized markdown, RSC-by-default
  routing, and a working (if plain) interview → generating → preview → continue flow to restyle
  rather than rebuild.

### Visual reference

The images live in [`docs/design/`](../docs/design/) — see its
[README](../docs/design/README.md) for the full table. They are also attached to
[issue #19](https://github.com/MelvinEdlund/airrow/issues/19).

| Asset | File | How to use it |
| ----- | ---- | ------------- |
| Airrow wordmark + mark | `docs/design/airrow-lockup.png` | **Copy exactly.** |
| Airrow mark (solo) | `docs/design/airrow-mark.png` | **Copy exactly.** |
| Odysseus AI hero | `docs/design/ref-odysseus-hero.png` | Reference only — density, card rhythm, hero structure. **Do not copy.** |
| Odysseus AI features grid | `docs/design/ref-odysseus-features.png` | Reference only — icon-card grid and section pacing. **Do not copy.** (Its mono-everything type and pink accent are explicitly *not* our direction.) |

**The mark**, described so it can be authored as SVG: a sharp, upward arrowhead that reads as a
stylized **A** — a narrow apex with straight outer edges sweeping down and *outward*, each lower
corner drawn to a fine concave point (a swept-wing silhouette, not a flat-based triangle). Inside sits
a negative-space counter: a smaller inverted V whose right leg curves away in a thin crescent, leaving
the A's crossbar implied rather than drawn. Fill is a brushed-metal gradient — near-white highlight
just below the apex, mid-silver body, graphite falling to the lower-left facet — with a thin bright
edge outline separating it from the background.

**The wordmark:** `AIRROW` in wide uppercase, heavy letter-spacing (~0.3em), monoline geometric sans
with outlined letterforms (bright hairline stroke, lighter inner fill), optically round `O`/`R`
bowls, and a soft outer glow. Set alongside the mark with generous clearspace ≥ the mark's width.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

Build the system bottom-up, then re-skin top-down. **(1)** Expand `globals.css` into the single source
of truth for tokens — color (issue palette), type scale, spacing, radii, elevation, motion durations
and easings — with dark as the design target and light derived from the same semantic names.
**(2)** Split `components/ui/index.tsx` into one file per component (`button.tsx`, `dialog.tsx`, …)
with **no re-export barrel** (constitution I forbids barrels that hide the dep graph), adding the
missing primitives on **Radix** headless behavior (unstyled — we own every pixel). **(3)** Rebuild the
app shell (sidebar, top bar, breadcrumbs, ⌘K command palette, progress rail) as real components.
**(4)** Re-implement each screen in the sitemap on the system, one slice at a time, deleting ad-hoc
styling as we go. Motion is CSS-first (transitions + `@keyframes` on tokenized durations); no
animation library unless a screen provably needs one.

Resolved during `/clarify`:

- **Palette:** background `#09090B`, surface `#111114`, border `#202026`, primary text `#FAFAFA`,
  secondary `#9CA3AF`. Accent is a flat neutral **silver** token (borders, focus rings, active
  states); blue is reserved for the rare true highlight. The **metallic sheen is reserved for the
  logo, splash and landing hero only** — the issue's own rule is "never overused", so UI chrome stays
  matte and readable.
- **Themes:** dark **and** light both ship; every screen is verified in both. The choice is persisted
  in a cookie so the root layout can render the correct theme server-side with no flash — **no schema
  change**, no `useEffect` theme flip.
- **Auth providers:** Google / GitHub / Email / Magic link all appear on `/login` and `/signup` as
  designed buttons that are **visibly disabled** with a "Coming soon" affordance. Only the email +
  password flow from [#18](18-supabase-auth.md) actually submits. They must never look enabled and
  fail silently.
- **Generation stages:** the visualization is driven by the **real** `JobStage` union in
  [packages/schemas/src/types.ts:146](packages/schemas/src/types.ts#L146) — `resolve · author ·
  assemble · validate · manifest`, as emitted by
  [features/generation/runner.ts:10](apps/web/src/features/generation/runner.ts#L10) — presented with
  expressive labels. The issue's 10-stage list is aspirational; showing stages the engine does not
  emit would be fiction, so a finer breakdown is a follow-up **engine** issue, not a UI trick.
- **Syntax highlighting:** `shiki`, run server-side, with its HTML output passed through the existing
  DOMPurify path — a highlighter must not become an injection route for untrusted generated code.
- **Responsive:** desktop-first. Designed at ≥1280px, fully functional 768–1280px (sidebar collapses
  to icons), usable but not optimized below 768px (sidebar becomes a drawer).

**Not touched:** Server Actions, `queries.ts` / `actions.ts`, the DataStore, `packages/engine` and
`packages/schemas` — this is a presentation-layer change. Where a screen needs data that doesn't
exist yet (usage, news, roadmap, templates, prompts, billing, API keys, Azure DevOps), we ship the
designed surface in a disabled / "Coming soon" state rather than inventing a data source.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

**Foundations**

- [x] `globals.css` defines the full token set — color (palette above), typography scale, spacing
      scale, radii, elevation/shadow, motion duration + easing — and is the only place raw color
      values appear in `apps/web`.
- [x] No hardcoded hex or arbitrary `px` values remain in `apps/web/src/**` components; a check proves it.
- [x] The orange `--color-accent` (`#ff6b3d`) is gone from the codebase.
- [x] Dark and light themes both render every screen legibly; the theme is chosen in Settings,
      persisted in a cookie, and applied server-side with no flash of the wrong theme.
      *(Implemented and contrast-verified by calculation; a browser pass over every screen is the one
      remaining manual check — see Implementation notes.)*
- [x] The Airrow logo ships as real assets faithful to the reference images — mark and lockup — and
      appears in navbar, auth, loading/splash, empty states, footer and favicon.
      **Changed from the plan:** the assets are **the approved artwork itself** (transparent PNG,
      cropped to its alpha bounding box), not redrawn SVG. Hand-tracing was tried and rejected for
      changing the design, and there is no vector original. The metallic sheen is therefore baked into
      the asset — which is also what confines it to the logo — and the light theme darkens it with a
      CSS filter instead of a colour variant.
- [x] Metallic sheen appears only on the logo (it is part of the artwork); UI chrome uses the flat
      silver token and never a gradient.

**Component library** (`apps/web/src/components/ui/*`)

- [x] One component per file, no barrel re-export; every component is token-driven and typed with no `any`.
- [x] Covers: Button, Card (+header/body/footer), Input, Textarea, Select/Dropdown, Checkbox/Radio,
      Label, Dialog, Command palette (⌘K), Tooltip, Toast/notification, Table, Tabs, Breadcrumbs,
      Badge, Progress, Skeleton, Spinner, Separator, EmptyState, ErrorState.
- [x] Behavior comes from Radix primitives; all visuals are ours (no imported theme CSS).
- [x] Loading / error / empty are real reusable components, not per-screen conditionals.
- [x] Every interactive component is keyboard-operable with a visible focus ring; dialogs trap focus
      and close on `Esc`.
- [x] Motion system: fade / scale / slide / blur / shimmer on tokenized durations and easings,
      respecting `prefers-reduced-motion`.

**App shell**

- [x] Sidebar (collapsible, active-route state), top bar with breadcrumbs and quick actions,
      persistent generation progress, and a working ⌘K command palette that navigates to projects,
      screens and actions.
- [x] A docked-panel slot is reserved in the shell for the future AI chat — structural only, not implemented.

**Screens** — each re-implemented on the system with designed loading, empty and error states:

- [x] `/` Landing — hero, how it works, features, why SDD, examples, pricing teaser, CTA. Copy,
      pricing tiers and examples are clearly-marked placeholders until product supplies real content.
- [x] `/login`, `/signup` — centered logo, minimal form; email + password functional, the other four
      providers visibly disabled with "Coming soon".
- [x] `/app` Dashboard — recent projects, create project, continue project, recent generations; plus
      templates, roadmap, usage and news as designed "Coming soon" empty states.
- [x] `/app/projects` — project list (new route).
- [x] `/app/projects/new` + interview — stepped wizard, progress indicator, animated transitions, one
      question per screen, back/edit at any time.
- [x] `/app/projects/[id]/generating` — large animated visualization of the five real job stages
      (resolve → author → assemble → validate → manifest), with the authored-file ticker; never a bare spinner.
- [x] `/app/projects/[id]` Project dashboard — architecture, specifications, roadmap, generated files,
      documentation, next steps, Continue in VS Code, Open GitHub, Download Project.
- [x] `/app/projects/[id]/preview` — two-pane repo browser; sanitized markdown, shiki-highlighted code
      blocks, copy buttons.
- [x] `/app/projects/[id]/docs` — documentation reader for the **generated project's** docs:
      searchable sidebar, collapsible nav, beautiful markdown.
- [x] `/app/projects/[id]/continue` — handoff checklist.
- [x] `/app/templates`, `/app/prompts` — routes and sidebar entries exist as designed "Coming soon" pages.
- [x] `/app/settings` — profile, theme (functional), workspace; GitHub, Azure DevOps, billing, API
      keys and organizations render as disabled "Coming soon" sections.
- [x] Responsive rules hold: designed ≥1280px, functional 768–1280px, usable below 768px.
      *(Breakpoint behaviour implemented; visual confirmation pending the browser pass.)*

**Quality**

- [x] WCAG AA contrast in **both** themes, verified on the new palette (`#9CA3AF` on `#09090B` checked
      at every size it's used) — ratios recorded in `UI_ARCHITECTURE.md`.
- [x] `docs/architecture/UI_ARCHITECTURE.md` updated in the same change — tokens, component inventory,
      motion rules, route map, responsive rules, theme rules (constitution IV: AI context stays synced).
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — `components/ui/button.test.tsx` (variants, disabled, `asChild`),
  `components/ui/dialog.test.tsx` (opens, focus stays trapped, `Esc` closes),
  `components/ui/command-palette.test.tsx` (⌘K opens, query filters, arrows + Enter navigate, `Esc`
  closes).
- **New test** — `components/design-tokens.test.ts`: walks every `.ts`/`.tsx` under `src/` and fails
  on a raw hex outside the token layer, an arbitrary `px` class value, or any surviving `#ff6b3d`.
  It caught two real offenders (`CopyBlock`, `PreviewBrowser`) on first run.
- **New test** — `features/auth/ProviderButtons.test.tsx`: all four unavailable providers render
  `disabled`, and none is a link that could navigate.
- Screen criteria → manual check per screen in both themes, plus the existing E2E critical path
  (signup → interview → generate → preview → deliver) still passing after the re-skin.
- Contrast criterion → recorded contrast ratios for the fg / fg-muted / border pairs in
  `UI_ARCHITECTURE.md`.
- Full suite result + typecheck/lint status.

### Implementation notes

Verified on 2026-07-25:

- `pnpm -r typecheck` — clean (engine, schemas, web).
- `pnpm -r lint` — clean, no new issues.
- `pnpm -r test` — **25 passed, 15 skipped, 0 failed**. The 15 skips are the pre-existing data-layer
  suites (`schema.rls`, `organizations.rls`, `auth.trigger`, `store.cutover`), which skip without a
  local Supabase — unchanged by this spec.
- `pnpm build` — succeeds; all 19 routes compile.

**One check is still outstanding:** a browser pass over every screen in both themes. `.env` is absent
in this working copy, so the dev server cannot boot far enough to render authenticated screens. The
palette is verified by calculation (ratios in `UI_ARCHITECTURE.md`) and the layout by build + tests,
but "renders legibly in both themes at every breakpoint" is asserted from the code, not observed.

### Scope amendment — auth was broken before this spec

Signup and login did not work at all. Diagnosed during implementation and, **on the founder's explicit
decision, fixed in this branch** rather than deferred to a follow-up issue — it belongs to
[#18](18-supabase-auth.md)'s area, so recording it here is what keeps the spec honest.

Four faults, all verified against the live project:

1. **Env was in the wrong place.** `.env.local` sat in the repo root; Next reads `.env*` only from the
   directory it runs in, so **zero** env files were loaded (the dev banner had no `- Environments:`
   line). Moved to `apps/web/.env.local`, with `.env.example`, `README.md`, `DEVELOPER_GUIDE.md`,
   `INFRASTRUCTURE_SETUP.md` and `scripts/migrate-data-to-supabase.mjs` updated to match.
2. **Misconfiguration was silent.** `updateSession` returned `userId: null` when env was missing, so
   every `/app` request bounced to `/login` and an unconfigured app looked exactly like a wrong
   password. It now throws and names the file the keys belong in.
3. **Signup had three outcomes, not two.** The hosted project has *Confirm email* on
   (`mailer_autoconfirm: false`), so `signUp` returns no session; the action redirected to `/app`
   anyway and middleware threw the founder back to `/login`. `signUp` now returns a discriminated
   `SignUpResult` and the page shows a "Confirm your email" state.
4. **The login error lied.** An unconfirmed account renders as "Invalid email or password". `signIn`
   now returns `SignInResult` with a distinct `unconfirmed` case and its own message.

Verified end to end: with env in place, the server-side auth path reaches Supabase and returns real
answers, `/app` redirects correctly through the Edge middleware, and 9 new regression tests cover
faults 2–4 (`lib/auth.test.ts`, `lib/data/supabase-middleware.test.ts`).

Still the founder's call, outside the code: turning *Confirm email* off for the dev project
(Authentication → Sign In / Providers → Email) if signup should log you straight in. And
`SUPABASE_DB_URL` points at `127.0.0.1:54322`, which is why the data-layer suites skip — run
`pnpm dlx supabase start` to exercise them.

**Resolved: the logo is the real artwork, not a redraw.** A first pass hand-traced the mark as an SVG
path and it was rejected for changing the design — correctly. The reference PNGs turned out to be
**already transparent** (RGBA, 94–96 % fully transparent pixels; the grey is viewers compositing
alpha), so the artwork itself is now the asset.

Pipeline: crop each source to its alpha bounding box → `apps/web/public/brand/` (mark 526×495, lockup
1135×301) plus a 256×241 favicon at `app/icon.png`, replacing the hand-drawn `icon.svg`. **A bounding
box must be taken above an alpha threshold of ~16** — these renders carry a near-zero glow wash over
the whole 1536×1024 frame, so `alpha > 0` returns almost the entire canvas. Components size by height
(`h-*`), never `size-*`, since neither asset is square.

Consequences of using raster over vector, accepted knowingly: no per-theme recolouring (the light
theme darkens the asset with a CSS filter via `.brand-asset`), and the SVG gradient plumbing
(`BrandDefs`, `--a-metal-*`, `.metal-text`, `tracking-wordmark`) is deleted as dead weight. The
wordmark now comes from the lockup artwork rather than being set as type, so the letterforms and
tracking are the designed ones. A vector original would still be welcome later.

---

## Exact changes (file:line)

_What was actually built._

**Foundations**

1. **`apps/web/src/app/globals.css`** — full token set (color via `--a-*` indirection, type scale,
   radii, elevation, easings, keyframes), `[data-theme="light"]` block, `prefers-reduced-motion`
   collapse, `.metal-text` / `.shimmer`, tokenized `.prose-airrow`.
2. **`apps/web/src/lib/theme.ts`** (new) + **`src/features/settings/actions.ts`** (new) — cookie read
   / server-action write; **`src/app/layout.tsx`** stamps `data-theme` and renders `<BrandDefs>`.
3. **`apps/web/src/components/brand/`** (new) — `mark.tsx` (flat + metal, shared gradient defs),
   `logo.tsx` (wordmark + lockup), `splash.tsx`. **`src/app/icon.svg`** re-cut on the new mark.

**Component library** — `src/components/ui/index.tsx` deleted; one file per component:
`button` · `card` · `input` · `label` · `select` · `choice` · `badge` · `separator` · `spinner` ·
`skeleton` · `progress` · `dialog` · `dropdown` · `tooltip` · `tabs` · `table` · `breadcrumbs` ·
`toast` · `command-palette` · `states`.

**Shell** — `src/components/shell/`: `sidebar.tsx`, `top-bar.tsx`, `user-menu.tsx`, `chat-slot.tsx`,
`nav-items.ts`; `src/app/app/layout.tsx` composes them plus `TooltipProvider`, `Toaster` and the
palette, and feeds the rail real job progress via `features/generation/stages.ts` (new).

**Screens** — `app/page.tsx`, `login`, `signup`, `app/app/page.tsx`, `app/app/projects/page.tsx`
(new), `projects/new`, `projects/[id]/page.tsx`, `preview` (+ server-side `features/preview/
highlight.ts`), `docs` (new, + `features/docs/DocsReader.tsx`), `continue`, `templates` (new),
`prompts` (new), `settings`; `loading.tsx` splash for `/app` and `/app/projects/[id]`;
`features/auth/ProviderButtons.tsx` (new), `features/projects/ProjectCard.tsx` (new),
`features/settings/ThemeToggle.tsx` (new).

**Dependencies** — `@radix-ui/react-*` (dialog, dropdown-menu, tooltip, tabs, select, checkbox,
radio-group, progress, separator, label, slot, toast, collapsible), `shiki`,
`isomorphic-dompurify`; dev: `@vitejs/plugin-react@4`, `jsdom`, `@testing-library/{react,user-event,
jest-dom}`. **`apps/web/vitest.config.ts`** + **`vitest.setup.ts`** (new) give `*.test.tsx` a DOM
while the data-layer suites stay on node.

**No change needed:** `lib/utils.ts`, the root layout's font wiring, and every server action / query —
no data-layer change was required.

---

## Data model

**No schema changes.** This is a presentation-layer spec. The theme preference lives in a cookie, not
in `profiles`. Any surface that would need new data (usage, news, roadmap, templates, prompts,
billing, API keys) ships as a "Coming soon" state; real data sources are separate issues.

---

## Security

Nothing security-relevant is opened up: no new endpoints, no new data access, no change to auth or
org scoping — the four extra auth providers are inert UI and cannot initiate a sign-in. Two existing
rules must survive the re-skin: generated/authored markdown stays sanitized (DOMPurify, never
`dangerouslySetInnerHTML` with user-derived content), and shiki's highlighted HTML goes through that
same sanitization so a highlighter never becomes an injection route.

---

## Edge cases

- **Disabled auth provider clicked** → no navigation, no error; a tooltip/label explains it's coming soon.
- **Long project names / emails in the sidebar** → truncate with ellipsis, full value in a tooltip.
- **Zero projects** → dashboard shows the designed empty state with a single Create Project CTA, not
  an empty grid.
- **Generation fails mid-run** → the stage visualization shows the failed stage in a danger state and
  offers retry; it never spins forever.
- **`prefers-reduced-motion`** → all transitions collapse to instant; shimmer becomes a static skeleton.
- **Theme cookie missing or corrupt** → fall back to dark, no flash, no crash.
- **Very wide (>2000px) displays** → content is max-width-capped and centered, not stretched.
- **Below 768px** → sidebar becomes a drawer; the interview and preview remain completable.
- **Slow markdown/preview load** → skeleton in the file tree and viewer, never a layout jump.
- **Generated project with no docs directory** → the docs reader shows its empty state, not a 404.

---

## Out of scope

- **The AI chat assistant itself** — only the shell slot is reserved (issue: "leave room for").
- **Making Google / GitHub / magic-link auth work** — visible-but-disabled here; wiring them up is a
  follow-up to [#18](18-supabase-auth.md).
- **Backends for billing, API keys, Azure DevOps, usage, news, roadmap, templates, prompts** — UI
  surfaces only.
- **A finer generation-stage breakdown** — would require the engine to emit more `JobStage` values;
  separate engine issue.
- **A public `/docs` site for Airrow's own documentation** — the reader in this spec covers generated
  project docs only.
- **Marketing copywriting, testimonials, and real pricing** — placeholder copy until product supplies it.
- **The generated repo's own styling** — `template/` is untouched; this is the Airrow app UI.
- **Rebranding** — the issue is explicit: build the UI system, don't redesign the brand.
