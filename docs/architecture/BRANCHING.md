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

## CI / DEV deploy
- Every push to `feature/<name>` **and** `develop` runs a DEV deploy (see `.github/workflows/deploy-dev.yml`).
- `<nr>-<short>` branches do not deploy — they are tested via their feature.

## Keep branches in sync
- Update your issue against the feature often: `git merge feature/<name>`.
- Update the feature against develop: `git merge develop`.
