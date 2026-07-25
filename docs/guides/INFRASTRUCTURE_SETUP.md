# Infrastructure Setup — Vercel + Supabase

One-time runbook for provisioning Airrow's hosting (Vercel) and database (Supabase). Most steps are
manual dashboard work; this is the exact order that makes the deployed app connect to Supabase.
Day-to-day local database work lives in [`DEVELOPER_GUIDE.md`](./DEVELOPER_GUIDE.md#local-supabase).

> **Founder-in-control:** nothing here runs automatically. You perform each dashboard step and paste
> the resulting values where noted. Secrets go into Vercel/`apps/web/.env.local` only — **never** into git.

---

## 1. Supabase project

1. Create a project at <https://supabase.com/dashboard> → **New project** (Free tier is fine).
   - Pick a strong DB password and store it in your password manager.
   - Choose the region closest to your users.
2. When it finishes provisioning, open **Project Settings → API** and note:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` *(server-only — never ship to the client)*
3. Link the repo's local CLI config to the cloud project and push the migration:
   ```bash
   pnpm dlx supabase login                    # opens a browser to authorize the CLI
   pnpm dlx supabase link --project-ref <ref> # <ref> is in the dashboard URL / Settings → General
   pnpm dlx supabase db push                  # applies supabase/migrations to the cloud DB
   ```
4. Verify RLS in the dashboard: **Table Editor** shows `organizations` and `organization_members`;
   **Authentication → Policies** shows each has RLS **enabled** with the read policies from the
   migration. (This is the proof-of-concept schema; the full product schema is a separate issue.)

---

## 2. Vercel project

1. At <https://vercel.com/new>, **Import** the GitHub repo (authorize the Vercel GitHub App on it).
2. **Configure Project** before the first deploy:
   - **Root Directory:** `apps/web` — Vercel detects Next.js + the pnpm workspace from here and
     installs from the repo root automatically. `apps/web/vercel.json` pins the framework.
   - **Framework Preset:** Next.js (auto-detected).
   - Leave Build/Install commands on their defaults unless a build error says otherwise.
3. **Environment Variables** — add all four for **Production** *and* **Preview** (same values unless
   you run a separate staging Supabase project):
   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
   - `NEXT_PUBLIC_*` are exposed to the browser by design; the **service_role key must NOT** carry a
     `NEXT_PUBLIC_` prefix so it stays server-only.
4. **Deploy.** The first production deploy runs off the branch you set as Production Branch.

---

## 3. Git integration (previews + production)

- **Production Branch:** set to `main` under **Project Settings → Git**. Per Airrow's branch model,
  code only reaches `main` through the strict PR chain (issue → feature → `develop` → `main`).
- **Preview Deployments:** enabled by default — every PR gets its own URL. Confirm under
  **Settings → Git** that preview deployments are on.

---

## 4. Custom domain (`airrow.app`)

1. **Project Settings → Domains → Add** → `airrow.app` (and optionally `www.airrow.app`).
2. Since the domain is already on Vercel, assigning it to this project is one click; if DNS was
   external you'd add the A/CNAME records Vercel shows.
3. Wait for the status to read **Valid Configuration** before calling production done (DNS can lag).

---

## 5. Verify end-to-end

- `pnpm build` passes locally.
- The Vercel production deploy is green and `https://airrow.app` loads.
- The deployed app can reach Supabase (no auth/network errors in the Function logs once app code
  starts reading from Supabase — that wiring is a later issue; for now the env vars are in place and
  the migration is applied).
- Local RLS proof: `pnpm dlx supabase start` then `pnpm --filter web test organizations.rls` — the
  access + denial test passes against the local DB.

---

## Notes & constraints

- **Free tier:** the Supabase project pauses after ~1 week of inactivity and has row/storage caps —
  fine for now; revisit before launch.
- **Secrets:** only ever live in Vercel env vars and your local `apps/web/.env.local` (gitignored).
  `apps/web/.env.example` documents the names with no values. The location matters: Next.js reads
  `.env*` only from the directory it runs in, so a file at the repo root is ignored and the app looks
  permanently signed out.
- **Email confirmation:** a hosted Supabase project ships with *Confirm email* **on**, so signup
  creates the account but no session — the UI sends you to "Confirm your email" instead of the
  dashboard. `supabase/config.toml` (`enable_confirmations = false`) only governs a **local** stack.
  Turn it off for the dev project under *Authentication → Sign In / Providers → Email* if you want
  signup to log you straight in.
