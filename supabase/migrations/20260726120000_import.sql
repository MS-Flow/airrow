-- Importing an existing project (spec 63).
--
-- An import belongs to the project it created, so these tables are project-scoped and reuse the
-- is_project_member() pattern from the #14 schema — tenancy still resolves to organization_id
-- through projects, exactly like interviews and generation_jobs.
--
-- import_files deliberately stores a digest, never the content: Airrow needs to tell "already
-- there" from "different" when diffing generated output, and a digest answers that without the
-- customer's source ever landing in our database (constitution §II, customer IP).

create table if not exists public.import_sources (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  kind           text not null check (kind in ('zip', 'repo')),
  status         text not null default 'analyzed' check (status in ('analyzed', 'failed')),
  -- Name of the uploaded archive, for the review screen. Untrusted text; never a filesystem path.
  original_name  text not null default '',
  files_analyzed int not null default 0,
  files_ignored  int not null default 0,
  -- ImportAnalysis: the prefilled answers plus the evidence behind each one.
  analysis       jsonb not null default '{}'::jsonb,
  error          text,
  created_at     timestamptz not null default now()
);

create index if not exists import_sources_project_idx on public.import_sources (project_id);

create table if not exists public.import_files (
  id               uuid primary key default gen_random_uuid(),
  import_source_id uuid not null references public.import_sources(id) on delete cascade,
  path             text not null,
  bytes            int not null,
  digest           text not null,
  unique (import_source_id, path)
);

-- One row per generated file that collides with an imported one. A conflict with no row, or a row
-- with resolution 'keep_existing', means the existing file stands — silence never overwrites.
create table if not exists public.import_conflicts (
  id                uuid primary key default gen_random_uuid(),
  import_source_id  uuid not null references public.import_sources(id) on delete cascade,
  generation_job_id uuid not null references public.generation_jobs(id) on delete cascade,
  path              text not null,
  resolution        text not null check (resolution in ('keep_existing', 'use_generated')),
  decided_at        timestamptz not null default now(),
  unique (generation_job_id, path)
);

/* ── RLS ──────────────────────────────────────────────────────────────────── */

alter table public.import_sources   enable row level security;
alter table public.import_files     enable row level security;
alter table public.import_conflicts enable row level security;

create policy "org members access import_sources" on public.import_sources
  for all using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

-- The children join through their source to the project, mirroring the artifacts policy.
create policy "org members access import_files" on public.import_files
  for all using (
    exists (
      select 1 from public.import_sources s
      where s.id = import_source_id and public.is_project_member(s.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.import_sources s
      where s.id = import_source_id and public.is_project_member(s.project_id)
    )
  );

create policy "org members access import_conflicts" on public.import_conflicts
  for all using (
    exists (
      select 1 from public.import_sources s
      where s.id = import_source_id and public.is_project_member(s.project_id)
    )
  )
  with check (
    exists (
      select 1 from public.import_sources s
      where s.id = import_source_id and public.is_project_member(s.project_id)
    )
  );

/* ── Grants ───────────────────────────────────────────────────────────────── */
-- New tables are not auto-exposed (config.toml [api]); the app path uses service_role.

grant all on public.import_sources, public.import_files, public.import_conflicts to service_role;

grant select, insert, update, delete on
             public.import_sources, public.import_files, public.import_conflicts
  to authenticated;
