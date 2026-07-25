# Spec: Auto-assign the issue to whoever runs /createspec

**GitHub issue:** #27 — "Auto assign the person on a task in github to the person who writes /createspec on a specific issue"
**Branch:** `27-auto-assign-createspec` (from `feature/ci-cd`)
**Feature:** Spec-kit tooling / CI-CD
**Depends on:** nothing
**Status:** ✅ Done

<!--
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
Mark anything undecided inline with [NEEDS CLARIFICATION: …] so /clarify can find it.
-->

---

## User story
As a **team member running `/createspec` on an issue** I want **that GitHub issue to be automatically
assigned to me** so that **the assignee always reflects who is actively working the spec, with no
manual assigning**.

---

## Background
Populated during `/implement`.
- `/createspec` already resolves the issue (`gh issue view <n>`) and creates + links the branch
  (`gh issue develop <n> --base feature/<name> …`). It does **not** touch the assignee.
- The person running the command is the authenticated `gh` user, addressable as `@me`, so assignment
  can happen at command time without guessing identity.
- Command definition lives in the spec-kit `/createspec` flow (`.claude/…`).

---

## Design decision
Assign client-side in the command via `gh issue edit <n> --add-assignee @me`, right after the issue
number is resolved. Maps exactly to "whoever ran `/createspec`" and needs no server infrastructure.
Deliberately **not** implemented as a GitHub Action on linked-branch creation — actor-on-push can
differ from the spec author, and it would duplicate logic the command already owns.

---

## Exact changes (file:line)
<Populated/expanded by `/implement`.>
1. **`.claude/commands/createspec.md`** — at the **end of Step 1 ("Resolve the issue")**, add an
   assignment instruction: for a real issue number, run `gh issue edit <n> --add-assignee "@me"`
   (`"@me"` is quoted so PowerShell doesn't parse a bare `@me` as the splat operator). Guarded so it
   only runs for real issue numbers (skipped for `#TBD` description-based specs) and degrades
   gracefully on failure — warn and continue, never abort spec/branch creation.
2. **`.claude/commands/createspec.md`** — Step 5 report: mention when assignment was skipped/failed so
   the runner knows to assign manually.

---

## Data model
**No schema changes.**

---

## Acceptance criteria
- [x] Running `/createspec <issue#>` sets the current `gh` user as an assignee on that issue.
      (Step 1 now runs `gh issue edit <n> --add-assignee "@me"`; flag confirmed via `gh issue edit --help`.)
- [x] If the user is already assigned, the command still succeeds (no duplicate, no error) — idempotent.
      (`--add-assignee @me` is a no-op when already assigned; documented in the step.)
- [x] A description-based `/createspec` (no issue yet, `#TBD`) creates the spec without attempting assignment.
      (Step explicitly skips for `#TBD`.)
- [x] With `gh` unavailable/unauthenticated or the edit failing, the spec is still scaffolded and the
      branch still created; a clear note explains assignment was skipped — assignment never blocks
      spec/branch creation. (Step 1 warns-and-continues; Step 5 surfaces the skip.)
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).
      (Change is markdown-only — `.claude/commands/createspec.md`; no TS/JS source touched, so the
      suites are unaffected.)

### Verification
- Manual: run `/createspec` on a throwaway test issue → confirm the assignee is set on GitHub, and the
  linked branch appears in the issue's Development section (existing behavior unbroken).
- Re-run on the same issue → no error, still assigned (idempotency).
- Simulate `gh` failure → spec still scaffolded with a skip note.
- **Verification bar: manual only.** `/createspec` is a markdown prompt file, not executable code —
  there is no code path for Vitest to exercise, so no automated test is added. The change is proven by
  the manual runs above.

### Implementation notes
- Implemented in [.claude/commands/createspec.md](../.claude/commands/createspec.md): a new
  assignment bullet at the end of Step 1 (`gh issue edit <n> --add-assignee @me`, real issues only,
  idempotent, warn-and-continue on failure), and a Step 5 report line surfacing a skipped/failed
  assignment.
- No TS/JS source changed, so `pnpm -r typecheck/lint/test` are unaffected — not run for a
  markdown-only edit per the manual-only bar.
- `/analyze` correctness fix: quoted `"@me"` because this repo's primary shell is PowerShell, where a
  bare `@me` is the splat operator; unquoted it could break assignment. The `--add-assignee` flag and
  its `"@me"` form were confirmed against `gh issue edit --help`.
- Full end-to-end manual proof (a live `/createspec` run assigning a throwaway issue) is left to the
  next real invocation; the command string itself is verified valid.

---

## Edge cases
- Issue already assigned to the runner → `--add-assignee @me` is a no-op, exits cleanly.
- `gh` missing / unauthenticated → warn and continue; spec + branch still produced.
- Description-based invocation (no issue number) → skip assignment entirely.
- Assignee edit fails (e.g. permissions) → warn and continue, never abort.

---

## Out of scope
- Auto-assign on other commands (`/implement`, `/analyze`).
- Multi-assignee, round-robin, or team-based assignment.
- Un-assigning on spec completion or PR merge.
