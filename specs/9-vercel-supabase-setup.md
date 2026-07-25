# Spec: Vercel and Supabase infrastructure setup

**GitHub issue:** #9 — "Set up Vercel and Supabase"
**Branch:** `9-vercel-supabase-setup` (from `feature/infrastructure`)
**Feature:** Infrastructure
**Depends on:** nothing — first infra step for Airrow.
**Status:** ✅ Done

<!-- Status legend: ⏳ Not started · 🔄 In progress · ✅ Done -->

---

## User story
As a **founder setting up Airrow's infrastructure** I want **Vercel and Supabase connected and
configured for `apps/web`** so that **the app can be deployed (preview + production) and store data
with multi-tenant RLS from day one.**

---

## Background
Current state, grounded in real code with `file:line` links (add these during `/implement`):
- `apps/web` is the Next.js app in this pnpm workspace monorepo. The domain `airrow.app` is already
  owned and registered on Vercel, but **no Vercel project exists yet** — this issue creates the
  project from scratch and attaches the domain.
- No `.env.example` currently documents Supabase keys (confirm exact current state during `/implement`).
- No `supabase/migrations` directory exists yet. The app currently only has the local file-backed
  store (`apps/web/src/lib/data/store.ts`) — there is no cloud database at all yet, so this issue
  covers full Supabase project creation **including** the initial migration scaffolding (see Design
  decision).

---

## Design decision
This is primarily manual, guided infra provisioning (Vercel project + Supabase project + env var
wiring) rather than application code — the founder performs the external dashboard steps and
Claude Code guides each one and verifies the result via `pnpm build` / deploy. Because there is no
cloud database at all yet, this issue also creates the `supabase/migrations` scaffolding with one
minimal proof-of-concept table (e.g. `organizations`) and its RLS policy, so "RLS enabled by
default" is actually demonstrated end-to-end rather than only configured in the dashboard. It
deliberately does **not** build out the real product schema, auth flows, or GitHub App integration —
each is a separate issue.

---

## Exact changes (file:line)
1. **`supabase/config.toml`, `supabase/.gitignore`** (new) — `supabase init` scaffolding; local
   stack config, ignores local env/secrets.
2. **`supabase/migrations/20260724132100_init.sql`** (new) — `organizations` + `organization_members`
   + `is_org_member(org_id)` security-definer helper + RLS policies (deny-by-default, member-scoped
   reads). Timestamped filename per the Supabase CLI convention (the spec sketch said `0001_init`).
3. **`.env.example`** — Supabase URL + anon + service_role keys and `SUPABASE_DB_URL`, with local-dev
   defaults documented; no values committed.
4. **`apps/web/vercel.json`** (new) — pins `framework: nextjs`; Root Directory `apps/web` is set in
   the dashboard (documented in the runbook), from where Vercel auto-installs the pnpm workspace.
5. **`apps/web/src/lib/data/organizations.rls.test.ts`** (new) — RLS access + denial test against
   local Supabase; skips when the DB is unreachable.
6. **`apps/web/package.json`** — add `pg` + `@types/pg` devDeps for the RLS test.
7. **`docs/guides/DEVELOPER_GUIDE.md`** — new "Local Supabase" section (dev workflow).
8. **`docs/guides/INFRASTRUCTURE_SETUP.md`** (new) — step-by-step manual provisioning runbook
   (Supabase project, Vercel project, git integration, `airrow.app` domain, verification).

---

## Data model
Proof-of-concept tenancy only, in `supabase/migrations/20260724132100_init.sql`:
- `organizations` (`id`, `name`, `created_at`) — the tenancy root.
- `organization_members` (`organization_id`, `user_id`, `role`, `created_at`) — membership join.
  `user_id` is a bare `uuid` here; the real schema wires it to `profiles → auth.users` (separate
  issue). `auth.uid()` still identifies the caller.
- `is_org_member(org_id)` — security-definer helper (constitution §II RLS pattern).
- RLS enabled on both tables; deny-by-default with member-scoped `select` policies.

This exists solely to demonstrate the RLS pattern works on this Supabase project — the real product
schema (projects, interviews, artifacts, etc.) is a separate issue per "Out of scope".

---

## Acceptance criteria
Legend: **[code]** delivered by this change · **[manual]** founder dashboard step, guided by
[`INFRASTRUCTURE_SETUP.md`](../docs/guides/INFRASTRUCTURE_SETUP.md).

- [ ] **[manual]** Vercel project connected to the GitHub repo
- [x] **[code]** Root/monorepo settings pinned (`apps/web`, pnpm) — `apps/web/vercel.json` + runbook
- [ ] **[manual]** Preview deployments enabled for PRs
- [ ] **[manual]** Production deployment on `main`
- [ ] **[manual]** Custom domain `airrow.app` attached to the Vercel project
- [ ] **[manual]** Supabase project created (free tier)
- [ ] **[manual]** Database credentials generated
- [x] **[code]** RLS enabled by default, proven via `organizations` table + policy + access/denial
      test passing green against local Supabase (2/2)
- [x] **[code]** Local development workflow documented (`DEVELOPER_GUIDE.md` → Local Supabase)
- [ ] **[manual]** Supabase URL + keys added to Vercel (Production + Preview)
- [x] **[code]** `.env.example` updated with all keys (no secrets in the repo)
- [x] **[code]** Secrets server-side only — `service_role` key has no `NEXT_PUBLIC_` prefix; documented
- [x] **[code]** `pnpm build` passes
- [ ] **[manual]** Deploy to Vercel succeeds
- [ ] **[manual]** App can connect to Supabase in the deployed environment
- [x] **[code]** Typecheck passes; lint adds no new issues; tests green (RLS test skips without Docker)

### Verification
- **New tests** — `apps/web/src/lib/data/organizations.rls.test.ts`: RLS access ("member reads only
  their own org") + denial ("member cannot see another org") against local Supabase, per §V. Skips
  when the DB is unreachable so `pnpm -r test` stays green without Docker.
- **Run 2026-07-24:** `pnpm -r typecheck` ✓ · `pnpm -r lint` ✓ (no new issues) · `next build` ✓ ·
  `pnpm -r test` ✓ (engine 8/8). RLS test exercised **green** against local Supabase
  (`supabase start` + `supabase db reset` replays the migration from zero) — 2/2 pass. Without
  Docker it skips, keeping the default suite green; CI wiring belongs to `feature/ci-cd`.
- **Bug the test caught:** the first run failed with `permission denied for table organizations` —
  RLS filters rows but the `authenticated` role still needs a table `GRANT`, and Supabase no longer
  auto-exposes new tables. Fixed by adding `grant select … to authenticated` in the migration.
- Manual dashboard criteria are verified by the founder following the runbook.

---

## Edge cases
- Supabase free-tier project limits (pausing after inactivity, row/storage caps) → acceptable for now;
  note as a known constraint, not a blocker.
- Secrets accidentally added client-side → build must fail or be caught by review before merge.
- `airrow.app` DNS/domain propagation delay → verify via Vercel's domain status check before
  declaring production deployment done.

---

## Security
- Secrets (`SUPABASE_SERVICE_ROLE_KEY`, DB URL) live only in Vercel env vars and gitignored
  `.env.local` — `.env.example` carries names, never values. The service_role key deliberately has
  **no** `NEXT_PUBLIC_` prefix so it never enters the client bundle.
- RLS is enabled on every table created here with deny-by-default policies scoped through
  `is_org_member` (constitution §II) — the proof-of-concept table ships with its access control.
- `pg` added as a dev-only dependency (test harness), not shipped to the client.

## Out of scope
- Database schema and tables (separate issue).
- Auth flows (separate issue).
- GitHub App integration (separate issue).
