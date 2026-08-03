-- What the founder showed us (spec 159).
--
-- The interview's design question used to accept words and nothing else. A founder who could not
-- write a design brief got a generic one, and generic output is a top-severity bug. This is where the
-- screenshots they attach instead live: one row per image, the bytes in a private Storage bucket.
--
-- Two things this table is deliberately not. It is not part of `interviews.answers` — that JSON is
-- rewritten on every keystroke, replayed into a guest's localStorage, and hashed into the authoring
-- memo, none of which should ever carry a megabyte of PNG. And it is not reachable by anyone: the
-- images are read server-side by the authoring provider, described in words, and never published.
--
-- Idempotent, replays cleanly from zero.

create table if not exists public.ui_references (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  -- Where the bytes are, inside the private bucket below. Unique because two rows pointing at one
  -- object would make deletion ambiguous, and deletion is what protects the founder's material.
  storage_path    text not null unique,
  media_type      text not null,
  bytes           integer not null,
  created_by      uuid not null,
  created_at      timestamptz not null default now(),
  constraint ui_references_media_type_check
    check (media_type in ('image/png', 'image/jpeg', 'image/webp')),
  -- The same 2 MB the upload action enforces. Stated here as well because a limit that lives only in
  -- application code is a limit that a second caller silently does not have.
  constraint ui_references_bytes_check check (bytes > 0 and bytes <= 2097152)
);

-- The interview screen lists a project's references; generation loads them in the same order.
create index if not exists ui_references_project_created_idx
  on public.ui_references (project_id, created_at);

comment on table public.ui_references is
  'Screenshots a founder attached to the UI question (spec 159). Bytes live in the private ui-references bucket; these rows are the index. Read server-side by the authoring provider only — never rendered to another user, never written into a generated foundation.';

/* ── Access ─────────────────────────────────────────────────────────────────
 *
 * Members read their own workspace's rows. Writes are `service_role` only, exactly as for tickets and
 * reviews: the row is written by a server action that has already resolved the organization from the
 * session and checked the type, the size and the count. Granting `authenticated` an INSERT would make
 * every one of those checks optional, because a row inserted from a browser console skips all of them
 * — and here it would also point at a Storage object nobody validated.
 */
alter table public.ui_references enable row level security;

drop policy if exists "org members read ui_references" on public.ui_references;
create policy "org members read ui_references" on public.ui_references
  for select using (public.is_org_member(organization_id));

grant all on public.ui_references to service_role;
grant select on public.ui_references to authenticated;

/* ── The bucket ─────────────────────────────────────────────────────────────
 *
 * Private, and with no policy granting anyone anything. That is not an omission: Storage enforces RLS
 * on `storage.objects`, and with no policy for `authenticated` or `anon`, the only role that reaches
 * these bytes is `service_role`, which is the one the DataStore holds. The founder sees their own
 * uploads through a short-expiry signed URL the server mints for them (§II), never through a public
 * path — so an image cannot be enumerated, hotlinked, or reached after the project is gone.
 */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ui-references', 'ui-references', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
