# UI Architecture

## Design identity

Premium developer-tool aesthetic: Linear's density, Vercel's restraint, Apple's calm. **Dark mode is
the design target**, light is derived from the same semantic tokens and ships alongside it. Minimal
chrome, generous whitespace, fast transitions, keyboard-first.

The brand mark is the strongest visual element on any screen. The **brushed-metal sheen belongs to the
logo artwork and nowhere else** — UI chrome stays matte so it never competes with content.

## Design tokens

All raw values live in [`apps/web/src/app/globals.css`](../../apps/web/src/app/globals.css) and
nowhere else; `src/components/design-tokens.test.ts` fails the build if a hex or an arbitrary `px`
value appears in a component.

Colors resolve through a second variable (`--color-bg` → `--a-bg`) so a theme swaps the value while
the utility name stays put.

| Token | Dark | Light |
|-------|------|-------|
| `bg` | `#09090b` | `#fbfbfc` |
| `bg-subtle` | `#0d0d10` | `#f4f4f6` |
| `surface` | `#111114` | `#ffffff` |
| `surface-raised` | `#17171b` | `#ffffff` |
| `border` | `#202026` | `#e5e5ea` |
| `border-strong` | `#2c2c34` | `#d2d2d9` |
| `fg` | `#fafafa` | `#0b0b0d` |
| `fg-muted` | `#9ca3af` | `#52525b` |
| `fg-faint` | `#7c8492` | `#71717a` |
| `accent` (silver) | `#cbd1da` | `#3f3f46` |
| `info` / `success` / `danger` | `#7aa2f7` / `#4ec99a` / `#f0564a` | `#2f5fd0` / `#17845a` / `#c33025` |
| `warn` | `#e3a94e` | `#8f6108` |

**Contrast on `bg`** — dark: `fg` 19.4:1 · `fg-muted` 7.7:1 · `fg-faint` 5.3:1. Light: `fg` 19.0:1 ·
`fg-muted` 7.5:1 · `fg-faint` 4.7:1. All clear the 4.5:1 AA bar at every size we use; `fg-faint` is
the floor in both themes, so anything quieter must be decorative rather than informational.

**Type scale:** `2xs` 11 · `xs` 12 · `sm` 13 · `base` 14 · `md` 15 · `lg` 17 · `xl` 21 · `2xl` 26 ·
`3xl` 33 · `4xl` 42 · `5xl` 54 · `6xl` 68 px, each with a paired line-height. Fonts: Inter (sans),
JetBrains Mono (labels, paths, code).

**Spacing** is Tailwind's 4px scale. **Radii:** `sm` 6 · `md` 8 · `lg` 12 · `xl` 16 · `2xl` 20 px.
**Elevation:** `shadow-e1/e2/e3`.

**Motion:** `animate-fade-in`, `-scale-in`, `-slide-up`, `-slide-down`, `-blur-in`, `-shimmer` on
`--ease-out-quart`. A global `prefers-reduced-motion` block collapses every animation and transition;
the skeleton shimmer becomes a flat block.

## Theming

The choice lives in the `airrow-theme` cookie, read server-side in the root layout
([`lib/theme.ts`](../../apps/web/src/lib/theme.ts)) and written by a server action from Settings — so
the first paint is already correct and there is no flash. Anything unrecognised falls back to dark.
No schema change; no `useEffect` theme flip.

## Stack

Next.js App Router · RSC by default · Server Actions for mutations · client components only for
interactivity · Tailwind v4 · **Radix primitives** for the behavior of dialog, dropdown, tooltip,
tabs, select, checkbox/radio, progress, separator, label and toast (unstyled — every pixel is ours) ·
`shiki` for server-side syntax highlighting · `marked` + DOMPurify for markdown.

## Components

One component per file in `apps/web/src/components/ui`, **no barrel** (constitution I). Import
directly: `@/components/ui/button`.

`button` · `card` (+ Header/Title/Description/Body/Footer) · `input` (Input, Textarea) · `label` ·
`file-dropzone` · `select` · `choice` (Checkbox, RadioGroup) · `dialog` · `dropdown` · `tooltip` ·
`tabs` · `breadcrumbs` · `table` · `badge` · `progress` · `skeleton` · `spinner` · `separator` ·
`toast` · `command-palette` · `states` (EmptyState, ErrorState, InlineError, **Notice**,
LoadingState, **ComingSoon**).

`file-dropzone` is the file field: click or drop, with the chosen file named back. It keeps a real
`<input type="file">` — visually hidden, still `required`, still submitted — so a form gets the same
`FormData` a bare input would give it.

Brand lives in `components/brand`: `mark`, `logo` (the mark+wordmark lockup), `splash`. Both render
**the approved artwork** from `public/brand/*.png` via `next/image` — not redrawn vectors, because no
vector original exists and tracing changes the design. The metal is baked in; `.brand-asset` darkens
it in the light theme. Size these by height (`h-*`), never `size-*` — neither asset is square.

Shell lives in `components/shell`: `sidebar`, `top-bar`, `user-menu`, `chat-slot`, `nav-items`.

**Rules.** Loading / error / empty are these components, never inline conditionals. A surface with no
backend uses `<ComingSoon>` — visible so the product's shape is honest, disabled so nothing pretends
to work. `<Notice>` carries the `warn` tone for a caution before an action or a consequence after
one; it never takes `role="alert"` and never borrows `danger`, because a warning that looks like a
failure teaches founders to dismiss both. Below ~24px the mark drops the gradient for flat `currentColor`.

## Route map

```
/                                  Landing
/start                             Signed-out interview — no account until "generate" (spec 11)
/login  /signup                    Auth — email+password live; Google/GitHub/Email/magic-link disabled
/app                               Dashboard: continue, recent projects, recent generations
/app/projects                      Project list
/app/projects/new                  Create project (step 1 of 2)
/app/projects/import               Import an existing project — ZIP or public repo (specs 63, 67)
/app/projects/[id]                 Project workspace, and what the last revision changed (spec 100)
/app/projects/[id]/interview       Adaptive interview — reopens prefilled to revise a foundation
/app/projects/[id]/generating      Live generation
/app/projects/[id]/preview         Repo browser (tree + reader + editor) — the one view of the output
/app/projects/[id]/import          Import review: what was derived, and conflicts to decide (spec 63)
/app/projects/[id]/continue        "Continue locally" handoff
/app/settings                      Profile, plan & billing, theme, workspace, connections
/app/upgrade                       What Pro gives, and the way to buy it (specs 99, 100)
/app/upgrade/return                Where Checkout returns: reconciles with Stripe, then Settings (spec 100)
```

The paywall sits at **generate**, never earlier: a founder out of free foundations can still create a
project and answer every question, and meets `/app/upgrade` at the button that would cost a Claude
call. Screens that need Pro are shown disabled with an explanation rather than hidden — seeing what
you are missing is what converts; not knowing it exists does not.

The landing page's Pro action follows the same rule from the other side (`features/landing/pro-cta.ts`):
a visitor with nothing generated goes to their free foundation, and one who has already spent it goes
straight to `/app/upgrade`. Sending everyone to `/app/projects/new` handed the only visitor who had met
the limit the one screen that cannot lift it.

Shell: collapsible sidebar + sticky top bar with breadcrumbs derived from the URL + ⌘K command
palette + a reserved `ChatSlot` column for the future repository-aware assistant. The sidebar logo
links to `/`, not `/app` — the rail already has Projects. Theme switch and account menu sit top-right
in both the app top bar and the landing header; the theme is a cookie, so the switch works signed out.

## Responsive

Desktop-first. **≥1280px** is the design target; **768–1280px** stays fully functional with the
sidebar collapsed to icons; **<768px** is usable but not optimized — the sidebar becomes a drawer and
the preview/docs trees hide. Content is max-width-capped so ultra-wide displays center rather than
stretch.

## Key experiences

- **Interview:** one question per screen, each keyed so it animates in, progress bar, card options,
  back/edit at any time.
- **Generation:** the five stages the engine actually emits (`resolve · author · assemble · validate ·
  manifest`) as a large animated visualisation with the authored-file ticker. A richer breakdown
  requires the engine to emit more stages — never invented in the UI.
- **Preview:** two-pane browser; markdown sanitized client-side, code highlighted server-side by
  shiki and passed through DOMPurify before it reaches the DOM.
- **Continue locally:** checklist handoff into month two.

## Quality bars

- WCAG AA contrast in both themes; full keyboard navigation; visible focus rings everywhere.
- Every async surface has a designed loading, empty and error state.
- No raw hex or arbitrary px in components — enforced by test.
