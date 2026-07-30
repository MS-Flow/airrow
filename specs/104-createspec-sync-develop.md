# Spec 104 — `/createspec` syncs `develop` into the feature branch first

> **In one sentence:** `/createspec` merges the latest `develop` into `feature/<name>` before it cuts
> the issue branch, so every new issue branch is born with the latest integrated work instead of a
> warning nobody acts on.

|                |                                                      |
| -------------- | ---------------------------------------------------- |
| **Status**     | ✅ Done                                               |
| **Issue**      | #104 — "/createspec ska dra in senaste develop i feature-branchen innan issue-branchen skapas" |
| **Branch**     | `104-createspec-sync-develop` (from `feature/ci-cd`)  |
| **Feature**    | ci-cd                                                 |
| **Depends on** | nothing (touches the same file as [spec 27](27-auto-assign-createspec.md)) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

_Who wants this, and what they get out of it._

As a **team member running `/createspec` on an issue** I want **the parent `feature/<name>` to be
brought up to date with `develop` before my issue branch is cut** so that **I start from the latest
integrated work instead of discovering weeks-old drift as conflicts in the PR.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today:** Step 3 of [.claude/commands/createspec.md](../.claude/commands/createspec.md) does
  `git checkout feature/<name> && git pull` and then creates the branch via `gh issue develop`. A
  sub-bullet ("Don't merge `develop` into the new issue branch") tells the runner to check
  `git log feature/<name>..origin/develop --oneline` and *mention* it if the feature branch is behind,
  suggesting a separate `git merge develop` into `feature/<name>`.
- **The problem:** it is advice, not an action. Creating the branch for this very issue found
  `feature/ci-cd` **51 commits behind `develop`** — an issue branch cut there would have missed every
  import, authoring and `/start`/`/cleanup` change, and the drift would only surface as conflicts in
  the eventual PR.
- **Already in place:** the correct direction is already written down and enforced — the constitution's
  branch model (`.claude/spec-kit/constitution.md` §IV), the "Update the feature against develop:
  `git merge develop`" line in [docs/architecture/BRANCHING.md](../docs/architecture/BRANCHING.md),
  and `.github/workflows/branch-policy.yml`. Nothing about the hierarchy changes here.
- **Two copies:** the same command ships to customers as
  [template/.claude/commands/createspec.md](../template/.claude/commands/createspec.md). It is listed
  under `fixedWorkflowPaths` in `template/.airrow-template.json`, so it is copied verbatim — with
  `{{ISSUE_TERM}}` / `{{CLI_BRANCH_LINK}}` style tokens, and `develop` written literally.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

Replace the "warn only" sub-bullet in Step 3 with an executed sync: after `git pull` on
`feature/<name>`, fetch `develop` and — if the feature branch is behind — merge `origin/develop` into
`feature/<name>` and push it, and only then create the issue branch. The merge direction is unchanged
from what the constitution already requires: `develop` goes **into the feature branch**, never straight
into an issue branch. The same edit lands in the template so generated projects inherit the behaviour.

**The sync is blocking, and it never cleans up after itself.** Anything that stops it — a conflict, a
dirty working tree, a rejected push, no network — stops spec creation at that point and hands the
runner a named problem. This is deliberately *unlike* the best-effort issue assignment in Step 1:
assignment failing costs a label, the sync failing costs the whole point of the change, since the
issue branch would be cut from stale code. On conflict the half-merged tree is left in place (never
`git merge --abort`) so no resolution work is thrown away; a rejected push is retried once after a
`git pull`, then reported.

**Not touched:** the branch hierarchy and PR-direction rules, `branch-policy.yml`, the issue-assignment
step, and everything from Step 4 onward. No application code changes — this is a prompt-file change,
mirrored.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] `/createspec` fetches `develop` and merges `origin/develop` into `feature/<name>` **before** the
      issue branch is created, whenever the feature branch is behind.
- [x] The merge is pushed, so the remote `feature/<name>` matches — the issue branch is created from
      the synced state and contains the latest `develop`.
- [x] Nothing runs when `git log feature/<name>..origin/develop --oneline` is empty — no merge commit,
      no push.
- [x] A merge conflict stops the flow with the conflicting paths named, leaves the half-merged tree in
      place for the runner to resolve, and does **not** create the issue branch on top of it.
- [x] A dirty working tree is detected **before** the merge starts and stops the flow with the files
      named — nothing is stashed, merged over, or committed on the runner's behalf. The check ignores
      `.claude/settings.local.json` (machine-local, never committed by `/push`) and untracked files.
- [x] A rejected push is retried once after `git pull`; if it still fails, the flow stops and reports.
      No failure mode lets spec creation continue on an unsynced feature branch.
- [x] `develop` is never merged directly into an issue branch.
- [x] Step 5's report says whether a sync happened and how many commits it brought in.
- [x] `template/.claude/commands/createspec.md` carries the same behaviour, in template voice
      (existing tokens preserved), so generated projects get it.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New test** — [packages/engine/src/scaffold.test.ts](../packages/engine/src/scaffold.test.ts):
  assert the *generated* `.claude/commands/createspec.md` tells the runner to merge `develop` into the
  feature branch before creating the issue branch, so the template copy cannot silently drift back.
  That file is the right home — it already reaches command files by path (`.claude/commands/start.md`
  at [:315](../packages/engine/src/scaffold.test.ts#L315)) and the behaviour is provider-independent,
  unlike `provider.test.ts` (GitHub vs Azure vocabulary) and `authored.test.ts` (which only proves
  authoring never rewrites these files).
- Behavioural criteria → manual check, following the precedent set by
  [spec 27](27-auto-assign-createspec.md): `/createspec` is a markdown prompt, not executable code, so
  a live run on a throwaway issue against a deliberately-behind feature branch is the proof.
- Full suite result + typecheck/lint status.

**Result (2026-07-29).** All green, no pre-existing failures:

| Command             | Result                                                        |
| ------------------- | ------------------------------------------------------------- |
| `pnpm -r typecheck` | clean — engine, schemas, web                                   |
| `pnpm -r lint`      | clean — no new issues                                          |
| `pnpm -r test`      | engine 214 passed (8 files) · web 246 passed, 28 skipped (38 files, 7 skipped) |
| `pnpm test:scripts` | 13 passed                                                      |

The new guard test is `makes /createspec sync develop into the feature branch before cutting the issue
branch` in `scaffold.test.ts` — it renders the scaffold from `template/**` and asserts the *generated*
command contains the fetch, the behind-check, the merge, the direction rule and the blocking-not-
best-effort rule, so the template copy cannot drift back to warn-only.

**The guard test bites.** Verified during `/analyze` by mutating the template
(`git fetch origin develop` → `origin main`): the test failed (1 failed | 30 passed), and restoring the
file made it green again (31 passed). It is not a vacuous assertion.

**Manual proof, already collected:** the run that created this very branch. `feature/ci-cd` was **51
commits behind `develop`**; the sync merged and pushed it, and `104-createspec-sync-develop` was cut
from the synced state. That is the criterion "the issue branch contains the latest `develop`",
demonstrated on the change's own branch.

**Known limit of the verification.** Only the happy path has been observed. The conflict, dirty-tree
and rejected-push paths are instruction text in a prompt file — no automated test can exercise them,
and closing this spec does not claim they were run. Same position as
[spec 27](27-auto-assign-createspec.md), which left its live end-to-end proof to the next real run.
The first `/createspec` that meets one of those states is the proof; if the command misbehaves there,
that is a bug against this spec, not a new one.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

1. **`.claude/commands/createspec.md`** — Step 3: replace the "Don't merge `develop` into the new issue
   branch" sub-bullet with the executed sync (fetch → compare → merge → push → then create the branch),
   keeping the reason the old bullet gave (sync at the feature level, never into the issue branch).
2. **`.claude/commands/createspec.md`** — Step 5: report the sync outcome alongside the existing
   branch/marker report.
3. **`template/.claude/commands/createspec.md`** — the same two edits in template voice; keep
   `{{ISSUE_TERM}}`, `{{CLI_BRANCH_LINK}}` and friends intact. The integration branch stays the
   literal `develop`: every other template file already writes it literally
   (`docs/architecture/BRANCHING.md`, `.github/workflows/branch-policy.yml`, `CLAUDE.md`,
   `.claude/commands/pr-check.md`), and introducing a token in one file only would be inconsistent.
   A real `{{INTEGRATION_BRANCH}}` token is a separate, template-wide change.
4. **`docs/architecture/BRANCHING.md`** (+ `template/docs/architecture/BRANCHING.md`) — the "Update the
   feature against develop: `git merge develop`" line now describes something `/createspec` does for
   you at branch creation. Required by the constitution's "AI context stays synchronized" rule: the
   line currently reads as a manual chore and would otherwise contradict the command.
5. **`packages/engine/src/scaffold.test.ts`** — the guard test named under _Verification_.

**No change needed:** `.claude/spec-kit/constitution.md` — §IV already states the branch model and PR
direction this implements; nothing in it says the sync must be manual.

### Implementation notes

- [.claude/commands/createspec.md](../.claude/commands/createspec.md) — Step 3's warn-only bullet is
  now a numbered three-step sync (dirty check → fetch + behind check → merge + push), placed before
  branch creation, with the direction rule and the blocking-not-best-effort rule as their own bullets.
  Step 5 reports the sync outcome.
- [template/.claude/commands/createspec.md](../template/.claude/commands/createspec.md) — same, in
  template voice; `{{ISSUE_TERM}}` and `{{CLI_BRANCH_LINK}}` untouched, `develop` literal as decided.
- [docs/architecture/BRANCHING.md](../docs/architecture/BRANCHING.md) and its template twin — workflow
  step 2 shows the merge, and "Keep branches in sync" now says `/createspec` does it for you, so
  neither doc reads as a manual chore that contradicts the command.
- [packages/engine/src/scaffold.test.ts](../packages/engine/src/scaffold.test.ts) — the guard test.

No application code changed; the engine and its purity are untouched.

### Follow-up: the dirty check was too strict (fixed in this spec)

The first real `/createspec` run after this change — issue #77 — exposed a defect in the rule as first
written. A plain `git status --porcelain` reports `.claude/settings.local.json`, which is machine-local
and which [`/push`](../.claude/commands/push.md) deliberately never commits. The dirty check would
therefore have hard-stopped **every** run that needed a merge, on a file nobody is ever expected to
commit. The #77 run only survived it because `feature/ci-cd` was already in sync, so no merge was
attempted.

Fixed by narrowing the check to
`git status --porcelain --untracked-files=no -- . ':(exclude).claude/settings.local.json'`, in both
copies of the command. Untracked files are excluded for a different reason: a merge does not touch
them, and git refuses on its own if one would be overwritten — so blocking on them is noise, not
safety. Verified: with the pathspec, a tree dirty only in `settings.local.json` reports nothing, while
two genuinely modified source files are still reported.

---

## Data model

**No schema changes.**

---

## Security

Nothing security-relevant: the change only alters which git commands `/createspec` runs locally, on
branches the runner already has push rights to. No new credentials, no new network surface, and no
generated-output change beyond the prompt text itself.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- **Feature branch already in sync** → skip fetch-merge-push entirely; no empty merge commit.
- **Merge conflict** → stop before creating the issue branch and name the conflicting files. The
  half-merged tree is **left in place** — never `git merge --abort` — so the runner resolves it once
  and no resolution work is discarded. Spec creation continues after the merge is committed.
- **Uncommitted local changes** → detected *before* the merge starts; hard stop with the files listed.
  Nothing is stashed, merged over, or committed for the runner. Two things are deliberately **not**
  treated as dirty: `.claude/settings.local.json`, which is machine-local and which `/push` explicitly
  never commits, and untracked files, which a merge does not touch (git refuses on its own if one is in
  the way). The check is therefore
  `git status --porcelain --untracked-files=no -- . ':(exclude).claude/settings.local.json'`.
- **Push to `feature/<name>` rejected** (someone else pushed meanwhile) → `git pull` and retry the push
  once; if it still fails, stop and report. The issue branch is not created from an unpushed state.
- **`gh`/network unavailable, or the fetch fails** → stop and report. Unlike the issue assignment in
  Step 1, the sync is **not** best-effort: continuing would cut the branch from stale code, which is
  exactly what this spec exists to prevent.
- **Already on the matching `NNN-<kort>` branch** → keep it, no sync.
- **Description-based spec** (`#TBD`, no feature branch chosen) → unchanged; no sync.

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- Keeping an **existing** issue branch up to date mid-work (`git merge feature/<name>`) — that is the
  runner's call, documented in `BRANCHING.md`.
- Any automation that merges into `develop` or `main`; those still change only through a reviewed PR.
- CI enforcement of "feature branch must not be behind `develop`" — a possible follow-up in
  `branch-policy.yml`, not this spec.
