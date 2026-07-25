-- Airrow initial migration — proof-of-concept tenancy + RLS.
--
-- Scope (issue #9): demonstrate the multi-tenant RLS pattern end-to-end on a real
-- Supabase project. This is NOT the full product schema (projects, interviews,
-- artifacts, …) — that lands in a separate schema issue. Only the tenancy root
-- (`organizations`) and the membership join needed to prove RLS are created here.

-- Tenancy root. Every future resource hangs off organization_id (constitution §II).
create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- Membership join. user_id is a bare uuid for this POC; the real schema wires it to
-- public.profiles → auth.users (separate issue). auth.uid() still identifies the user.
create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null,
  role            text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- Single membership helper (constitution §II RLS pattern). security definer so the
-- membership lookup itself is not subject to organization_members' own RLS.
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
  );
$$;

-- RLS on by default, deny-by-default: with RLS enabled and only the policies below,
-- every access not matching a policy is denied.
alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;

create policy "members read their organizations"
  on public.organizations
  for select
  using (public.is_org_member(id));

create policy "members read their memberships"
  on public.organization_members
  for select
  using (public.is_org_member(organization_id));

-- Table privileges for the API role. RLS filters rows, but the role still needs a GRANT —
-- Supabase no longer auto-exposes new tables (see [api].auto_expose_new_tables in config.toml).
-- Reads only for now; writes are added with the real schema (separate issue).
grant select on public.organizations        to authenticated;
grant select on public.organization_members to authenticated;
