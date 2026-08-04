# {{PROJECT_NAME}} — Developer Guide

{{SETUP_SECTION}}

## Verification bar (run before any PR)
```bash
{{CMD_TYPECHECK}}  # type check
{{CMD_LINT}}       # linter — no new issues
{{CMD_TEST}}       # tests — green (note known pre-existing failures)
```

## Patterns & conventions
{{KEY_CONVENTIONS}}

## Getting to a deployed product

What it should look like, and how someone moves through it, is
[`../architecture/UI_ARCHITECTURE.md`](../architecture/UI_ARCHITECTURE.md). `{{FIRST_COMMAND}}`
deliberately doesn't touch any of the accounts below — follow these in order; each one verifies the
one before it.

{{INFRASTRUCTURE_SETUP}}

## Workflow
Spec-driven, via slash commands: `/createspec → /clarify → /implement → /analyze`, with `/push` and
`/pr-check` around the PR, and `/security` outside the loop — it reviews the whole repository for
vulnerabilities, fixes only what nobody can see, and writes the gitignored `SECURITY_AUDIT.md`.
Governed by
[`../../.claude/spec-kit/constitution.md`](../../.claude/spec-kit/constitution.md). Branch + PR
direction: see [`../architecture/BRANCHING.md`](../architecture/BRANCHING.md).
