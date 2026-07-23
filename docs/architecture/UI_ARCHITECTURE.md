# UI Architecture

## Design identity

Premium developer-tool aesthetic: Linear's density and speed, Vercel's restraint, Stripe's polish. **Dark mode first** — dark is the default and design target; light mode derived. Minimal chrome, generous whitespace, fast transitions (no decorative animation), keyboard-friendly.

Design tokens (Tailwind CSS variables): near-black neutral background scale, one accent color, semantic tokens (`bg`, `bg-subtle`, `border`, `fg`, `fg-muted`, `accent`, `danger`...). Components exclusively from `apps/web/src/components/ui` (shadcn/ui based, tokenized). No raw hex values in app code.

## Stack

Next.js App Router · React Server Components by default · Server Actions for mutations · client components only for interactivity (interview flow, preview tree, command palette) · Tailwind + shadcn/ui · Zod + react-hook-form for forms · Supabase Realtime for generation progress.

## Route map

```
/                       Landing (static, marketing)
/login                  Auth (magic link + GitHub)
/app                    Dashboard: recent projects, quick actions
/app/projects           Project list
/app/projects/new       Create project → starts interview
/app/projects/[slug]    Project overview (status, artifacts, deliveries)
/app/projects/[slug]/interview     Adaptive interview
/app/projects/[slug]/generating    Live generation progress
/app/projects/[slug]/preview       Repo preview (tree + file viewer)
/app/projects/[slug]/continue      "Continue Locally" handoff
/app/templates          Templates gallery (M6)
/app/prompts            Prompt library (M6)
/app/settings           Profile, organization, connections
```

Layout: left sidebar nav (collapsible) + content area; command palette (⌘K) from M2 as stub, wired in M6.

## Feature-module structure (apps/web)

```
src/
  app/                  routes (thin: compose features)
  features/
    auth/
    projects/
    interview/          schema-driven renderer + question components
    generation/         progress UI, job hooks
    preview/            file tree, markdown viewer
    delivery/           zip, github connect & push
    settings/
  lib/                  supabase clients, utils
  ...each feature: components/ actions.ts queries.ts types.ts
```

Rules: routes never contain business logic; features never import other features' internals (shared code moves to `packages/`); data flows RSC → feature components via typed props.

## Key experiences

- **Interview:** one question per screen, instant transitions, progress indicator, card-style options, back/edit at any time. Feels like Linear onboarding, not a form.
- **Generation:** live stage/document progress (Realtime), streaming file-tree buildup — the "watching your foundation being built" moment.
- **Preview:** two-pane repo browser; markdown rendered beautifully; this screen must sell the product on sight.
- **Continue Locally:** checklist handoff (clone, open VS Code, run Claude Code, first prompt provided) — the bridge into month two.

## Quality bars

- Lighthouse ≥ 95 on landing; instant (<100ms perceived) route transitions in app.
- Full keyboard navigation; WCAG AA contrast in dark theme.
- Every async surface has designed loading, empty, and error states — specified in each feature spec.
