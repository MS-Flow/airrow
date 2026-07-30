-- A durable record of generations used, and admin accounts that bypass the limit.
--
-- The bug: the allowance counted rows in `generation_jobs`, and those cascade away with their
-- project. A founder who hit the limit could delete a project and generate again — the ceiling was
-- refundable, which is no ceiling at all. Every generation costs a paid Claude call whether or not
-- the project it produced still exists, so what is counted has to survive the project.
--
-- Hence a ledger rather than a count over live rows. `project_id` is nullable and set null on
-- delete, so the row outlives what it refers to; `organization_id` is the thing it is really about
-- and is never null.

create table if not exists public.generation_usage (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Deliberately `set null`, not `cascade`: deleting the project must not delete the fact that a
  -- generation was paid for. This one clause is the whole fix.
  project_id      uuid references public.projects(id) on delete set null,
  generation_job_id uuid references public.generation_jobs(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists generation_usage_org_idx
  on public.generation_usage (organization_id, created_at desc);

comment on table public.generation_usage is
  'One row per generation started, kept for the lifetime of the organization. Survives project deletion by design — the allowance counts what was spent, not what still exists.';

-- Written by the database rather than the app. Two code paths create jobs (first run and
-- regenerate), and a third would be easy to add without remembering to record usage; a trigger
-- cannot be forgotten and cannot drift from what actually happened.
create or replace function public.record_generation_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.generation_usage (organization_id, project_id, generation_job_id)
  select p.organization_id, p.id, new.id
    from public.projects p
   where p.id = new.project_id;
  return new;
end;
$$;

drop trigger if exists generation_jobs_record_usage on public.generation_jobs;
create trigger generation_jobs_record_usage
  after insert on public.generation_jobs
  for each row execute function public.record_generation_usage();

-- Backfill so nobody's existing usage is forgotten when this ships. Only jobs whose project still
-- exists can be recovered — the ones lost to deletion are exactly what this table now prevents.
insert into public.generation_usage (organization_id, project_id, generation_job_id, created_at)
select p.organization_id, p.id, j.id, coalesce(j.created_at, now())
  from public.generation_jobs j
  join public.projects p on p.id = j.project_id
 where not exists (
   select 1 from public.generation_usage u where u.generation_job_id = j.id
 );

/* ── Admin accounts ─────────────────────────────────────────────────────────
 *
 * Unlimited generations, for the people who have to run test generations to build the product.
 * A column rather than an env var so it is auditable and survives a deploy config change, and so
 * the badge in the profile reads from the same fact the limit does.
 */
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is
  'Bypasses the free generation allowance. Granted by migration only — never from the app.';

-- Grant by email so this replays correctly whether or not the account exists yet at migration time;
-- the trigger in 20260725110000_auth.sql creates the profile row on signup, and the update below
-- catches accounts that already exist. Add a colleague by adding their address here in a new
-- migration — never by an UPDATE from the app, which is why no code path can set this column.
update public.profiles
   set is_admin = true
 where lower(email) in ('medlund01@gmail.com');

alter table public.generation_usage enable row level security;

-- Same shape as every other org-scoped table (§II): membership of the row's organization, denied
-- otherwise. Inserts come from the trigger, which is security definer and runs above this.
drop policy if exists "org members read generation_usage" on public.generation_usage;
create policy "org members read generation_usage" on public.generation_usage
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- RLS filters rows, but the role still needs the table privilege before any policy is consulted —
-- without this every read is "permission denied" rather than an empty result. `service_role` is
-- what the app's server-side client uses; `authenticated` is what the policy above applies to.
grant all on public.generation_usage to service_role;
grant select, insert, update, delete on public.generation_usage to authenticated;
