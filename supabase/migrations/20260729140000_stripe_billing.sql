-- Stripe billing state, and the ledger that makes the webhook safe to retry (spec 99).
--
-- Spec 74 put `organizations.plan` on the organization and argued it should stay there: it is the
-- entitlement answer, it survives a change of payment provider, and `checkAllowance` reads it
-- without a join. This migration adds what is *Stripe's* rather than ours, beside it.
--
-- Idempotent, replays cleanly from zero.

create table if not exists public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  -- One subscription per organization. Unique rather than merely referenced: two live subscriptions
  -- for one workspace is a billing incident, not a state to model.
  organization_id          uuid not null unique references public.organizations(id) on delete cascade,
  provider                 text not null default 'stripe' check (provider in ('stripe')),
  provider_customer_id     text not null,
  provider_subscription_id text,
  -- Stripe's own vocabulary, kept verbatim. Translating it into ours would mean maintaining a
  -- mapping that silently drops any status Stripe adds later.
  status                   text not null,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists subscriptions_customer_idx
  on public.subscriptions (provider_customer_id);

comment on table public.subscriptions is
  'Stripe billing state per organization. The entitlement itself lives on organizations.plan — this table records why it has the value it has.';

alter table public.subscriptions enable row level security;

-- Members may read their own billing state; nobody writes it but the webhook, which runs as
-- service_role. Note there is no `with check` and no insert/update grant below: the read policy is
-- the whole of what `authenticated` gets, which is the same reasoning that protects
-- `organizations.plan` (see DATABASE_DESIGN, "The plan column is the exception").
drop policy if exists "org members read subscriptions" on public.subscriptions;
create policy "org members read subscriptions" on public.subscriptions
  for select using (public.is_org_member(organization_id));

grant all on public.subscriptions to service_role;
grant select on public.subscriptions to authenticated;

/* ── Delivered events ──────────────────────────────────────────────────────
 *
 * Stripe guarantees at-least-once delivery and retries for days on a non-2xx. Without a record of
 * what has already been applied, one retried `checkout.session.completed` is a second upgrade — and
 * an `invoice.payment_failed` replayed after a recovery would undo a good state.
 *
 * The primary key is the whole mechanism: claiming an event is an insert that either succeeds or
 * violates the key, which is atomic and needs no lock of ours.
 */
create table if not exists public.stripe_events (
  event_id    text primary key,
  event_type  text not null,
  received_at timestamptz not null default now()
);

comment on table public.stripe_events is
  'Event ids already applied, so a redelivered webhook is a no-op. Written by the webhook only.';

-- RLS on with no policy at all: every access is denied, which is exactly right for a table only the
-- webhook (service_role, above RLS) ever touches. Same shape as `admin_emails` — a founder has no
-- business reading our billing bookkeeping, and there is no query they should be making against it.
alter table public.stripe_events enable row level security;

grant all on public.stripe_events to service_role;
