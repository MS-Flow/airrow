-- Reaching us, and telling us what it was worth (spec 144).
--
-- Two tables that exist for the same reason: until now every word a founder wanted to say to Airrow
-- had nowhere to go. A ticket is a question we owe an answer to; a review is a verdict we may one day
-- be allowed to quote. Both are written before any email is attempted, so a dead third party costs us
-- a notification and never the message itself.
--
-- Idempotent, replays cleanly from zero.

/* ── Tickets ────────────────────────────────────────────────────────────────
 *
 * `project_id` is nullable and `on delete set null` rather than cascading: a founder who deletes the
 * project they were asking about still deserves the answer, and a ticket that vanishes with its
 * subject is a conversation that ends mid-sentence.
 *
 * `status` is ours, not theirs. It exists so a closed ticket can be told from an open one when we
 * read the list; nothing in the app lets a founder set it, which is why there is no policy for that
 * below.
 */
create table if not exists public.support_tickets (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id         uuid not null,
  project_id      uuid references public.projects(id) on delete set null,
  category        text not null,
  subject         text not null,
  body            text not null,
  status          text not null default 'open',
  created_at      timestamptz not null default now(),
  constraint support_tickets_category_check
    check (category in ('generation', 'billing', 'account', 'other')),
  constraint support_tickets_status_check check (status in ('open', 'closed'))
);

-- The support page reads a workspace's tickets newest first; the rate limit counts the last day's.
-- One index answers both.
create index if not exists support_tickets_org_created_idx
  on public.support_tickets (organization_id, created_at desc);

comment on table public.support_tickets is
  'Support requests written from /app/support (spec 144). Stored before the notification email is attempted, so a mail failure never loses a ticket.';

/* ── Reviews ────────────────────────────────────────────────────────────────
 *
 * One per project — the unique constraint is the whole rule. A founder who regenerates revises the
 * verdict they already gave instead of adding a second one, which is also what keeps one person from
 * appearing twice on a landing page that quotes these.
 *
 * `consent_public` and `published_at` are two different permissions and both are required before a
 * word of this is public: the founder's, and ours. Nothing in the application ever writes
 * `published_at` — publishing arrives with the admin page, in its own spec — so until then the
 * column's only job is to make that page a page rather than a migration.
 */
create table if not exists public.project_reviews (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id      uuid not null unique references public.projects(id) on delete cascade,
  user_id         uuid not null,
  rating          smallint not null,
  body            text not null default '',
  consent_public  boolean not null default false,
  display_name    text not null default '',
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint project_reviews_rating_check check (rating between 1 and 5)
);

create index if not exists project_reviews_org_idx
  on public.project_reviews (organization_id);

comment on table public.project_reviews is
  'A founder''s rating of the foundation they were given (spec 144). One row per project, editable. Public only when consent_public AND published_at are both set, and nothing in the app sets published_at.';

/* ── Access ─────────────────────────────────────────────────────────────────
 *
 * Members read their own workspace's rows and nothing else — the same shape as every other
 * org-scoped table.
 *
 * Writes are `service_role` only, and that is stricter than it first looks like it needs to be. The
 * rows are written by a server action that has already decided who the founder is, checked the rate
 * limit and resolved the organization from the session; handing `authenticated` an INSERT would make
 * every one of those checks optional, since a row inserted from a browser console skips all of them.
 * `project_reviews` has the sharper version of the same problem: `published_at` sits on the row a
 * founder would be allowed to update, so a self-publishing testimonial would be one UPDATE away.
 * Neither privilege is granted, and the denial tests say so.
 */
alter table public.support_tickets  enable row level security;
alter table public.project_reviews  enable row level security;

drop policy if exists "org members read support_tickets" on public.support_tickets;
create policy "org members read support_tickets" on public.support_tickets
  for select using (public.is_org_member(organization_id));

drop policy if exists "org members read project_reviews" on public.project_reviews;
create policy "org members read project_reviews" on public.project_reviews
  for select using (public.is_org_member(organization_id));

grant all on public.support_tickets to service_role;
grant all on public.project_reviews to service_role;

grant select on public.support_tickets to authenticated;
grant select on public.project_reviews to authenticated;
