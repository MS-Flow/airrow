# Spec 77 — Migrations apply themselves, or the PR is blocked

> **In one sentence:** A merged migration reaches the database the deployed code talks to without
> anyone remembering a command — and if code and schema drift apart anyway, we find out before a user
> does.

|                |                                                      |
| -------------- | ---------------------------------------------------- |
| **Status**     | ⏳ Not started                                        |
| **Issue**      | #77 — "Migrationer ska appliceras automatiskt — kod och databas i takt utan manuellt steg" |
| **Branch**     | `77-auto-apply-migrations` (from `feature/ci-cd`)     |
| **Feature**    | ci-cd                                                 |
| **Depends on** | nothing                                               |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

_Who wants this, and what they get out of it._

As a **developer merging a change that includes a migration** I want **the migration applied to the
database the deployed code actually talks to, as part of shipping** so that **the code never goes live
against a schema that is missing the column it depends on.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today:** `pnpm dlx supabase db push` is a one-off step in the provisioning runbook
  ([docs/guides/INFRASTRUCTURE_SETUP.md](../docs/guides/INFRASTRUCTURE_SETUP.md)). Nothing in
  [.github/workflows/](../.github/workflows/) touches Supabase — the four workflows there
  (`branch-policy.yml`, `ci.yml`, `close-issue-on-merge.yml`, `delete-issue-branch-on-merge.yml`)
  are about PR direction, tests and issue housekeeping. Vercel deploys through its GitHub App and
  knows nothing about `supabase/migrations`.
- **The problem:** there is no mechanism at all keeping the schema in step with the code — only a line
  in a runbook, which is a thing a human remembers or doesn't.
- **It already cost us, 2026-07-27.** `20260727093000_import_digest_version.sql` (spec 68,
  `import_sources.digest_version`) was merged but never pushed to the cloud project. Every import
  against cloud died on PostgREST `42703 — column import_sources.digest_version does not exist`, and
  `import_sources` held **0 rows** there — the import flow had never actually worked in cloud. CI was
  green, the tests were green (they run against local Supabase, where the migration existed), the
  build was green. A human trying the feature in a browser is what surfaced it.
- **Already in place:** migrations are committed and ordered
  ([supabase/migrations/](../supabase/migrations/)), and the constitution's data invariants already
  require them to be the only way the schema changes.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

[NEEDS CLARIFICATION: the shape of the solution is exactly what the issue's open questions decide —
resolve those in `/clarify` before writing this section.]

**Not touched:** down-migrations and rollback (a bad migration is fixed by a new one going forward),
data seeding, and a separate staging database — Production and Preview point at the same Supabase
project today, and splitting them is its own issue.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [ ] A migration merged to `main` is applied to the cloud database automatically, before or together
      with the Vercel deploy of the code that assumes it.
      [NEEDS CLARIFICATION: `main` only, or also on `develop`? With one cloud database today `main` is
      the obvious answer, but then `develop` runs one migration behind.]
- [ ] Applying is idempotent — re-running the workflow, or running it when the migration is already
      applied, changes nothing and the job is green.
- [ ] A failed apply shows up as a red job with a readable error. Never a silent deploy against an old
      schema.
- [ ] A PR whose `supabase/migrations` contains something the linked database does not have is flagged
      **before** merge.
      [NEEDS CLARIFICATION: where does the check live — a step in `ci.yml` or in `/pr-check`? A `ci.yml`
      step is a required status check and blocks; `/pr-check` is advisory and only runs when someone
      runs it.]
- [ ] Secrets (`SUPABASE_ACCESS_TOKEN`, project ref, DB password) live in GitHub Secrets — never in the
      repo, never printed in logs.
- [ ] [docs/guides/INFRASTRUCTURE_SETUP.md](../docs/guides/INFRASTRUCTURE_SETUP.md) describes the new
      flow in the same change; the manual line does not survive as if it were still the truth
      (constitution §IV).
- [ ] The migration invariants hold unchanged: only via `supabase/migrations`, replays cleanly from
      zero, the schema is never hand-edited in the dashboard.
- [ ] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- [NEEDS CLARIFICATION: how is "the migration reached cloud" proven in CI without a throwaway project
  to run against? Options: `supabase migration list --linked` asserted in the job, a smoke query, or
  accepting a manual check on the first real merge.]
- **Regression anchor:** the 2026-07-27 failure is the case to replay — a merged migration that never
  reached cloud must now either be applied or be loudly red.
- Full suite result + typecheck/lint status.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

[NEEDS CLARIFICATION: fill during `/implement`, once the open questions above are settled. Likely
touches: a new workflow under `.github/workflows/`, a step in `ci.yml`, and
`docs/guides/INFRASTRUCTURE_SETUP.md`.]

---

## Data model

**No schema changes.** This spec changes *how* migrations reach the database, not what they contain.
The constitution's data invariants are the thing being enforced, not amended.

---

## Security

This puts database credentials into CI: a `SUPABASE_ACCESS_TOKEN` (and project ref / DB password) able
to alter the production schema. They belong in GitHub Secrets, must never be echoed, and the workflow
must not run on `pull_request_target` or any trigger where a fork's code could reach them.
[NEEDS CLARIFICATION: does the apply job need the DB password, or is the access token + project ref
enough for `supabase db push`?]

---

## Edge cases

_Unusual inputs or states, and what should happen._

- **Migration already applied** → no-op, job green.
- **Two migrations merged close together** → applied in timestamp order; a re-run is still a no-op.
- **The apply fails halfway** → the job is red and the error is readable; the next run resumes from the
  unapplied migration rather than replaying applied ones.
- **A PR with no migration at all** → the check passes silently, no noise on the vast majority of PRs.
- **Merge to `main` that contains no schema change** → nothing runs, or runs and does nothing.
- [NEEDS CLARIFICATION: should a failed migration be able to **stop** the Vercel deploy? Vercel triggers
  on push and does not listen to our workflows, so a real gate means taking over the deploy trigger
  (Deploy Hooks + `vercel.json: git.deploymentEnabled=false`) — a meaningfully bigger change.]

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- Down-migrations and rollback — a faulty migration is corrected by a new migration going forward.
- Data seeding.
- A separate staging database. Production and Preview share one Supabase project today; splitting them
  is its own issue.
