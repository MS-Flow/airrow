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

**It deletes nothing, and it renames nothing.** Where this foundation shipped a document the project
already had, both are on disk — theirs at its own path, this foundation's beside it as `.airrow`.
Everything you would otherwise remove gets reported instead.

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

## 4. The `.airrow` files: where this project already had one

Where this foundation ships a document the project already had, the founder's file keeps its path and
this foundation's version arrives beside it as `<name>.airrow.md` — `README.airrow.md`,
`CLAUDE.airrow.md`, `docs/architecture/SYSTEM_OVERVIEW.airrow.md`. Both are on disk on purpose, and
the name says which is which: **the `.airrow` file is this foundation's version; the plain one is the
founder's.**

**Start by finding all of them** — `git ls-files '*.airrow.md'`, or a glob for `**/*.airrow.md` if
this is not a git repository. There may be one, there may be a dozen; the number depends on how much
of this foundation the project already had. List them in your report before you touch any, and work
through every single one. An `.airrow` file left untailored is a document that describes someone
else's project.

For each of them:

1. **Treat the `.airrow` file as one of the documents in section 3.** It is this foundation's, so
   tailor it to this project like the rest — that is what makes it worth adopting.
2. **Read the founder's version for what only they know.** Anything in it that is true and not in the
   `.airrow` file — how the project is deployed, why something is the way it is, what a reader needs
   to know — belongs in the tailored version. Say in your report what you carried across.
3. **Leave the founder's file alone.** Do not rewrite it, do not delete it, do not rename it. Their
   `README.md` is theirs.
4. **Tell them the swap is theirs to make**, in plain words: their file is untouched,
   `README.airrow.md` is the version the workflow reads, and when they are happy with it they rename
   it over their own — `git mv README.airrow.md README.md`. Nothing here does that for them.

If an `.airrow` file is missing for a document this project already had, the founder chose to keep
theirs during the import review. Respect it: say so once in the report and move on.

**Only documents arrive this way.** Where this foundation would have shipped a *non*-document the
project already had — a workflow file most likely — nothing was delivered, because a second live
pipeline sitting next to theirs is worse than none. If this foundation's `{{CI_FILE}}` is missing
while the project has its own, that is why. Say so in the report, alongside the command mismatch from
section 3, and leave the founder to decide.

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
