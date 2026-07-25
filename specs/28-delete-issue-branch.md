# Spec: Auto-delete issue branch on merge to feature

**GitHub issue:** #28 — "Auto remove issue branch on merge to the parent feature branch."
**Branch:** `28-delete-issue-branch` (from `feature/ci-cd`)
**Feature:** CI/CD
**Depends on:** nothing (sits next to `.github/workflows/close-issue-on-merge.yml`)
**Status:** ✅ Done

<!--
Canonical single-file spec format for Airrow. One file per issue: specs/NNN-kort.md.
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
Mark anything undecided inline with [NEEDS CLARIFICATION: …] so /clarify can find it.
-->

---

## User story
As a **maintainer** I want **issue branches (`NNN-kort`) deleted automatically when merged into their
parent `feature/<name>`** so that **the remote branch list stays clean without risking longer-lived
`feature/*` branches**.

---

## Background
Populated during `/implement`. Known plumbing today:
- Branch model (`docs/architecture/BRANCHING.md`): `NNN-kort` → `feature/<name>` → `develop` → `main`.
- `.github/workflows/close-issue-on-merge.yml` already runs on merge — this workflow lives beside it.
- GitHub's repo-level "Automatically delete head branches" is too broad (would delete `feature/*` on
  merge to `develop`), so pattern-scoped deletion is required instead.

---

## Design decision
A scoped GitHub Action, triggered on `pull_request: [closed]`, that deletes the head branch **only**
when all hold: `pull_request.merged == true`, head ref matches `^[0-9]+-`, and base ref starts with
`feature/`. Deletion uses the default `GITHUB_TOKEN` (`contents: write`) — no PAT. Deliberately does
**not** touch PRs targeting `develop`/`main`, close-without-merge, or stale-branch sweeping.

---

## Exact changes (file:line)
1. **`.github/workflows/delete-issue-branch-on-merge.yml`** (new) — mirrors the structure/style of the
   sibling `close-issue-on-merge.yml`:
   - Trigger `pull_request: [closed]` filtered to `branches: ['feature/**']`, so only PRs whose **base**
     is a `feature/*` branch run the workflow (base guard). Merges into `develop`/`main` never trigger.
   - Job guard `if: github.event.pull_request.merged == true` — close-without-merge does nothing.
   - Step re-checks the **head** ref against `^[0-9]+-`; non-matching heads (e.g. `feature/ci-cd`) skip.
   - Deletes via `gh api -X DELETE "repos/$REPO/git/refs/heads/$HEAD"`, `|| echo …` so an already-gone
     branch (422/404) does not fail the run.
   - `permissions: contents: write`, `GH_TOKEN: ${{ github.token }}` — default token, no PAT.

---

## Data model
**No schema changes.**

---

## Security
- Runs on the default `GITHUB_TOKEN` scoped to `contents: write` (branch deletion only) — no PAT, no
  added secrets, nothing logged beyond branch names.
- Deletion is gated to `merged == true` + head `^[0-9]+-` + base `feature/**`, so it cannot remove
  `feature/*`/`develop`/`main` or act on an unmerged/closed PR. Head/base come from GitHub's trusted
  `pull_request` payload, not user input.

---

## Acceptance criteria
- [x] Merging a `NNN-kort` PR into its `feature/<name>` deletes the `NNN-kort` branch automatically.
      *(base filter `feature/**` + merged guard + head `^[0-9]+-` → DELETE ref)*
- [x] Merging a `feature/<name>` PR into `develop` (or `develop`→`main`) does **not** delete anything.
      *(base `develop`/`main` never matches the `feature/**` trigger filter; head also fails `^[0-9]+-`)*
- [x] A PR closed **without** merging leaves the branch intact — `if: …merged == true` guard.
- [x] Safe if the branch is already gone — `gh api -X DELETE … || echo …` swallows the failure.
- [x] Workflow uses the default `GITHUB_TOKEN` with `permissions: contents: write` — no PAT.
- [x] Typecheck / lint / tests unaffected — change is a CI-only YAML file (no TS/JS/schema touched).

### Verification
- Static: workflow mirrors the already-running `close-issue-on-merge.yml` structure; YAML read/parses.
- Manual (post-merge): throwaway `NNN-test` branch → PR into a `feature/*` → merge → confirm the branch
  is deleted and the linked issue still closes (existing `close-issue-on-merge` behavior intact).
- Manual (post-merge): `feature/*` → `develop` PR → merge → confirm the feature branch is **not** deleted.
- No JS/TS/schema changed → `pnpm -r typecheck|lint|test` outcomes unchanged by this PR.

### Implementation notes
- Base-ref guarding is done by the trigger's `branches: ['feature/**']` filter (matching the sibling
  workflow) rather than an `if` on `base.ref`, keeping the two workflows consistent.
- Head-pattern re-check inside the step is defense-in-depth: `feature/*→feature/*` merges (should they
  ever happen) won't match `^[0-9]+-` and are skipped.
- The two manual acceptance checks can only be exercised on a real merge; they're the checkpoints for
  `/analyze` to confirm after this branch merges.
- **`/analyze` result:** all five cross-check categories pass (criteria, no drift, no constitution
  violation, verification appropriate for a CI-only change, PR direction correct). Security note added.

---

## Edge cases
- Head ref like `feature/ci-cd` merged to `develop` → guard fails (base not `feature/`), no delete.
- Branch already deleted before the workflow runs → DELETE returns 422/404; step must not fail the run.
- PR closed without merge → `merged == false`, no delete.

---

## Out of scope
- Deleting branches for PRs targeting `develop` / `main`.
- Deleting on close-without-merge, or stale-branch sweeping of abandoned branches.
- Local branch cleanup on the contributor's machine (remote-only).
