---
description: Take this foundation from documents to a project that runs, once.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

Set up **{{PROJECT_NAME}}** so it runs.

This foundation ships the documents, the rules and the workflow. It does not ship a stack — that is
what this command is for. Run it once, in a fresh clone. Read
@.claude/spec-kit/constitution.md first; everything below is subject to it.

**Re-runnable until it succeeds.** Check before every step and skip what is already there. A founder
who runs this twice, or runs it after writing code, must lose nothing. When a step's output already
exists, say so and move on — never overwrite, never scaffold on top. Once section 4 has passed in
full, this command has nothing left to do and removes itself (section 5) — so a second run only ever
happens because the first one did not finish.

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

## 5. Remove this command

**Only if all five commands above actually ran and passed.** If any of them failed, if you skipped
one, or if anything in section 3 was left as a `[NEEDS CLARIFICATION]` note, stop here and leave this
file exactly where it is — the founder will want to run it again once that is resolved, and a command
that deleted itself after half a job is the one failure mode this step must never have.

Otherwise, delete `.claude/commands/start.md` — this file. It scaffolds a stack into an empty
repository, and that has now happened; a command that can only be run once, offering itself forever,
is a trap for whoever opens this project next. Everything from here goes through the spec loop, and
`/createspec` is where that starts.

Then point the founder at step 2 of [START_HERE.md](../../START_HERE.md): the accounts and services
only they can create — and tell them plainly that this command has removed itself, so nothing about
the project looks quietly different next time they look.
