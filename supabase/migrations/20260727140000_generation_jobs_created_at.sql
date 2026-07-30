-- An immutable creation time for generation jobs.
--
-- The bug: `latestJob` ordered by `started_at desc nulls last`, and a job is created with
-- `started_at = null` — it is only set when the job begins running. So on any project that already
-- had a finished job, "latest" resolved to the *old* one. Clicking regenerate created a queued job
-- that nothing could see: the start endpoint found a completed job and refused to run anything, the
-- poll reported that old job's `completed`, and the project sat on `generating` forever.
--
-- Neither existing column can order jobs correctly. `started_at` is null exactly when the job most
-- needs to be found, and `heartbeat_at` is bumped on every update, so it says when a job was last
-- touched rather than when it was created. Ordering on a mutable column is what let this class of
-- bug in; `created_at` is written once and never updated.
--
-- Idempotent, replays cleanly from zero.

-- Added nullable first so existing rows can be backfilled with their real order rather than all
-- collapsing to now(), which would leave the very rows this fixes unorderable.
alter table public.generation_jobs
  add column if not exists created_at timestamptz;

update public.generation_jobs
   set created_at = coalesce(started_at, heartbeat_at)
 where created_at is null;

alter table public.generation_jobs
  alter column created_at set default now(),
  alter column created_at set not null;

-- "The project's most recent job" is the single hottest read in generation: the progress screen
-- polls it every 150ms.
create index if not exists generation_jobs_project_created_idx
  on public.generation_jobs (project_id, created_at desc);

comment on column public.generation_jobs.created_at is
  'When the job was queued. Immutable — the only correct ordering for "the latest job"; started_at is null until it runs and heartbeat_at moves on every update.';
