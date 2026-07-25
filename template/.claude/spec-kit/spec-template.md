# Spec NNN — <short title>

> **In one sentence:** <what changes and why it matters, in plain language.>

|                |                                      |
| -------------- | ------------------------------------ |
| **Status**     | ⏳ Not started                       |
| **Issue**      | #NNN — "<issue title>"               |
| **Branch**     | `NNN-kort` (from `feature/<name>`)   |
| **Feature**    | <area>                               |
| **Depends on** | <links to other specs, or "nothing"> |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Canonical single-file spec format for {{PROJECT_NAME}}. One file per issue: specs/NNN-kort.md. It holds
the WHAT, the HOW (exact file:line changes), acceptance criteria, verification and edge cases together —
do NOT split into separate plan.md / tasks.md files.
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
Mark anything undecided inline with [NEEDS CLARIFICATION: …] so /clarify can find it.
Keep the section names as they are — the slash commands and the constitution refer to them by name.
-->

---

## User story

_Who wants this, and what they get out of it._

As a **<role>** I want **<capability>** so that **<outcome>**.

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today:** <what exists and where>
- **The problem:** <the gap or root cause>
- **Already in place:** <existing plumbing that covers part of it>

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

<The chosen approach in 1–3 sentences.>

**Not touched:** <what stays as-is, and why.>

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [ ] <specific, testable outcome>
- [ ] <…>
- [ ] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — `<path>`: <what they cover>.
- <Criterion → the test, the existing wiring, or the manual check that proves it.>
- Full suite result + typecheck/lint status.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

1. **`<path>`** — <what and why>, at ([:NNN](link)).
2. **`<path>`** — <what and why>.

**No change needed:** <what already handles this, and why.>

---

## Data model

_Any database change. Most specs have none — say so plainly._

**No schema changes.** — OR — a new table/column sketch. Any DB work follows the data invariants in the
constitution: access control ships with the new resource, migrations are idempotent, and the schema is
never hand-edited.

---

## Security

_Two lines at most: what this opens up and who may reach it — or "nothing security-relevant, because …".
Required by the constitution; silence is not an answer._

---

## Edge cases

_Unusual inputs or states, and what should happen._

- <input/state → expected behaviour>

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- <excluded item, with a one-line reason or a follow-up pointer>
