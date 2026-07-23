---
description: Plan the exact changes, implement them, verify, and check off criteria.
argument-hint: [spec file — defaults to the spec matching the current branch]
allowed-tools: Read, Edit, Write, Bash, Grep, Glob
---

**If `$ARGUMENTS` is empty, reply with only this line and stop — do nothing else:**
> Vilken spec ska jag implementera? (issue-nr)

Implement: **$ARGUMENTS**.

Read @.claude/spec-kit/constitution.md and the spec first.

1. **Verify the branch** matches the spec's issue and was cut from the stated `feature/<name>`. If it
   doesn't match, stop and ask — never branch off `main`.
2. **Plan the changes** (if "Exact changes (file:line)" isn't filled): ground the Background in real
   code with `file:line`, fill "Exact changes" with the minimal edits, fill the Data model (enforce
   the constitution's data invariants), and list tests to add. Run a quick **Constitution Check** —
   flag any invariant the plan would break before writing code.
3. **Implement the "Exact changes"** exactly. Clean code matching surrounding style; no unrequested
   refactors. Respect every invariant.
4. **Add/adjust the tests** named in the Verification section.
5. **Verify** — run the project's typecheck, lint, and test commands (single-file while iterating).
   Fix new failures. Note any pre-existing ones.
6. **Update the spec** — check off satisfied criteria, set **Status: 🔄 In progress**, record the
   verification result under Verification / an Implementation notes block.
7. Report what changed, the verification output, and remaining criteria. Suggest `/analyze`.

Do **not** open a PR or push — that happens after `/analyze` closes the spec out.
