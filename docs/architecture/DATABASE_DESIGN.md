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
```

## RLS pattern

Single helper: `is_org_member(org_id uuid)` security-definer function checking `organization_members`. Every policy reduces to membership of the row's (direct or joined) organization. Writes additionally check role where relevant. No table without a policy; policies tested in CI.

## Design decisions

- **`answers` and `model` as jsonb, validated in app by Zod against versioned schemas** — interview evolves fast; relational modeling of questions would calcify it. `schema_version` makes old answers interpretable forever.
- **Immutable `project_models` versions** — regeneration and future diffing need a stable snapshot of "what the engine saw."
- **Manifest in `artifact_files`, not only in Storage** — queryable per-file provenance is the foundation for Phase 4 repository sync.
- **`organizations.kind='personal'`** — avoids nullable org on projects and makes the M7 teams migration additive-only.
