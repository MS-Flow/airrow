# Spec: Supabase Auth — email + password login

**GitHub issue:** #18 — "Auth"
**Branch:** `18-supabase-auth` (from `feature/infrastructure`)
**Feature:** Infrastructure
**Depends on:** [`14-supabase-schema-auth`](14-supabase-schema-auth.md) — the Supabase schema and
DataStore cutover, which left `profiles.id → auth.users` unlinked and kept a dev-auth bridge.
**Status:** ✅ Done

<!-- Status legend: ⏳ Not started · 🔄 In progress · ✅ Done -->

---

## User story
As a **founder** I want **to sign up and log in with email + password** so that **my session is a
real authenticated Supabase user tied to my own organization, replacing the temporary dev-auth
bridge.**

---

## Background
Current state, grounded in real code with `file:line` links (add these during `/implement`):
- #14 cut the DataStore over to Supabase but kept a **dev-auth bridge** — `users` + `sessions` live
  in `.data/bridge.json`, and `resolveSession` reads the session/user from the bridge and the org
  from Supabase ([apps/web/src/lib/data/store.ts](apps/web/src/lib/data/store.ts)).
- Session helpers (`signIn`, `signOut`, `getSession`, `requireSession`) are dev-only
  ([apps/web/src/lib/auth.ts](apps/web/src/lib/auth.ts)); there is no password, no real auth.
- `profiles` exists but is empty and **not** FK'd to `auth.users`; `organizations.created_by` and
  `organization_members.user_id` are bare uuids seeded by the bridge (see #14 migration).
- Supabase Auth is not yet enabled in [supabase/config.toml](supabase/config.toml).
- **Fresh start:** existing `.data/bridge.json` users are discarded (no production users yet) —
  everyone re-signs up through real auth. No bridge-user migration script.

---

## Design decision
Enable Supabase Auth (email + password); add a `handle_new_user()` trigger on `auth.users` that
provisions `profiles` + personal `organizations` + owner `organization_members`; add the deferred
`profiles.id → auth.users` FK; use the Supabase SSR client to resolve the session server-side and
rewrite `lib/auth.ts` + `resolveSession` onto it; retire the `.data/bridge.json` bridge (fresh
start — existing bridge users discarded). Enforcement is **defense in depth**: Next.js middleware
refreshes the session cookie and coarse-redirects unauthenticated `/app/**`, while `requireSession()`
in each RSC / server action / route handler does the actual org-scoping. Deliberately does **not**
add OAuth/magic-link, team invites, or Storage.

---

## Exact changes (file:line)
<Populated by `/implement`.>
1. **`supabase/config.toml`** — enable email + password auth.
2. **`supabase/migrations/<ts>_auth.sql`** (new) — `profiles.id → auth.users` FK; `handle_new_user()`
   trigger (idempotent: no duplicate personal org on re-fire); tighten `organizations.created_by` /
   `organization_members.user_id` references to `profiles` where safe.
3. **`apps/web/src/lib/data/supabase-server.ts`** (new) — SSR client reading the auth session
   (anon key + cookies), distinct from the service-role client.
4. **`apps/web/src/lib/auth.ts`** — `signIn`/`signUp`/`signOut`/`resolveSession` via Supabase Auth.
5. **`apps/web/src/app/login/**`, `signup` UI** — server actions + explicit loading/error/empty states.
6. **`apps/web/src/middleware.ts`** (new/extend) — refresh the Supabase session cookie and redirect
   unauthenticated `/app/**` to `/login`.
7. **`store.ts`** — retire the dev-auth bridge (`users`/`sessions` helpers + `.data/bridge.json`).
8. **`/api/projects/**` route handlers** — keep the `getSession` 401 guard (hard-enforced alongside
   middleware).

---

## Data model
No new tables. Adds the `profiles.id → auth.users(id)` FK (on delete cascade) deferred from #14, and
the `handle_new_user()` trigger. Follows the data invariants: personal org auto-created per user;
RLS already enforces `auth.uid()` membership (now populated by real auth). Migration idempotent,
replays from zero.

---

## Acceptance criteria
- [x] Signup auto-creates profile + personal org (`kind='personal'`) + owner membership via the trigger — **tested**
- [x] `profiles.id → auth.users` FK enforced; deleting the auth user cascades the profile — **tested**
- [x] The dev-auth bridge is removed; identity comes from the Supabase SSR session (`getSession`),
      org via `getOrgForUser` — bridge file/functions deleted from `store.ts`
- [x] Unauthenticated `/app/**` and `/api/projects/**` are gated by `middleware.ts` (redirect / 401),
      with `requireSession()` / `getSession` still enforcing in RSC/actions (code + build verified)
- [x] Migrations replay cleanly from zero (`supabase db reset`) and pushed to cloud (`db push`)
- [x] Typecheck passes; lint adds no new issues; tests green
- [ ] A new user can sign up with email + password and is logged in — **manual** (needs a running app)
- [ ] Log out / log back in; session persists across requests (SSR) — **manual**
- [ ] A logged-in user sees **only** their own org's data end-to-end — **manual** (RLS + scoping are
      unit-tested; the logged-in browser path needs the app running / deployed)

### Verification
- **New tests** — `apps/web/src/lib/data/auth.trigger.test.ts` (3): creates two real auth users via
  the admin API → asserts profile + personal org + owner membership; profiles RLS **access + denial**
  (each user sees only their own profile); profile cascade on `auth.users` delete. `schema.rls.test.ts`
  adjusted (profiles case moved here, since `profiles.id` is now FK'd to `auth.users`).
- **Context sync (§IV):** the settings page's stale "local mode / `.data/`" copy was updated to
  describe Supabase auth + Postgres, since this change makes the old copy false.
- **Run 2026-07-25** (local Supabase, `db reset`): `pnpm -r typecheck` ✓ · `pnpm -r lint` ✓ ·
  `pnpm -r test` ✓ (engine 22/22; web 15/15) · `next build` ✓ (`/signup` route + middleware bundled).
- Cloud: `supabase db push` applied `20260725110000_auth.sql`.
- **Manual (pending a running app / Monday's Vercel unblock):** sign up → rows + redirect to `/app`;
  log out → `/app` redirects to `/login`; log in → data visible.

## Implementation notes
- **SSR vs service-role:** two server clients now — `supabase-server.ts` (anon key + cookies, runs
  *as the user*, RLS applies) for auth/session; `supabase.ts` (service-role) for the DataStore. Never
  imported client-side.
- **Bridge retired:** `store.ts` lost `upsertUserByEmail`/`updateUserName`/`createSession`/
  `deleteSession`/`resolveSession` and all `.data/` filesystem code; gained `getOrgForUser` +
  `setDisplayName`. `lib/auth.ts` is now `signUp`/`signIn`/`signOut`/`getSession`/`updateName`.
- **FK scope:** only `profiles.id → auth.users` was added. `organization_members.user_id` /
  `organizations.created_by` stay bare uuids — tightening them to `auth.users` FKs would require
  reworking #14's synthetic-user integration tests; deferred (documented limitation: deleting an auth
  user leaves its personal org orphaned until a cleanup pass).
- **Local vs cloud confirmations:** local `enable_confirmations=false`, so signup logs in
  immediately. Cloud email confirmation / SMTP is out of scope (issue note).

---

## Security
- Passwords handled entirely by Supabase Auth — never stored or logged by app code.
- Service-role key stays server-only; the browser only ever sees the anon key. The SSR client uses
  the anon key + httpOnly secure session cookies.
- Auth decisions made server-side; never trust client-supplied user/org ids.

---

## Edge cases
- Re-firing `handle_new_user()` (e.g. ret/replay) → idempotent, no duplicate personal org.
- Signup with an already-registered email → Supabase Auth error surfaced, no partial rows.
- Existing `.data/bridge.json` users → discarded (fresh start); the file is removed, no migration.
- Authenticated user with no membership row (shouldn't happen post-trigger) → treated as no session.

---

## Out of scope
- Magic-link / OAuth / SSO providers (email + password only for now).
- Team invites / multi-user orgs (`kind='team'` activates later, M7).
- Password-strength UX beyond Supabase defaults; email deliverability / SMTP customization.
- GitHub App delivery and Storage buckets (separate issues).
