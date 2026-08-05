---
description: Reorganise this project so its structure is readable, and clear out what nothing uses.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

Make **{{PROJECT_NAME}}** a project someone else could join.

`/sync` made this foundation's documents describe the code. This command works on the code's
*shape*: files moved until the structure explains itself, and everything nothing uses proposed for
removal. It is the one command in this foundation that changes the founder's own files, and every
rule below exists to keep that safe.

Read @.claude/spec-kit/constitution.md first; everything below is subject to it.

**It stages, and never commits.** Every move lands in the index for the founder to inspect and
commit themselves. No commit, no branch of its own for the work, no push, no history rewritten —
never `rebase`, never `reset --hard`, never `--force`.

**It deletes nothing without a yes.** Removal is proposed per category, with the evidence, and
happens only for what the founder actually approves.

**It changes behaviour nowhere.** Files move and imports follow. Nothing is upgraded, installed,
reconfigured or rewritten to work differently — a file that ran before runs the same afterwards, from
its new path.

**It stops at this machine.** No remote, no provisioning, no deploying, no secrets written.

---

## 1. Before you move anything

**Is there a map?** This command reads `.claude/project-map.md` — the stack, the structure and the
conventions `/sync` established from the repository. Without it you would be reorganising a project
nobody has read.

If it is missing, do not improvise: say so, offer to run `/sync` first, and stop there. That is one
command and it is the right one.

**Is this a git repository?** Check for `.git`. If there is none, say plainly that a restructure with
no way back is not something this command will do, and offer the fix: `git init`, then stage
everything and make one first commit of the project exactly as it stands today. Only with the
founder's yes, and never on a checkout that is somebody else's. Then continue.

**Is the tree clean?** `git status --porcelain`. Three cases:

1. **Clean** — a first run. Continue.
2. **Dirty, and `.claude/cleanup-plan.json` exists** — a previous run of this command stopped part
   way. Go to *Resuming*, below.
3. **Dirty, with no plan** — the changes are the founder's. Stop, list them, and ask them to commit
   or stash first. They must be able to see exactly what this command did, and that is impossible
   mixed with their own uncommitted work.

**Record the verification bar before you touch anything.** Run each of these and write down what it
does today, in the plan:

```bash
{{CMD_BUILD}}
{{CMD_TYPECHECK}}
{{CMD_LINT}}
{{CMD_TEST}}
```

Whatever is already failing was failing before you arrived. That is the baseline, not your fault and
not yours to fix here — but you cannot tell what a move broke without it. If a command does not exist
in this project, note that instead of inventing one.

### Resuming

A run that stopped part way left staged moves behind, and they are not mess to be cleared — they are
work already done. **Resume from where it stopped.**

Read `.claude/cleanup-plan.json` and compare it against the tree:

- Entries marked done, whose destination exists → already applied. Leave them.
- Entries not marked done → still to do. Verify the source is still where the plan says before
  moving it.
- **Anything changed in the working tree that the plan does not account for** → the founder's, or
  something that went wrong. **Leave it untouched and report it.** Never assume an unattributed
  change is yours.

The clean-tree rule in case 3 above is what protects the founder's work on a first run. On a resumed
run the plan is what does that job, so it has to be right — which is why nothing moves before it is
written.

## 2. Plan every move before you make one

Write the whole plan to `.claude/cleanup-plan.json` **before applying any of it**: every move as a
`from` → `to` pair, the baseline verification results, and a `done` flag per entry that you set as
you go. A crashed session with a plan can be resumed; one without has to be untangled by hand.

That file is scratch state, not documentation. Keep it out of what you stage, and delete it in
section 7 when the run has succeeded.

**Where things should end up.** The layout comes from this project's own ecosystem — what someone who
knows this stack would expect to find, and where:

{{CLEANUP_LAYOUT}}

**If the stack is one you do not recognise**, do not invent a convention for it. Move nothing, report
what looked disorganised and why, and let the founder decide. An imposed layout nobody in that
ecosystem uses is worse than the mess.

**What never moves, whatever the layout says:**

- **Framework-mandated paths.** `app/`, `pages/`, `public/`, `src/` where the framework requires it,
  `supabase/`, `migrations/`, `.github/`, and anything else the tooling discovers by location.
  Moving one of these is not tidying, it is breaking the build.
- **Root config that has to be at the root** — the manifest, the lockfile, the framework config, the
  type checker, the linter, the formatter, the container and deploy files. Every ecosystem has a
  list; the test is whether a tool finds it by path.
- **Anything under a directory the project ignores** — build output, caches, `node_modules`, vendored
  dependencies.

**What the root should be left holding:** the files above, this foundation's entry documents, and
nothing else. Everything else in a root belongs in a folder that says what it is.

**In a monorepo, every package is its own root.** Apply the whole rule at the workspace root — for
what a workspace genuinely needs there — and then again inside each package, against that package's
own ecosystem. A workspace root is not a dumping ground because it is shared.

Show the founder the plan before you apply it. Moves per group, with the reason for each group, and
what the root looks like afterwards.

## 3. Apply the moves

- **`git mv`, always.** History follows the file. Never move-and-recreate, never copy-and-delete.
- **Update every reference in the same pass** — imports, re-exports, path aliases, config globs, test
  paths, CI paths, and any relative link in a document. A move that leaves a broken import is worse
  than no move at all.
- **Mark each entry done in the plan as it lands**, so an interrupted run knows exactly where it got
  to.
- **Nothing is committed.** The moves sit staged.

**Then run the verification bar again** — the same four commands, compared against the baseline from
section 1. Anything that passed before and fails now is something you broke: **revert that move**,
put it back where it was, and report it. Pre-existing failures stay pre-existing; they are noted, not
inherited as blame.

## 4. What nothing uses

Projects built quickly, and projects built with AI app-builders in particular, accumulate files
nobody meant to keep. Work through these as **separate categories**, and propose each one on its own:

- **Duplicates and abandoned drafts** — `Component 2.tsx`, `Button-old.tsx`, `copy of …`, two files
  rendering the same thing where only one is imported.
- **Dead code** — modules nothing imports, exports nothing consumes, routes nothing links to.
- **Generator leftovers** — the builder's demo pages, placeholder copy, its boilerplate README,
  `console.log` debris, large commented-out blocks.
- **Dependencies nothing imports**, named from the manifest and checked against the source.

For each category: what you found, the evidence for each file, and what would be lost by removing it.
**Then wait.** Nothing is deleted without an explicit yes, and a yes to one category is not a yes to
the next. "Delete everything that looks unused" is how someone loses the one file they needed, and
you are not the one who can tell which it is.

**Files too large to maintain** — the 2,000-line component that is really eight — get reported and
left alone. Splitting them changes behaviour, so it goes through `/createspec` like any other change.

## 5. The branch model

The workflow this foundation ships runs on branches — `/createspec` cuts one, `/pr-check` opens a
pull request into the one above it, and the CI rules key off their names. This project usually
arrives without them, so set them up. Locally, and only what is missing.

1. **Find the trunk**: the branch that is checked out, or what
   `git symbolic-ref refs/remotes/origin/HEAD` reports. **Do not rename it.** A trunk called `master`
   stays `master` — renaming it breaks branch protection, open pull requests and every CI trigger
   pointing at the old name, and none of that is yours to break.
2. **Create what is missing**, and nothing else: `develop` from the trunk, then the first
   `feature/<name>` from `develop` — see [BRANCHING.md](../../docs/architecture/BRANCHING.md). A
   branch that already exists is left exactly where it is.
3. **Make the documents say the real name.** If this project's trunk is not called `main`, rewrite
   [BRANCHING.md](../../docs/architecture/BRANCHING.md) and `CLAUDE.md` to name the branch that
   exists — the *shape* is the rule (trunk ← `develop` ← `feature/<name>` ← issue branch), the
   trunk's name is a fact about this repository.

**No remote.** No `push`, no `remote add`, no branch created anywhere but here. No branch renamed and
none deleted.

## 6. Point the documents at where things are now

Every path `/sync` wrote into a document may have just moved. Fix them from your own plan — you know
exactly what went where, so this is a rename map, not a second analysis.

Update `.claude/project-map.md` the same way, so the map describes the tree as it is now.

## 7. Report, then hand back

Say, plainly:

1. What moved, grouped by reason, and what the root holds now.
2. The verification bar: what it did before, what it does now, and anything you reverted.
3. Which categories of unused files you found, what the founder approved, and what was left in place.
4. Which branches existed already and which you created.
5. Anything you left alone and why — unrecognised stack, framework-mandated path, a change you could
   not attribute.
6. **That nothing is committed**, and that the whole change is staged for them to review — one
   `git diff --staged` away, and `git restore --staged .` puts it all back.

**Then, and only then, hand back.** When the verification bar is no worse than the baseline and the
work above is done:

1. Rewrite step 1 of [START_HERE.md](../../START_HERE.md) to say this project has been reorganised,
   and that `/createspec` is where a change starts from here.
2. Delete `.claude/cleanup-plan.json`.
3. Delete this command file.

In that order — the first file anyone opens must never point at a command that is no longer there.
Those deletions are staged with everything else, so a founder who discards the changeset gets this
command back along with the moves, and can run it again.

**A failed or partial run leaves all three alone.** If the verification bar came back worse, or the
founder stopped part way, this command has not finished — and it must still be here tomorrow to
finish the job.

**Nothing left to do?** If the structure is already idiomatic and nothing is unused, say so, move
nothing, and hand back anyway. A tidy project does not need this command a second time.
