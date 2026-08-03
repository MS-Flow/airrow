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
   - The failure this bootstrap prevents, for anyone who meets it on a project CI does not cover
     yet: a deployment running ahead of its database fails on the column it cannot see.
     `column generation_jobs.reused_authoring does not exist` was a 500 on the interview screen for
     exactly that reason, and no amount of redeploying fixes it. `supabase migration list` compares
     local to cloud and is the fastest way to see the gap.
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
- **Nothing but production is indexable.** Two things do that, and they cover different hosts:
  - **Vercel itself** sends `X-Robots-Tag: noindex` on preview deployments — verified, including on
    previews built before we touched any of this.
  - **`apps/web/vercel.json`** sends it for `airrow-dev.vercel.app` and `dev.airrow.app`. The dev
    environment is *not* a preview as far as Vercel is concerned (it is the production deploy of its own
    project), so it gets no header automatically — which is why it was indexable until spec 113.

  Both hosts are listed explicitly rather than matched by pattern. That is deliberate: the rule this
  replaced named `dev.airrow.app` alone and therefore did nothing at all — the host it named did not
  exist, and the host actually serving dev was never matched. A rule that silently matches nothing is
  the failure mode here, so predictability beats brevity. Note that separate entries in `headers` are
  independent rules, while two `has` items inside one entry must **both** match.

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
2. **Publish the DNS records.** `airrow.app` uses Vercel's nameservers (`ns1`/`ns2.vercel-dns.com`), so
   they go in the **domain's own DNS view** — Vercel dashboard → _Domains_ → `airrow.app` → DNS records.
   Not the project's _Settings → Domains_ tab, which only attaches a domain to a project.
   _(§8 adds receiving on top of this and deliberately leaves every record here alone — DNS stays at
   Vercel.)_

   Resend gives the values; they are unique to the domain and cannot be written down here in advance.
   What is worth knowing before you start:

   - **Enter the name without the domain.** Resend displays `send.airrow.app` and
     `resend._domainkey.airrow.app`; Vercel's Name field wants `send` and `resend._domainkey`. Pasting
     the full name creates `send.airrow.app.airrow.app` and verification never passes. This is the
     mistake to expect.
   - **Paste TXT values without the surrounding quotes.** Vercel adds them.
   - **The MX record needs a priority** (Resend shows it, usually `10`), and it sits on the sending
     subdomain — not on the apex, so it cannot disturb inbound mail for `airrow.app`. That choice is
     what later let §8 put a receiving MX and SPF on the apex without merging anything.
   - There were no TXT or MX records on the domain as of 2026-07-30, so nothing here merges with an
     existing SPF.

   Check propagation yourself rather than only refreshing Resend:
   `nslookup -type=TXT resend._domainkey.airrow.app`. Wait for Resend to report **Verified** before
   sending — mail sent earlier is likely to be filed as spam.
3. **Create an API key** (Resend → **API keys**) with send permission only.
4. **Get a Supabase access token** from <https://supabase.com/dashboard/account/tokens>, then put it and
   the Resend key in a `.env` file at the repo root:
   ```
   SUPABASE_ACCESS_TOKEN=sbp_…
   SUPABASE_PROJECT_ID=frqhxybuzcmecxqkimxj
   RESEND_API_KEY=re_…
   ```
   `.env` is gitignored and Next.js never reads it — the app only reads `.env*` inside `apps/web/`, so
   nothing here reaches a build or a bundle.

   A file rather than shell variables on purpose. `VAR=value command` is bash syntax and fails in
   PowerShell, and the PowerShell equivalent invites a worse trap: paste several `Read-Host` lines at
   once and the prompt swallows the following line, leaving a whole command inside the variable. It is
   non-empty, so every "is it set?" check passes, and the API answers with a 401 about header format
   that names nothing. The script now rejects a credential containing whitespace for exactly that
   reason — but not needing the shell at all is better than diagnosing it well.
5. **Push the whole auth configuration** — SMTP, the three email templates (signup confirmation,
   password reset, email change), the redirect allow-list and the site URL, in one call:
   ```bash
   node --env-file=.env scripts/sync-supabase-auth.mjs --dry-run   # inspect; the key is redacted
   node --env-file=.env scripts/sync-supabase-auth.mjs
   ```
   Run it again whenever the template or the host list changes. Without `RESEND_API_KEY` it updates
   everything **except** SMTP and says so — blanking working sending credentials would be worse than
   leaving them.
6. **Check it took:** _Project Settings → Authentication_ shows the SMTP host, and
   _Authentication → URL Configuration_ the redirect list. Then sign up with a real address and read the
   mail that arrives.

**The repo is the source of truth for all of it, not the dashboard.** The templates are
[`supabase/templates/`](../../supabase/templates/) — `confirmation.html`, `recovery.html` and
`email-change.html` (spec 171); the SMTP values,
the redirect allow-list and the site URL are constants in
[`scripts/sync-supabase-auth.mjs`](../../scripts/sync-supabase-auth.mjs). Editing any of them in the
dashboard is pointless — the next sync overwrites it. Only the two secrets live outside the repo: the
Resend key and the access token.

The same SMTP block sits **commented out** in [`supabase/config.toml`](../../supabase/config.toml) for
reference. That file governs the local stack, where enabling it would override the local inbox and start
mailing real addresses from a developer's machine.

**Why a script and not a set of dashboard forms:** one fact in two places, kept in step by someone
remembering, is what [spec 77](../../specs/77-auto-apply-migrations.md) was written to remove after it
had already shipped a broken production database. A stale email template or a missing redirect host is
cheaper than a stale schema, but it fails the same way — what reviewers approved stops being what
founders get, and nothing announces it. The redirect list has a second guard: a test fails if the app's
own host allow-list (`apps/web/src/lib/site-url.ts`) and this script's list stop agreeing, because a
host in one and not the other builds a confirmation link that Supabase then rejects.

**Local development sends nothing outward.** `[auth.email.smtp]` stays commented out, so the local stack
keeps using `[local_smtp]` — the mail catcher on port 54324 — and no real address is ever mailed from a
developer machine. Enabling it is a deliberate act, and the point at which that stops being true.

---

## 7. Taking Pro live (specs 99, 100)

Test mode and live mode are two separate Stripe accounts wearing one dashboard. Nothing carries over:
not the product, not the price id, not the keys, not the webhook endpoint or its signing secret. Every
value below has a live twin that has to be created and pasted once.

**Before the first real card:**

1. **Schema.** Confirm `supabase migration list` shows nothing pending — the merge to `main` should
   already have applied it (see [_Migrations after the bootstrap_](#migrations-after-the-bootstrap)),
   and this is the check that it did. `organizations.plan` and the `subscriptions` / `stripe_events`
   tables all arrive in migrations, and a production database behind them cannot grant Pro to
   anyone: the failure looks like a payment that vanished.
2. **Product and price, in live mode.** Recreate the monthly product and copy the live `price_…`.
   Optional yearly likewise. No amount lives in this repository, so the figure is only ever right in
   one place — and since spec 179 the landing card reads it back out of Stripe rather than being told
   it, so a price edited here changes the site within the hour with no deploy.
3. **The founding-member offer (spec 179), live mode.** Products → Coupons → create one with
   **`max_redemptions: 100`** and **`duration: forever`**, and put its id in
   `STRIPE_COUPON_FOUNDING`. `forever` is not a preference: the card promises the founding rate
   "stays that rate for as long as you keep it", and a `once` coupon would renew the second year at
   the list price — the card would then be advertising something Stripe does not do. It is applied to
   the **yearly** price only, server-side at Checkout. Stripe owns the count, which is the point: two
   founders checking out at the same moment cannot both take the hundredth place, and the "places
   left" counter on the landing card is read from the same coupon rather than from anything we tally.
   Leave the variable unset to run no offer. A redemption is never given back — cancelling does not
   free a place, which is the honest reading of "the first 100 customers".
4. **Keys, in Vercel → Production.** `STRIPE_SECRET_KEY` (`sk_live_…`), `STRIPE_PRICE_MONTHLY`,
   `STRIPE_WEBHOOK_SECRET`. Names and values are both checked at runtime (prefix + trim) — get one
   wrong and the deploy shows a disabled Upgrade button with the reason on the page and the variable
   named in the log, rather than a broken checkout. `STRIPE_COUPON_FOUNDING` is checked for presence
   only; a coupon id has no prefix to verify.
5. **Webhook endpoint, live mode.** Developers → Webhooks → Add endpoint →
   `https://airrow.app/api/stripe/webhook`, subscribed to `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Its signing secret is the `STRIPE_WEBHOOK_SECRET` above — the
   test-mode one will reject every live delivery, which looks exactly like nothing happening.
6. **Business settings Stripe requires of you, not of the code:** company details and statement
   descriptor, a support email or URL on the receipt, and the customer portal enabled with
   cancellation on (Settings → Billing → Customer portal) — `Manage billing` opens it and a portal
   that is not configured 400s.
7. **VAT / Tax.** Selling a subscription from Sweden to consumers means VAT, and Airrow does not
   compute it: Checkout is created without `automatic_tax`. Either enable **Stripe Tax** and add
   `automatic_tax: { enabled: true }` (plus address collection) in `startCheckoutAction`, or price
   inclusive and account for it yourself. This is a decision to make deliberately before launch, not
   a default to inherit.
8. **Terms and refunds.** `/terms` and `/privacy` exist; make sure they say what the subscription is,
   when it renews and how to cancel, because the portal is where people will look for it.

**Then prove it with one real payment**, and use a real card rather than a test one — live mode has no
`4242…`. Buy Pro, land back on `/app/upgrade/return`, and confirm Settings says "Payment confirmed"
immediately. That screen is now reconciled against Stripe's API on arrival, so it is honest even if the
webhook is slow or misconfigured — but check the webhook delivered anyway (Developers → Events, a 200),
because it is what carries renewals and cancellations later. Then cancel from the portal and confirm
the plan returns to free at period end. Refund yourself from the dashboard afterwards.

If a payment ever lands without the plan following, the founder-facing repair is on Settings —
**"Already paid? Check again"** re-reads the subscription from Stripe — and the developer-facing
diagnosis is the "Paid, and still on Free" runbook in
[`DEVELOPER_GUIDE.md`](./DEVELOPER_GUIDE.md#paid-and-still-on-free).

---

## 8. Inbound email (forwarding on Vercel DNS, spec 144)

§6 made Airrow able to **send**. Nothing receives: `support@airrow.app` and `hello@airrow.app` — the
address already printed in the legal pages — reach no mailbox at all, and the support page (spec 144)
mails tickets and reviews to the first of them. A message to an address with no MX record does not
bounce loudly; it shows as `sent` in Resend and is simply never delivered, which is exactly how this
was found.

**Forwarding is three DNS records, not a migration.** `airrow.app` uses Vercel's nameservers
(`ns1`/`ns2.vercel-dns.com`) and **stays there**. ImprovMX (or Forward Email — same shape) receives on
the domain's `MX` and forwards to an ordinary Gmail account, free, and Vercel ships a preset that
writes the records for you.

> **Why not Cloudflare Email Routing.** It does the same job for the same price, but only on a zone
> using **Cloudflare's** nameservers — so it would mean re-creating every §4 and §6 record inside
> Cloudflare and switching nameservers at the registrar, with §6's verified sending domain riding on
> the change. Spec 144 chose that route first and reversed it here: the receiving half is worth two
> records, not a zone move. Cloudflare stays the right answer only if the zone is going there anyway.

1. **Add the forwarding records.** Vercel dashboard → _Domains_ → `airrow.app` → **Add DNS Preset** →
   **ImprovMX [MX]** → _Add records_. Prefer the preset and then check what landed against this:

   | Type  | Name         | Value                                  | Priority |
   | ----- | ------------ | -------------------------------------- | -------- |
   | `MX`  | _(empty)_    | `mx1.improvmx.com`                     | `10`     |
   | `MX`  | _(empty)_    | `mx2.improvmx.com`                     | `20`     |
   | `TXT` | _(empty)_    | `v=spf1 include:spf.improvmx.com ~all` | —        |

   - **Leave Name empty for the apex** — not `@`, not `airrow.app`. Vercel appends the domain, so `@`
     creates `@.airrow.app` and nothing works. Same trap as §6's `send` / `resend._domainkey`.
   - **Paste the TXT value without quotes**; Vercel adds them.
   - Safe on the apex only because §6 deliberately put Resend's sending on the **`send.airrow.app`**
     subdomain. Verified on 2026-07-31, before adding anything: `airrow.app` had **no** `MX` and **no**
     `TXT`, while `send.airrow.app` carried `feedback-smtp.eu-west-1.amazonses.com` and
     `v=spf1 include:amazonses.com ~all`. Nothing to merge. If sending is ever moved to the apex, the
     two SPF strings must become one record — a domain may publish exactly one, and two make both
     invalid.
2. **Create the aliases** at <https://improvmx.com> → add the domain → forward
   `support@airrow.app → <gmail>` and `hello@airrow.app → <gmail>`. A free account allows both, plus a
   catch-all — leave the **catch-all off**, it forwards every typo and every address a spammer guesses.
3. **Wait for the domain to read _Active_** in ImprovMX (usually minutes; DNS can lag an hour).
4. **Verify receiving:** mail `support@airrow.app` from an outside account and watch it arrive in
   Gmail. Then send a ticket from `/app/support` — Resend's log should show `last_event: delivered`
   rather than `sent`, with the founder's address in `Reply-To`. `sent` and nothing in Gmail means the
   MX records have not propagated yet.
5. **Nothing in §4 or §6 changes.** No nameserver switch, no record re-created, so Resend's _Domains_
   page keeps reading **Verified** and the signup verification email keeps working. That is the whole
   reason this route was preferred.
6. **DMARC already exists — edit it, never add a second.** `_dmarc.airrow.app` publishes
   `v=DMARC1; p=none;` (checked 2026-07-31). A domain may have exactly one DMARC record, so to start
   receiving failure reports, change that record to
   `v=DMARC1; p=none; rua=mailto:<gmail>` rather than creating another. Tighten past `p=none` only
   once the reports are clean.
7. **Optional, and worth it:** in Gmail, _See all settings → Accounts → Send mail as_ →
   `support@airrow.app`, using Resend's SMTP (`smtp.resend.com`, port 587, user `resend`, the API key
   as the password). Without it, replies come from a personal address, which reads as a different
   person than the one they wrote to. ImprovMX's own SMTP sending is a paid feature; Resend's is
   already paid for.

**Until the records are in place**, set `SUPPORT_INBOX` to a real mailbox
(`apps/web/.env.example`) — the notification then goes straight there and `Reply-To` still carries the
founder, so the support loop works with no DNS at all. It does not help anyone who writes to the
published addresses, which is what step 1 is for.

**What the app needs from this:** nothing but `RESEND_API_KEY`, which §6 already set. `SUPPORT_INBOX`
and `MAIL_FROM` have working defaults and exist so a staging deployment can be pointed somewhere else.
With no key at all the support page and the review card still save everything — only the notification
to us is skipped.

**Not chosen: Resend Inbound.** Resend can receive (its domain API reports a `receiving` capability),
but a received message becomes a **webhook POST carrying metadata only** — the body is a second API
call — so forwarding to Gmail would be a route handler we write and maintain. Its docs also steer
receiving onto a subdomain rather than the root. It earns its place the day tickets should land *in*
the app as threads; it does not earn it for forwarding two addresses.

---

## 9. Funnel analytics (PostHog, spec 182)

Vercel Web Analytics (spec 153) counts how many people reach the site. This counts what they then do,
so the five ratios a launch is judged on — visit → start → signup → generate → download → paid — are
answerable on the day rather than a month later.

**Time: about 25 minutes**, most of it waiting for a deployment. Nothing below needs a card.

### Step 1 — Create the PostHog project (3 min)

1. Go to **<https://eu.posthog.com/signup>** — the EU cloud. Pick it deliberately: our visitors are
   European, the region cannot be changed after the project is made, and it is the host the code
   defaults to.
2. Sign up, and when it asks what you are building, choose **Product analytics**. Skip any
   "install the snippet" wizard it offers — the code is already written; you only need the key.
3. Name the project **`airrow-production`**. Naming it after the *environment* rather than the
   product is what stops a second project appearing later and splitting the funnel in half.
4. Go to **Settings → Project → Project ID / API key** and copy the value beginning `phc_`.

That `phc_…` key is *publishable and write-only*. It ships in the browser bundle by design, it is
visible in devtools on any site that uses PostHog, and nothing can be read back with it. It is not a
secret and does not belong in a password manager's "critical" pile — but do not paste it into a public
issue either, because anyone holding it can write junk events into your funnel.

### Step 2 — Put the key in Vercel, on Production only (5 min)

Vercel dashboard → the `airrow` project → **Settings → Environment Variables**. Add four, and
**untick Preview and Development on every one of them**:

| Variable | Value | Environments |
|---|---|---|
| `POSTHOG_KEY` | your `phc_…` key | ☑ Production only |
| `NEXT_PUBLIC_POSTHOG_KEY` | the same `phc_…` key | ☑ Production only |
| `POSTHOG_HOST` | `https://eu.i.posthog.com` | ☑ Production only |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://eu.i.posthog.com` | ☑ Production only |

Two things people get wrong here:

- **`i.posthog.com`, not `posthog.com`.** The first is the ingest host, the second is the dashboard.
  Pointing the app at the dashboard fails silently — events go nowhere and nothing logs an error.
- **The same key twice is correct.** A PostHog project has one ingest key. Two variables exist so the
  server can report while the browser is told nothing; normally they hold the same value.

**Preview and Development stay empty on purpose.** Production is the only source, so the launch
dashboard is never diluted by your own clicking through a branch. The price is that the events cannot
be rehearsed anywhere — which is why Step 4 is a deliberate walk-through rather than a wait-and-see.

### Step 3 — Redeploy (5 min, mostly waiting)

Environment variables are read at build time, so an existing deployment will not pick them up.
Vercel → **Deployments** → the newest Production one → **⋯ → Redeploy**.

**Untick "use existing Build Cache".** This matters and is easy to get wrong: `NEXT_PUBLIC_*` values
are not read at runtime — Next inlines them into the client bundle as string literals during
compilation. A cached build can reuse the already-compiled bundle, in which the value is still empty,
and you get a deployment where the *server* half sends events and the *browser* half silently does
not. The server keys (`POSTHOG_KEY`) are read at runtime and are unaffected, which is exactly what
makes the symptom confusing.

Wait for it to go green before Step 4. A half-deployed app will simply not send anything, and you
will spend twenty minutes debugging a deployment that was still building.

### Step 4 — Walk the funnel yourself, in production (10 min)

This is the verification, and nobody else is going to do it. Open PostHog → **Activity** in one tab
(it is a live feed) and the production site in another, then do all of this in order:

| Do this | Watch for |
|---|---|
| Open the landing page | `pageview` |
| Start the interview | `interview_started` (`mode: guest`) |
| Answer two or three questions | one `interview_step` each, with `index` climbing |
| Create an account | `signup` |
| Finish the interview and generate | `foundation_generated` |
| Download the ZIP | `zip_downloaded` |
| Press Upgrade, reach Stripe's page | `checkout_started` |
| Complete a real payment (or use a Stripe test-mode card if the deployment is in test mode) | `paid`, with `tier` |

Eight events. There is a ninth name, `github_pushed`, which is defined and **never fires** — pushing
a foundation to a repository is not built yet, and the name exists so the funnel has a slot ready
rather than to claim a feature we do not have.

#### When nothing arrives

Work through these in order — the first two are what actually went wrong the first time this was set
up, and neither produces an error message anywhere.

**1. Read the variable names back, character by character.** `NEXT_PUBLICPOSTHOG_KEY` — a single
missing underscore — cost an afternoon. Next exposes a variable to the browser *only* if the name
starts with exactly `NEXT_PUBLIC_`; anything else stays server-side, where nothing reads it. The
Vercel list looks completely correct at a glance, the build succeeds, and the browser sends nothing.
There is no warning for this, in Vercel or in Next.

**2. Redeploy without the build cache** (Step 3). A cached build reuses the compiled client bundle,
in which the inlined value is still whatever it was at the last real compile.

**3. Devtools → Network, filter `posthog`, reload the production site.**

| What you see | What it means |
|---|---|
| A request to `eu.i.posthog.com` | It works — the problem is the PostHog view, not the app |
| Nothing at all | The key is not in the client bundle → 1 or 2 |
| 401 or 403 | Wrong key, or wrong region in the host |

**4. Search the bundle directly.** Devtools → **Sources** → `Ctrl+Shift+F` → search `phc_`. A hit
means the key compiled in and the fault is elsewhere; no hit confirms 1 or 2 without guesswork.

**If the client events appear but `signup` / `paid` do not:** those are server-sent, so the problem is
`POSTHOG_KEY` (the one without `NEXT_PUBLIC_`), not the browser. Check the Vercel function logs.

**Note the asymmetry that makes this confusing:** `POSTHOG_KEY` is read at *runtime*, so a typo there
breaks only the server half; `NEXT_PUBLIC_POSTHOG_KEY` is inlined at *build* time, so a typo there
breaks only the browser half — and each half fails silently and independently.

### Step 5 — Build the dashboard as ratios (5 min)

PostHog → **Dashboards → New dashboard**, name it `Launch funnel`. Then add **one Funnel insight**
rather than five counters — PostHog computes the conversion rate between consecutive steps for you,
which is the entire point:

1. New insight → **Funnels**
2. Add these steps, in this order:
   `pageview` → `interview_started` → `signup` → `foundation_generated` → `zip_downloaded` → `paid`
3. Set the conversion window to **7 days** (a founder who signs up on Monday and pays on Thursday is
   one conversion, not two people)
4. Save it to the dashboard.

Then add a **Breakdown by `utm_source`** on the same insight and save it as a second tile. That is
how a channel gets credit — but read the note below before trusting it past the signup step.

Five totals side by side is the thing this replaces: "1,200 visits and 14 payments" hides which of
the four steps between them lost everybody.

### How to read what you get

**The two top-of-funnel ratios are floors, not measurements.** The browser side runs with
`persistence: "memory"` — no cookie, no `localStorage`, nothing written to the visitor's device — which
is what keeps the cookie policy true and the consent banner unnecessary (spec 153). It also means an
identity lasts **one page session**: somebody who leaves and comes back is counted as two visitors, so
visit → start and start → signup *understate* reality. Everything from `signup` down is sent
server-side against a workspace id and is exact.

**`utm_source` is reliable up to `signup` and absent after it,** for the same reason: the campaign is
held in memory for that page session, so it cannot follow a founder to a checkout three days later.
Read channel breakdowns on the top of the funnel; do not read them on `paid`.

Closing both gaps means a cookie, and a cookie means a consent banner — a trade to make deliberately,
in its own issue, not by changing one line of configuration.

### Do not turn these on

PostHog's defaults are broader than ours. **Session recording would capture interview answers**, which
are customer IP, and autocapture would send DOM text we have not vetted. Both are disabled in code
(`POSTHOG_OPTIONS` in `features/analytics/client.tsx`), and PostHog's project settings can *also* turn
recording on server-side — if a banner in its UI offers to enable it, decline.

Changing `persistence` away from `"memory"` makes the published cookie policy false and a consent
banner legally mandatory. `client.test.ts` fails if you do, and says so.

**What is never sent:** no email, no name, no interview answer, no generated document. Event
properties are enums, counts and workspace ids, and the complete list is in
`apps/web/src/features/analytics/events.ts` — one file, readable in full, enforced at runtime rather
than by convention.

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
