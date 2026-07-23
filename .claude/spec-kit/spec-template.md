# Spec: <short title>

**GitHub issue:** #NNN — "<issue title>"
**Branch:** `NNN-kort` (from `feature/<name>`)
**Feature:** <area>
**Depends on:** <links to other specs, or "nothing">
**Status:** ⏳ Not started

<!--
Canonical single-file spec format for Airrow. One file per issue: specs/NNN-kort.md. It combines the
WHAT, the HOW (exact file:line changes), acceptance criteria, verification and edge cases in one
document — do NOT split into separate plan.md / tasks.md files.
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
Mark anything undecided inline with [NEEDS CLARIFICATION: …] so /clarify can find it.
-->

---

## User story
As a **<role>** I want **<capability>** so that **<outcome>**.

---

## Background
Current state, grounded in real code with `file:line` links (add these during `/implement`):
- <what exists today and where>
- <the gap / root cause>
- <existing plumbing that already covers part of it>

---

## Design decision
<The chosen approach in 1–3 sentences, and what it deliberately does NOT touch and why.>

---

## Exact changes (file:line)
<The inline "plan". Every change grounded in current code. Populated/expanded by `/implement`.>
1. **`<path>`** — <what and why>, at ([:NNN](<link>)).
2. **`<path>`** — <what and why>.
<State what needs NO change and why the existing code already handles it.>

---

## Data model
**No schema changes.** — OR — new table/column sketch. If DB work, follow the data invariants in the
constitution (access control on new resources, idempotent migrations, never hand-edit the schema).

---

## Acceptance criteria
- [ ] <specific, testable outcome>
- [ ] <…>
- [ ] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification
- **New tests** — `<path>`: <what they cover>.
- <How each acceptance criterion is proven — by a test, by existing wiring, or by manual check.>
- Full suite result + typecheck/lint status.

---

## Edge cases
- <input/state → expected behaviour>

---

## Out of scope
- <explicitly excluded, with a one-line reason or follow-up pointer>
