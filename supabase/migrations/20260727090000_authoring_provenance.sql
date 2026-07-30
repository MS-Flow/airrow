-- Authoring provenance on generation jobs (spec 65).
--
-- Two needs, one set of columns:
--
--   Manifest of record (constitution §II) — a generated file has to say which prompt version and
--   which model produced it, or a regression months from now is unattributable.
--
--   Memoisation — regenerating with unchanged answers currently pays for another ~45s Claude call
--   and another slice of the founder's allowance. `inputs_hash` is what makes "nothing changed"
--   answerable without calling out.
--
-- No new table, deliberately: `generation_jobs` already carries the org boundary through
-- `project_id` and already has an RLS policy scoped by `is_project_member`, so these columns
-- inherit access control rather than needing their own. A separate table would mean a second policy
-- to keep in step with the first.
--
-- Idempotent, replays cleanly from zero.

alter table public.generation_jobs
  -- Hash over the resolved project model + prompt version + model id. Null on rows written before
  -- this migration and on any job that generated deterministically.
  add column if not exists inputs_hash     text,
  -- The authoring prompt that produced this job's prose. Bumped when wording changes in a way that
  -- would produce different prose from identical answers.
  add column if not exists prompt_version  text,
  -- The model that wrote it, e.g. 'claude-haiku-4-5'.
  add column if not exists authoring_model text,
  -- The validated authored payload ({slots, documents}), kept so an unchanged regeneration can
  -- reuse it instead of paying for the call again.
  add column if not exists authored        jsonb;

-- Lookup for the memoisation path: most recent completed job for this project whose inputs, prompt
-- and model all match. Partial, because a row without a hash can never be a cache hit.
create index if not exists generation_jobs_memo_idx
  on public.generation_jobs (project_id, inputs_hash, prompt_version, authoring_model)
  where inputs_hash is not null;

comment on column public.generation_jobs.authored is
  'Validated authoring payload. Reused verbatim when inputs_hash, prompt_version and authoring_model all match a previous completed job.';
