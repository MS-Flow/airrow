-- The Pro plan, and the one thing a plan has to know about (spec 74).
--
-- The free generation ceiling was a cost control: every generation makes a Claude call Airrow pays
-- for and signup is open. This turns it into a business model. An organization carries a plan, and
-- the plan is the entitlement answer — "may this organization generate, and may it import?".
--
-- A column on `organizations` rather than a `subscriptions` table, deliberately. Billing *state*
-- (provider customer id, subscription status, period end, cancel-at-period-end) is a different
-- concern with a different owner, and the payment issue adds a table for it. That table will not
-- replace this column; it will be the only thing besides a migration that writes to it. So this
-- column is the half that outlives the provider: swapping Stripe for something else leaves it
-- untouched, and `checkAllowance` stays a single cheap read with no join.
--
-- Idempotent, replays cleanly from zero.

alter table public.organizations
  add column if not exists plan text not null default 'free';

-- Added separately and guarded, because `add column if not exists` skips the constraint when the
-- column is already there — a replay would otherwise leave the column unconstrained.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'organizations_plan_check'
       and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_plan_check check (plan in ('free', 'pro'));
  end if;
end;
$$;

comment on column public.organizations.plan is
  'Entitlement: free (one foundation, no import) or pro (unlimited, import). Written by migration or the billing webhook only — never by a member of the organization.';

/* ── The plan is not the organization's to change ──────────────────────────
 *
 * `20260725100000_schema.sql:197` grants insert, update and delete on `organizations` to
 * `authenticated`, and the "org members update organizations" policy admits any member of the row.
 * That was harmless while the table held a name and a slug. It is not harmless now: putting an
 * entitlement on the same row means a signed-in founder could `update organizations set plan =
 * 'pro'` straight against PostgREST with their own JWT and grant themselves Pro. The app never
 * offers that call, but the API is reachable without the app.
 *
 * RLS cannot express "this row, but not this column", so the fix is column-level privilege: drop
 * the table-wide grants and hand back every column except `plan`. The row policies are untouched, so
 * nothing a member could legitimately edit changes.
 *
 * Found by the denial test in `schema.rls.test.ts` — which is the entire argument for §II requiring
 * one. It was written expecting to pass, and it failed.
 */
revoke update, insert on public.organizations from authenticated;

grant update (name, kind, created_by, slug) on public.organizations to authenticated;
-- `plan` omitted, so a row inserted by a member takes the column default and can never arrive paid.
grant insert (id, name, created_at, kind, created_by, slug) on public.organizations to authenticated;

/* ── Not charging for work we did not pay for ──────────────────────────────
 *
 * Authoring memoisation already exists (20260727090000): a regeneration whose inputs hash, prompt
 * version and model all match a previous completed job reuses that job's prose and makes no Claude
 * call. But the job row is still inserted, the usage trigger still fires, and the founder is still
 * charged a generation — so "nothing changed" cost them a foundation for a call nobody made.
 *
 * This flag is what the ledger joins back to. It mirrors the existing rule for failed jobs: the
 * allowance counts Claude calls Airrow actually paid for, and nothing else. Set by the runner when
 * it reuses a payload; false for every job that authored live or derived deterministically.
 */
alter table public.generation_jobs
  add column if not exists reused_authoring boolean not null default false;

comment on column public.generation_jobs.reused_authoring is
  'True when this job reused a previous run''s authored payload instead of calling Claude. Excluded from the generation allowance — see countGenerations.';
