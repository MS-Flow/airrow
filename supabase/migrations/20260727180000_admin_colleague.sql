-- Admin accounts, granted by address rather than by row.
--
-- The previous migration granted `is_admin` with an UPDATE, which silently does nothing when the
-- account does not exist yet — and neither of these accounts is guaranteed to have signed up before
-- a fresh database is migrated. So the address is the durable fact and the profile row derives from
-- it: the signup trigger consults this list when it creates the profile, and the backfill below
-- catches accounts that already exist. Either order works.
--
-- Idempotent, replays cleanly from zero.

create table if not exists public.admin_emails (
  email text primary key
);

comment on table public.admin_emails is
  'Addresses that get is_admin on signup. Seeded by migration only — no app code reads or writes it.';

insert into public.admin_emails (email)
values ('medlund01@gmail.com'), ('sebbebreuker@gmail.com')
on conflict (email) do nothing;

-- Same body as 20260725110000_auth.sql, with the admin lookup added. Replacing the whole function
-- rather than patching it keeps one readable definition of what happens on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display    text;
  new_org_id uuid;
  admin      boolean;
begin
  display := coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1));
  admin := exists (select 1 from public.admin_emails a where a.email = lower(new.email));

  insert into public.profiles (id, email, display_name, is_admin)
  values (new.id, new.email, display, admin)
  on conflict (id) do nothing;

  if not exists (select 1 from public.organization_members where user_id = new.id) then
    insert into public.organizations (name, kind, created_by)
    values (display || '''s workspace', 'personal', new.id)
    returning id into new_org_id;

    insert into public.organization_members (organization_id, user_id, role)
    values (new_org_id, new.id, 'owner');
  end if;

  return new;
end;
$$;

-- Accounts that signed up before this landed.
update public.profiles p
   set is_admin = true
  from public.admin_emails a
 where lower(p.email) = a.email
   and p.is_admin is distinct from true;

-- No RLS policy, deliberately: with RLS enabled and no policy, every access is denied, which is
-- exactly right for a list only the signup trigger (security definer, above RLS) ever reads. A
-- founder must not be able to see who the admins are, let alone add themselves.
alter table public.admin_emails enable row level security;
