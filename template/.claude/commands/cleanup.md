---
description: Make this foundation's documents describe the project that is actually here, once.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

Make this foundation describe **{{PROJECT_NAME}}** as it really is.

This project already exists. What arrived with this foundation is the workflow, the rules and the
documents — written from an interview about the project rather than from reading it. This command
closes that gap. Read @.claude/spec-kit/constitution.md first; everything below is subject to it.

**It changes no code.** Not a source file, not a dependency, not a config file, not a migration, not
a pipeline. Documents only. If something in the project looks wrong to you, that is a spec, not a fix
you make here.

**It deletes nothing.** Where this foundation took a path the project already used, the founder's
version is recovered and kept, never removed. Everything you would otherwise delete gets reported
instead.

**Re-runnable by design.** Check before every step and skip what is already done. A founder who runs
this twice, or runs it after editing the documents by hand, must lose nothing.

**It stops at this machine.** No remote, no provisioning, no deploying, no secrets written.

---

## 1. Read the project

Before changing a single document, work out what this project actually is. Read, in roughly this
order, and only what is there:

- **Manifests and lockfiles** — what the dependencies say the stack is, and which package manager
  the lockfile proves is in use.
- **The scripts that really exist**, and what each one runs.
- **Config** — the framework, the type checker, the linter, the test runner, the formatter.
- **Structure** — the top-level layout, where source lives, where tests live, how they are named.
- **Conventions the code itself shows** — module style, error handling, how boundaries are
  validated, what the tests actually assert.
- **CI and deploy** — what runs on a push, where it deploys, what the environment needs.
- **The founder's own documents** — their README and anything under their docs. Read them for
  context. You are not rewriting them.

Say what you found before you change anything, and name the file each conclusion came from. A claim
with no file behind it is a guess, and a guess written into `CLAUDE.md` outlives everyone's memory of
having made it.

## 2. What these documents currently claim

{{CLEANUP_CLAIM}}

## 3. Rewrite the documents to match

{{CLEANUP_SCOPE}}

Work through them and make every statement true of this repository:

- **The commands.** `{{CMD_DEV}}`, `{{CMD_BUILD}}`, `{{CMD_TYPECHECK}}`, `{{CMD_LINT}}` and
  `{{CMD_TEST}}` appear across these documents and in `{{CI_FILE}}`. Replace each one with the
  command that actually works here. If a project has no typecheck or no tests at all, say so plainly
  in the document rather than naming a command that does not exist — and note it in your report.
- **CI names those commands too, and you may not edit it.** `{{CI_FILE}}` runs the same verification
  bar on every push, and it is pipeline configuration — out of bounds for this command. If the
  commands there do not exist in this project, the first push will fail. Do not quietly fix it and do
  not quietly ignore it: put it at the top of your report, with the two ways out — add the missing
  scripts to this project, or edit the workflow — and let the founder choose. The same goes for the
  verification bar named in `.claude/spec-kit/constitution.md`, which you may also only read.
- **The stack.** Every description of the architecture, the layers and the conventions should read
  as a description of this codebase, written by someone who has read it.
- **The structure.** Where the documents describe folders, describe the ones that are here.
- **What is not there.** If a document describes something this project does not have, remove that
  claim. Do not add the thing.
- **Keep the workflow intact.** The spec loop, the branch model and the verification bar are how this
  project is built from here. They describe the future, not the past, so they are not wrong just
  because the project has not worked that way until today.

Anything you cannot establish from the repository goes in as
`[NEEDS CLARIFICATION: <the question>]`, exactly as the spec loop uses it. Never fill a gap with a
plausible guess — an invented convention is worse than an admitted unknown, because the next
assistant will follow it.

## 4. Where this foundation took a path the project already used

This foundation ships files the project may already have — `README.md` most often. Landing it here
overwrote the founder's version of that file. Nothing is allowed to stay lost.

For every document this foundation shipped that this project already had:

1. **Recover their version.** In a git repository it is in the history:
   `git show HEAD:README.md > README.old.md` — the commit before this foundation arrived. Read
   `git status` and `git log` to find which paths that applies to. If this is not a git repository,
   or the file has no history, say so in the report and change nothing.
2. **Keep it as `.old`**, byte for byte unchanged: `README.md` → `README.old.md`, the suffix before
   the extension. Never delete it, never edit it, never merge it silently.
3. **Say so in plain words**, in the report: their file is still there, they are welcome to fold
   anything from it back in, and the reason this foundation's version now holds the path is that the
   workflow reads it.

If a `.old` file from an earlier run is already there, leave it alone. That path is settled.

## 5. Old assistant instructions

Projects that have been worked on with AI accumulate instruction files — `.cursorrules`, an older
`AGENTS.md`, `.github/copilot-instructions.md`, half-finished notes to a model that are now years of
context out of date. Two of them saying different things is worse than neither, and this foundation's
`CLAUDE.md` is about to be a third.

**Find them, report them, delete nothing.** For each one: where it is, what it says that contradicts
this foundation or the code, and what would be lost by removing it. Where it holds something still
true and still useful, fold that into `CLAUDE.md` — attributed, so the founder can see what moved —
and say the original is now redundant. The founder decides what to remove.

## 6. Report

Say, plainly:

1. What you found the stack and structure to be, and which files told you.
2. Which documents you rewrote, and what changed in each.
3. What you renamed to `.old`, and what you left untouched.
4. Which old instruction files you found, and what you recommend for each.
5. Every `[NEEDS CLARIFICATION]` you left, and why it could not be answered from the repository.
6. Anything you noticed about the code that looks wrong. Name it — and leave it. It goes through
   `/createspec`, like every other change from here.

Then point the founder at step 2 of [START_HERE.md](../../START_HERE.md): the accounts and services
only they can create.
