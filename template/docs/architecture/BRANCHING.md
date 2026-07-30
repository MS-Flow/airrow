# Branch and workflow

We work via {{REPO_PROVIDER}}. A **feature** is a {{BOARD_TERM}}, and **{{ISSUE_TERM}}s** are linked
to that feature. Each {{ISSUE_TERM}} gets a spec in [`../../specs/`](../../specs/) and its own branch.

## Branch hierarchy
```
main               -> production
develop            -> integration; tested against the DEV environment
feature/<name>     -> a feature (= one project board); branched from develop, deploys continuously to DEV
<nr>-<short>       -> an issue; branched from ITS feature, PR'd back into the feature
```

Issue branches are named `<nr>-<short>` (issue number + short name), **without** the `issue/` prefix.

## Workflow
1. **Start a feature** (once per project board):
   git checkout develop && git pull
   git checkout -b feature/<name>
   git push -u origin feature/<name>
2. **Take an issue** from the feature:
   git checkout feature/<name> && git pull
   git merge origin/develop && git push   # only if the feature is behind — `/createspec` does this for you
   git checkout -b <nr>-<short>
3. **PR** `<nr>-<short>` → `feature/<name>`.
4. When the feature is done: **PR** `feature/<name>` → `develop`.
5. Release: **PR** `develop` → `main`.

> The direction is strict and never skipped: `<nr>-<short>` → `feature/<name>` → `develop` → `main`.
> An issue is **never** PR'd directly to `develop` or `main`.

## CI / DEV deploy
- Every push to `feature/<name>` **and** `develop` runs a DEV deploy to {{DEPLOY_TARGET}}
  (see `{{DEPLOY_FILE}}`).
- `<nr>-<short>` branches do not deploy — they are tested via their feature.

## Keep branches in sync
- Update your issue against the feature often: `git merge feature/<name>`.
- Update the feature against develop: `git merge develop`. **`/createspec` already does this** — it
  merges `origin/develop` into `feature/<name>` and pushes it before cutting the issue branch, so a new
  branch is never born behind. Do it by hand for a feature branch you have had open for a while.
