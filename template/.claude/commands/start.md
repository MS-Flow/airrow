---
description: Take this foundation from documents to a project that runs, once.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

Set up **{{PROJECT_NAME}}** so it runs.

This foundation ships the documents, the rules and the workflow. It does not ship a stack — that is
what this command is for. Run it once, in a fresh clone. Read
@.claude/spec-kit/constitution.md first; everything below is subject to it.

## How this runs

Six sections, in this order. Finish one before starting the next, and say out loud which one you are
in:

| #   | Section          | What it leaves behind                                                     |
| --- | ---------------- | ------------------------------------------------------------------------- |
| 1   | Tools            | git, this stack's runtime and the CLI for your repo host, all installed    |
| 2   | Stack            | the framework, the toolchain, and `.env.example`                          |
| 3   | Git              | a local repository on `main`, plus `develop` and your first feature branch |
| 4   | The first screen | {{PROJECT_NAME}}'s core action, built and finished                        |
| 5   | Verify           | all five commands run, with their real output                             |
| 6   | Hand back        | `START_HERE.md` updated, this command removed                             |

**Show progress.** When a section is done, print exactly this line and nothing else, so the founder
can see where they are without reading the transcript:

```
[██░░░░░░░░░░] 1/6 · Tools ✓
```

Two filled cells per finished section, twelve in total. Print `[░░░░░░░░░░░░] 0/6 · starting` before
section 1, and add `(already done)` after the section name when there was nothing left to do there —
it still counts as finished. If a section fails, print the bar as far as you actually got, say which
step failed, and stop: a bar that runs ahead of the work is worse than no bar at all.

**Re-runnable until it succeeds.** Check before every step and skip what is already there. A founder
who runs this twice, or runs it after writing code, must lose nothing. When a step's output already
exists, say so and move on — never overwrite, never scaffold on top. Once section 5 has passed in
full, this command has nothing left to do: it updates step 1 of `START_HERE.md` and then removes
itself (section 6) — so a second run only ever happens because the first one did not finish.

**It stops at this machine.** Section 1 installs developer tools, and that is the only thing here
that reaches outside this directory. No creating a remote repository, no provisioning a database, no
deploying, no writing secrets anywhere, and no signing in to anything. Those need a human with an
account and are step 2 of [START_HERE.md](../../START_HERE.md).

---

## 1. Tools

Nothing else in this command works without these.

{{START_TOOLS}}

## 2. Stack and toolchain

Turn this directory into a project that runs. Keep every file the foundation already put here.

{{START_BOOTSTRAP}}

**Done when:** the dependencies are installed and `package.json` (or this stack's equivalent) defines
the five commands section 5 runs.

## 3. Git, locally

A repository on this machine only — no remote, no push. Skip any step that is already done.

1. **`git init -b main`**, if there is no `.git` here yet. The branch model this foundation ships is
   `main` ← `develop` ← `feature/<name>`, and git still defaults to `master` on many machines.
2. **Commit everything as the first commit** — the foundation as it was generated, before your
   changes. If `git` has no `user.name` or `user.email` on this machine, ask the founder for them and
   set them locally (`git config user.name …` in this repository), rather than committing as nobody.
3. **Create the long-lived branches:** `develop`, then your first `feature/<name>`. See
   [BRANCHING.md](../../docs/architecture/BRANCHING.md).

No remote. Adding one, and pushing, is yours to do in [START_HERE.md](../../START_HERE.md).

**Done when:** `git log` shows the first commit and `git branch` lists `main`, `develop` and one
`feature/<name>`.

## 4. The first screen

Build the one thing this product is for, and finish it. The ceiling below is the whole of it.

{{START_MINIMUM}}

## 5. Verify, and report honestly

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

**Done when:** all five have actually run, and you have shown what each one printed.

## 6. Hand back, and remove this command

**Only if all five commands above actually ran and passed.** If any of them failed, if you skipped
one, or if anything in section 4 was left as a `[NEEDS CLARIFICATION]` note, stop here and leave this
file and [START_HERE.md](../../START_HERE.md) exactly as they are — the founder will want to run this
again once that is resolved, and a command that deleted itself after half a job is the one failure
mode this step must never have.

Otherwise, do these two things in this order — the guide first, the deletion second, so an
interruption between them leaves a command that can still be run rather than instructions for one
that no longer exists.

**6a. Update [START_HERE.md](../../START_HERE.md) so it no longer tells anyone to run this command.**
It is the first file anyone opens, and it currently describes this step as work still to do. Two
places name the command, and both change:

- **Step 1, "Get it running"** — replace the instruction to run this command, and the paragraph
  describing what it would do, with one or two sentences saying what is now true: the stack is
  scaffolded, git is initialised locally, and {{PROJECT_NAME}} runs. Two things in that step survive
  untouched: the **Claude Code** paragraph that opens it, which is still how every other command gets
  run, and the four commands with the **verification bar** sentence below them — that block is what
  the founder comes back to, and it stays true forever.
- **"How the commands work"** — drop this command from the list of commands this foundation ships.
  The rest of the list — `/createspec`, `/clarify`, `/implement`, `/analyze`, `/push`, `/pr-check` —
  is untouched, because those are the ones they run from now on.

Change nothing else in that file: not the reading list, not the spec loop, not step 2's accounts.
Anything you write there is the founder's own documentation now — keep it in the voice of the rest of
the file, and do not add a changelog entry, a note about this command, or a date.

**6b. Delete `.claude/commands/start.md`** — this file. It scaffolds a stack into an empty
repository, and that has now happened; a command that can only be run once, offering itself forever,
is a trap for whoever opens this project next. Everything from here goes through the spec loop, and
`/createspec` is where that starts.

Then print the finished bar, `[████████████] 6/6 · done`, and point the founder at step 2 of
[START_HERE.md](../../START_HERE.md): the accounts and services only they can create — and tell them
plainly that this command has removed itself and rewritten step 1, so nothing about the project looks
quietly different next time they look.
