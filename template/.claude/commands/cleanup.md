---
description: Reorganise this project so its structure is readable, and clear out what nothing uses.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

Make **{{PROJECT_NAME}}** a project someone else could join.

`/sync` made this foundation's documents describe the code. This command works on the code's
*shape*: files moved until the structure explains itself, and everything nothing uses proposed for
removal. It is the one command in this foundation that changes the founder's own files, and every
rule below exists to keep that safe.

**And it says what it cannot fix.** A project someone else could join is not only one whose folders
are tidy — it is one where they can tell what it is tied to, what is load-bearing, and where to start
reading. That part is reported, never acted on (sections 2 and 7).

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

**Is the toolchain even here?** The commands below run through the package manager this project
declares — the one its lockfile and its manifest name. Check it is installed before you run anything.

If it is not, **stop and ask**. Never quietly substitute another one: a different package manager
writes a second lockfile, and two lockfiles that resolve differently is a defect introduced by the
command that came to tidy up. If the founder picks a substitute, write that choice into the plan,
name the lockfile it created in your report, and leave that file untracked. If they would rather not
install anything, record the bar as unrunnable and carry on with the reading — but **move nothing**,
because without a baseline there is no way to tell what a move broke.

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

**The bar itself is a finding.** Write down, for the report: which of these four this project cannot
actually run, where what CI or the constitution claims differs from what exists, and how many failures
were already there. A red linter that was red before you arrived is a fact the next person needs on
their first day — and stating the count is what stops a later change being blamed for it.

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

## 2. What this project is still tied to

A project that was generated by an app-builder — Lovable, v0, Bolt, Replit — arrives structurally
correct, because a scaffold puts routes in the routes directory. Everything below this line will find
nothing to move, and that is not the same as the project standing on its own. It may still be unable
to build without the vendor's package.

**This section removes nothing.** It reads, and it writes down what it found. Every finding names the
file it came from.

**Never judge a file by its name or its comments.** A file that mentions the vendor may be the only
error handling this project has; a file that mentions nobody may be the thing that pins it. Read it.

Four questions:

**a. Does the build depend on a vendor?** Read the framework config. If it imports a preset, a wrapper
or a plugin bundle rather than composing the pieces itself, **unpack that package** — read its source
or its documentation — and list what it actually provides, then which of those this project already
depends on directly. The difference between those two lists is the real cost of leaving, and it is
usually far smaller than the wrapper makes it look. List it either way, including whatever it was
doing silently.

**b. Does anything phone home?** Error reporting, analytics, editor bridges, dev-server tunnels. For
each one, find where it is initialised and whether its key or endpoint is even set in production.
*Inert in production* and *live and being watched* are two different findings and must never be
reported as one — a reporter the founder actually reads is monitoring, not leftovers, and taking it
away silently removes the only thing that tells them the product is broken.

**c. Is this project named after itself?** Compare three names: the one in the manifest, the one the
running app shows a user, and the one in these documents. A generated project often still carries the
template's.

**d. What arrived through the vendor but is good on its own merit?** Error boundaries, security
middleware and headers, input validation, retry logic, sensible config defaults. **These are keeps.**
Judge them on what they do, never on where they came from — the vendor writing something does not make
it the vendor's, and a project stripped of the one thing its generator got right is worse off than it
started. **Security middleware stays** unless you can name the file where this framework provides the
same protection another way. Say them out loud in the report as kept, or the next run proposes them
again.

**Then stop.** Removing any of this changes behaviour, and this command changes behaviour nowhere.
What it does instead is hand the founder the exact next step — see section 8.

Write the findings into `.claude/cleanup-plan.json` as you go. A run interrupted after the moves must
still be able to report what it found without reading the whole project a second time.

## 3. Plan every move before you make one

Write the whole plan to `.claude/cleanup-plan.json` **before applying any of it**: every move as a
`from` → `to` pair, the baseline verification results, the findings from section 2, and a `done` flag
per entry that you set as you go. A crashed session with a plan can be resumed; one without has to be
untangled by hand.

That file is scratch state, not documentation. Keep it out of what you stage, and delete it in
section 8 when the run has succeeded.

**Where things should end up.**

{{CLEANUP_LAYOUT}}

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

## 4. Apply the moves

- **`git mv`, always.** History follows the file. Never move-and-recreate, never copy-and-delete.
- **Update every reference in the same pass** — imports, re-exports, path aliases, config globs, test
  paths, CI paths, and any relative link in a document. A move that leaves a broken import is worse
  than no move at all.
- **Mark each entry done in the plan as it lands**, so an interrupted run knows exactly where it got
  to.
- **Stage per planned path, never `git add -A`.** A blanket add sweeps in build output, a lockfile the
  baseline run rewrote, and any generated file a build refreshed while you were measuring — and lands
  a code change inside a changeset that is supposed to hold nothing but moves.
- **Nothing is committed.** The moves sit staged.

**Then run the verification bar again** — the same four commands, compared against the baseline from
section 1. Anything that passed before and fails now is something you broke: **revert that move**,
put it back where it was, and report it. Pre-existing failures stay pre-existing; they are noted, not
inherited as blame.

**Then check what is actually staged**, against the plan. Anything staged that the plan does not
account for comes back out. If running the bar refreshed a tracked generated file, restore it to its
committed state and report that the committed copy is stale — that is a real finding, and it is the
founder's to fix in a change of its own.

## 5. What nothing uses

Projects built quickly, and projects built with AI app-builders in particular, accumulate files
nobody meant to keep. Work through these as **separate categories**, and propose each one on its own:

- **Duplicates and abandoned drafts** — `Component 2.tsx`, `Button-old.tsx`, `copy of …`, two files
  rendering the same thing where only one is imported.
- **Dead code** — modules nothing imports, exports nothing consumes, routes nothing links to.
- **Generator leftovers** — the builder's demo pages, placeholder copy, its boilerplate README,
  `console.log` debris, large commented-out blocks.
- **Dependencies nothing imports** — and this one can do real damage, so the bar is higher. A package
  is not unused because the source does not import it. Check the source, **every config file**, and
  anything resolved for you by a build preset or plugin — the wrapper from section 2 is exactly how a
  dependency ends up load-bearing and invisible at the same time. **Never propose removing a package
  without showing where you established it is unused, including outside the source directory.** Where
  a package is imported only by files you have already proposed removing, say so: it is conditional on
  that removal, not independently dead.

For each category: what you found, the evidence for each file, and what would be lost by removing it.
**Then wait.** Nothing is deleted without an explicit yes, and a yes to one category is not a yes to
the next. "Delete everything that looks unused" is how someone loses the one file they needed, and
you are not the one who can tell which it is.

**Files too large to maintain** — the 2,000-line component that is really eight — get reported and
left alone. Splitting them changes behaviour, so it goes through `/createspec` like any other change.

## 6. The branch model

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

## 7. Point the documents at where things are now

Every path `/sync` wrote into a document may have just moved. Fix them from your own plan — you know
exactly what went where, so this is a rename map, not a second analysis.

Update `.claude/project-map.md` the same way, so the map describes the tree as it is now — including
its **Orientation** section, which `/sync` wrote against the old paths. That section is what someone
who has never seen this project reads first, so rewrite it from the tree as it stands now:

- **Entry points** — where execution actually begins, in order.
- **The critical path** — the two or three files that carry what this product does.
- **Load-bearing and easy to break** — files whose removal or edit has consequences that are not
  obvious from reading them: security middleware, generated files, paths the framework discovers by
  location, and whatever section 2 found holding the build up.
- **Safe to change first** — where a newcomer's first edit can land without risk.
- **Read in this order** — four to six files. Not more; a list nobody finishes is a list nobody reads.

Derive all five from the code. Restating what the documents already claim is how a map ends up
describing a project that no longer exists.

## 8. Report, then hand back

Say, plainly:

1. What moved, grouped by reason, and what the root holds now.
2. **What this project is still tied to** — section 2's four answers, with the files behind them:
   what the build depends on and what it would cost to leave, what phones home and whether it is live,
   which names disagree, and **what you kept on merit** and why.
3. The verification bar: what it did before, what it does now, anything you reverted, which checks
   this project does not have, and the pre-existing failure count.
4. Which categories of unused files you found, what the founder approved, and what was left in place.
5. Which branches existed already and which you created.
6. Anything you left alone and why — unrecognised stack, framework-mandated path, a change you could
   not attribute. **Anything you could not attribute with confidence is reported, never acted on.**
7. **That nothing is committed**, and that the whole change is staged for them to review — one
   `git diff --staged` away, and `git restore --staged .` puts it all back.

**Then hand off the work you are not allowed to do.** If section 2 found the build tied to a vendor,
end the report with the line that starts fixing it — written out in full, ready to paste:

> `/createspec "Remove the <vendor> build coupling: replace <package> with the plugins it wraps, so
> the project builds on its own"`

And one sentence naming what running it would cost — the editor sync, the live preview, the one-click
deploy, the round trip back into the builder. The founder cannot decide to keep something they were
never told they had.

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

**Nothing left to do?** Then say what you checked, one line each: the layout against this ecosystem's
conventions, what the root holds, the four questions in section 2, each category of unused files, the
branches, and the verification bar. Move nothing and hand back anyway.

A bare "nothing to move" reads as an oversight, and on a generated project it is usually wrong in the
way that matters most: the structure was always going to be fine, because a scaffold wrote it. What
the founder needs to know is what you looked at and found sound. That is a verdict. Silence is not.
