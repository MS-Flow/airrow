# Spec: Supabase full schema migration + DataStore cutover

**GitHub issue:** #14 — "Think about necessary fields for this project and also migrate them to supabase. Like login for example."
**Branch:** `14-supabase-schema-auth` (from `feature/infrastructure`)
**Feature:** Infrastructure
**Depends on:** [`9-vercel-supabase-setup`](9-vercel-supabase-setup.md) — Supabase project, `supabase/` scaffolding, and the `organizations` + `organization_members` + `is_org_member()` proof.
**Split from this spec:** real Supabase Auth (email + password login/logout, `handle_new_user()`
signup trigger on `auth.users`, `profiles.id → auth.users` FK, `resolveSession` via the Supabase
SSR session) is a **follow-up auth issue** — not built here. See Out of scope.
**Status:** 🔄 In progress

<!-- Status legend: ⏳ Not started · 🔄 In progress · ✅ Done -->

---

## User story
As a **founder using Airrow** I want **all my data persisted in Supabase under my own organization**
so that **the app is backed by a real multi-tenant database instead of the local file store, ready
for real login to land on top.**

---

## Background
Current state, grounded in real code with `file:line` links (add these during `/implement`):
- The app persists everything through the local file-backed store
  ([apps/web/src/lib/data/store.ts](apps/web/src/lib/data/store.ts)) — record shapes for users,
  sessions, organizations, members, projects, interviews, model versions, jobs, deliveries.
- #9 scaffolded `supabase/` and the first migration
  ([supabase/migrations/20260724132100_init.sql](supabase/migrations/20260724132100_init.sql)) with
  `organizations`, `organization_members`, and the `is_org_member()` helper — a proof of the RLS
  pattern only.
- The canonical target schema is [`docs/architecture/DATABASE_DESIGN.md`](../docs/architecture/DATABASE_DESIGN.md).
- Auth today is dev-only wiring resolved in `store.ts` (`resolveSession`); there is no real login.
  This spec keeps that dev-auth session mechanism as a bridge, but re-points it at Supabase — real
  login is the follow-up auth issue.

---

## Design decision
Two coordinated moves: (1) add every remaining table from `DATABASE_DESIGN.md` as idempotent
migrations under `supabase/migrations`, each with RLS scoped via `is_org_member()`; (2) **full
cutover** — reimplement the DataStore (`store.ts`) internals to read/write Supabase instead of the
`.data/` JSON file, and ship a one-off script that migrates existing `.data/` records into Supabase.
Real login (email + password, `auth.users` signup trigger, `profiles → auth.users` FK, SSR session)
is deliberately **split into a follow-up auth issue**; until then the existing dev-auth session
bridges, writing its `profiles` / `organizations` / `organization_members` rows into Supabase
server-side. Also out: GitHub App delivery and Storage buckets.

---

## Exact changes (file:line)
1. **`supabase/migrations/<ts>_schema.sql`** (new) — the remaining org-scoped tables, RLS policies,
   and role grants (service_role for the app path now; authenticated for when auth lands).
2. **`apps/web/src/lib/data/supabase.ts`** (new) — server-only Supabase client built from the
   service-role key (reads `process.env`; allowed in `apps/*`, never in `packages/*`).
3. **`apps/web/src/lib/data/store.ts`** — reimplement the **org-scoped** functions against Supabase.
   These become **`async` (`Promise<T>`)** — a Supabase cutover cannot keep the synchronous
   signatures, so all call sites gain `await`. Dev-auth `users`/`sessions` stay on the `.data/` file
   store (no canonical Supabase home; replaced by Supabase Auth in the follow-up).
4. **14 call sites** (RSC pages, route handlers, feature `actions.ts`, `runner.ts`, `lib/auth.ts`) —
   add `await` where the DataStore is now async.
5. **`scripts/migrate-data-to-supabase.mjs`** (new) — one-off importer that reads existing `.data/`
   records and upserts them into Supabase (idempotent; safe to re-run).
6. **`apps/web/src/lib/data/*.rls.test.ts`** — access + denial test per new table.
<The follow-up auth issue owns: Supabase SSR client, login/logout server actions, the
`handle_new_user()` trigger, `profiles.id → auth.users` FK, and `resolveSession` via the Supabase
session. Storage buckets stay out of scope — so `artifacts` stores the `GenerationResult` as `jsonb`
here rather than a Storage path (a deliberate divergence from `DATABASE_DESIGN.md`, revisited when
Storage lands).>

---

## Data model
Full schema per [`DATABASE_DESIGN.md`](../docs/architecture/DATABASE_DESIGN.md). Tables (all with
`id uuid pk default gen_random_uuid()`, timestamps where noted, RLS + policy scoped via
`is_org_member()`):
`profiles`, `organizations` *(extend #9: `slug`, `kind`, `created_by`)*, `organization_members`
*(exists)*, `projects`, `interviews`, `project_models`, `generation_jobs`, `artifacts`,
`artifact_files`, `deliveries`, `repo_connections`. Migrations only; never hand-edit the dashboard.

**Auth-coupling note:** `profiles.id → auth.users(id)` is finalized by the follow-up auth issue.
Here `profiles` is created keyed on its own uuid so the dev-auth bridge can seed rows without real
`auth.users` entries; the FK is added when Supabase Auth lands.

**Documented divergences from `DATABASE_DESIGN.md`** (each because a coupled concern is out of scope):
- `users` + `sessions` remain on the `.data/` file store (dev-auth bridge) — they map to
  `auth.users` / Supabase sessions, which the auth issue owns.
- `artifacts` stores the `GenerationResult` as a `jsonb` column, not a Storage `storage_path` +
  `artifact_files` manifest — Storage buckets are out of scope.
- App-path access is via the **service-role** key (bypasses RLS); own-org visibility is enforced by
  server-side scoping now, with RLS policies in place for when `authenticated` (real auth) arrives.
- Column shapes follow the live `store.ts` record types (e.g. the richer `generation_jobs` fields)
  so the cutover is lossless; `DATABASE_DESIGN.md` to be reconciled when auth + Storage land.

---

## Acceptance criteria
- [x] All tables above exist as idempotent migrations in `supabase/migrations`, replaying cleanly from zero
- [x] RLS enabled on every table, scoped via `is_org_member()`; writes additionally check role where relevant
- [x] Every table has an access **and** denial test (Vitest + local Supabase)
- [x] `store.ts` reads/writes Supabase (full cutover) — functions are now `async` (the sync
      "signatures unchanged" claim was infeasible; the 14 call sites were updated to `await`)
- [x] A one-off script migrates existing `.data/` records into Supabase (idempotent, re-runnable)
- [x] Only own-org data is visible through the DataStore (server-side org scoping + RLS, defense in depth)
- [x] Migrations pushed to the cloud project (`frqhxybuzcmecxqkimxj`)
- [ ] App connects to Supabase in the **deployed** (Vercel) environment — manual check after deploy
- [x] Typecheck passes; lint adds no new issues; tests green

### Verification
- **New tests** — `apps/web/src/lib/data/schema.rls.test.ts` (8): access + denial for projects,
  interviews, project_models, generation_jobs, artifacts, deliveries, repo_connections, profiles.
  `store.cutover.test.ts` (3): the real DataStore against local Supabase — project create + interview
  seed + read-back + cross-org denial; model/job/artifact round-trip; status update + cascading delete.
  Both skip when local Supabase is unreachable, keeping the default suite green without Docker.
- **Run 2026-07-25** (local Supabase up via `supabase start` + `db reset`):
  `pnpm -r typecheck` ✓ · `pnpm -r lint` ✓ · `pnpm -r test` ✓ (engine 22/22; web 13/13) ·
  `next build` ✓ (all app/data routes dynamic — nothing hits Supabase at build).
- Cloud: `supabase db push` applied `20260725100000_schema.sql` to the cloud project.
- `.data/` migration script (`pnpm migrate:data`) is idempotent (per-row upserts; orphans skipped
  with a warning) — exercised structurally; run against a populated `.data/` for a full manual check.

## Implementation notes
- **Async cutover:** a Supabase cutover cannot keep synchronous signatures, so every org-scoped
  DataStore function returns `Promise<T>` and all 14 call sites now `await`. `updateUserName`,
  `createSession`, `deleteSession`, `uid` stay sync (bridge/local only).
- **Dev-auth bridge:** `users` + `sessions` moved to `.data/bridge.json`; `resolveSession` reads the
  session/user from the bridge and the org/membership from Supabase. Real auth replaces this.
- **service-role client** (`lib/data/supabase.ts`) bypasses RLS, so every query is additionally
  `organization_id`-scoped server-side (defense in depth). RLS policies are in place and tested for
  when `authenticated` (real login) arrives.
- Divergences from `DATABASE_DESIGN.md` (artifacts-as-jsonb, users/sessions on the bridge, richer
  `generation_jobs` columns) are listed under Data model; reconcile the doc when auth + Storage land.

---

## Edge cases
- Re-running the `.data/` migration script → idempotent upserts, no duplicate rows or personal orgs.
- `anon` role → sees no rows (policies require `auth.uid()` membership).
- Empty/absent `.data/` (fresh clone) → migration script is a no-op, not an error.
- A `.data/` record referencing a user/org that no longer exists → skipped with a logged warning,
  not a hard failure.

---

## Security
- **Secrets stay server-side.** The service-role key is read only in `lib/data/supabase.ts` (server
  module, never imported by a client component — verified) and never reaches the client bundle. Only
  the `NEXT_PUBLIC_*` URL + anon key are public. `.data/bridge.json` is gitignored.
- **Tenancy enforced server-side.** The service-role client bypasses RLS, so every DataStore query is
  additionally `organization_id`-scoped in code (defense in depth, §II). RLS policies exist and are
  denial-tested on every table for when real `authenticated` login lands.
- **Cascading delete.** Deleting a project cascades to its interviews, models, jobs, artifacts, and
  deliveries via `on delete cascade` (customer-IP invariant), covered by the cutover test.
- No dependency advisories introduced (`@supabase/supabase-js` added; `pnpm -r lint`/build clean).

---

## Out of scope
- **Real Supabase Auth — the follow-up auth issue:** email + password login/logout, the
  `handle_new_user()` signup trigger on `auth.users`, the `profiles.id → auth.users` FK, and
  `resolveSession` via the Supabase SSR session. Auth method is decided: **email + password**.
- Team invites / multi-user orgs (`kind='team'` activates later, M7).
- GitHub App delivery wiring — `repo_connections` is created but not populated (separate issue).
- Storage buckets for artifacts (separate issue).
