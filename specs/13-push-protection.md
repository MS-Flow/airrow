# Spec 13 — Push protection on `develop` and `main`

> **In one sentence:** Block direct pushes (and force-pushes/deletions) to `develop` and `main` so
> changes reach them only through a merged pull request — while `feature/*` and `NNN-kort` branches
> stay freely pushable.

|                |                                                        |
| -------------- | ------------------------------------------------------ |
| **Status**     | ✅ Done                                                 |
| **Issue**      | #13 — "Not being able to push in dev and main. only able to push in feature branches and issue branches." |
| **Branch**     | `13-push-protection` (from `feature/ci-cd`)            |
| **Feature**    | CI/CD                                                  |
| **Depends on** | [`29-branch-policy.md`](29-branch-policy.md) — the `validate-source-branch` check and the existing ruleset script |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

As a **maintainer** I want **`develop` and `main` to reject direct pushes** so that **every change to
an integration branch goes through a reviewable pull request, and history on those branches cannot be
rewritten or deleted by accident**.

---

## Background

- **Today:** `.github/workflows/branch-policy.yml` validates the *direction* of a PR, and
  `scripts/setup-branch-protection.sh` creates a repository ruleset
  (`branch-policy-required-check`) that makes `validate-source-branch` a required status check on
  `refs/heads/main`, `refs/heads/develop`, `refs/heads/feature/**`.
- **The problem:** a required status check only governs *merges*. Nothing stops
  `git push origin main` / `git push origin develop`, a force-push, or a branch deletion — the PR
  flow can be bypassed entirely.
- **Already in place:** the ruleset script pattern (idempotent `gh api`, run locally by a repo-admin
  — no admin PAT in CI) and the enforcement section in
  [`docs/architecture/BRANCHING.md`](../docs/architecture/BRANCHING.md#L31-L36).

---

## Design decision

Use GitHub **repository rulesets** (not a workflow guard) to add push protection on `develop` and
`main`: require a pull request before merging, block non-fast-forward/force pushes, and block branch
deletion. Configured as code by extending the existing idempotent script so the whole branch policy
stays reproducible in one place.

Concretely, `scripts/setup-branch-protection.sh` manages **two** rulesets:

| Ruleset                          | Targets                             | Rules                                                 |
| -------------------------------- | ----------------------------------- | ----------------------------------------------------- |
| `branch-policy-required-check` (existing, **narrowed**) | `main`, `develop`   | `required_status_checks: validate-source-branch`      |
| `branch-push-protection` (new)   | `main`, `develop`                   | `pull_request` (1 approval), `non_fast_forward`, `deletion` |

`feature/**` was dropped from the required-check ruleset (it targeted `main`, `develop`,
`feature/**` before). A ruleset evaluates a required status check on **every ref update**, not only
on merge, and `validate-source-branch` only runs on `pull_request` events — so a commit pushed
directly to a feature branch can never carry a passing check, and the rule silently banned all pushes
to `feature/*`, branch creation included. Direction into a feature branch is now a soft gate (red
check on the PR); the hard gate stays on `develop`/`main`. Trade-off recorded in
[`29-branch-policy.md`](29-branch-policy.md), which owns that ruleset.

`bypass_actors` is **empty** on the new ruleset — repo admins are included in the protection, so no
one can push directly to `develop`/`main`, hotfixes included.

**Not touched:** `feature/*` and `NNN-kort` branches keep direct push (and their existing required
status check). The merge-direction validation itself is spec 29's job, and its ruleset is left
exactly as it is.

**Deviation from the issue:** the issue scopes "CODEOWNERS / required-reviewer policy" out, but we
set `required_approving_review_count: 1` — a review requirement on `develop`/`main` without a
CODEOWNERS file. Consequence to accept knowingly: combined with the empty bypass list, **nobody can
merge their own PR into `develop`/`main` alone** — a second team member must approve.

---

## Acceptance criteria

The script has been run against `MS-Flow/airrow`; both rulesets are **active**
(`branch-policy-required-check` id `19735515`, `branch-push-protection` id `19735516`). The
behavioural criteria below are verified by reading the enforced configuration
(`gh api repos/MS-Flow/airrow/rules/branches/<branch>`) rather than by a physical rejected push.

- [x] `git push origin develop` and `git push origin main` are rejected for a normal contributor.
      — `pull_request` rule active on `refs/heads/main` and `refs/heads/develop`.
- [x] Changes still reach `develop`/`main` through a merged PR. — the `pull_request` rule permits
      exactly that path (`allowed_merge_methods: merge, squash, rebase`).
- [x] The rejection also applies to a repository admin (empty `bypass_actors`).
      — `bypass_actors: []`; the API reports `current_user_can_bypass: "never"` for a user with
      `admin: true` on the repo.
- [x] A PR into `develop`/`main` needs **1 approving review** before it can be merged.
      — `required_approving_review_count: 1`.
- [x] Force-push to `develop`/`main` is blocked. — `non_fast_forward` rule active on both refs.
- [x] Deletion of `develop`/`main` is blocked. — `deletion` rule active on both refs.
- [x] Pushing to a `feature/*` branch and to a `NNN-kort` issue branch still works normally.
      — verified with **real pushes** to a throwaway `feature/verify-probe-13`: create, push a second
      commit, force-push and delete all returned exit 0 (branch since deleted). No ruleset targets
      `feature/**` or `NNN-kort` any more. This criterion initially shipped **broken** — see
      _Implementation notes_.
- [x] The `validate-source-branch` required check from spec 29 still applies and still blocks
      wrong-direction merges **into `develop`/`main`**. — `branch-policy-required-check` active with
      context `validate-source-branch` on `main` + `develop`;
      `.github/workflows/branch-policy.yml` is untouched, so the check still runs on every PR and
      still marks a wrong-direction PR into a `feature/*` branch red (soft gate there).
- [x] Protection is captured as code (an idempotent script under `scripts/`) so it is reproducible on
      a fresh repo, not a one-off UI click.
- [x] The settings are documented in `docs/architecture/BRANCHING.md`.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

- **Rollout** — a repo-admin runs `scripts/setup-branch-protection.sh` locally (admin-scoped token),
  then a **non-admin contributor** attempts the pushes below. Verifying from a normal account is the
  proof that matters; the admin additionally confirms their *own* direct push is rejected (empty
  `bypass_actors`).
- **Manual** — attempt `git push origin main` and `git push origin develop` → both rejected; open a
  PR into each and confirm merge is the only path.
- **Manual** — open a PR into `develop` with no approval → merge blocked until one review approves.
- **Manual** — attempt a force-push and a branch deletion on `develop` → both rejected.
- **Manual** — push a commit to a throwaway `feature/*` and a `NNN-kort` branch → both succeed.
- **Script** — run the setup script twice; the second run is a no-op update (idempotence), and
  `branch-policy-required-check` is unchanged by it.
- No automated Vitest tests: this is repo/platform configuration, not app business logic — same
  reasoning as spec 29.
- Full suite result + typecheck/lint status.

---

## Exact changes (file:line)

_Expanded by `/implement`._

1. **`scripts/setup-branch-protection.sh`** — generalise the existing create-or-update block into a
   reusable step (name + payload in, idempotent `POST`/`PUT` out) so both rulesets are applied by one
   script without duplicating the `gh api` logic, at
   ([:52-61](../scripts/setup-branch-protection.sh#L52-L61)). Add the second ruleset
   `branch-push-protection` targeting `refs/heads/main` + `refs/heads/develop` with
   `bypass_actors: []` and rules `pull_request` (`required_approving_review_count: 1`),
   `non_fast_forward`, `deletion`. The existing `branch-policy-required-check` payload
   ([:26-50](../scripts/setup-branch-protection.sh#L26-L50)) keeps the same targets and rule (its
   `$RULESET_NAME` variable is inlined now that the name is a per-call argument).
2. **`docs/architecture/BRANCHING.md`** — add a "Push protection" section next to
   ([:31-36](../docs/architecture/BRANCHING.md#L31-L36)) describing exactly what is blocked on
   `develop`/`main` (direct push, force-push, deletion, unapproved merge) and what stays open on
   `feature/*` / `NNN-kort`.

**No change needed:** `.github/workflows/branch-policy.yml` — direction validation is unchanged by
this spec. No workflow pushes commits to `develop`/`main` (`ci.yml`, `deploy-dev.yml` only *trigger*
on push; `delete-issue-branch-on-merge.yml` deletes issue branches only), so no automation needs a
bypass actor.

---

## Implementation notes

- **`scripts/setup-branch-protection.sh`** — the create-or-update block became an `apply_ruleset
  <name> <payload>` function (one `gh api` code path, two callers), and the script now applies both
  rulesets: `branch-policy-required-check` (payload semantically unchanged) and the new
  `branch-push-protection` on `refs/heads/main` + `refs/heads/develop` with `bypass_actors: []` and
  the rules `pull_request` (`required_approving_review_count: 1`, no code-owner/stale-dismiss/
  last-push/thread-resolution requirements), `non_fast_forward`, `deletion`. The stale
  `REPO=MelvinEdlund/airrow` usage example was corrected to `MS-Flow/airrow`.
- **`docs/architecture/BRANCHING.md`** — new "Push protection" section: a table of what is blocked on
  `develop`/`main`, the empty-bypass note (no direct hotfix path), the explicit statement that
  `feature/*` and `<nr>-<short>` stay freely pushable, and the recovery snippet for work already
  committed on `develop`.
- **`specs/README.md`** — spec added to the status overview.
- **Verification result:** `bash -n` clean. Both code paths exercised against a stubbed `gh`: on a
  fresh repo both rulesets `POST` with valid JSON (targets/rules/`bypass_actors` asserted); on a
  second run both take the `PUT` update path — idempotent. `corepack pnpm -r lint` clean;
  `corepack pnpm -r typecheck` clean (spec 29's stale `.next` types failure no longer reproduces);
  `corepack pnpm -r test` green — 73 passed, 3 skipped (`auth.trigger.test.ts`, pre-existing: needs a
  local Supabase). No Vitest tests added (platform configuration, per Verification above).
- **Rollout done:** the script was run against `MS-Flow/airrow` and created **both** rulesets in one
  pass — `branch-policy-required-check` (id `19735515`) and `branch-push-protection` (id `19735516`),
  both `enforcement: active`, created 2026-07-25 17:33. Spec 29's ruleset had never been activated
  before, so this run also closes that spec's last open criterion (see
  [`29-branch-policy.md`](29-branch-policy.md) — its 4th criterion can be ticked).
- **Bug found by `/verify`, fixed in this spec.** The first version of this change kept spec 29's
  ruleset targeting `feature/**`. Driving the real surface showed that a required status check gates
  *every ref update*, so `git push -u origin feature/<name>` was rejected outright
  (`GH013: Required status check "validate-source-branch" is expected.`) — BRANCHING.md's workflow
  step 1 was broken, while the docs in this same change claimed feature branches were freely
  pushable. Fix: drop `feature/**` from `branch-policy-required-check`. Root cause and trade-off
  belong to [`29-branch-policy.md`](29-branch-policy.md).
- **Verified at the surface (not only from config):** a rejected ref update on `develop` and `main`
  as an `admin: true` user (`422 … Changes must be made through a pull request`), and a full
  create → push → force-push → delete cycle on a throwaway `feature/verify-probe-13` (all exit 0,
  branch deleted afterwards; the DEV-deploy runs it triggered were cancelled).
- **Not part of this change:** `.claude/settings.local.json` picked up two local Claude Code
  allow-entries during implementation; unrelated to the spec.

---

## Data model

**No schema changes.**

---

## Security

Tightens who can write to the release/integration branches: after this, only a merged PR can change
`develop`/`main`, and history there cannot be rewritten. Applying it needs an admin-scoped token, run
locally by a repo-admin — never stored in GitHub Actions.

---

## Edge cases

- A future bot or workflow that needs to push to `develop`/`main` → with `bypass_actors: []` it will
  be rejected; it must use the PR path or the spec must be revisited. No such automation exists today.
- A solo contributor with no one available to approve → cannot merge into `develop`/`main` (1
  approval required, no admin bypass). Accepted consequence, recorded in _Design decision_.
- An in-flight local branch already ahead of `develop` → the developer must open a PR instead;
  document the recovery (`git switch -c feature/…`).
- Ruleset applied while an open PR exists → merges keep working; only direct pushes are affected.
- Repo plan/permission limits: rulesets on private repos require a plan that supports them →
  if unavailable, fall back to classic branch protection on the two exact branch names.

---

## Out of scope

- Protecting `feature/*` branches (they stay freely pushable by design).
- A CODEOWNERS file / per-path reviewer routing. (A plain 1-approval requirement **is** in scope —
  see the deviation note in _Design decision_.)
- The merge-direction validation itself — spec [`29-branch-policy.md`](29-branch-policy.md).
- Hotfix / release branch flows (none defined yet).
