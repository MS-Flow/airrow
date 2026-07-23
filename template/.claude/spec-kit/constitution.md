# {{PROJECT_NAME}} — Spec Constitution

The single source of truth for how {{PROJECT_NAME}} is built and what every spec and change must
respect. When any other file disagrees with this one, **this file wins**. It holds the *invariants*
and links to canonical docs for detail. Amendments require an ADR.

Canonical sources: [`CLAUDE.md`](../../CLAUDE.md) ·
[`SYSTEM_OVERVIEW.md`](../../docs/architecture/SYSTEM_OVERVIEW.md) ·
[`DEVELOPER_GUIDE.md`](../../docs/guides/DEVELOPER_GUIDE.md) ·
[`BRANCHING.md`](../../docs/architecture/BRANCHING.md).

---

## I. Architecture invariants
{{ARCHITECTURE_INVARIANTS}}

## II. Data invariants
{{DATA_INVARIANTS}}

## III. Design invariants
{{DESIGN_INVARIANTS}}

## IV. Process invariants  (PORTABLE — the {{PROJECT_NAME}} workflow, do not weaken)
- We work via GitHub: a **feature** is a GitHub Project, and **issues** are linked to that feature.
  Each issue gets a spec and a branch.
- **Spec before code.** Every issue gets a `specs/NNN-kort.md` before implementation; the spec is the
  source of truth and code is reviewed *against* it. One feature at a time. When code and spec
  disagree, stop and **fix the spec first**.
- Branch `NNN-kort` (issue number + short name, **no** `issue/` prefix) is cut from its
  `feature/<name>`. **PR direction is strict and never skipped:** issue branch → its `feature/<name>`
  → `develop` → `main`. An issue branch is **never** PR'd to `main` or `develop`.
- **Conventional Commits**, atomic and buildable. Small PRs — one coherent slice; squash-merge.
- **Decisions are recorded** as ADRs in `adr/` (with or before the implementing PR).
- **AI context stays synchronized.** `CLAUDE.md` and docs update in the **same** change as the code.
  Single source of truth: a fact lives in one file, everything else links; duplication is a bug.
- After implementing: check off acceptance criteria, set the spec **Status**, and update
  [`specs/README.md`](../../specs/README.md).

## V. Testing invariants  (PORTABLE — do not weaken)
- Tests are **co-located** with the code they cover, matching the test runner's glob so CI runs them.
- Tests are **deterministic**: no dependence on local time/timezone, randomness, or the network. Pin
  `TZ=UTC` and anchor fake time in UTC.
- Each spec's **Verification** section names the tests it adds. `/implement` writes them; `/analyze`
  confirms they exist and are green before closing a spec.
- Bug fixes ship with a regression test that fails before the fix. Failing/skipped tests never merge.

## VI. Verification bar
A change is not done until:
- Typecheck is clean:  `{{CMD_TYPECHECK}}`
- Linter adds **no new** issues:  `{{CMD_LINT}}`
- Tests are green:  `{{CMD_TEST}}`  — noting known pre-existing failures.
- The relevant acceptance criteria are demonstrably met (by a test or an explicit manual check).
