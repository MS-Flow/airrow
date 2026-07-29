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
```

## RLS pattern

Single helper: `is_org_member(org_id uuid)` security-definer function checking `organization_members`. Every policy reduces to membership of the row's (direct or joined) organization. Writes additionally check role where relevant. No table without a policy; policies tested in CI.

### The plan column is the exception, and has to be

`organizations.plan` is an entitlement sitting on a row its own members may edit — `authenticated` holds `update` on `organizations`, and the "org members update organizations" policy admits any member. Row-level security cannot express *"this row, but not this column"*, so membership alone would have let a founder run `update organizations set plan = 'pro'` straight against PostgREST with their own JWT.

So the plan is protected by **column-level privilege** instead: spec 74's migration revokes table-wide `insert, update` from `authenticated` and grants back every column except `plan`. The row policies are unchanged. Only a migration or the billing webhook's service-role path writes it.

Read this as the general rule it implies: when a column decides what someone is *entitled to*, membership of the row is not sufficient authorization, and RLS is not the tool. Two denial tests in `schema.rls.test.ts` hold the line — one for a member's own organization, one for someone else's.

`subscriptions` follows the same rule at table scope: members may `select` it and nothing more, because `status = 'active'` is an entitlement too. `stripe_events` goes further and has **RLS enabled with no policy at all** — the deny-everything shape `admin_emails` uses. It is the webhook's own bookkeeping, and there is no query a founder should be making against it.

## Design decisions

- **`answers` and `model` as jsonb, validated in app by Zod against versioned schemas** — interview evolves fast; relational modeling of questions would calcify it. `schema_version` makes old answers interpretable forever.
- **Immutable `project_models` versions** — regeneration and future diffing need a stable snapshot of "what the engine saw."
- **Manifest in `artifact_files`, not only in Storage** — queryable per-file provenance is the foundation for Phase 4 repository sync.
- **`organizations.kind='personal'`** — avoids nullable org on projects and makes the M7 teams migration additive-only.
