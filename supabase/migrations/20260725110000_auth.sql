-- Real Supabase Auth wiring (issue #18), on top of the #14 schema.
--
-- Links profiles to auth.users and auto-provisions a personal org + owner membership
-- whenever a new auth user is created. This replaces the dev-auth bridge; from now on
-- every session is a real auth.uid() and the RLS policies from #14 actually bite.
--
-- Scope note: organization_members.user_id and organizations.created_by remain bare
-- uuids (they already hold auth user ids). Tightening those to auth.users FKs is
-- deferred — it would require reworking #14's synthetic-user integration tests — so
-- deleting an auth user cascades its profile here; membership cleanup is future work.

-- profiles rows are keyed by the auth user id. Fresh start: no production users yet, so
-- the table is empty and the FK can be added cleanly (constitution — migrations replay
-- from zero; #14 created profiles without the FK, deferred to this issue).
alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

-- On signup: create the profile, then a personal organization + owner membership.
-- security definer so it runs above RLS. Idempotent — re-firing never creates a second
-- personal org for a user who already has a membership.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display    text;
  new_org_id uuid;
begin
  display := coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1));

  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, display)
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
