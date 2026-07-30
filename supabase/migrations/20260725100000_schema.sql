-- Airrow full product schema (issue #14).
--
-- Builds on the #9 proof (organizations, organization_members, is_org_member()).
-- Adds the remaining org-scoped domain tables so the DataStore can cut over from the
-- local .data/ file store to Supabase. Column shapes follow the live store.ts record
-- types so the cutover is lossless.
--
-- Not here (follow-up auth issue): profiles.id -> auth.users FK, the signup trigger,
-- and real login. profiles is created now (keyed on its own uuid) as scaffolding.
-- users/sessions stay on the .data/ bridge; artifacts store the GenerationResult as
-- jsonb (Supabase Storage is out of scope).

/* ── Identity scaffolding ─────────────────────────────────────────────────── */

-- Populated by the auth issue's signup trigger; empty for now. organization_members
-- and organizations.created_by reference the bridge user id (bare uuid) until then.
create table public.profiles (
  id           uuid primary key default gen_random_uuid(),
  email        text,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- Extend the #9 tenancy root to the full store OrgRecord shape.
alter table public.organizations add column kind       text not null default 'personal'
  check (kind in ('personal', 'team'));
alter table public.organizations add column created_by uuid;         -- bridge user id; FK with auth
alter table public.organizations add column slug       text unique;  -- reserved; unused by the bridge

/* ── Domain tables ────────────────────────────────────────────────────────── */

create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  slug            text not null,
  description     text not null default '',
  status          text not null default 'interviewing'
    check (status in ('interviewing', 'generating', 'ready', 'failed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, slug)
);

-- Membership helper for project-scoped child tables (constitution §II RLS pattern).
create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and public.is_org_member(p.organization_id)
  );
$$;

create table public.interviews (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  schema_version text not null,
  answers        jsonb not null default '{}'::jsonb,
  completed_at   timestamptz,
  created_at     timestamptz not null default now()
);

create table public.project_models (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  version    int not null,
  model      jsonb not null,
  created_at timestamptz not null default now(),
  unique (project_id, version)
);

create table public.generation_jobs (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  model_version_id uuid not null references public.project_models(id) on delete cascade,
  status           text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  stage            text
    check (stage in ('resolve', 'author', 'assemble', 'validate', 'manifest')),
  stages_done      text[] not null default '{}',
  files_authored   int not null default 0,
  total_files      int not null default 0,
  current_path     text,
  error            text,
  heartbeat_at     timestamptz not null default now(),
  started_at       timestamptz,
  finished_at      timestamptz
);

-- One artifact blob per job (store.ts keys artifacts by jobId). GenerationResult as
-- jsonb; Storage-backed manifest is a follow-up when Storage buckets land.
create table public.artifacts (
  id                uuid primary key default gen_random_uuid(),
  generation_job_id uuid not null unique references public.generation_jobs(id) on delete cascade,
  result            jsonb not null,
  created_at        timestamptz not null default now()
);

create table public.deliveries (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  job_id     uuid not null references public.generation_jobs(id) on delete cascade,
  method     text not null check (method in ('zip', 'github')),
  status     text not null default 'completed' check (status in ('completed', 'failed')),
  created_at timestamptz not null default now()
);

-- Created for completeness; populated by the GitHub App issue (not yet).
create table public.repo_connections (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider        text not null check (provider in ('github')),
  installation_id text not null,
  created_at      timestamptz not null default now(),
  unique (organization_id, provider)
);

/* ── RLS ──────────────────────────────────────────────────────────────────── */

alter table public.profiles         enable row level security;
alter table public.projects         enable row level security;
alter table public.interviews       enable row level security;
alter table public.project_models   enable row level security;
alter table public.generation_jobs  enable row level security;
alter table public.artifacts        enable row level security;
alter table public.deliveries       enable row level security;
alter table public.repo_connections enable row level security;

-- A user sees only their own profile.
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- Org-scoped resources: membership of the row's organization.
drop policy if exists "org members access projects" on public.projects;
create policy "org members access projects" on public.projects
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

drop policy if exists "org members access repo_connections" on public.repo_connections;
create policy "org members access repo_connections" on public.repo_connections
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- Project-scoped resources: membership of the parent project's organization.
drop policy if exists "org members access interviews" on public.interviews;
create policy "org members access interviews" on public.interviews
  for all using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists "org members access project_models" on public.project_models;
create policy "org members access project_models" on public.project_models
  for all using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists "org members access generation_jobs" on public.generation_jobs;
create policy "org members access generation_jobs" on public.generation_jobs
  for all using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists "org members access deliveries" on public.deliveries;
create policy "org members access deliveries" on public.deliveries
  for all using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

-- Artifacts join through their job to the project.
drop policy if exists "org members access artifacts" on public.artifacts;
create policy "org members access artifacts" on public.artifacts
  for all using (
    exists (
      select 1 from public.generation_jobs j
      where j.id = generation_job_id and public.is_project_member(j.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.generation_jobs j
      where j.id = generation_job_id and public.is_project_member(j.project_id)
    )
  );

/* ── Grants ───────────────────────────────────────────────────────────────── */
-- Supabase no longer auto-exposes new tables (config.toml [api]). The app path uses
-- the service_role key (bypasses RLS) and so needs explicit grants; authenticated is
-- granted for when real auth lands and the RLS policies above take effect.

grant all on public.profiles, public.projects, public.interviews, public.project_models,
             public.generation_jobs, public.artifacts, public.deliveries, public.repo_connections
  to service_role;

grant select, insert, update, delete on
             public.profiles, public.projects, public.interviews, public.project_models,
             public.generation_jobs, public.artifacts, public.deliveries, public.repo_connections
  to authenticated;

-- #9 granted only SELECT on the tenancy tables; the app now writes them too.
grant insert, update, delete on public.organizations        to authenticated;
grant insert, update, delete on public.organization_members to authenticated;
grant all on public.organizations        to service_role;
grant all on public.organization_members to service_role;

-- Write policies for the tenancy tables (read policies exist from #9).
drop policy if exists "org members write organizations" on public.organizations;
create policy "org members write organizations" on public.organizations
  for insert to authenticated with check (public.is_org_member(id));
drop policy if exists "org members update organizations" on public.organizations;
create policy "org members update organizations" on public.organizations
  for update to authenticated using (public.is_org_member(id));
drop policy if exists "org members write memberships" on public.organization_members;
create policy "org members write memberships" on public.organization_members
  for insert to authenticated with check (public.is_org_member(organization_id));
