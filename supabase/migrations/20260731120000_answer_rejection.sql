-- Answers the authoring layer refused, on the job that stopped for them (spec 128).
--
-- A generation used to end the same way whether the Claude call was unavailable or the model judged
-- that the answers describe no software product: `null` prose, a deterministic foundation, and a
-- founder who never learned their answers were the reason. The second case is theirs to fix, so it
-- now stops the run — and this column is what says which of the two happened.
--
-- Non-null (an empty array included) on a `failed` job means the answers were refused, and names the
-- free-text questions the model pointed at. Null means the job fell over on our side, where a retry
-- is the right offer. Job statuses are deliberately untouched: a `rejected` status would have to be
-- threaded through the check constraint, the usage ledger's exclusions and every screen that reads a
-- status, to say what this column already says. It also keeps a refused run `failed`, which is what
-- already excludes it from `generation_usage` — a founder is never charged for answers we declined.
--
-- No new table: `generation_jobs` carries the org boundary through `project_id` and already has an
-- RLS policy scoped by `is_project_member`, so this column inherits access control rather than
-- needing its own — the same argument the authoring-provenance columns were added under.
--
-- Idempotent, replays cleanly from zero.

alter table public.generation_jobs
  add column if not exists rejected_answers text[];

comment on column public.generation_jobs.rejected_answers is
  'Spec 128. Non-null on a failed job means the authoring layer refused the interview answers, and names the free-text question ids to rewrite. Null means the job failed on our side.';
