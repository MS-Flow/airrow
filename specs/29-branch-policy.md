# Spec: Enforce PR merge-direction at the PR level

**GitHub issue:** #29 — "Rules for merging. Issue only to feature. feature only to develope. develope only into main."
**Branch:** `29-branch-policy` (from `feature/ci-cd`)
**Feature:** CI/CD
**Depends on:** nothing
**Status:** ✅ Done

<!--
Canonical single-file spec format for Airrow. One file per issue: specs/NNN-kort.md. It combines the
WHAT, the HOW (exact file:line changes), acceptance criteria, verification and edge cases in one
document — do NOT split into separate plan.md / tasks.md files.
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
Mark anything undecided inline with [NEEDS CLARIFICATION: …] so /clarify can find it.
-->

---

## User story
As a **maintainer** I want **PRs to be rejected before merge whenever their head → base direction
violates the branch hierarchy** so that **a wrong-direction merge (e.g. an issue branch into
`develop`/`main`) is impossible, not just discouraged**.

---

## Background
Current state, grounded in real code with `file:line` links (add these during `/implement`):
- `.github/workflows/branch-policy.yml` exists but only triggers on `pull_request` with
  `branches: [main, develop]` and only enforces the `develop`/`main` bases — it does **not** cover
  the issue-branch → `feature/*` rule, and does not run on `edited`/`reopened` events.
- Constitution §IV / `BRANCHING.md`: PR direction is strict and never skipped —
  `NNN-kort` → `feature/<name>` → `develop` → `main`. An issue branch is **never** PR'd to
  `develop`/`main`.
- Enforcement requires the workflow to be a **required status check** in branch protection so a
  failing check actually blocks merge. This spec configures that protection **as code** via the
  GitHub API (`gh` / REST) for `feature/*`, `develop`, and `main`.

---

## Design decision
Extend the existing `branch-policy.yml` (do not duplicate) so it runs on **every** PR (no `branches:`
filter; gate in-script) and evaluates `head.ref` / `base.ref` against the full hierarchy table,
failing with a clear, target-naming message on any violation. An "issue branch" is matched **strictly**
by `^[0-9]+-` naming. Wire the check into branch protection **as required** — configured as code via
the GitHub API — so violations block merge. Deliberately does NOT add auto-retargeting or
hotfix/release flows.

---

## Exact changes (file:line)
<The inline "plan". Every change grounded in current code. Populated/expanded by `/implement`.>
1. **`.github/workflows/branch-policy.yml`** — remove the `branches: [main, develop]` filter so the
   job runs on `pull_request: [opened, reopened, synchronize, edited]` for any base, and evaluate all
   three rules of the table below in-script. Issue branches matched strictly by `^[0-9]+-`.
2. **Branch protection (as code)** — configure the workflow job as a required status check for
   `feature/*`, `develop`, and `main` via a GitHub **repository ruleset** (rulesets support the
   `feature/**` wildcard target that classic per-branch protection cannot). *(`feature/**` was later
   removed — see [Amendment](#amendment-2026-07-25-via-spec-13).)* Captured as an idempotent
   `gh api` script in the repo (and noted in `docs/architecture/BRANCHING.md`) so the setting is
   reproducible, not a one-off UI click.

Rules (head → allowed base):

| Head branch pattern      | Allowed base        | Everything else |
|--------------------------|---------------------|-----------------|
| `^[0-9]+-…` (issue)      | `feature/*` only    | ❌ fail          |
| `feature/*`              | `develop` only      | ❌ fail          |
| `develop`                | `main` only         | ❌ fail          |

---

## Data model
**No schema changes.**

---

## Acceptance criteria
- [x] `NNN-kort` → `feature/<name>` passes; `NNN-kort` → `develop` or `main` fails the check.
- [x] `feature/*` → `develop` passes; `feature/*` → `main` or another `feature/*` fails.
- [x] `develop` → `main` passes; `develop` → anything else fails.
- [x] A failing check **blocks merge** (required status check configured), not just a red mark.
      — ruleset `branch-policy-required-check` is live and `active` on `main` + `develop`
      (activated 2026-07-25). **Amended:** on `feature/*` the check is a *soft* gate — see
      _Amendment_ below.
- [x] The failure message states the allowed target for that head branch.
- [x] Existing valid PRs (e.g. current `NNN-kort → feature/*`) still pass.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification
- **Manual** — open PRs for each row of the table (valid + invalid) against throwaway branches and
  confirm pass/fail matches; confirm an invalid PR is un-mergeable with protection on. No automated
  Vitest tests are added — this is CI/YAML wiring, not app business logic, so the constitution's
  Vitest layers do not apply here.
- Full suite result + typecheck/lint status (unchanged by this workflow-only change).

---

## Security
- The workflow itself needs no elevated permissions — it only reads `github.head_ref` / `base_ref`
  (consumed via `env:`, not interpolated into the shell, to avoid branch-name injection).
- Activating the required status check edits repo settings, which needs an **admin-scoped** token.
  This lives in `scripts/setup-branch-protection.sh`, run **locally by a repo-admin** — no admin PAT
  is ever stored in GitHub Actions (aligns with the "short-lived tokens, never store admin creds in
  CI" posture).

---

## Implementation notes
- **`.github/workflows/branch-policy.yml`** — dropped the `branches: [main, develop]` filter; now runs
  on `pull_request: [opened, reopened, synchronize, edited]`. Base-centric `case` on `$BASE` enforces:
  `main` ← only `develop`; `develop` ← only `feature/*`; `feature/*` ← only `^[0-9]+-` issue branches;
  any ungoverned base is skipped. Branch names read via `env:` (injection-safe, matching
  `delete-issue-branch-on-merge.yml`).
- **`scripts/setup-branch-protection.sh`** — idempotent `gh api` script creating/updating a repository
  **ruleset** (`branch-policy-required-check`) with `validate-source-branch` as a required status
  check. Originally targeted `refs/heads/{main,develop,feature/**}`; now `refs/heads/{main,develop}`
  (see [Amendment](#amendment-2026-07-25-via-spec-13)).
- **`docs/architecture/BRANCHING.md`** — documented the enforcement + the admin setup step.
- **Verification result:** rule matrix tested against all acceptance-criteria rows (all match);
  `pnpm -r lint` clean; `pnpm -r typecheck` has a **pre-existing** failure in
  `apps/web/.next/types/app/signup/page.ts` (stale autogenerated Next.js types — unrelated to this
  change, which touches no TS). No Vitest tests added (CI/YAML wiring, per Verification above).

---

## Amendment (2026-07-25, via spec 13)

The ruleset originally targeted `refs/heads/{main,develop,feature/**}`. `feature/**` has been
**removed**; it now targets `main` + `develop` only.

**Why:** a repository ruleset evaluates a required status check on *every ref update*, not just on
merge. `validate-source-branch` only runs on `pull_request` events, so a commit pushed directly to a
feature branch never carries that check and can never satisfy the rule. With `feature/**` in the
target, `git push -u origin feature/<name>` — step 1 of the documented workflow — was rejected with
`GH013: Required status check "validate-source-branch" is expected.`, as was any later push to a
feature branch (including the `git merge develop` sync step). Found by driving a real push during
`/verify` on spec 13.

**Trade-off accepted:** a wrong-direction PR *into* a `feature/*` branch (e.g. `feature/x` →
`feature/y`, or a non-`NNN-` head) still gets a red check from the workflow, but is no longer
un-mergeable — the hard block now exists only where the consequences are, on `develop` and `main`.
Rejected alternatives: `do_not_enforce_on_create: true` (only unblocks *creating* a branch, later
pushes stay broken) and adding bypass actors (bypass is all-or-nothing, so the same people could
merge a red PR into `develop`).

---

## Edge cases
- Issue branch that does not match `^[0-9]+-` naming (e.g. a manual branch) targeting `feature/*` →
  **fails**. Only strict `^[0-9]+-` issue branches are allowed into `feature/*`.
- A `feature/*` → another `feature/*` PR → must fail.
- PR `edited` to change its base after opening → must re-run and re-evaluate.

---

## Out of scope
- Hotfix / release branch flows (none defined yet).
- Auto-retargeting a mis-based PR (just fail with guidance; the author fixes the base).
- Commit-message / conventional-commit linting (separate concern).
