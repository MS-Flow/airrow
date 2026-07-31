# Spec 77 — Migrations apply themselves, or the PR is blocked

> **In one sentence:** A merged migration reaches the database the deployed code talks to without
> anyone remembering a command — and if code and schema drift apart anyway, we find out before a user
> does.

|                |                                                      |
| -------------- | ---------------------------------------------------- |
| **Status**     | ✅ Done                                               |
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

Two GitHub Actions entry points over one shared comparison:

- **Apply on push to `develop` and `main`.** A new workflow links the CLI to the single cloud project
  and runs `supabase db push --include-all --yes`. **`--include-all` is not optional:** plain `db push`
  refuses outright when a committed migration carries an older timestamp than the last one already
  applied (`LegacyDbPushMissingRemoteError`), which is the ordinary outcome of two branches merging in a
  different order than their timestamps. Without the flag the job errors instead of applying and the
  schema stays behind — the very failure this spec exists to remove.
  `develop` is where the schema is genuinely needed first — `dev.airrow.app`
  runs `develop` code against the *same* Supabase project ([INFRASTRUCTURE_SETUP.md:45-46](../docs/guides/INFRASTRUCTURE_SETUP.md)) —
  and the `main` run is an idempotent no-op that still guarantees production if the `develop` run was
  missed or someone merged past it.
- **Check on every PR.** A step in [.github/workflows/ci.yml](../.github/workflows/ci.yml) runs the same
  comparison read-only. Living in `ci.yml` makes it a required status check — it blocks, and nobody has
  to remember to run it. It distinguishes three states rather than two:
  - a migration **this change adds** is expected to be unapplied and is reported, not failed — the merge
    is the only thing that can apply it, so failing would make every schema PR permanently red;
  - a migration that was **already merged** and still is not applied **fails** — that is the
    2026-07-27 incident, and stacking more schema on a broken apply pipeline is how one missed
    migration becomes several;
  - the **database being ahead** warns, since any branch cut before that migration landed sees it.

  The base branch is fetched in the step so the first two can be told apart; if it cannot be resolved
  the check fails closed and treats everything as pre-existing.
- **The comparison is one script, not two copies of a shell pipeline.** Both entry points shell out to a
  helper under `scripts/` that parses `supabase migration list --linked` and reports unapplied
  migrations, which also makes it unit-testable through `pnpm test:scripts` (spec 53) instead of only
  provable by merging.
- **No Vercel gate.** Vercel deploys on push and does not listen to our workflows, so the apply job
  cannot stop it; it runs on the same push and turns red loudly instead.

**Not touched:** the deploy trigger — taking it over (Deploy Hooks +
`vercel.json: git.deploymentEnabled=false`) would gate the deploy for real, but hands us the trigger for
*every* branch, previews included; that is its own issue. Also unchanged: down-migrations and rollback
(a bad migration is fixed by a new one going forward), data seeding, and a separate staging database —
Production and Preview point at the same Supabase project today, and splitting them is its own issue.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] A migration merged to `develop` is applied to the cloud database automatically, on that push —
      so `dev.airrow.app`, which runs `develop` code against the same project, is never a migration
      behind the code. Ran on the merge (Actions 30530630330): trigger fired, `link` succeeded,
      `db push --include-all` ran, and the assertion confirmed the schema in step. One honest gap: the
      run had nothing left to apply, so the *applying* branch is proven by the identical command run by
      hand against the same project, not by the workflow itself.
- [x] The same apply runs on push to `main` and is a green no-op when `develop` already applied it —
      production is guaranteed even if the `develop` run was missed. Ran on `main` (Actions 30531185169)
      after PR #111: `Finished supabase link.` → `Remote database is up to date.` → green assertion.
- [x] Applying is idempotent — re-running the workflow, or running it when the migration is already
      applied, changes nothing and the job is green. Observed exactly: `Remote database is up to date.`
      followed by a green assertion, on a database that was already current.
- [x] A failed apply shows up as a red job with a readable error. Never a silent deploy against an old
      schema. Every failure path names its cause: unapplied migrations are listed by version, a CLI
      that cannot reach the project reports the exit code and the likely reasons, unreadable output is
      refused outright, and missing secrets fail on the secret's own name. The parse and verdict paths
      are covered by tests.
- [x] A PR whose `supabase/migrations` contains something the linked database does not have fails a step
      in `ci.yml` — a required status check, so it blocks the merge rather than advising against it. A PR
      with no new migration passes without noise. **Refined during implementation:** a migration the PR
      *itself* adds does not fail, because the merge is the only thing that can apply it — failing there
      would make every schema PR permanently red. Drift that predates the PR fails. See _Design decision_.
- [x] Secrets (`SUPABASE_ACCESS_TOKEN`, project ref, DB password) live in GitHub Secrets — never in the
      repo, never printed in logs. All three are configured on the repo (`gh secret list`). Read as
      `"$VAR"` inside `run:`, so no value is interpolated into a rendered command line, and in `ci.yml`
      scoped to the drift step alone so nothing that runs third-party code can reach them. Neither
      workflow uses `pull_request_target`.
- [x] [docs/guides/INFRASTRUCTURE_SETUP.md](../docs/guides/INFRASTRUCTURE_SETUP.md) describes the new
      flow in the same change; the manual line does not survive as if it were still the truth
      (constitution §IV). §1's `db push` is now explicitly bootstrap-only, a new
      _Migrations after the bootstrap_ subsection documents both workflows and the three secrets, and
      §3's "there is no GitHub Actions workflow" is corrected.
- [x] The migration invariants hold unchanged: only via `supabase/migrations`, replays cleanly from
      zero, the schema is never hand-edited in the dashboard. Nothing under `supabase/` was touched;
      the change only automates the delivery of what is already committed there.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **The job proves itself.** After `db push`, the workflow asserts `supabase migration list --linked`
  reports no migration present locally but missing remotely — so a green job means the schema is in
  step, not merely that the CLI exited zero. No throwaway project is needed; the assertion is against
  the real linked database.
- **New tests** — [scripts/supabase-migration-drift.test.mjs](../scripts/supabase-migration-drift.test.mjs),
  38 cases: in-sync, one unapplied migration, several unapplied, the database ahead of the branch, a
  header with no rows, output that is not a table, empty output, the format-change guard, the repo's own
  migration filenames, the credential guard (all missing / one missing / empty-string value / points at
  the runbook), and fork detection (fork PR, same-repo PR, push event, missing payload). Runs via
  `pnpm test:scripts`. This is what makes the check testable without CI credentials.
- **Regression anchor:** the 2026-07-27 failure is the case to replay — feed the parser a listing where
  `20260727093000_import_digest_version.sql` is local-only and assert it is reported as unapplied. That
  exact shape was green everywhere before this spec.
- **PR check** — proven on this spec's own PR: `ci.yml` runs the new step and is green (this branch adds
  no migration), plus the fixture-level proof above for the failing direction.
- Full suite result + typecheck/lint status.

---

## Implementation notes

> **Amended by [spec 130](130-migration-check-on-push.md).** The drift check told "this change adds the
> migration" from "somebody merged one that never applied" by reading `GITHUB_BASE_REF` — which exists
> only on pull request events. Since `verify` is one required context produced by *both* triggers, every
> push that carried a migration failed a required check for drift that did not exist, and that blocked
> PR #129 outright. The base is now derived per event instead: the stated base on a PR, `origin/develop`
> on a push to any other branch, and `before..HEAD` on a push to `develop`/`main` — the last of which is
> what keeps the property below intact, since a migration that merged days ago and never applied is
> still not in that range.

**What shipped** — five files, no application code and no schema change:

1. [scripts/supabase-migration-drift.mjs](../scripts/supabase-migration-drift.mjs) — parses
   `supabase migration list --linked` and returns a verdict. Only the repo being **ahead** fails; a
   version the database has that the repo does not is normal on any branch cut before that migration
   landed, so it warns instead of failing — otherwise every slightly-behind PR would go red for no
   reason. A guard fails the job when the table parses to zero rows while `supabase/migrations` holds
   files, so a CLI output-format change surfaces as a loud error rather than a silent "in sync".
   The script also owns the credential contract — which variables are required, and the fork-PR case —
   so both workflows are one `run:` line and the awkward parts are unit-testable.
2. [scripts/supabase-migration-drift.test.mjs](../scripts/supabase-migration-drift.test.mjs) — 38 cases,
   including the 2026-07-27 listing replayed as a fixture.
3. [.github/workflows/supabase-migrate.yml](../.github/workflows/supabase-migrate.yml) — push to
   `develop`/`main` → link → `db push` → assert no drift. Serialized via `concurrency` with
   `cancel-in-progress: false`: a cancelled apply is a half-applied schema.
4. [.github/workflows/ci.yml](../.github/workflows/ci.yml) — read-only drift step, last in `verify`,
   credentials scoped to that step.

**Three decisions worth recording.**

- **A step in `verify`, not its own job.** `verify` is already a required status check, and
  [scripts/setup-branch-protection.sh](../scripts/setup-branch-protection.sh) enumerates the contexts by
  hand — a separate job would block nothing until an admin re-ran that script, so the gate would only
  look real. Placed dead last so the deterministic gates above have all reported before the one step
  that talks to the network can turn the job red.
- **No `paths:` filter on the apply workflow.** Applying is idempotent, so a push with no schema change
  costs a no-op job — and in exchange every push retries an apply that failed earlier. With a filter, a
  red apply followed by a fix touching no SQL would leave the schema behind indefinitely, which is the
  exact failure class this spec exists to remove.
- **Credentials scoped to the step, and the shared wrapper dropped.** The first cut put the three secrets
  at job level in `ci.yml` and shared a composite action between the workflows. Both had to go together:
  job-level env made the production DB password readable by `pnpm install` lifecycle scripts and the
  build, and the composite action depended on that job-level env — a composite action does not reliably
  inherit `env:` set on the `uses:` step that invokes it, so scoping the credentials down would have
  broken it. Folding the credential guard and the link into the script fixed both at once and moved the
  guard somewhere tests can reach it. See _Security_.

**Corrected during review: the repo is public, not private.** The first draft of _Security_ justified
exposing the credentials to every PR run with "the repo is private and takes no fork PRs". `gh api
repos/MS-Flow/airrow --jq .visibility` says `public`, with forking allowed. That made two things real: the
step-level scoping above, and the fork-PR path — GitHub withholds secrets from a fork's `pull_request`
run, so the check now passes with a warning there instead of failing a contributor's PR for something
structural.

**What the first real CI run and the catch-up taught us** — four things no amount of reading would have:

1. **The CLI has two output shapes, both from "latest".** The GitHub Action installed a build that prints
   a markdown-ish table with backticked cells and a `Local | Remote` header; `pnpm dlx supabase` (2.110.0)
   prints `{"migrations":[…]}`. The first parser was written against a plausible-looking fixture and
   matched neither. The script now asks for `--output-format json`, reads JSON when it gets it, and falls
   back to the table — with a real captured fixture for each.
2. **The rowCount guard earned itself immediately.** Faced with output it could not read, the check
   refused rather than reporting "in sync". A naive parser would have gone green and been wrong, which is
   exactly the failure mode this spec exists to prevent.
3. **`db push` refuses out-of-order migrations** — see the `--include-all` note in _Design decision_.
4. **The migrations were not idempotent** — see _Data model_.

**Cloud was two migrations behind, including the one from the incident.** The issue records
`20260727093000_import_digest_version.sql` as manually pushed and back in sync; the linked project said
otherwise, and `20260726120000_import.sql` was missing too. Both applied 2026-07-30 with
`db push --include-all` once the policy guards were in place — so imports against cloud work again, and
`migration list --linked` now reports 9 migrations with 0 out of step. That was the last hand-run push.

**First run on `develop`, 2026-07-30 — green.** Merged via the full chain (`77-auto-apply-migrations` →
`feature/ci-cd` #109 → `develop` #110), and both workflows passed on `cb06af5`:

- **`Supabase migrations`** (Actions 30530630330), all five steps green:
  `Finished supabase link.` → `Connecting to remote database...` → `Remote database is up to date.` →
  `OK: schemat är i takt med koden (9 migration(er), 0 tillkommer i den här ändringen).`
- **`CI`** (Actions 30530630263) green, drift step included, same verdict line.
- Secrets rendered as `***` in both logs — the step-level scoping holds in practice.
- Issue #77 closed itself on merge, so `close-issue-on-merge.yml` still works with the new workflows in
  place.

**Then `main`, same day — also green.** PR #111 carried it on, and `Supabase migrations` ran again
(Actions 30531185169): `Finished supabase link.` → `Remote database is up to date.` → the same green
assertion. That is the safety-net run behaving exactly as designed, and it closes the last criterion.

**What those runs do and do not prove.** They prove the trigger on both branches, the link, the command,
the assertion, the idempotent no-op, and that a green job means the schema is genuinely in step. They do
**not** prove the workflow *applying* a pending migration, because the catch-up had already left nothing to
apply. That branch rests on the identical `db push --include-all` run by hand against the same project,
where it applied two migrations. The first merge carrying a real migration closes it — worth a look at that
run when it happens.

**One residual, stated rather than smoothed over.** Replaying the guarded migrations from zero was never
executed: Docker was down both times it was tried, so `supabase db reset` was unavailable. What *was*
verified statically: all 17 `create policy` statements are guarded, and every guard sits after its table
is created — three of them reference `public.organizations` / `public.organization_members` from
`20260724132100_init.sql`, which runs earlier by timestamp, so `drop policy if exists` never hits a
missing relation. Combined with the successful real `db push` (the harder case, where the policies existed),
the risk is small — but a `db reset` on the next local stack would settle it.

**Verification run** (2026-07-30, local).

- `pnpm test:scripts` 51 passed (2 files), green both with and without `GITHUB_EVENT_PATH` set ·
  `pnpm -r typecheck` clean across all three packages ·
  `pnpm -r lint` clean · `pnpm -r test` 258 passed / 28 skipped (40 files in `apps/web`, 8 in
  `packages/engine`, 2 in `packages/schemas`) — **no failures**. The skips are pre-existing.
- All three workflow files parse, and the step order was checked from the parsed YAML: `checkout` first in
  both, drift check last in `verify`, credentials present on that step only.
- The script's four failure paths were run, not just read:

  | Run | Result |
  | --- | --- |
  | no credentials | `::error::Saknar SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID, SUPABASE_DB_PASSWORD…` exit 1 |
  | one credential missing | names only that one, exit 1 |
  | fork-PR event payload | `::warning::Hoppar över migrationskontrollen…` exit **0** |
  | same-repo + credentials, no CLI | `kommandot \`supabase\` finns inte på PATH…` exit 1 |
- Repository secrets confirmed present via `gh secret list`: all three.
- **Policy guards checked statically** (Docker unavailable, see the residual above): 17 `create policy`,
  17 guards, none unguarded at any indentation or casing, and every guard ordered after its table's
  creation.
- **First CI run caught a non-deterministic test of mine** (§V): `readGitHubEvent(undefined)` falls through
  to the `process.env.GITHUB_EVENT_PATH` default, so it passed locally where the variable is unset and
  parsed the real push payload in Actions. Now stubbed with `vi.stubEnv`, and the suite is checked green
  both with and without the variable set.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

1. **`scripts/supabase-migration-drift.mjs`** (new) — owns the whole contract: which credentials are
   required, the fork-PR case, `supabase link`, then parse `supabase migration list --linked` and report
   migrations present locally but not remotely. Exits non-zero with a readable list when they drift.
2. **`scripts/supabase-migration-drift.test.mjs`** (new) — 38 cases, run by `pnpm test:scripts`.
3. **`.github/workflows/supabase-migrate.yml`** (new) — `on: push: branches: [develop, main]`;
   `setup-cli` → `link` + `db push` → assert no drift. Credentials at job level: every step is migration
   work.
4. **`.github/workflows/ci.yml`** — `setup-cli` plus a read-only drift step, **last** in `verify`
   ([:91](../.github/workflows/ci.yml#L91)), with the credentials scoped to that step alone. No
   `db push` here.
5. **`docs/guides/INFRASTRUCTURE_SETUP.md`** — rewrite the `db push` line at
   [:25](../docs/guides/INFRASTRUCTURE_SETUP.md#L25) so it reads as the one-time bootstrap it now is, and
   document the three GitHub Secrets plus the new flow. §3's "there is no GitHub Actions workflow"
   ([:65](../docs/guides/INFRASTRUCTURE_SETUP.md#L65)) becomes wrong on merge and must be corrected in the
   same change (constitution §IV).

6. **`supabase/migrations/*.sql`** — a `drop policy if exists` before each of the 17 `create policy`
   statements. Forced by the apply, not planned; see _Data model_.

**No change needed:** the branch-policy / issue-housekeeping workflows, and
`scripts/setup-branch-protection.sh` — the drift check is a step inside the existing `verify` context, so
no new required status check has to be registered.

**Considered and dropped:** a composite action wrapping `setup-cli` + credential guard + `link`, shared by
both workflows. It reads credentials from the job environment, which is exactly what the step-level
scoping above removes — and a composite action does not reliably inherit `env:` set on the `uses:` step
that calls it. Moving the same logic into the script instead removed the duplication *and* made the
credential guard unit-testable, so the wrapper had nothing left to do.

---

## Data model

**No schema changes** — no new tables, columns, or policies. The migrations themselves are edited, but
only to make replaying them a no-op:

**17 `create policy` statements gained a `drop policy if exists` guard** across
`20260724132100_init.sql`, `20260725100000_schema.sql`, `20260726120000_import.sql` and
`20260727160000_generation_allowance.sql`. Not one of them had a guard, while every `create table` in the
same files already used `if not exists` — so the intent was idempotency and the policies were the gap.
The resulting schema is identical; only re-running changed.

This was not in the original plan. It was forced by what automating the apply exposed: the cloud project
held the `import_sources` tables **and their policies** while
[20260726120000_import.sql](../supabase/migrations/20260726120000_import.sql) was absent from its
migration history, so applying it died on `create policy … already exists` — a schema ahead of its own
recorded history, which nothing could move forward. Guarding the policies is what unblocked it, and it is
what the constitution's *"migrations are idempotent"* asks for regardless. It grows this change and
touches migrations belonging to specs 9, 63 and the allowance work; recorded here rather than done
quietly.

---

## Security

This puts credentials able to alter the production schema into CI. Three secrets are needed, not two:
`SUPABASE_ACCESS_TOKEN` and the project ref authenticate `supabase link` against the Management API, but
`supabase db push` opens a direct Postgres connection and therefore also needs `SUPABASE_DB_PASSWORD` —
the drift check reads the same connection, so it carries them too. All three live in GitHub Secrets and
are read as `"$VAR"` inside `run:`, never interpolated into a rendered command line where the value would
land in the log. Neither workflow uses `pull_request_target`, which would run our secrets against a
fork's code.

**Scoped to the step, not the job.** In `ci.yml` the three variables are declared on the drift step
alone. The rest of `verify` runs third-party code — `pnpm install` lifecycle scripts, the production
build — and none of it has any business being able to read the production database password. In
`supabase-migrate.yml` they sit at job level, because every step in that job is the migration.

**The repo is public** (`gh api repos/MS-Flow/airrow --jq .visibility` → `public`, forking allowed), so
fork PRs are a real case rather than a theoretical one. GitHub withholds secrets from a fork's
`pull_request` run by design, which cuts both ways: an outside PR cannot exfiltrate anything, and it also
cannot run the check. So the script detects a fork PR from the event payload and passes with a warning,
rather than failing a contributor's PR for something structural. A **same-repo** run with a missing
credential still fails hard — that is a misconfigured repo, not an impossible one.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- **Migration already applied** → no-op, job green.
- **Two migrations merged close together** → applied in timestamp order; a re-run is still a no-op.
- **The apply fails halfway** → the job is red and the error is readable; the next run resumes from the
  unapplied migration rather than replaying applied ones.
- **A PR with no migration at all** → the check passes silently, no noise on the vast majority of PRs.
- **Merge to `main` that contains no schema change** → nothing runs, or runs and does nothing.
- **A migration applied on `develop`, then merged to `main`** → the `main` run finds nothing to do and is
  green. This is the normal path, not an exception.
- **The apply fails but Vercel deploys anyway** → accepted and deliberate: the job is red and the failure
  is visible, but nothing blocks the deploy. Gating it would mean owning the deploy trigger for every
  branch (Deploy Hooks + `vercel.json: git.deploymentEnabled=false`) — out of scope here.
- **Secrets missing on a same-repo run, or the Supabase project paused** (free tier pauses after ~a week
  of inactivity, [INFRASTRUCTURE_SETUP.md:128](../docs/guides/INFRASTRUCTURE_SETUP.md)) → red with a
  readable error naming the cause — every missing variable at once, not just the first — never a green
  skip that looks like "in sync".
- **A pull request from a fork** → GitHub withholds secrets from it by design, so the check cannot run.
  Passes with a `::warning::` saying so and naming when it will be checked instead (push to
  `develop`/`main`). The one deliberate green skip, and only because it is structurally impossible rather
  than misconfigured.
- **The Supabase CLI missing from the runner** → names that specifically ("`supabase` finns inte på
  PATH — saknas steget som installerar CLI:n?") rather than reporting an unknown exit code.

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- Down-migrations and rollback — a faulty migration is corrected by a new migration going forward.
- Data seeding.
- A separate staging database. Production and Preview share one Supabase project today; splitting them
  is its own issue.
