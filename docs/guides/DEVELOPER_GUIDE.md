# Airrow — Developer Guide

## Setup
Requirements: **Node ≥20** and **pnpm 9** (`corepack enable` or `npm i -g pnpm@9`).

```bash
pnpm install
pnpm dev            # apps/web on http://localhost:3000
pnpm engine:smoke   # headless generation-engine smoke test (no install needed)
```

Airrow runs in **local mode** out of the box: dev auth, file-backed store in `.data/`, deterministic
document authoring, ZIP delivery. Supabase / Claude authoring / GitHub push activate via env — copy
`apps/web/.env.example` to `apps/web/.env.local` and fill what you need.

> **Env lives in `apps/web/`, not the repo root.** Next.js only reads `.env*` from the directory it
> runs in, so a file at the root is silently ignored — the app then behaves as if you are permanently
> signed out. Everything else (scripts, tests) reads `apps/web/.env.local` too.

## Local Supabase
One-time cloud provisioning (Vercel + Supabase projects, env wiring, `airrow.app`) is a separate
runbook: [`INFRASTRUCTURE_SETUP.md`](./INFRASTRUCTURE_SETUP.md). For day-to-day work against a local
database you only need **Docker running** and the Supabase CLI (invoked via `pnpm dlx supabase`).

```bash
pnpm dlx supabase start          # boots Postgres + Studio locally (first run pulls images)
pnpm dlx supabase status         # prints the local URL, anon key, service_role key, DB URL
pnpm dlx supabase db reset       # replays every migration in supabase/migrations from zero
pnpm dlx supabase migration new <name>   # scaffold the next migration
pnpm dlx supabase stop           # tear the local stack down
```

- **Migrations are the only way the schema changes** (constitution §II) — never edit tables in Studio.
  They must replay cleanly from zero (`db reset`).
- Copy the keys `supabase status` prints into `apps/web/.env.local` (see `apps/web/.env.example`). Studio runs at
  http://127.0.0.1:54323; the DB is `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
- **RLS tests** (`*.rls.test.ts`) run against this local DB and are **skipped automatically** when it
  isn't reachable, so `pnpm -r test` stays green without Docker. Start Supabase to exercise them.

## Stripe / Pro billing (spec 99)
Airrow runs without any of this: with no Stripe keys the app starts normally, Settings shows Pro as
unavailable, and nothing throws. You only need it to exercise the paid path.

**1. Product and price, once.** In the [Stripe dashboard](https://dashboard.stripe.com) (test mode),
create a product with a recurring monthly price. Copy the **price id** (`price_…`), not the amount —
no figure exists anywhere in this repository, so changing the price is a dashboard edit and never a
deploy.

**2. Keys into `apps/web/.env.local`:**
```bash
STRIPE_SECRET_KEY=sk_test_…        # Developers → API keys. Server-only; never NEXT_PUBLIC_
STRIPE_PRICE_MONTHLY=price_…       # required to enable the upgrade path at all
STRIPE_PRICE_YEARLY=price_…        # optional; leave unset to offer monthly only
STRIPE_WEBHOOK_SECRET=whsec_…      # from step 3
```

**3. The webhook, which is the part that actually grants Pro.** A Checkout redirect proves the browser
reached a URL, not that money moved, so `organizations.plan` is written *only* here.
```bash
pnpm dlx stripe login
pnpm dlx stripe listen --forward-to localhost:3000/api/stripe/webhook
# prints "Ready! Your webhook signing secret is whsec_…" — that is STRIPE_WEBHOOK_SECRET
```
Leave `stripe listen` running while you test. Deployed, register the endpoint under Developers →
Webhooks at `https://<your-domain>/api/stripe/webhook` and take the signing secret from there — a
wrong value means every event is rejected, which is correct behaviour and looks like nothing happening.

**4. Try it.** `pnpm dev`, sign in, generate a foundation to spend the free one, then hit generate
again — you land on `/app/upgrade`. Pay with Stripe's test card `4242 4242 4242 4242`, any future
expiry, any CVC. The plan flips when the webhook lands, not when the browser returns, so a reload may
be a second behind.

Useful while debugging:
```bash
pnpm dlx stripe trigger customer.subscription.deleted   # replay a cancellation
```

- **A failed payment does not downgrade.** Stripe retries a declined card for days and reports
  `past_due`, which stays Pro. Only `customer.subscription.deleted` ends it.
- **Cancelling runs to the end of the paid period** (`cancel_at_period_end`), so Settings says "Pro
  runs until …" rather than cutting off mid-month.
- Events are recorded in `stripe_events` so a redelivery is a no-op; if applying one fails the row is
  released, so Stripe's retry is a real second attempt rather than a "duplicate" no-op.
- To grant yourself Pro without paying, do it the same way admin accounts are granted — SQL, not app
  code: `update organizations set plan = 'pro' where id = '…';`

## Code organization
```
apps/web/src/
  app/**            App Router routes (Server Components by default)
  features/<area>/  feature slices — components + actions.ts / queries.ts
  components/ui/     shared shadcn/ui-based design system
  lib/               auth, data/store.ts (the DataStore), middleware helpers
packages/engine/src/    pure generation engine (scaffold renderer + pipeline)
template/               the canonical scaffold generated for customers — single source of output
packages/schemas/src/   Zod schemas & types shared across app + engine
```

## Patterns
- **Server Components by default.** Reach for a client component only for interactivity.
- **Data access only through feature `queries.ts` / `actions.ts`**, which call the DataStore. Never
  hit Supabase / the filesystem directly from a component.
- **Zod at every boundary** — forms, server actions, engine I/O, and all LLM output. `any` is
  forbidden (TypeScript strict).
- **`packages/engine` and `packages/schemas` stay pure** — no imports from `apps/*`, no `process.env`.
- **Design tokens, not literals** — use the Tailwind/design-system tokens; reuse `components/ui`
  before adding a component.
- **Untrusted Markdown** (generated/authored) is rendered sanitized (DOMPurify), never executed.

## Testing (Vitest)
- Co-locate tests with the code: `*.test.ts` / `*.test.tsx`, picked up by Vitest's glob and CI.
- Deterministic only: no reliance on local time/timezone, randomness, or the network. CI pins
  `TZ=UTC`; anchor fake time with `vi.setSystemTime`.
- The engine is testable offline via its mock authoring provider + snapshot fixtures.

```bash
pnpm -r test                      # all packages
pnpm --filter web test <file>     # single file while iterating
```

## Verification bar (run before any PR)
```bash
pnpm -r typecheck   # tsc --noEmit, strict
pnpm -r lint        # ESLint — no new issues
pnpm -r test        # Vitest — green (note known pre-existing failures)
pnpm test:scripts   # the CI helpers in scripts/ — `-r` does not reach them
```
> ESLint + Vitest are the agreed tools. If a package still lacks its `lint` / `test` script or dev
> dependency, wire it in the change that first needs it — don't skip the bar.

## Workflow
Spec-driven, via slash commands: `/createspec → /clarify → /implement → /analyze`, with `/push` and
`/pr-check` around the PR. Governed by [`../../.claude/spec-kit/constitution.md`](../../.claude/spec-kit/constitution.md).
Branch + PR direction: see [`../architecture/BRANCHING.md`](../architecture/BRANCHING.md).

## Troubleshooting
- **`pnpm dev` fails to start:** confirm Node ≥20 and `pnpm -v` ≈ 9; re-run `pnpm install`.
- **Type errors after schema edits:** `packages/schemas` is the source of truth — rebuild types with
  `pnpm -r typecheck` to see the real boundary breaks.
- **Engine changes:** run `pnpm engine:smoke` for a fast end-to-end sanity check without the app.
