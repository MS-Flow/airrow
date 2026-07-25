# Spec NNN — <short title>

> **In one sentence:** <what changes and why it matters, in plain language.>

|                |                                        |
| -------------- | -------------------------------------- |
| **Status**     | ⏳ Not started                          |
| **Issue**      | #NNN — "<issue title>"                 |
| **Branch**     | `NNN-kort` (from `feature/<name>`)     |
| **Feature**    | <area>                                 |
| **Depends on** | <links to other specs, or "nothing">   |

**Short on time?** Read *User story* and *Acceptance criteria* — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Canonical single-file spec format for Airrow. One file per issue: specs/NNN-kort.md. It holds the WHAT,
the HOW (exact file:line changes), acceptance criteria, verification and edge cases together — do NOT
split into separate plan.md / tasks.md files.
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
Mark anything undecided inline with [NEEDS CLARIFICATION: …] so /clarify can find it.
Keep the section names as they are — the slash commands and the constitution refer to them by name.
-->

---

## User story
*Who wants this, and what they get out of it.*

As a **<role>** I want **<capability>** so that **<outcome>**.

---

## Background
*How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`).*

- **Today:** <what exists and where>
- **The problem:** <the gap or root cause>
- **Already in place:** <existing plumbing that covers part of it>

---

## Design decision
*The approach we picked, and what we deliberately leave alone.*

<The chosen approach in 1–3 sentences.>

**Not touched:** <what stays as-is, and why.>

---

## Acceptance criteria
*What "done" means. Every line is something a reviewer can check.*

- [ ] <specific, testable outcome>
- [ ] <…>
- [ ] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification
*How each criterion above is proven.*

- **New tests** — `<path>`: <what they cover>.
- <Criterion → the test, the existing wiring, or the manual check that proves it.>
- Full suite result + typecheck/lint status.

---

## Exact changes (file:line)
*The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`.*

1. **`<path>`** — <what and why>, at ([:NNN](<link>)).
2. **`<path>`** — <what and why>.

**No change needed:** <what already handles this, and why.>

---

## Data model
*Any database change. Most specs have none — say so plainly.*

**No schema changes.** — OR — a new table/column sketch. Any DB work follows the data invariants in the
constitution: access control ships with the new resource, migrations are idempotent, and the schema is
never hand-edited.

---

## Security
*Required by the constitution — every spec has one. "Nothing security-relevant here, and why" is a
valid answer; silence is not.*

- **New surface:** <what an attacker can now reach — a route, action, table, upload, external call — or
  "none".>
- **Who may reach it:** <how authorization is decided **server-side**; never from client-supplied ids.>
- **Untrusted input:** <what is validated, and against what. Anything rendered is sanitized.>
- **Secrets & logs:** <what must never appear in code, the client bundle, or a log line.>

---

## Edge cases
*Unusual inputs or states, and what should happen.*

- <input/state → expected behaviour>

---

## Out of scope
*Deliberately excluded, so nobody wonders whether it was forgotten.*

- <excluded item, with a one-line reason or a follow-up pointer>
