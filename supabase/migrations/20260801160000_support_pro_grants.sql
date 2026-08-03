-- Pro that support can hand out (spec 164).
--
-- One constraint widened, and nothing else. `plan_grants` already is what a non-Stripe entitlement
-- looks like: `20260730120000_referrals.sql` built it for the invite programme, RLS already denies
-- `authenticated` every write, and `claimPro`/`checkAllowance` already resolve an entitlement as *the
-- plan or an active grant*. The only thing standing between that table and an operator granting Pro
-- was a check constraint that named exactly one source.
--
-- Why not `organizations.plan`: that column is Stripe's alone (specs 74, 99, 100). A support write to
-- it survives right up until the next webhook or `syncPlanFromStripe` reconciles the workspace against
-- Stripe's answer, which knows nothing about our gift — the entitlement would vanish silently, and the
-- founder would be told to contact support about the Pro that support just gave them.
--
-- Idempotent, replays cleanly from zero.

alter table public.plan_grants
  drop constraint if exists plan_grants_source_check;

alter table public.plan_grants
  add constraint plan_grants_source_check check (source in ('referral', 'support'));

comment on column public.plan_grants.source is
  'Where this entitlement came from: ''referral'' — earned by inviting someone who generated (spec 122); ''support'' — given by an operator from the admin console (spec 164). Never a substitute for organizations.plan, which only Stripe writes.';

/* ── The audit log has to be able to say what happened ──────────────────────
 *
 * `admin_audit_log.action` is a closed set in Postgres, not only in TypeScript
 * (`20260801130000_admin_console.sql`). Widening the union in `recordAdminAction` without widening the
 * constraint would have failed at the database: the grant would be written, and then the row recording
 * it would be rejected — leaving Pro handed out with no trace of who did it, and an error on the
 * operator's screen after the thing they asked for had already happened.
 *
 * The two names match the actions exactly, and the subject stays `user`: an operator is looking at a
 * person, and the audit lists on the console are keyed on users.
 */
alter table public.admin_audit_log
  drop constraint if exists admin_audit_log_action_check;

alter table public.admin_audit_log
  add constraint admin_audit_log_action_check check (action in (
    'user.suspend', 'user.reactivate', 'credits.grant',
    'pro.grant', 'pro.revoke',
    'ticket.close', 'ticket.reopen', 'review.publish', 'review.unpublish'
  ));
