-- The allowance ledger stops being writable from a browser (spec 157, finding H1).
--
-- `20260725100000_schema.sql` granted `select, insert, update, delete` on eight tables to
-- `authenticated`, with the comment "granted for when real auth lands and the RLS policies above take
-- effect". Real auth landed; the grant was never narrowed. `20260727160000_generation_allowance.sql`
-- then did the same for `generation_usage`, whose policy is `for all using (is_org_member(...))` —
-- and a founder's own organization is precisely the one they would delete from.
--
-- So the ceiling on the free plan could be reset from the browser, against PostgREST, with no
-- involvement from the app: delete the ledger rows, or mark the jobs behind them `failed` or
-- `reused_authoring` — `chargedUsage` excludes both — and every foundation after that is free. Each
-- one is two Claude calls on generation's budget, and unlimited generation is what Pro sells.
--
-- Nothing in the application writes either table as `authenticated`: every write goes through the
-- service-role client in `apps/web/src/lib/data/supabase.ts`, and `generation_usage` rows are
-- inserted by `record_generation_usage()`, which is security definer and runs above both the grant
-- and the policy. `select` therefore stays — reading your own usage is not the problem, and the RLS
-- policies keep doing that job.
--
-- The same treatment `20260729120000_pro_plan.sql` gave `organizations.plan`, for the same reason:
-- what someone is entitled to is not theirs to edit. Denial tests live in
-- `apps/web/src/lib/data/schema.rls.test.ts`.
--
-- Idempotent, replays cleanly from zero: `revoke` on a privilege that was never granted is a no-op.

revoke insert, update, delete on public.generation_usage from authenticated;
revoke insert, update, delete on public.generation_jobs  from authenticated;

comment on table public.generation_usage is
  'The durable allowance ledger (spec 74). Written only by record_generation_usage() and the service role — authenticated may read it and nothing else (spec 157).';
