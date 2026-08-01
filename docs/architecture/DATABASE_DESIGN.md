# Database Design

Postgres (Supabase). All tables: `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at`. RLS enabled on every table — access is always scoped through organization membership. Multi-tenancy from day one: personal org auto-created per user (see ROADMAP pre-commitments).

## Schema v1

```
users (Supabase auth.users + public.profiles)
profiles
  id uuid pk → auth.users
  display_name text
  avatar_url text

organizations
  id uuid pk
  name text
  slug text unique
  kind text check in ('personal','team')   -- teams activate in M7
  created_by uuid → profiles
  plan text check in ('free','pro')        -- entitlement (spec 74); see "The plan column" below

organization_members
  organization_id uuid → organizations
  user_id uuid → profiles
  role text check in ('owner','admin','member')
  pk (organization_id, user_id)

projects
  id uuid pk
  organization_id uuid → organizations
  name text
  slug text
  status text check in ('draft','interviewing','generating','ready','delivered','archived')
  unique (organization_id, slug)

interviews
  id uuid pk
  project_id uuid → projects (one active per project)
  schema_version text                       -- interview schema version answered against
  answers jsonb                             -- keyed by question id, validated by schema
  completed_at timestamptz null

project_models
  id uuid pk
  project_id uuid → projects
  version int                               -- models are immutable; new version per regeneration
  model jsonb                               -- resolved, validated project model
  unique (project_id, version)

generation_jobs
  id uuid pk
  project_id uuid → projects
  project_model_id uuid → project_models
  status text check in ('queued','running','failed','completed','cancelled')
  stage text null                           -- resolve|author|assemble|validate|manifest
  progress jsonb                            -- per-stage / per-document progress for Realtime UI
  error jsonb null
  tokens_used int null
  started_at / finished_at timestamptz
  inputs_hash / prompt_version / authoring_model / authored   -- memoisation + provenance (spec 65)
  reused_authoring boolean                  -- answered from a previous run; not charged (spec 74)

artifacts
  id uuid pk
  generation_job_id uuid → generation_jobs
  storage_path text                         -- Supabase Storage location of repo tree
  file_count int
  total_bytes bigint

artifact_files                              -- the manifest; enables diff/regeneration/sync later
  id uuid pk
  artifact_id uuid → artifacts
  path text
  source text check in ('static','authored')
  template_id text
  template_version text
  prompt_version text null
  model text null                           -- LLM model id when authored
  inputs_hash text                          -- hash of project-model slice used
  bytes int
  unique (artifact_id, path)

deliveries
  id uuid pk
  project_id uuid → projects
  artifact_id uuid → artifacts
  method text check in ('zip','github')     -- 'azure_devops' later
  external_url text null                    -- created repo URL
  status text check in ('pending','completed','failed')

repo_connections                            -- provider credentials per org (GitHub App install)
  id uuid pk
  organization_id uuid → organizations
  provider text check in ('github')         -- 'azure_devops' later
  installation_id text
  unique (organization_id, provider)

generation_usage                            -- the allowance ledger (spec 65)
  id uuid pk
  organization_id uuid → organizations      -- never null; the fact this is really about
  project_id uuid → projects on delete set null   -- outlives its project on purpose
  generation_job_id uuid → generation_jobs on delete set null
  -- Counted minus jobs that failed or reused a previous run's prose: the allowance charges for
  -- Claude calls Airrow actually paid for, and nothing else.

subscriptions                               -- Stripe billing state per org (spec 99)
  id uuid pk
  organization_id uuid → organizations unique     -- two live subscriptions is an incident, not a state
  provider text check in ('stripe')
  provider_customer_id text                 -- how the webhook, which has no session, finds the org
  provider_subscription_id text null
  status text                               -- Stripe's own vocabulary, kept verbatim
  current_period_end timestamptz null
  cancel_at_period_end boolean

stripe_events                               -- delivered event ids, for idempotency (spec 99)
  event_id text pk                          -- the pk *is* the mechanism: claiming is an insert
  event_type text
  received_at timestamptz

support_tickets                             -- written from /app/support (spec 144)
  id uuid pk
  organization_id uuid → organizations
  user_id uuid
  project_id uuid → projects on delete set null   -- the answer is still owed after the project goes
  category text check in ('generation','billing','account','other')
  subject text
  body text
  status text check in ('open','closed')    -- ours to set; no app path writes it

project_reviews                             -- the founder's verdict on a foundation (spec 144)
  id uuid pk
  organization_id uuid → organizations
  project_id uuid → projects unique         -- one per project, editable: the constraint is the rule
  user_id uuid
  rating smallint check (rating between 1 and 5)
  body text
  consent_public boolean                    -- the founder's permission
  display_name text                         -- the byline they chose, never their address
  published_at timestamptz null             -- ours to set (admin console, spec 150); cleared on withdrawal

ui_references                               -- screenshots attached to the UI question (spec 159)
  id uuid pk
  organization_id uuid → organizations
  project_id uuid → projects on delete cascade
  storage_path text unique                  -- inside the private `ui-references` bucket
  media_type text check in ('image/png','image/jpeg','image/webp')
  bytes integer check (bytes > 0 and bytes <= 2097152)
  created_by uuid
  -- The bytes are read server-side by the authoring provider's UI call and described in words; they
  -- never reach a generated file. The founder sees their own uploads through a short-expiry signed
  -- URL. Storage has no foreign key, so `deleteProject` removes the objects explicitly.

generation_credits                          -- a generation handed back by support (spec 150)
  id uuid pk
  organization_id uuid → organizations
  reason text                               -- free text: the reasons are not a taxonomy we can predict
  granted_by uuid → profiles on delete set null   -- the founder keeps it if the grantor leaves
  granted_at timestamptz
  consumed_at timestamptz null              -- one row *is* one generation; there is no amount column

admin_audit_log                             -- every operator action (spec 150)
  id uuid pk
  actor_id uuid → profiles on delete set null
  action text check in ('user.suspend','user.reactivate','credits.grant',
                        'ticket.close','ticket.reopen','review.publish','review.unpublish')
  subject_type text check in ('user','organization','ticket','review')
  subject_id uuid                           -- loose pair, not five nullable FKs; nothing joins on it
  reason text

profiles.suspended_at timestamptz null      -- read by getSession, so an open session dies (spec 150)

admin_user_accounts (view)                  -- six auth.users columns the console shows (spec 150)
admin_daily_series() · admin_totals() · admin_standing() · admin_project_status_counts()
admin_interview_progress() · admin_ticket_categories() · admin_review_distribution()
                                            -- aggregates, service_role only; execute revoked from public
```

## RLS pattern

Single helper: `is_org_member(org_id uuid)` security-definer function checking `organization_members`. Every policy reduces to membership of the row's (direct or joined) organization. Writes additionally check role where relevant. No table without a policy; policies tested in CI.

### The plan column is the exception, and has to be

`organizations.plan` is an entitlement sitting on a row its own members may edit — `authenticated` holds `update` on `organizations`, and the "org members update organizations" policy admits any member. Row-level security cannot express *"this row, but not this column"*, so membership alone would have let a founder run `update organizations set plan = 'pro'` straight against PostgREST with their own JWT.

So the plan is protected by **column-level privilege** instead: spec 74's migration revokes table-wide `insert, update` from `authenticated` and grants back every column except `plan`. The row policies are unchanged. Only a migration or the service-role billing path writes it — the webhook, and the Stripe API read in `features/billing/sync.ts` that spec 100 added for the founder who paid before the webhook could tell us. Both go through `applySubscriptionState`; neither trusts anything the browser said.

Read this as the general rule it implies: when a column decides what someone is *entitled to*, membership of the row is not sufficient authorization, and RLS is not the tool. Two denial tests in `schema.rls.test.ts` hold the line — one for a member's own organization, one for someone else's.

`subscriptions` follows the same rule at table scope: members may `select` it and nothing more, because `status = 'active'` is an entitlement too. `stripe_events` goes further and has **RLS enabled with no policy at all** — the deny-everything shape `admin_emails` uses. It is the webhook's own bookkeeping, and there is no query a founder should be making against it.

### `profiles` was the same bug, and had been since the beginning

Spec 150 found `is_admin` sitting in exactly the position the plan column had been in, and losing the same argument. `20260725100000_schema.sql` granted `authenticated` table-wide `insert, update, delete` on `profiles` under the policy `own profile … using (id = auth.uid())` — a policy that is *correct*: the row genuinely is theirs. But the privilege is table-wide, so every column on it was theirs to write, and `update public.profiles set is_admin = true where id = auth.uid()` succeeded against PostgREST with an ordinary login. Until the admin console it bought an unlimited generation allowance; after it, it would have bought every other workspace's interview answers, and it would have let a suspended account clear its own `suspended_at`.

The fix is spec 74's, applied to the same shape: `20260801130000_admin_console.sql` revokes `insert, update, delete` from `authenticated` and grants back `update (display_name, avatar_url)` — the two columns a founder legitimately owns. Row policies are unchanged, and every profile write in the app already went through the service-role DataStore, so nothing in the product noticed. Three denial tests in `admin.db.test.ts` hold the line: the escalation, the self-un-suspension, and the rename that must keep working.

The general rule from the plan column now has a second instance and a sharper edge: **a column that decides authorization is never protected by a policy about the row.** RLS answers "whose row is this"; it cannot answer "which columns of their own row may they write".

`generation_credits` and `admin_audit_log` go one step past `stripe_events`: RLS enabled, **no policy, and no grant to `authenticated` at all**. A founder who can insert a credit has granted themselves a generation, and no policy phrased as "your own organization" would stop them — their own organization is precisely the one they would grant it to. The statistics functions and `admin_user_accounts` are the same posture in function form: Postgres grants `execute` to `public` by default, so each one is explicitly revoked and granted to `service_role` alone.

`ui_references` is select-only for `authenticated` for the same reason, with the sharper edge that a row here names a Storage object: an insert from a browser console would skip the type, size and count checks *and* point at bytes nobody validated (spec 159). The bucket itself carries no policy for `authenticated` or `anon` at all, so the only role that reaches an image is `service_role` — the founder sees their own through a signed URL the server mints, which is also why the bucket must never be made public. `ui-references.db.test.ts` covers both the reads and the four denials.

`support_tickets` and `project_reviews` are select-only for `authenticated` for the same family of reasons (spec 144). A ticket inserted from a browser console would skip the rate limit and the session the server action resolves the organization from; and `published_at` sits on a review row that genuinely belongs to the founder, so "may edit my own review" and "may publish my own testimonial" would be the same privilege. Writes go through the service-role path only, and the denial tests in `support.db.test.ts` say so.

## Design decisions

- **`answers` and `model` as jsonb, validated in app by Zod against versioned schemas** — interview evolves fast; relational modeling of questions would calcify it. `schema_version` makes old answers interpretable forever.
- **Immutable `project_models` versions** — regeneration and future diffing need a stable snapshot of "what the engine saw."
- **Manifest in `artifact_files`, not only in Storage** — queryable per-file provenance is the foundation for Phase 4 repository sync.
- **`organizations.kind='personal'`** — avoids nullable org on projects and makes the M7 teams migration additive-only.
