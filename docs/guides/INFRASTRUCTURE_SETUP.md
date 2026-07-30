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
3. Link the repo's local CLI config to the cloud project and apply the schema **once**, to get the
   brand-new project from empty to current:
   ```bash
   pnpm dlx supabase login                    # opens a browser to authorize the CLI
   pnpm dlx supabase link --project-ref <ref> # <ref> is in the dashboard URL / Settings → General
   pnpm dlx supabase db push                  # applies supabase/migrations to the cloud DB
   ```

   - This is bootstrap only. From here on, migrations reach the database through CI — see
     [_Migrations after the bootstrap_](#migrations-after-the-bootstrap) below. Do not treat
     `db push` as a step you run after every merge; that is the manual habit that broke us.
   - If `supabase link` fails with `Your account does not have the necessary privileges`, the CLI
     is authenticated as an account that cannot see the project. Log out, log back in with the
     Supabase owner/admin account, or ask the project owner to grant access, then rerun the link.
4. Verify RLS in the dashboard: **Table Editor** shows `organizations` and `organization_members`;
   **Authentication → Policies** shows each has RLS **enabled** with the read policies from the
   migration. (This is the proof-of-concept schema; the full product schema is a separate issue.)

### Migrations after the bootstrap

Committing a migration is the whole job — CI applies it. Two workflows, one comparison
([`scripts/supabase-migration-drift.mjs`](../../scripts/supabase-migration-drift.mjs)):

| When | Workflow | What it does |
| --- | --- | --- |
| Every PR | `ci.yml`, step _Check migrations against the linked database_ | Read-only. Fails when `supabase/migrations` holds something the database does not, so it blocks the merge. |
| Push to `develop` / `main` | `supabase-migrate.yml` | `supabase db push`, then asserts nothing is left unapplied. Idempotent — a push with no schema change is a green no-op. |

`develop` is where a migration is genuinely needed first: the dev environment runs `develop` code
against the **same** Supabase project as production (see the env-var table in §2). The `main` run is
the safety net that guarantees production even if the `develop` run was missed.

**Three repository secrets make this work** — _Settings → Secrets and variables → Actions_. Without
them every CI run fails on a readable error naming each missing one, by design: a green skip would
look exactly like "in sync". They are read only by the steps that talk to Supabase, never by the
install, test or build steps.

| Secret | Value | Why |
| --- | --- | --- |
| `SUPABASE_ACCESS_TOKEN` | a CLI access token from <https://supabase.com/dashboard/account/tokens> | authenticates `supabase link` |
| `SUPABASE_PROJECT_ID` | the project ref from step 1 | which project to link |
| `SUPABASE_DB_PASSWORD` | the DB password from step 1 | `db push` and the drift check open a direct Postgres connection |

**A pull request from a fork** never receives these secrets — GitHub withholds them, and this repo is
public. The check detects that case and passes with a warning rather than failing the PR; the schema is
checked on the push to `develop`/`main` instead. A **same-repo** run with a missing secret still fails.

Two things this deliberately does **not** do: a failed migration cannot stop the Vercel deploy
(Vercel triggers on push and does not listen to our workflows — the job just goes red and loud), and
there is no rollback. A faulty migration is corrected by a new migration going forward. Full
reasoning: [`specs/77-auto-apply-migrations.md`](../../specs/77-auto-apply-migrations.md).

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

Vercel's Git integration is the **only** deploy mechanism — no GitHub Actions workflow deploys the
app. Every push deploys automatically once the project is connected. (`supabase-migrate.yml` runs on
the same push, but it only touches the database schema; it cannot gate the deploy.)

- **Production Branch:** set to `main` under **Project Settings → Git**. Per Airrow's branch model,
  code only reaches `main` through the strict PR chain (issue → feature → `develop` → `main`).
- **Preview Deployments:** enabled by default — every PR / branch push gets its own throwaway URL.
  Confirm under **Settings → Git** that preview deployments are on.
- **The dev environment is `https://airrow-dev.vercel.app` today.** A stable hostname on Vercel's own
  domain, serving what `develop` last deployed.
- **Branch Domain for `develop` — planned, not attached.** **Project Settings → Domains → Add** →
  `dev.airrow.app` → under "Git Branch" pick `develop`, which would alias a hostname on our own domain
  to the same deploys. `dev.airrow.app` answers `404` as of 2026-07-30, so nothing points at it yet;
  every reference to it in this guide describes the intended state, not the current one.
- **Nothing but production is indexable.** `apps/web/vercel.json` sends `X-Robots-Tag: noindex` for
  `dev.airrow.app` **and** every `*.vercel.app` host, which covers the dev environment above and every
  preview deploy. The rule is host-matched rather than listed one by one precisely because it was
  written against `dev.airrow.app` alone and therefore did nothing for a year: the host it named did
  not exist while the host serving dev was never matched (spec 113).

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
| `develop`                    | `https://airrow-dev.vercel.app`                    | Stable — same URL every deploy       |
| `feature/**`, `<nr>-<short>` | Vercel-generated preview URL                       | Throwaway — new URL per deploy       |

`dev.airrow.app` is the intended home for the `develop` row and is not attached yet — see §3. Only the
`main` row is indexable; everything else carries `X-Robots-Tag: noindex`.

---

## 5. Verify end-to-end

- `pnpm build` passes locally.
- The Vercel production deploy is green and `https://airrow.app` loads; `https://www.airrow.app`
  redirects to it (`curl -I https://www.airrow.app`).
- Push to `develop` and confirm `https://airrow-dev.vercel.app` updates and the hostname stays the same
  as the previous deploy; `curl -I https://airrow-dev.vercel.app` shows `X-Robots-Tag: noindex`.
  The same check on `https://airrow.app` must show **no** such header — production is the one host that
  is meant to be indexed.
- Push a `feature/**` branch and confirm it only gets a throwaway preview URL — never the dev or
  production hostname.
- The deployed app can reach Supabase (no auth/network errors in the Function logs once app code
  starts reading from Supabase — that wiring is a later issue; for now the env vars are in place and
  the migration is applied).
- Local RLS proof: `pnpm dlx supabase start` then `pnpm --filter web test organizations.rls` — the
  access + denial test passes against the local DB.

---

## 6. Auth email (Resend)

Without this, Supabase sends the verification email from its own domain with its own wording — and its
built-in mailer is rate-limited to a couple of messages an hour, so mail starts disappearing under any
real traffic. Spec 113 replaces it with Resend over plain SMTP.

1. **Create the sending domain.** At <https://resend.com> → **Domains → Add**, add `airrow.app`.
   Resend shows DKIM (and optionally DMARC) records to publish.
2. **Publish the DNS records** where `airrow.app` is served — Vercel → **Project Settings → Domains**,
   or the DNS provider if it moves. Wait for Resend to report the domain **Verified**; mail sent before
   that is likely to be filed as spam.
3. **Create an API key** (Resend → **API keys**) with send permission only.
4. **Point Supabase at it** — dashboard → _Project Settings → Authentication → SMTP Settings_:

   | Field | Value |
   | --- | --- |
   | Host | `smtp.resend.com` |
   | Port | `587` |
   | Username | `resend` |
   | Password | the Resend API key |
   | Sender email | `noreply@airrow.app` |
   | Sender name | `Airrow` |

   This dashboard form is the only place these values are active. The same block sits **commented out**
   in [`supabase/config.toml`](../../supabase/config.toml) for reference: that file governs the local
   stack, where enabling it would override the local inbox and start mailing real addresses from a
   developer's machine.
5. **Allow the confirmation redirect.** Under _Authentication → URL Configuration → Redirect URLs_ add:
   - `https://airrow.app/auth/confirm` — production
   - `https://airrow-dev.vercel.app/auth/confirm` — the dev environment as it is today
   - `https://*.vercel.app/auth/confirm` — preview deploys, whose hostnames change every time

   Supabase rejects an `emailRedirectTo` it was not told about, and the app passes one per environment
   (the host is allow-listed on our side too — `apps/web/src/lib/site-url.ts`). If the
   `dev.airrow.app` branch domain from §3 is ever attached, add its `/auth/confirm` as well.
6. **Push the template:**
   ```bash
   SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_ID=… node scripts/sync-auth-email-templates.mjs
   ```

**The template lives in the repo, not in the dashboard.**
[`supabase/templates/confirmation.html`](../../supabase/templates/confirmation.html) is the source of
truth; the script above pushes it to the hosted project. Editing the dashboard copy directly is
pointless — the next sync overwrites it. `--dry-run` prints what would be sent without sending it.

**Why a script and not a "paste this into the dashboard" step:** one fact in two places, kept in step
by someone remembering, is what [spec 77](../../specs/77-auto-apply-migrations.md) was written to
remove after it had already shipped a broken production database. A stale email template is cheaper
than a stale schema, but it fails the same way — the version reviewers approve stops being the version
founders receive.

**Local development sends nothing outward.** `[auth.email.smtp]` stays commented out, so the local stack
keeps using `[local_smtp]` — the mail catcher on port 54324 — and no real address is ever mailed from a
developer machine. Enabling it is a deliberate act, and the point at which that stops being true.

---

## Notes & constraints

- **Free tier:** the Supabase project pauses after ~1 week of inactivity and has row/storage caps —
  fine for now; revisit before launch. A paused project turns the migration check red on every PR
  (it cannot read the schema to compare against). Resume it in the dashboard and re-run the job.
- **Secrets:** only ever live in Vercel env vars and your local `apps/web/.env.local` (gitignored).
  `apps/web/.env.example` documents the names with no values. The location matters: Next.js reads
  `.env*` only from the directory it runs in, so a file at the repo root is ignored and the app looks
  permanently signed out.
- **Email confirmation:** a hosted Supabase project ships with _Confirm email_ **on**, so signup
  creates the account but no session — the UI sends you to "Confirm your email" instead of the
  dashboard. `supabase/config.toml` (`enable_confirmations = false`) only governs a **local** stack.
  Turn it off for the dev project under _Authentication → Sign In / Providers → Email_ if you want
  signup to log you straight in. Who that email comes from, and what it says, is §6 below.
