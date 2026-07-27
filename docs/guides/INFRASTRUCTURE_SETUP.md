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
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` _(server-only — never ship to the client)_
3. Link the repo's local CLI config to the cloud project and push the migration:
   ```bash
   pnpm dlx supabase login                    # opens a browser to authorize the CLI
   pnpm dlx supabase link --project-ref <ref> # <ref> is in the dashboard URL / Settings → General
   pnpm dlx supabase db push                  # applies supabase/migrations to the cloud DB
   ```

   - If `supabase link` fails with `Your account does not have the necessary privileges`, the CLI
     is authenticated as an account that cannot see the project. Log out, log back in with the
     Supabase owner/admin account, or ask the project owner to grant access, then rerun the link.
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
3. **Environment Variables** — add all four for **Production** _and_ **Preview** (same values unless
   you run a separate staging Supabase project):
   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
   | `ANTHROPIC_API_KEY` | Claude API key — enables authored prose (spec 65) |
   - `NEXT_PUBLIC_*` are exposed to the browser by design; the **service_role key must NOT** carry a
     `NEXT_PUBLIC_` prefix so it stays server-only.
   - Without `ANTHROPIC_API_KEY` a deploy still generates — `authorFoundation` returns `null` and the
     engine derives every document from the answers instead. That is a supported outcome, so nothing
     errors and nothing in the UI says the prose was not written. The tell is in the database: a job
     whose `prompt_version` is null was not authored.
4. **Deploy.** The first production deploy runs off the branch you set as Production Branch.

---

## 3. Git integration (previews + production)

Vercel's Git integration is the **only** deploy mechanism — there is no GitHub Actions workflow.
Every push deploys automatically once the project is connected.

- **Production Branch:** set to `main` under **Project Settings → Git**. Per Airrow's branch model,
  code only reaches `main` through the strict PR chain (issue → feature → `develop` → `main`).
- **Preview Deployments:** enabled by default — every PR / branch push gets its own throwaway URL.
  Confirm under **Settings → Git** that preview deployments are on.
- **Branch Domain for `develop`:** **Project Settings → Domains → Add** → `dev.airrow.app` → under
  "Git Branch" pick `develop`. This aliases the hostname to whatever `develop` last deployed, so the
  URL never changes between deploys. `apps/web/vercel.json` adds `X-Robots-Tag: noindex` on this host
  so it never gets indexed.

---

## 4. Custom domain (`airrow.app`)

1. **Project Settings → Domains → Add** → `airrow.app` and `www.airrow.app`.
2. Since the domain is already on Vercel, assigning it to this project is one click; if DNS was
   external you'd add the A/CNAME records Vercel shows.
3. `www.airrow.app` → apex redirect is handled by `apps/web/vercel.json` (host-based redirect), not a
   dashboard setting — no extra step needed once both hostnames are attached.
4. Wait for the status to read **Valid Configuration** before calling production done (DNS can lag).

> **Blocked as of 2026-07-27.** `airrow.app` was bought under a Vercel team that was later deleted,
> which leaves the domain registered (Name.com, expires 2027-07-23, still on `*.vercel-dns.com`) but
> unreachable from every scope this account can access — so steps 1–4 cannot be completed yet. It
> needs a Vercel Support ticket to be moved into the `airrow` team. Full diagnosis and the two
> recovery routes: [`specs/12-vercel-domains.md`](../../specs/12-vercel-domains.md) § _Domain recovery_.
>
> **Never delete a Vercel team that owns a purchased domain** — the domain does not follow you, and
> there is no self-service way to get it back. Move the domain out first.

### Branch → URL mapping

| Branch                       | URL                                                | Stability                            |
| ---------------------------- | -------------------------------------------------- | ------------------------------------ |
| `main`                       | `https://airrow.app` (+ `www.airrow.app` redirect) | Production — never changes           |
| `develop`                    | `https://dev.airrow.app`                           | Stable alias — same URL every deploy |
| `feature/**`, `<nr>-<short>` | Vercel-generated preview URL                       | Throwaway — new URL per deploy       |

---

## 5. Verify end-to-end

- `pnpm build` passes locally.
- The Vercel production deploy is green and `https://airrow.app` loads; `https://www.airrow.app`
  redirects to it (`curl -I https://www.airrow.app`).
- Push to `develop` and confirm `https://dev.airrow.app` updates and the hostname stays the same as
  the previous deploy; `curl -I https://dev.airrow.app` shows `X-Robots-Tag: noindex`.
- Push a `feature/**` branch and confirm it only gets a throwaway preview URL — never the dev or
  production hostname.
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
- **Email confirmation:** a hosted Supabase project ships with _Confirm email_ **on**, so signup
  creates the account but no session — the UI sends you to "Confirm your email" instead of the
  dashboard. `supabase/config.toml` (`enable_confirmations = false`) only governs a **local** stack.
  Turn it off for the dev project under _Authentication → Sign In / Providers → Email_ if you want
  signup to log you straight in.
