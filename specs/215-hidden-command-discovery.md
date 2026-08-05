# Spec 215 — A hidden foundation's commands, found from the repository root

> **In one sentence:** A hidden foundation's `/sync` becomes runnable from the root of the founder's
> own repository — where they actually work — by linking its command files into the root's
> `.claude/commands/`, and the session that runs it can finally read the project it describes.

|                |                                      |
| -------------- | ------------------------------------ |
| **Status**     | ✅ Done                              |
| **Issue**      | [#215](https://github.com/MS-Flow/airrow/issues/215) — "Hidden mode: make the foundation's commands discoverable from the repository root" · **absorbs [#207](https://github.com/MS-Flow/airrow/issues/207)** — "Hidden mode: `/cleanup` is told to read the project, and started where it cannot" |
| **Branch**     | `215-hidden-command-discovery` (from `feature/import-existing-projects`) |
| **Feature**    | Import existing projects             |
| **Depends on** | [187-hidden-import-integration.md](187-hidden-import-integration.md) — the nesting transform, the folder name, and the "nothing outside the folder" rule this spec amends · [214-sync-cleanup-split.md](214-sync-cleanup-split.md) — `/sync`, the only first-run command a hidden delivery ships · [91-cleanup-command.md](91-cleanup-command.md) — the command scope this inherits · [199-import-interview-questions.md](199-import-interview-questions.md) — the interview that picks the mode |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
Mark anything undecided inline with [NEEDS CLARIFICATION: …] so /clarify can find it.
-->

---

## User story

_Who wants this, and what they get out of it._

As a **developer bringing Airrow into a codebase my team shares** I want **the foundation's commands
to work from the repository root, where I already sit** so that **spec-driven work costs me nothing
per session — no relocating, no flag to remember — and my teammates still see an untouched
repository.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today:** `nestUnder` (`packages/engine/src/import.ts:548`) moves every generated path under the
  founder's folder, applied once inside `generate()` (`packages/engine/src/index.ts:206`), and
  `START_HERE.md` tells the founder to open Claude Code **in that folder**
  (`firstStep`, `packages/engine/src/scaffold.ts:1600-1606`).
- **The problem:** Claude Code discovers commands from the session's directory and every **parent**
  up to the repository root — never downward at startup. So the foundation's commands do not exist at
  the root, and the instruction that works around that moves the founder's working directory away
  from the codebase `/sync` exists to read. That second half is #207, absorbed here: started inside
  the folder, `/sync`'s own instruction to read "everything outside `<folder>/`" cannot be followed,
  and the likely outcome is a `/sync` that describes the foundation folder as if it were the project.
- **Already in place:** `/sync` already writes `.git/info/exclude`
  (`syncRepoWork`, `packages/engine/src/scaffold.ts:2591-2607`) and already knows how to offer a
  change to a file the team owns and wait for a yes (the committed `.gitignore` line, same function).
  `hiddenFolder(model)` (`packages/engine/src/model.ts:347`) is the single place the folder name is
  read, and `firstStep` is the one place `START_HERE.md`'s first move is written.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

**The command files do not move. The root learns to see them.** `/sync` links the foundation's
commands into the repository root's `.claude/commands/`, so a plain `claude` at the root finds them
exactly as it would in an integrated delivery. The foundation stays where spec 187 put it; what
changes is a directory entry pointing into it.

**Two entries, and the shapes are different on purpose** (verified — see _Implementation notes_):

- **`.claude/commands/<folder>` → `<folder>/.claude/commands/`, always.** A link to the *directory*,
  which Claude Code namespaces: the commands arrive as `/<folder>:sync`. That namespace makes the
  collision rule **structural rather than checked** — there is no name a team could own that this can
  shadow — and a directory link never goes stale, so a command added by a later `/sync` appears
  without relinking. **Named after the founder's folder, not after Airrow**: the entry sits in a
  directory their team may open, and a `.claude/commands/airrow/` there would announce exactly what
  this mode exists not to.
- **`.claude/commands/sync.md` → the folder's file, only when that name is free.** The bare `/sync`
  is the name every document already uses, so it ships where it can. It is a per-file link and it
  *can* collide, which is exactly why it is conditional: if the team owns `sync.md`, theirs wins and
  this one is not written.

**The first session cannot use the link, because `/sync` is what creates it.** That sequencing is the
reason #207 is absorbed here rather than specced separately — its route is not a fallback, it is the
bootstrap:

1. **Delivered.** Nothing at the root. `START_HERE.md` says `cd <folder> && claude --add-dir ..` —
   the folder for the commands, the parent for the project they describe.
2. **`/sync` runs.** It offers the links, and on a yes writes them plus the `.git/info/exclude` lines
   that keep them out of the diff, then rewrites `START_HERE.md`'s step 1 to the root route — the
   same "rewrite the document before you change the world" ordering `/start` uses (spec 159).
3. **Every session after that.** `claude` at the repository root, `/<folder>:sync` or `/sync`.

**Windows takes junctions and hardlinks, not symlinks.** Creating a symlink on Windows needs
Developer Mode or an administrator; a **junction** (directory) and a **hardlink** (file) need
neither. So the platform split is `ln -s` on macOS and Linux, `mklink /J` and `mklink /H` on Windows —
and Windows stops being the degraded case the spec first assumed. A hardlink does not survive its
target being *replaced* rather than edited, which is safe here only because `/sync` is re-runnable
forever and re-verifies both links on every run.

This is route **C** from the issue, and it was chosen over route A (ship the commands as
`.claude/skills/` and reach them with `claude --add-dir <folder>`) because **`.claude/commands/`
stays as it is** — a deliberate call to leave the shipped command format alone. The constraint that
makes the two mutually exclusive is documented Claude Code behaviour: `--add-dir` loads
`.claude/skills/` from an added directory but explicitly **not** `.claude/commands/`, so no flag can
ever reach the commands in their current shape.

**Beside it, two smaller pieces:**

- **The foundation's rules reach the root the same way** — a root `CLAUDE.local.md` containing
  `@<folder>/CLAUDE.md`. That is the file the docs describe for exactly this purpose ("personal
  project-specific preferences; add to `.gitignore`"), and the import path resolves inside the working
  directory, so it triggers no external-import approval dialog.
- **A fallback for when linking is not possible** — a founder who declines, or a machine where the
  link cannot be made. The fallback is the bootstrap route itself, `cd <folder> && claude --add-dir ..`,
  which every founder has already used once by then.

**No launcher script ships, and that is a change from the plan.** The earlier route bundle carried
one to wrap a flag the founder would otherwise type every session. Once linking replaced the flag,
the flag survives in exactly one place: a bootstrap line used **once**, before the link exists.
A script is an abstraction earned by ≥2 uses (§I), and shipping an executable to save one founder one
`cd` would be the kind of file that looks like it does something — the thing spec 66 was written to
get rid of.

**This amends spec 187**, and the amendment is the point of the decision. Spec 187 says nothing
outside the folder may change — "not a document, not a branch, not the team's own instruction files".
A link inside the root's `.claude/` is outside the folder. The amendment is narrow: **one directory
entry per shipped command, plus one `CLAUDE.local.md`, both covered by the `.git/info/exclude` line
`/sync` already writes, so the repository's diff stays empty.** Nothing else outside the folder may
be touched, and the rest of spec 187's rule stands unchanged.

**Still written only on an explicit yes.** "Primary" means `/sync` proposes it first and recommends
it — not that it happens silently. §0 forbids anything irreversible running automatically, and spec
187 already set the precedent for this exact class of write with the committed `.gitignore` line.
Declining is a supported outcome, not a failure: the founder gets the fallback route and a working
foundation.

**The risk this spec put before all other work is retired.** Linking into `.claude/commands/` is not
documented — symlink support is specified for `.claude/skills/` and `.claude/rules/` only — so the
first acceptance criterion demanded proof before anything was built on it. Five tests on a real git
repository provide it, including a negative control; the results and what they changed are in
_Implementation notes_.

**Not touched:** the shipped command format — `.claude/commands/*.md` stays, for every foundation.
The integrated layout, which has no discovery problem: its commands already sit at the repository
root. `generate()`'s *content* — the documents are identical in both modes. `/sync`'s write scope
(spec 214) beyond the two entries named above. The Pro gate, the interview, and the stored `delivery`
union (spec 187).

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] **The linking mechanism is verified to work before anything is built on it** — a linked `.md`
      file inside `.claude/commands/` is discovered by Claude Code on a real repository, proven
      against a negative control on the same tree. *(Five tests, recorded in Implementation notes.)*
- [x] A founder sitting at the root of their team's repository runs a plain `claude` and the
      foundation's commands exist — no `cd`, no flag — once `/sync` has linked them.
- [x] The directory link ships **always** and produces namespaced commands (`/airrow:sync`); the bare
      `sync.md` link ships **only when the team does not own that name**.
- [x] **The bootstrap route is stated and true**: the first session, before any link exists, is
      `cd <folder> && claude --add-dir ..` — the folder for the commands, the parent for the project
      (#207, absorbed).
- [x] `/sync` rewrites `START_HERE.md`'s step 1 to the root route **after** the links are in place and
      never before, so the first file anyone opens never names a route that does not work yet
      (spec 159's ordering).
- [x] The link shapes are correct per platform: `ln -s` on macOS/Linux, `mklink /J` (directory) and
      `mklink /H` (file) on Windows — **never** a Windows symlink, which needs elevation.
- [x] `/sync` **proposes** the link and writes it **only on an explicit yes**, explaining in one short
      paragraph that it touches a directory the team may own and that the repository's diff stays
      empty regardless (§0, spec 187's precedent).
- [x] Declining is a first-class outcome: the founder is given the fallback route and a foundation
      that works, not an error.
- [x] `git status` in the founder's repository is **empty** after either path — the link and
      `CLAUDE.local.md` are both covered by the `.git/info/exclude` line `/sync` already writes.
- [x] Nothing outside the folder is written beyond exactly three entries: `.claude/commands/airrow`,
      a conditional `.claude/commands/sync.md`, and the root `CLAUDE.local.md`. Provable by asserting
      on what the command may write, not by inspection.
- [x] **The team's own commands are never overwritten or shadowed.** The namespaced link cannot
      collide by construction; the bare link is written only when the name is free, and where it is
      taken `/sync` reports it and leaves the team's file alone.
- [x] The foundation's rules load at the root: `CLAUDE.local.md` imports `@<folder>/CLAUDE.md`, and
      the import is additive — it never replaces or silently overrides a `CLAUDE.md` the team owns.
- [x] **The session that runs the command can read the project it describes** (#207). Whichever route
      the founder takes, `/sync` reaches the codebase.
- [x] **A command that cannot reach the codebase stops and says so** rather than describing the
      foundation folder as if it were the project (#207's dangerous failure — silent, and it produces
      plausible-looking documents about nothing real).
- [x] `START_HERE.md` states the route and it is **true for the folder the founder actually named** —
      interpolated from `hiddenFolder(model)`, never a placeholder.
- [x] `START_HERE.md` names a **minimum Claude Code version** beside the install step, so a founder on
      an older CLI fails loudly instead of following a true instruction that does nothing.
- [x] **No launcher script ships** — the bootstrap is a one-line command used once, and an executable
      to save one `cd` is an abstraction nothing earned (§I). *(Changed from the plan; reasoning in
      Design decision.)*
- [x] `/sync` verifies that the route **resolves**, not merely that the files exist side by side.
      Section 5 today checks layout (`packages/engine/src/scaffold.ts:2615-2629`); it gains a check
      that `/sync` is reachable from where the founder was told to start, and reports what a session
      without the route would miss.
- [x] The **integrated layout is unchanged**: same discovery, same `START_HERE.md` first step, same
      command files — asserted, so the hidden branch cannot leak into it.
- [x] **Greenfield (`/start`) output is unchanged** — no command file moves, in any mode.
- [x] A founder using an assistant other than Claude Code is still told plainly where the foundation
      is and that it is the thing to read (§0, no lock-in). The route degrades to a path, not to
      nothing.
- [x] Nothing about the route reaches Airrow's servers — no path, no confirmation, no telemetry that
      the founder is hiding anything from anyone (spec 187's standing rule).
- [x] `pnpm engine:smoke` covers the hidden fixture's route alongside the existing assertions.
- [x] `CLAUDE.md`, `SYSTEM_OVERVIEW.md` and the constitution record the spec 187 amendment **in the
      same change** (§IV).
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **Manual, and it comes first** — the linking mechanism on a real repository, before any code is
  written. Specs 66, 91 and 187 all record defects that only a real run found; this one has a
  documented gap (symlinks are specified for `skills/` and `rules/`, not `commands/`), so verifying
  it is step one rather than the last step.
- **New/extended tests** — `packages/engine/src/hidden-layout.test.ts`: the route appears in
  `START_HERE.md`'s hidden branch, names the real folder and the minimum version, and is absent from
  the integrated branch.
- **Extended** — `packages/engine/src/sync-command.test.ts`: `/sync` proposes the link rather than
  asserting it, names the collision rule and the decline path, verifies discovery in section 5, and
  its report items name what a session without the route would miss.
- **Extended** — `packages/engine/src/cleanup-command.test.ts`: the integrated branch still says what
  it said, so the hidden variant cannot strip prose from the mode that needs it (spec 187's
  `/analyze` finding, repeated deliberately).
- **Extended** — `scripts/engine-smoke.mjs`: the hidden fixture.
- **Manual run, in the spec** — unpack a hidden delivery into a real repository, follow
  `START_HERE.md` exactly, and show: `/sync` running from the root under a bare `claude`, reading the
  project, `git status` empty, `git check-ignore -v` pointing at `.git/info/exclude`, and the decline
  path producing a working fallback. Spec 187 left five criteria open for want of this run; this spec
  should not repeat that.
- Full suite result + typecheck/lint status.

---

## Exact changes (file:line)

**Engine (`packages/engine/src/scaffold.ts`)**

1. **`firstStep()`** ([:1600](../packages/engine/src/scaffold.ts#L1600)) — the hidden branch replaces
   "open Claude Code **in `<folder>/`**" with the bootstrap route `cd <folder> && claude --add-dir ..`
   and one sentence on why both halves are needed. It also names the minimum Claude Code version
   beside the install step, for every layout.
2. **`syncRepoWork()`** ([:2587](../packages/engine/src/scaffold.ts#L2587)) — the hidden branch gains
   a linking section: propose both entries, write only on a yes, the per-platform commands, the
   `.git/info/exclude` lines that cover them, the bare-name collision check, and the
   `START_HERE.md` step-1 rewrite ordered after the links.
3. **`syncReportItems()`** ([:2651](../packages/engine/src/scaffold.ts#L2651)) — the hidden branch
   reports which links exist, which shape each took, whether the bare name was free, and what a
   session started without them would miss.
4. **`syncScope()`** ([:2006](../packages/engine/src/scaffold.ts#L2006)) — the hidden branch's
   "everything outside `<folder>/`" is now reachable, so it says so; and a session that *cannot*
   reach it stops rather than describing the folder as the project (#207).

**Generated output (`template/`)**

5. **`.claude/commands/sync.md`** — no structural change; the new prose arrives through the existing
   `{{SYNC_REPO_WORK}}` and `{{SYNC_REPORT_ITEMS}}` tokens ([:98](../template/.claude/commands/sync.md#L98),
   [:106](../template/.claude/commands/sync.md#L106)).

**Docs + constitution** — `.claude/spec-kit/constitution.md` §0, `CLAUDE.md`,
`docs/architecture/SYSTEM_OVERVIEW.md` for the spec 187 amendment.

**Tests** — `packages/engine/src/hidden-layout.test.ts`, `sync-command.test.ts`,
`cleanup-command.test.ts`, `scripts/engine-smoke.mjs`.

**No change needed:** `nestUnder`, `generate()`, `shipsPath`, `deliveredPath`, the schemas, the app,
and the ZIP route. The links are made on the founder's machine by a command; nothing about what is
*delivered* changes, which is why this spec touches no delivery code at all.

---

## Data model

**No schema changes.** The folder name and the delivery layout are already stored on `import_sources`
(spec 187); this spec reads them and writes no new fact. Whether the founder accepted the link is
per-clone state on their own machine, and by spec 187's standing rule it never reaches Airrow's
servers.

---

## Security

Nothing security-relevant is opened. The route is the founder's own session reading their own disk;
Airrow gains no access, sends nothing, and learns nothing about the repository. The one thing to state
plainly, as spec 187 does: this hides files from a repository, not from an employer, and it grants no
access anybody did not already have.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- **The team already has a root `.claude/commands/sync.md`** → their file wins. `/sync` reports the
  collision and links nothing over it; the founder is offered the fallback route instead.
- **The team already has a root `CLAUDE.md`** → `CLAUDE.local.md` loads *alongside* it, never instead
  of it, and the foundation's rules must not silently override the team's.
- **The team already has a root `CLAUDE.local.md`** → it is theirs. Append the import line or report
  it; never rewrite the file.
- **Windows without Developer Mode** → symlinks need elevation. Degrade to the fallback route with the
  reason stated, never fail silently.
- **The founder declines the link** → fallback route, working foundation, no nagging on the next run
  beyond one line saying it is still available.
- **The founder works from a second clone** → the link and the exclude line are per-clone; neither
  travels. `/sync` says so when it installs them, so the limitation is known rather than discovered.
- **The founder renames the folder after delivery** → `/sync` rewrites the instruction to match the
  repository, never the other way round, and repairs a link that now dangles (spec 187's existing rule
  at `packages/engine/src/scaffold.ts:2625-2627`).
- **A dangling link from a deleted folder** → reported and removed; a broken command entry at the root
  is worse than none.
- **No `.git` directory** → nothing to exclude into. `/sync` says so and offers the `.gitignore` line
  instead; it never runs `git init` in somebody else's checkout (spec 187's existing rule).
- **An older Claude Code** → `START_HERE.md` names the minimum version, so this fails loudly.

---

## Implementation notes

### The gating experiment, and the two things it changed

The first acceptance criterion demanded proof before any code, because the whole route rested on
undocumented behaviour. Five runs against a throwaway git repository holding a `notes/` foundation, a
`src/` "team codebase", and a root `.claude/commands/`, each driven by `claude -p` so the result is
the CLI's own answer rather than an inspection of the tree:

| # | Test | Result |
| - | ---- | ------ |
| 1 | Linked `.md` inside the root's `.claude/commands/`, invoked from the root | **`ZORBLAT-9`** — the body came from the folder's file |
| — | **Negative control** — identical tree, link removed | **`Unknown command`** |
| 2 | Root `CLAUDE.local.md` containing `@notes/CLAUDE.md` | **`QUILLFERN-4`** — the folder's rules loaded at the root |
| 3 | Directory **junction** → `/airrow:ping` | worked, and needed **no administrator** |
| 4 | Team's own `/ping` beside the namespaced `/airrow:ping` | **`TEAMOWN-1`** and **`ZORBLAT-9`** — both resolve, neither shadowed |
| 5 | Bare `/ping` through the junction, name otherwise free | **`Unknown command`** — the namespace is not optional |

The negative control is the load-bearing one: tests 1 and 3 only mean something because the same tree
without the link answers `Unknown command`. Nested lazy discovery did not quietly do the work.

**Two findings changed the design.**

**Symlinks need an administrator on Windows** — `New-Item -ItemType SymbolicLink` failed with
`Administrator privilege required` on the development machine (Windows 10 Home, no Developer Mode).
The spec had treated Windows as an edge case to degrade from; it is the default state of a large
share of customers, and degrading there would have meant most Windows founders never getting the
feature. A **junction** for the directory and a **hardlink** for the file both work unelevated, so the
platform difference is a different command, not a lost capability.

**Linking the directory beats linking each file, but it renames the command.** Test 4 proves the
namespace cannot shadow a team's command — structural, not a check that could be got wrong — and a
directory link cannot go stale the way a hardlink can when its target is replaced. Test 5 proves the
cost: `/airrow:sync`, with no bare fallback. Hence both entries, with the bare one conditional: the
namespace is guaranteed, and the familiar name ships wherever the team has not already claimed it.

### The greenfield guard caught this spec leaking into a mode it has no business in

The minimum-version line was first written into the part of `firstStep` every layout shares, which
put it in `START_HERE.md` for projects that began from nothing. `greenfield-golden.test.ts` failed on
`START_HERE.md` immediately — the byte-for-byte fixture spec 214 built for exactly this.

It was the right failure and it was not regenerated. §V says a snapshot diff is a product decision,
and this one had no product behind it: greenfield uses none of the version-sensitive routes, so the
line bought a founder nothing and cost the guard its meaning. The line moved into the hidden branch,
where an older CLI fails *silently*, and both other layouts are byte-identical again. The test that
asserts integrated does **not** carry it is deliberate — it is what stops the next person putting it
back.

### The empty-diff criterion was proven, not inferred

Spec 187 left five criteria open because they describe what a command *does* in a real repository,
and this spec's `git status` criterion is the same shape. It was closed by building the end state by
hand instead of reasoning about it: a git repository with a committed `.claude/commands/` of the
team's own, the foundation in `notes/`, then both links and the `CLAUDE.local.md` created exactly as
section 5 specifies.

Before the exclude lines, `git status --porcelain` reported **exactly three** untracked entries and
no others:

```
?? .claude/commands/notes/
?? .claude/commands/sync.md
?? CLAUDE.local.md
```

which is the "nothing outside the folder beyond exactly three entries" criterion proven by
observation rather than by reading the command's text. After the four exclude lines: **empty**. The
team's `.claude/commands/teamthing.md` stayed tracked and unmodified throughout.

What is still not proven, and is honestly out of reach of anything but a founder's own run, is
whether an assistant *follows* section 5 correctly — the same limit specs 66, 91 and 187 all record
about command text.

### `/analyze` — 2026-08-05: one defect found and fixed

The numbered list in section 5 said "make **two** entries" and then ran to five numbered items,
because the follow-up steps continued the same list across an interposed table. A founder reading it
would count five entries where the sentence promised two. Split into the two entries and a separate
**"Then, in this order:"** list of three. Caught by reading the rendered diff, which is the only way
this class of defect surfaces — every test still passed with it in place.

The constitution amendment also stated the "never without a yes" rule twice in adjacent sentences,
once in the new paragraph and once in spec 187's existing one (§IV: duplicated content is a bug). The
new paragraph now follows 187's rather than interrupting it, and refers to the rule instead of
restating it.

### Reading step 1 as a founder found a false promise

Rendering `START_HERE.md`'s hidden branch and reading it — rather than reading the code that writes
it — turned up three things, one of them a real defect:

**The promise was no longer true.** The hidden branch said `/sync` "changes nothing outside this
folder". That was accurate under spec 187 and this spec broke it: `/sync` may now create three
entries outside the folder. A foundation that understates what it will touch in a repository someone
shares is the single defect this mode cannot afford, and no test caught it because no test asserted a
sentence that had simply become stale. It now says the truth — the only thing it puts outside the
folder is a shortcut, and it asks first — with a test asserting the old wording is **gone**.

**"Run this command" assumed knowledge the reader may not have.** A founder who has not used Claude
Code does not know the line opens something they then type into; the instruction only read as
complete to someone who already knew the answer. Step 1 now says the session takes over the terminal
and that every `/` command is typed there, and splits the one-liner into what each half does.

**The slash form is not the only way in.** A founder already in a session at the repository root
cannot type `/sync` — but these commands are ordinary Markdown, so naming the file works:
`read <folder>/.claude/commands/sync.md and do what it says`. That is the no-lock-in promise (§0)
made concrete rather than asserted, and it is now written where someone stuck would actually look.
Three tests cover the three, so none can quietly disappear.

### Verification — 2026-08-05

| Command | Result |
| --- | --- |
| `pnpm -r typecheck` | clean (3 projects) |
| `pnpm -r lint` | clean, no new issues (3 projects) |
| `pnpm -r test` | **1763 green**, 0 failed — schemas 129, engine 423, web 1211 |
| `pnpm engine:smoke` | SMOKE PASSED — 6 fixtures, Keystone Ops the hidden path |
| `pnpm test:scripts` | 115 green, **1 pre-existing failure** |

**The pre-existing failure** is `scripts/capture-ui-kit-previews.test.mjs` → "adds the field once, and
updates rather than duplicating on a re-run" (spec 165) — the same single failure spec 187 recorded
by name. Nothing in this change touches `scripts/`.

New tests: `sync-command.test.ts` gains 9 (the offer and the decline, the folder-derived namespace,
the conditional bare name, the Windows shapes, the exclude lines, the `CLAUDE.local.md` append rule,
the `START_HERE.md` ordering, the stop-rather-than-guess rule, and that an integrated import says
none of it). `hidden-layout.test.ts` gains the minimum-version pair and its bootstrap assertion
replaces the old "start inside the folder" one.

The `render` helper in `sync-command.test.ts` now takes an optional folder name, because every test
using the same `airrow` fixture could not tell an interpolated value from a hardcoded one — which is
precisely the bug that got written and caught (below).

### A hardcoded namespace got written, and the fixture name hid it

The first draft linked to `.claude/commands/airrow` and rendered `/airrow:sync` — a literal, not
`hiddenFolder(model)`. Every test passed, because the fixture folder is called `airrow`. It was
caught by reading, not by the suite.

Two things came out of it. The naming is now derived, and it is also *better*: the entry lands in a
directory the founder's team may open, and `.claude/commands/airrow/` would announce the tool this
mode exists to keep quiet — `/notes:sync` says nothing. And the tests now render a second folder name
(`notes`) wherever the folder appears in output, so a literal cannot pass again.

### The bootstrap sequence was not in the plan and had to be

`/sync` creates the links, so the first session cannot use them. That makes #207's route the
bootstrap rather than a fallback, and settles the open question about whether the two issues were one
piece of work: shipping this without #207 would leave a founder with a `START_HERE.md` naming a route
that only starts working after a command they cannot yet run.

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- **Moving the shipped command format to `.claude/skills/`.** Explicitly rejected here; if route A is
  ever revisited, it is a new spec.
- **The integrated layout.** Its commands are already at the repository root; there is nothing to fix.
- **Greenfield `/start`.** A new project's repository is the founder's own and the foundation sits at
  its root (spec 187's out-of-scope rule, unchanged).
- **Shipping the foundation as a plugin** (route E). The strongest long-term answer and a different
  change — it alters what `generate()` emits rather than where its output lands.
- **Anything about what `/sync` may write** beyond the two entries this spec names. Spec 214 settled
  the rest and this spec moves no line of it.
- **Concealment beyond git.** Nothing here hides the folder from an editor, a file search, a backup or
  anyone with access to the machine, and no generated document may imply otherwise.
- **Shipping `/cleanup` in hidden mode.** Still deliberately absent (spec 214); making commands
  discoverable does not make the mutating one appropriate.
