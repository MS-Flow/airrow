# Branch and workflow

We work via GitHub. A **feature** is a GitHub Project, and **issues** are linked to that feature.
Each issue gets a spec in [`../../specs/`](../../specs/) and its own branch.

## Branch hierarchy
```
main               -> production
develop            -> integration; tested against the DEV environment
feature/<name>     -> a feature (= one GitHub Project); branched from develop, deploys continuously to DEV
<nr>-<short>       -> an issue; branched from ITS feature, PR'd back into the feature
```

Issue branches are named `<nr>-<short>` (issue number + short name), **without** the `issue/` prefix.

## Workflow
1. **Start a feature** (once per GitHub Project):
   git checkout develop && git pull
   git checkout -b feature/<name>
   git push -u origin feature/<name>
2. **Take an issue** from the feature:
   git checkout feature/<name> && git pull
   git checkout -b <nr>-<short>
3. **PR** `<nr>-<short>` → `feature/<name>`.
4. When the feature is done: **PR** `feature/<name>` → `develop`.
5. Release: **PR** `develop` → `main`.

> The direction is strict and never skipped: `<nr>-<short>` → `feature/<name>` → `develop` → `main`.
> An issue is **never** PR'd directly to `develop` or `main`.

## The base branch is set for you

GitHub proposes the repository's **default branch** as base for every new PR. That default is
`develop`, not `main` — deliberately, so a `feature/<name>` PR already points one step up the
hierarchy instead of at production. (`main` only ever receives `develop`, which is a handful of PRs a
release; every other PR in the repo goes to `develop` or a feature branch.)

The two branch types the default gets wrong are fixed by
`.github/workflows/pr-base-branch.yml`, which rewrites the base when a PR is **opened**:

| Head branch     | Base you get | How it is decided                                      |
| --------------- | ------------ | ------------------------------------------------------ |
| `feature/<name>`| `develop`    | the repository default — no code involved              |
| `<nr>-<short>`  | its `feature/<name>` | read from the spec's **Branch** row            |
| `develop`       | `main`       | fixed: `develop` is the only branch that may enter `main` |

The parent of an issue branch is read from the spec, not guessed: the workflow finds the
`specs/<nr>-*.md` whose **Branch** row names this branch, and takes the `` (from `feature/<name>`) ``
part of it. Matching on the branch — not the number alone — is what keeps `14-pr-ci-checks` and
`14-supabase-schema-auth` apart. Keep that Branch row accurate and the base takes care of itself.

The workflow leaves the base **untouched** and comments on the PR when it cannot derive a parent (no
matching spec, no `(from …)` in the Branch row, or the target branch is already merged and deleted).
It never silently points at `main`.

> **Only on `opened`.** A base changed after the PR exists is never rewritten, so this can't fight you.
> That is also the sanctioned escape hatch: to target something other than the parent feature, open
> the PR and then change the base.

## Merge Direction Enforcement

The merge direction above is not just a convention — it is enforced by CI:

- `.github/workflows/branch-policy.yml` runs on every pull request and **fails** if the `head → base` branch relationship violates the hierarchy (`issue/*` → `feature/*`, `feature/*` → `develop`, `develop` → `main`). The error message specifies the correct target branch.
- The `validate-source-branch` check is configured as a **required status check** through a repository ruleset that applies to `main` and `develop`. A wrongly targeted PR into an integration branch therefore cannot be merged. The ruleset is configured (idempotently) by a repository administrator using `scripts/setup-branch-protection.sh`.
- On `feature/*` the check is a **soft gate**: the workflow still runs on every PR and marks a wrong-direction PR red, but it is not required. That is deliberate — a ruleset evaluates a required check on *every* ref update, not just on merge, and `validate-source-branch` only runs on `pull_request` events. Requiring it on `feature/**` would make every direct push to a feature branch unsatisfiable, including creating the branch in the first place.

## Push protection

`develop` and `main` are integration branches — they change **only** through a merged pull request.
The `branch-push-protection` ruleset (same script) enforces this on `refs/heads/main` and
`refs/heads/develop`:

| Blocked on `develop` / `main`             | Why                                            |
| ----------------------------------------- | ---------------------------------------------- |
| `git push origin develop` / `main`        | a pull request is required before merging      |
| Merging without **1 approving review**    | every change is seen by a second person        |
| Force-push (non-fast-forward)             | history on an integration branch is never rewritten |
| Deleting the branch                       | protects against accidental removal            |

`bypass_actors` is empty — the rules apply to repository administrators too, so there is no direct
hotfix path; a hotfix is a PR like anything else.

`feature/*` and `<nr>-<short>` branches are deliberately **not** push-protected — no ruleset targets
them at all, so push, force-push and delete work as usual.

> Already committed locally on `develop`? Move the work to a branch instead:
> `git switch -c feature/<name>` (or `<nr>-<short>`), then `git switch develop && git reset --hard origin/develop`.

## Required checks

Two checks are **required** on `main` and `develop` — a PR with either one red cannot be merged.
Both are configured by the same ruleset (`branch-policy-required-check`, set idempotently by
`scripts/setup-branch-protection.sh`):

| Check                    | Workflow            | Blocks a merge when                                        |
| ------------------------ | ------------------- | ---------------------------------------------------------- |
| `validate-source-branch` | `branch-policy.yml` | the PR targets the wrong branch for the hierarchy above     |
| `verify`                 | `ci.yml`            | typecheck, lint, tests **or** `pnpm build` fails            |

`verify` is one job on purpose — one install, and one context to keep in sync with the ruleset. It
ends with `pnpm build`, which is what catches the crashes unit tests cannot see: bad server/client
boundaries, RSC-only imports, failed prerenders. A render smoke test (`apps/web/src/app/smoke.test.tsx`)
covers the public pages `/`, `/login` and `/signup`.

On `feature/*` and `<nr>-<short>` neither check is required — both still run on every PR and mark it
red, but the ruleset does not apply. Full reasoning under _Merge Direction Enforcement_ above; `verify`
would be safe to require (it runs on `push` too), while `validate-source-branch` would not.

> Integration tests that need a local Supabase (`*.rls.test.ts`, `store.cutover.test.ts`) **skip**
> when no database is reachable, so a green `verify` does not prove RLS. Run them locally against
> `supabase start` before merging a data-layer change. Tracked as a deviation in
> [`../../specs/14-pr-ci-checks.md`](../../specs/14-pr-ci-checks.md).

## Deploys
Vercel's Git integration deploys every push directly — there is no GitHub Actions workflow.
- `main` → `https://airrow.app` (production).
- `develop` → `https://dev.airrow.app`, a stable alias that never changes between deploys.
- `feature/<name>` and `<nr>-<short>` → a throwaway Vercel preview URL, new on every push.

Full setup and the branch → URL mapping: [`INFRASTRUCTURE_SETUP.md`](../guides/INFRASTRUCTURE_SETUP.md#4-custom-domain-airrowapp).

## Keep branches in sync
- Update your issue against the feature often: `git merge feature/<name>`.
- Update the feature against develop: `git merge develop`.
