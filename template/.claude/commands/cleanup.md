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

**It deletes nothing, and it renames nothing.** Everything you would otherwise remove gets reported
instead.

**Re-runnable by design.** Check before every step and skip what is already done. A founder who runs
this twice, or runs it after editing the documents by hand, must lose nothing.

**It stops at this machine.** No remote, no provisioning, no deploying, no secrets written.

{{CLEANUP_MODE}}

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
- **Git** — whether this is a repository at all, what the trunk branch is called, and which
  long-lived branches already exist. Section 5 needs all three.
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

{{CLEANUP_COMMANDS_RULE}}
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

{{CLEANUP_REPO_WORK}}

## 7. Report

Say, plainly:

1. What you found the stack and structure to be, and which files told you.
2. Which documents you rewrote, and what changed in each.
{{CLEANUP_REPORT_ITEMS}}
6. Every `[NEEDS CLARIFICATION]` you left, and why it could not be answered from the repository.
7. Anything you noticed about the code that looks wrong. Name it — and leave it. It goes through
   `/createspec`, like every other change from here.

Then point the founder at step 2 of [START_HERE.md](../../START_HERE.md): the accounts and services
only they can create.
