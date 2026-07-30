---
description: Take this foundation from documents to a project that runs, once.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

Set up **{{PROJECT_NAME}}** so it runs.

This foundation ships the documents, the rules and the workflow. It does not ship a stack — that is
what this command is for. Run it once, in a fresh clone. Read
@.claude/spec-kit/constitution.md first; everything below is subject to it.

**Re-runnable by design.** Check before every step and skip what is already there. A founder who runs
this twice, or runs it after writing code, must lose nothing. When a step's output already exists,
say so and move on — never overwrite, never scaffold on top.

**It stops at this machine.** No creating a remote repository, no provisioning a database, no
deploying, no writing secrets anywhere. Those need a human with an account and are step 2 of
[START_HERE.md](../../START_HERE.md).

---

## 1. Stack and toolchain

{{START_BOOTSTRAP}}

## 2. Git, locally

Skip any of these that is already done.

1. `git init -b main`, if there is no `.git` here yet. The branch model this foundation ships is
   `main` ← `develop` ← `feature/<name>`, and git still defaults to `master` on many machines.
2. Commit everything as the first commit — the foundation as it was generated, before your changes.
3. Create the long-lived branches: `develop`, then your first `feature/<name>`. See
   [BRANCHING.md](../../docs/architecture/BRANCHING.md).

No remote. Adding one, and pushing, is yours to do in [START_HERE.md](../../START_HERE.md).

## 3. The smallest thing that runs

{{START_MINIMUM}}

## 4. Verify, and report honestly

Run all five and show the real output:

```bash
{{CMD_DEV}}        # starts, serves the page, then stop it
{{CMD_BUILD}}      # builds
{{CMD_TYPECHECK}}  # type check
{{CMD_LINT}}       # linter
{{CMD_TEST}}       # tests
```

This is the **verification bar**, and every change from here has to pass it before it merges — the
same bar `{{CI_FILE}}` runs on every push.

Report what you did, what you skipped because it already existed, and the result of each command. If
one of them fails, say which and why rather than working around it. A green bar that was reached by
weakening a check is worth less than a red one that is honest.

Then point the founder at step 2 of [START_HERE.md](../../START_HERE.md): the accounts and services
only they can create.
