-- The operator's console (spec 150).
--
-- Everything the admin page needs that the schema could not already answer: a way to hand a founder a
-- generation back, a way to take an account offline, a record of both, and the aggregates the
-- statistics are read from. Plus one fix that has nothing to do with the page and everything to do
-- with whether the page is safe to build at all — see "Closing the profiles hole" below.
--
-- Idempotent, replays cleanly from zero.

/* ── Closing the profiles hole ──────────────────────────────────────────────
 *
 * `20260725100000_schema.sql` granted `select, insert, update, delete` on `public.profiles` to
 * `authenticated`, under the policy `own profile … using (id = auth.uid())`. RLS is behaving
 * correctly — the row genuinely belongs to the founder — but the *privilege* is table-wide, so every
 * column on their own row is theirs to write. That includes `is_admin`, which means any signed-in
 * founder could grant themselves the flag with one statement and the anon key.
 *
 * Until now that bought an unlimited generation allowance. From this migration on it would buy every
 * other workspace's interview answers, and it would let a suspended account clear its own
 * `suspended_at`. So the privilege is narrowed to the two columns the founder legitimately owns,
 * exactly as `20260729120000_pro_plan.sql` did for `organizations.plan`.
 *
 * Nothing in the app is affected: every profile write goes through the DataStore on the service-role
 * key, and `authenticated` holds these privileges only as defense in depth.
 */
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

/* ── Suspension ─────────────────────────────────────────────────────────────
 *
 * The app's own record of an account being offline, read where the session is checked so an
 * already-issued token stops working at the next server call. Supabase Auth is banned alongside it by
 * the admin action, which is what stops a *new* token being fetched — but that ban is not the truth,
 * because it lives outside our schema and cannot be joined against. This column is.
 */
alter table public.profiles
  add column if not exists suspended_at timestamptz;

comment on column public.profiles.suspended_at is
  'Set by an admin to take an account offline (spec 150). Read by getSession, so an open session dies at the next server call. Never writable by the account itself.';

/* ── Generations handed back ────────────────────────────────────────────────
 *
 * One row is one generation. There is deliberately no `amount` column: a quantity plus a single
 * `consumed_at` cannot express "granted three, spent one", and a partially-spent row is a state that
 * has to be kept consistent under concurrency for no benefit. Granting three writes three rows,
 * counting is `count(*) where consumed_at is null`, and every spent credit says exactly when it went.
 *
 * This is **not** `plan_grants`. That table grants a week of Pro and is the referral programme's
 * (spec 122); this one returns a single generation to a founder support has agreed to make whole.
 * Neither of them is ever `organizations.plan`, which stays Stripe's alone (specs 74, 99, 100).
 */
create table if not exists public.generation_credits (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Why support gave it. Free text on purpose: the reasons are not a taxonomy we can predict, and a
  -- wrong enum would be answered by picking 'other' every time.
  reason          text not null default '',
  -- The admin who granted it. `set null` rather than cascade: if the grantor's account is ever
  -- removed, the founder keeps the generation they were promised.
  granted_by      uuid references public.profiles(id) on delete set null,
  granted_at      timestamptz not null default now(),
  consumed_at     timestamptz
);

-- The allowance asks "does this workspace have an unspent credit" on every generation decision, and
-- consumes the oldest. Partial, because spent credits are history and only the unspent ones are hot.
create index if not exists generation_credits_unspent_idx
  on public.generation_credits (organization_id, granted_at)
  where consumed_at is null;

comment on table public.generation_credits is
  'One generation handed back by support (spec 150). One row per generation, consumed oldest first by claimAllowance. Never a substitute for organizations.plan.';

/* ── What we did, and why ───────────────────────────────────────────────────
 *
 * Suspension, reactivation, credits and publication decisions all land here. It is read back in the
 * app, inline on the thing it concerns — an audit log that can only be read in Supabase Studio would
 * reintroduce exactly the problem this page exists to solve.
 *
 * `subject_*` is a loose pair rather than five nullable foreign keys: the subject of an action is a
 * user, an organization, a ticket or a review depending on the action, and a table with five columns
 * of which four are always null describes the shape of the writer rather than the shape of the fact.
 * Nothing joins on it; the screens look up the subject they already have.
 */
create table if not exists public.admin_audit_log (
  id           uuid primary key default gen_random_uuid(),
  -- Who did it. `set null` so removing an admin account never rewrites what happened.
  actor_id     uuid references public.profiles(id) on delete set null,
  action       text not null,
  subject_type text not null,
  subject_id   uuid not null,
  reason       text not null default '',
  created_at   timestamptz not null default now(),
  constraint admin_audit_log_action_check check (action in (
    'user.suspend', 'user.reactivate', 'credits.grant',
    'ticket.close', 'ticket.reopen', 'review.publish', 'review.unpublish'
  )),
  constraint admin_audit_log_subject_check check (subject_type in (
    'user', 'organization', 'ticket', 'review'
  ))
);

create index if not exists admin_audit_log_subject_idx
  on public.admin_audit_log (subject_type, subject_id, created_at desc);

comment on table public.admin_audit_log is
  'Every operator action taken from /app/admin (spec 150): who, what, when and why. Append-only in practice — nothing in the app updates or deletes a row.';

/* ── Access ─────────────────────────────────────────────────────────────────
 *
 * RLS on, and **no policy at all** on either table. With RLS enabled and no policy every access is
 * denied, which is the correct answer for both: a founder has no business reading who has been
 * suspended, and `generation_credits` is an entitlement — a founder who can insert one has granted
 * themselves a generation from a browser console, and no policy phrased as "your own organization"
 * would stop them, because their own organization is precisely the one they would grant it to.
 *
 * The same reasoning `20260730120000_referrals.sql` gives for `plan_grants`, one step further: that
 * table lets members read their own grants because the invite card shows them. Nothing shows these.
 *
 * `authenticated` is granted nothing, and the denial tests say so.
 */
alter table public.generation_credits enable row level security;
alter table public.admin_audit_log    enable row level security;

grant all on public.generation_credits to service_role;
grant all on public.admin_audit_log    to service_role;

revoke all on public.generation_credits from authenticated;
revoke all on public.admin_audit_log    from authenticated;

/* ── Accounts, as the console needs to see them ─────────────────────────────
 *
 * Last sign-in and address verification live in `auth.users`, which PostgREST does not expose and
 * `authenticated` cannot read. Everything else the user list shows lives on `profiles`. Joining them
 * into one view is what lets the list **search, sort and page in a single query** — the alternative is
 * paging `profiles` and then sorting the page by a column from another table, which is not sorting
 * the list at all, only the twenty-five rows that happened to come back.
 *
 * Owned by `postgres`, so it runs with the definer's rights and the grant below is the whole access
 * control. Only the columns the console actually shows: a `select *` over `auth.users` would put
 * password hashes and recovery tokens one careless grant away from a screen.
 */
drop view if exists public.admin_user_accounts;
drop view if exists public.admin_accounts;
create view public.admin_accounts as
  select p.id,
         p.email,
         p.display_name,
         p.is_admin,
         p.suspended_at,
         p.created_at,
         u.last_sign_in_at,
         u.email_confirmed_at
    from public.profiles p
    join auth.users u on u.id = p.id;

comment on view public.admin_accounts is
  'Profiles joined to the two auth.users columns the admin console shows (spec 150). One object so the user list can search, sort and page in one query. service_role only — never granted to authenticated.';

revoke all on public.admin_accounts from public, authenticated;
grant select on public.admin_accounts to service_role;

/* ── The numbers ────────────────────────────────────────────────────────────
 *
 * Aggregates belong in Postgres. PostgREST is good at returning rows and bad at counting them, so a
 * statistics page built on it would fetch every row and count in JavaScript — which works until we
 * are many, and then stops working on exactly the day the numbers get interesting.
 *
 * All of these are `security invoker` (the default) rather than definer, deliberately: they are
 * reachable only by `service_role`, which bypasses RLS anyway, so definer rights would buy nothing
 * and would turn a mistaken grant into a full read of every table. Execute is revoked from `public`
 * — Postgres grants it there by default, and leaving it would make every one of these callable by any
 * signed-in founder.
 */

-- Signups, projects, generations and tickets per day, with empty days as zeros rather than gaps.
create or replace function public.admin_daily_series(p_from date, p_to date)
returns table (day date, signups bigint, projects bigint, generations bigint, tickets bigint)
language sql
stable
set search_path = public
as $$
  select d::date,
         (select count(*) from public.profiles p
           where p.created_at >= d and p.created_at < d + interval '1 day'),
         (select count(*) from public.projects pr
           where pr.created_at >= d and pr.created_at < d + interval '1 day'),
         (select count(*) from public.generation_usage u
           where u.created_at >= d and u.created_at < d + interval '1 day'),
         (select count(*) from public.support_tickets t
           where t.created_at >= d and t.created_at < d + interval '1 day')
    from generate_series(p_from::timestamptz, p_to::timestamptz, interval '1 day') as d
   order by d;
$$;

-- One row of scalars for a window. Called twice by the page — this period and the one before it —
-- because a number without a direction is not information.
create or replace function public.admin_totals(p_from timestamptz, p_to timestamptz)
returns table (
  signups bigint, projects bigint, interviews_completed bigint, generations bigint,
  failures_ours bigint, failures_rejected bigint, tickets bigint,
  invites_created bigint, invites_matured bigint, grant_weeks bigint,
  reviews bigint, avg_rating numeric
)
language sql
stable
set search_path = public
as $$
  select
    (select count(*) from public.profiles where created_at >= p_from and created_at < p_to),
    (select count(*) from public.projects where created_at >= p_from and created_at < p_to),
    (select count(*) from public.interviews
      where completed_at is not null and completed_at >= p_from and completed_at < p_to),
    (select count(*) from public.generation_usage where created_at >= p_from and created_at < p_to),
    -- The split spec 128 made possible: a job that failed on our side, against one whose answers the
    -- authoring layer refused. Telling them apart is the difference between a bug and a bad interview.
    (select count(*) from public.generation_jobs j
      where j.status = 'failed' and j.rejected_answers is null
        and j.finished_at >= p_from and j.finished_at < p_to),
    (select count(*) from public.generation_jobs j
      where j.status = 'failed' and j.rejected_answers is not null
        and j.finished_at >= p_from and j.finished_at < p_to),
    (select count(*) from public.support_tickets where created_at >= p_from and created_at < p_to),
    (select count(*) from public.referrals where attached_at >= p_from and attached_at < p_to),
    (select count(*) from public.referrals
      where matured_at is not null and matured_at >= p_from and matured_at < p_to),
    (select count(*) from public.plan_grants where created_at >= p_from and created_at < p_to),
    (select count(*) from public.project_reviews where created_at >= p_from and created_at < p_to),
    (select round(avg(rating), 2) from public.project_reviews
      where created_at >= p_from and created_at < p_to);
$$;

-- Where projects stand right now. The most important chart on the page: it says where founders stop.
-- The output columns are named `total` rather than `count` throughout: a `returns table` column is a
-- name in scope inside the body, and one called `count` sitting beside `count(*)` is exactly the kind
-- of ambiguity that resolves differently on a version bump.
create or replace function public.admin_project_status_counts()
returns table (status text, total bigint)
language sql
stable
set search_path = public
as $$
  select p.status, count(*) from public.projects p group by p.status order by p.status;
$$;

-- How far into the interview the ones who never finished got. `answers` is a jsonb object, so the
-- number of keys is the number of questions answered — counted in Postgres, not fetched and counted here.
create or replace function public.admin_interview_progress()
returns table (answered integer, total bigint)
language sql
stable
set search_path = public
as $$
  select a.answered, count(*)
    from public.interviews i
    join public.projects p on p.id = i.project_id
   cross join lateral (
     select count(*)::integer as answered from jsonb_object_keys(i.answers)
   ) a
   where i.completed_at is null and p.status = 'interviewing'
   group by a.answered
   order by a.answered;
$$;

-- Tickets by category in a window. A category that grows is a product bug that has not been named yet.
create or replace function public.admin_ticket_categories(p_from timestamptz, p_to timestamptz)
returns table (category text, total bigint)
language sql
stable
set search_path = public
as $$
  select t.category, count(*)
    from public.support_tickets t
   where t.created_at >= p_from and t.created_at < p_to
   group by t.category
   order by count(*) desc;
$$;

-- Ratings, and how the plan is actually distributed right now. Two questions, one round trip: both
-- are single-row scalars that the statistics page shows side by side.
create or replace function public.admin_standing()
returns table (
  pro_orgs bigint, free_orgs bigint, subs_active bigint, subs_cancelling bigint,
  grants_active bigint, credits_unspent bigint, tickets_open bigint,
  reviews_consented bigint, reviews_published bigint
)
language sql
stable
set search_path = public
as $$
  select
    (select count(*) from public.organizations where plan = 'pro'),
    (select count(*) from public.organizations where plan = 'free'),
    (select count(*) from public.subscriptions where status in ('active', 'trialing')),
    (select count(*) from public.subscriptions where cancel_at_period_end),
    (select count(*) from public.plan_grants where starts_at is not null and expires_at > now()),
    (select count(*) from public.generation_credits where consumed_at is null),
    (select count(*) from public.support_tickets where status = 'open'),
    (select count(*) from public.project_reviews where consent_public),
    (select count(*) from public.project_reviews where published_at is not null);
$$;

create or replace function public.admin_review_distribution()
returns table (rating smallint, total bigint)
language sql
stable
set search_path = public
as $$
  select r.rating, count(*) from public.project_reviews r group by r.rating order by r.rating;
$$;

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'admin_daily_series(date, date)',
    'admin_totals(timestamptz, timestamptz)',
    'admin_project_status_counts()',
    'admin_interview_progress()',
    'admin_ticket_categories(timestamptz, timestamptz)',
    'admin_standing()',
    'admin_review_distribution()'
  ] loop
    execute format('revoke all on function public.%s from public, authenticated', fn);
    execute format('grant execute on function public.%s to service_role', fn);
  end loop;
end;
$$;
