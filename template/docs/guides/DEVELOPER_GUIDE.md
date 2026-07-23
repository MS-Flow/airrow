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

## Workflow
Spec-driven, via slash commands: `/createspec → /clarify → /implement → /analyze`, with `/push` and
`/pr-check` around the PR. Governed by
[`../../.claude/spec-kit/constitution.md`](../../.claude/spec-kit/constitution.md). Branch + PR
direction: see [`../architecture/BRANCHING.md`](../architecture/BRANCHING.md).
