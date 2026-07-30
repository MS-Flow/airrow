# {{PROJECT_NAME}} — Developer Guide

## Setup
```bash
{{CMD_DEV}}        # start the dev server
```
{{STACK_SUMMARY}}

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
`/pr-check` around the PR. Governed by
[`../../.claude/spec-kit/constitution.md`](../../.claude/spec-kit/constitution.md). Branch + PR
direction: see [`../architecture/BRANCHING.md`](../architecture/BRANCHING.md).
