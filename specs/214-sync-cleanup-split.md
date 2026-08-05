# Spec 214 — `/sync` maps the project, `/cleanup` makes it readable

> **In one sentence:** An imported project's first-run command is split in two — `/sync` maps the
> codebase and writes every document from that map, and a rebuilt `/cleanup` restructures the project
> so a human can see its shape, which means it edits the founder's code for the first time.

|                |                                      |
| -------------- | ------------------------------------ |
| **Status**     | 🔄 In progress                       |
| **Issue**      | [#214](https://github.com/MS-Flow/airrow/issues/214) — "Split the import's first-run command: /sync maps the project, /cleanup makes it readable" |
| **Branch**     | `214-sync-cleanup-split` (from `feature/import-existing-projects`) |
| **Feature**    | Import existing projects             |
| **Depends on** | [91-cleanup-command.md](91-cleanup-command.md) — today's `/cleanup`, whose sections 1–3 become `/sync` and whose ceiling this spec amends · [212-origin-aware-documents.md](212-origin-aware-documents.md) — owns the `CLEANUP_*` token functions this spec moves, and the greenfield byte-for-byte guard it reuses · [187-hidden-import-integration.md](187-hidden-import-integration.md) — integrated vs hidden, which decides whether `/cleanup` ships at all · [66-start-command.md](66-start-command.md) — `/start`, whose self-removal and verification-bar pattern `/cleanup` copies · [63-import-existing-projects.md](63-import-existing-projects.md) — the import flow and the analysis that prefills the interview · [199-import-interview-questions.md](199-import-interview-questions.md) — the interview that now asks about existing code |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
Mark anything undecided inline with [NEEDS CLARIFICATION: …] so /clarify can find it.
-->

---

## User story

_Who wants this, and what they get out of it._

As a **founder importing a project built with an AI app-builder** I want **a first session that both
maps my codebase into the foundation's documents and reorganises the codebase so its shape is
visible** so that **I end up with a project someone else could join, instead of a tidy set of
documents describing a mess**.

The second half is the point. A Lovable/Bolt/v0 export arrives with forty files at the root, three
components doing the same thing and half of them unreachable. That founder is the one who most needs
a foundation, and today's `/cleanup` — which changes no code — does nothing for them.

---

## Background

_How things work today and what's wrong with that._

- **Today:** an imported project ships exactly one first-run command,
  `template/.claude/commands/cleanup.md`. Its whole job is sections 1–3: read the project, notice what
  the documents claim, rewrite them to match. Sections 4–6 vary by layout
  (`packages/engine/src/scaffold.ts` — `integratedRepoWork`, `cleanupRepoWork`). It states its ceiling
  twice: "**It changes no code.**" (`cleanup.md:12`) and "**It deletes nothing, and it renames
  nothing.**" (`:16`), and the constitution repeats it (`.claude/spec-kit/constitution.md:42`).
- **The problem:** that command is a *sync*, not a cleanup. The word promises a project you can read,
  and nothing in Airrow builds one. Meanwhile the reading `/cleanup` does is implicit and disposable —
  nothing durable comes out of it, so a second run starts from zero and nothing downstream can tell
  whether a document was written from the repository or from the interview.
- **Already in place:** `commandFor` (`packages/engine/src/model.ts:301`), `shipsCleanup` (`:365`) and
  `hiddenFolder` (`:317`) already decide the first-run command from the origin; `FIRST_RUN_COMMANDS`
  and `shipsPath` (`scaffold.ts:498`, `:522`) already ship one command and strip the other. The seam
  exists — it just assumes "exactly one of the two", which stops being true here.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

Split the command along the line between **observing and mutating**. **`/sync`** takes today's
sections 1–3, strengthened: it produces a durable **project map** first — structure, the stack proven
from manifests and lockfiles, every `.md` already in the project, the real branch model, CI, the
conventions the code shows — and only then writes the foundation's documents from that map. It
changes no code, creates no branch, and is re-runnable forever.

**`/cleanup`** owns every repository mutation: move files with `git mv` until the structure explains
itself, update imports in the same pass, create the branch model the workflow needs, and propose the
AI slop for deletion. It stages everything and never commits. It removes itself once its verification
bar passes, exactly as `/start` does.

That line is what makes the pair explainable in one sentence each, and it is why branch creation moved
off `/sync`: a hidden import ships `/sync` alone and must never touch a branch, so a `/sync` that
creates branches would need a carve-out precisely where spec 187's promise is strictest.

**Not touched:** a greenfield foundation, which must not change by one byte — `/start` is untouched,
and the `{ kind: "new" }` `RepoTree` is asserted identical before and after. A documents-only import
still gets `/start`. Airrow's servers still write no application code: like `/start` and `/security`,
`/cleanup` runs on the founder's machine when they ask for it.

### The decisions already settled

Resolved on the issue via `/clarify`, 2026-08-05:

1. **The map persists**, as `.claude/project-map.md` — tooling state, not founder documentation.
2. **`/cleanup` stages and never commits.** The founder inspects and commits.
3. **The folder layout follows each ecosystem's own idiom**, never an Airrow house style.
4. **`/cleanup` removes itself once it succeeds**; `/sync` stays forever.
5. **An interrupted `/cleanup` resumes from where it stopped** rather than refusing a dirty tree.

And on this branch:

6. **`/sync` reads the branch model; `/cleanup` creates it.** One command observes, one mutates.
7. **No `.git`?** `/cleanup` offers `git init` and a first commit, then proceeds.
8. **The move plan is `.claude/cleanup-plan.json`**, removed when `/cleanup` removes itself.
9. **In a monorepo, every package is its own root**, plus the workspace root.

### Why the map is `.claude/`, not `docs/`

It is the input `/cleanup` consumes and the anchor a resumed run reads — machine state with an
evidence trail, not a document anyone reads for orientation. Putting it in `docs/` would have set it
against `SYSTEM_OVERVIEW.md`, which already describes this project's architecture, and the
constitution is explicit that a fact lives in exactly one file. So the map is not the founder's
overview: **the founder-facing value lands in the documents `/sync` rewrites from it**, which is the
whole point of the command.

Two consequences: it is regenerated by `/sync` rather than hand-edited, so it cannot go stale the way
a maintained document can — and there is no `.airrow.md` sibling problem, because `.claude/` is a
directory this foundation owns. In hidden mode it is `<folder>/.claude/project-map.md`, like
everything else.

### Built on spec 212

Spec 212 (origin-aware documents) merged into `feature/import-existing-projects` as
[#213](https://github.com/MS-Flow/airrow/pull/213) and is merged into this branch. It matters twice:

- It rewrote `cleanupMode`, `cleanupRepoWork`, `cleanupReportItems` and the branch-model tokens in
  `scaffold.ts` — the exact functions this spec splits between `/sync` and `/cleanup`. Every
  `file:line` below is against that merged tree.
- It shipped the greenfield guard this spec reuses rather than rebuilds:
  `packages/engine/src/greenfield-golden.test.ts` holds a SHA-256 per delivered file in
  `__fixtures__/greenfield-golden.json`, so a greenfield foundation moving by one byte fails as a diff
  of paths. **That fixture must not be regenerated by this spec** — if it goes red, the split leaked
  into the path that already worked.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

### `/sync`

- [x] An integrated import ships `template/.claude/commands/sync.md`; so does a hidden one.
- [x] `/sync` writes `.claude/project-map.md` covering: the top-level structure, the stack proven
      file-by-file, every `.md` in the project with whether it is still true, the branch model read
      from git, CI and deploy, and the conventions the code shows.
- [x] `/sync` **reads** the branch model and never creates one — not `develop`, not a `feature/*`
      branch, not `git init`. Observing is the whole of its repository interaction.
- [x] Every claim in the map names the file it came from. Anything not establishable from the
      repository is a `[NEEDS CLARIFICATION: …]` marker, never a plausible guess.
- [x] `/sync` rewrites `CLAUDE.md`, `START_HERE.md`, `README.md`, `docs/**` and `specs/README.md` from
      the map, so someone opening the repository cold can start working the Airrow way in it.
- [x] `/sync` changes no code, deletes nothing, renames nothing — today's `/cleanup` ceiling, kept.
- [x] `/sync` never removes itself, and a second run is a diff against the existing map rather than a
      redo.
- [x] `SYSTEM_OVERVIEW.md` describes the architecture and points at the map; it does not restate it.

### `/cleanup`

- [x] `/cleanup` refuses to run before `/sync` has, detecting the map's absence and offering to run
      `/sync` first rather than erroring.
- [x] It moves files with `git mv`, so history follows each one.
- [x] Imports and references are updated in the same pass; a move never leaves a broken import.
- [x] The layout it moves toward comes from the project's own ecosystem, not from
      `SYSTEM_OVERVIEW.md`'s layout. An unrecognised stack means: leave the structure alone and report
      what looked disorganised.
- [x] Framework-mandated paths never move — `app/`, `pages/`, `public/`, `supabase/`, `.github/`,
      `migrations/`, and the root configs each stack requires at the root.
- [x] The root ends up holding only what tooling requires there, plus the foundation's entry documents.
      **In a monorepo the rule applies per root** — the workspace root against its own needs
      (workspace config, lockfile, CI, shared tooling), and every package under it against its own
      ecosystem's idiom.
- [x] **`/cleanup` creates the branch model the workflow needs** — `develop`, then the first
      `feature/*`, locally and only what is missing. It finds the trunk rather than assuming `main`,
      **never renames it**, never deletes a branch, never touches a remote. (Today's spec-91 section 5,
      moved here from the command that now only reads.)
- [x] **No `.git` at all** → `/cleanup` explains that a restructure with no undo is not something it
      will do, offers `git init` plus a first commit of the project exactly as it stands, and proceeds
      only on a yes.
- [x] The verification bar is recorded before the first move and re-run after the last. Anything that
      passed before and fails after gets its move reverted and reported. Pre-existing failures are
      noted, never inherited as blame.
- [x] AI slop is **proposed per category with its evidence** and removed only on an explicit yes:
      duplicate/abandoned files, dead code with no importer, generator debris, unused dependencies.
      Files too large to maintain are reported, never split — that is a spec.
- [x] The restructure lands **staged and uncommitted**. `/cleanup` does not commit it, does not put it
      on a branch of its own, does not push, and rewrites no history.
- [x] A run on an already-tidy project moves nothing and says so.
- [x] After moving, `/cleanup` updates the paths in the documents `/sync` wrote, from its own move map
      rather than by re-analysing.
- [x] `/cleanup` rewrites `START_HERE.md`'s step 1 and then deletes its own command file — in that
      order, and only after its verification bar has actually passed. A failed or partial run leaves
      both untouched.

### Resuming

- [x] A first run requires a clean working tree. A **resumed** run does not — it reads its own staged
      state and continues.
- [x] `/cleanup` writes the whole move plan to `.claude/cleanup-plan.json` **before** applying any of
      it, marking each entry done as it goes.
- [x] A resumed run diffs the plan against the tree: what moved, what is pending, and what in the
      working tree it cannot attribute to its own plan. Anything unattributable is left untouched and
      reported.
- [x] The plan is excluded from what `/cleanup` stages, and is deleted when `/cleanup` removes itself
      — so a successful run leaves no scratch state in the founder's commit.

### Wiring

- [x] An integrated import ships **both** `/sync` and `/cleanup`; a hidden import ships `/sync` only;
      a new project and a documents-only import ship `/start` only.
- [x] `CLAUDE.md`'s first-session table and `START_HERE.md`'s step 1 name the right sequence for each
      of those four cases.
- [x] `.claude/spec-kit/constitution.md` §0 is amended in three places: `/cleanup`'s "changes no code
      and deletes nothing" ceiling (`:42`), "a foundation ships exactly one of the two" (`:43`), and
      the self-removal wording at `:34-38` that now describes two commands. The previous wording is
      recorded in this spec, per the amendment rule.
- [x] **A greenfield foundation does not change by one byte** — `greenfield-golden.test.ts` stays
      green against the existing fixture, which is not regenerated.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — `packages/engine/src/sync-command.test.ts`: `/sync` ships for every imported origin,
  and its content matches the layout.
- **Existing, extended** — `cleanup-command.test.ts` (the rebuilt command, and that hidden never ships
  it), `hidden-layout.test.ts` (hidden ships `/sync` and no `/cleanup`), `origin-documents.test.ts` and
  `scaffold.test.ts` (the first-session sequence per origin).
- **The greenfield guard** — `greenfield-golden.test.ts` and its SHA-256 fixture, inherited from spec
  212 and left as-is. Nothing to write; a red run is the finding.
- `/cleanup`'s runtime behaviour (moves, staging, resuming, self-removal) is **command prose, not our
  code** — it is verified by reading the generated command against these criteria, plus a manual run
  against a real AI-app-builder export. [NEEDS CLARIFICATION: which export we test against, and
  whether it becomes a fixture in the repo.]
- Full suite result + typecheck/lint status.

### What `/analyze` caught — 2026-08-05

**`pnpm engine:smoke` was never run during `/implement`, and it was failing.**
`scripts/engine-smoke.mjs` asserted the first-run command as a hard-coded either/or
(`cleanup` when imported, `start` otherwise), which is exactly the rule this spec replaces. The
hidden fixture — *Keystone Ops* — went red with
`missing first-run command: notes/.claude/commands/cleanup.md`, because hidden deliberately stops
shipping `/cleanup`. Nothing was wrong with the engine; the check was asserting the superseded rule.

Two things worth recording. It is **not** part of the constitution's §VI bar, which is why running
typecheck/lint/tests clean was not enough to notice — it is named in `CLAUDE.md`'s command list, and
`/implement` should run it whenever the engine's output changes. And the rewritten check is stronger
than the one it replaces: it now also fails a foundation whose documents *name* a command it did not
ship, in either direction, which is the defect class this spec had the most room to introduce.

### Implementation notes — 2026-08-05

**Verification bar, run in full:**

- `pnpm -r typecheck` — clean across all three packages.
- `pnpm -r lint` — clean, no new issues.
- `pnpm -r test` — **1752 passed, 0 failed** (schemas 129, engine 412, web 1211). Engine gained
  `sync-command.test.ts` (28) and a rewritten `cleanup-command.test.ts`.
- `pnpm test:scripts` — 115 passed, **1 pre-existing failure**:
  `capture-ui-kit-previews.test.mjs > adds the field once, and updates rather than duplicating on a
  re-run`. Confirmed pre-existing by stashing this branch's changes and re-running: it fails
  identically on a clean tree. Untouched by this spec.
- `pnpm engine:smoke` — **SMOKE PASSED**, all five fixtures including the hidden one. Red before the
  fix above; re-run green after.
- `greenfield-golden.test.ts` — green, fixture **not** regenerated. It earned its keep: the first
  version of `firstCommandLifetime` dropped the backticks the template had around
  `` `{{FIRST_COMMAND}}` ``, and the golden hash caught it as a one-file diff.

**Still open, and honestly so:** the manual run against a real AI-app-builder export has **not** been
done — the marker above is unresolved and there is no such export in the repo to run against. Every
criterion in this spec is proven by what the renderer produces, which is the right bar for command
prose but is not the same as watching `/cleanup` move somebody's files. That check belongs before
this reaches a founder.

---

## Exact changes (file:line)

_As implemented. Line numbers are against this branch._

1. **`template/.claude/commands/sync.md`** — new. Spec 91's `cleanup.md` sections 1–3, plus the map
   (`.claude/project-map.md`) as the thing section 1 produces, plus the promise that it creates no
   branch. Tokens: `SYNC_MODE`, `SYNC_CLAIM`, `SYNC_SCOPE`, `SYNC_COMMANDS_RULE`, `SYNC_REPO_WORK`,
   `SYNC_REPORT_ITEMS`, `SYNC_NEXT`.
2. **`template/.claude/commands/cleanup.md`** — rewritten end to end: the map check, the clean-tree /
   resume gate, the move plan, `git mv` plus reference updates, the verification bar before and after,
   the four slop categories, the branch model, re-pointing the documents, and the hand-back that
   removes the command. One new token, `CLEANUP_LAYOUT`.
3. **`packages/engine/src/model.ts`** — `FirstRunCommand` (`:294`), `firstRunCommands` (`:313`, the
   one place the set is decided), `firstCommand` (`:324`), `commandPaths` (`:331`). `shipsCleanup`
   (`:409`) is now genuinely "ships `/cleanup`"; the old predicate keeps its meaning under the honest
   name `hasExistingCode` (`:396`), which is what ~30 document call sites actually ask.
4. **`packages/engine/src/index.ts`** — `validate` requires **every** command the origin calls for
   (`...commandPaths(model)`), not just the first; export surface follows.
5. **`packages/engine/src/scaffold.ts`** — `FIRST_RUN_COMMANDS` (`:499`) lists all three and
   `shipsPath` (`:528`) defers to `commandPaths`. `cleanup*` token functions renamed `sync*`;
   `integratedRepoWork`'s section 5 (`:2504`) now *reads* the branch model instead of creating it.
   New: `branchCommandName` (`:1415`), `firstCommandLifetime` (`:2685`), `syncNext` (`:2714`),
   `cleanupLayout` (`:2742`). Reworked: `firstCommandEffect` (`:1487`), `afterEachCommand`'s first
   rows, `firstStep`, `commandRule` (`:1676`), `syncMode` (`:2052`).
6. **`template/CLAUDE.md`** — the "only applies while the file exists" sentence became
   `{{FIRST_COMMAND_LIFETIME}}`, because `/sync` never expires and `/cleanup` is the one that does.
   `FIRST_COMMAND_PATH` had no other reader and is gone.
7. **`template/.airrow-template.json`** — token documentation for the renames and the three new ones.
8. **`.claude/spec-kit/constitution.md:40-70`** — the amendment, plus `CLAUDE.md` and
   `docs/architecture/SYSTEM_OVERVIEW.md`, which state the same rule.
9. **`scripts/engine-smoke.mjs:219`** — the smoke test encoded spec 91's "exactly one of the two" as
   a hard-coded pair, so it failed the hidden fixture the moment `/cleanup` stopped shipping there.
   It now checks the whole set per origin, and — new — that no document names a command that was not
   delivered, in either direction. Found by `/analyze`; see the notes below.

**No change needed:** the import flow, the analysis, the interview, plan gating (import is already
Pro-only), and delivery. This spec adds no input to the engine — everything is derivable from
`ProjectModel.origin`, so the engine stays pure.

### Two decisions the code forced, that the spec had not

- **`shipsCleanup` had to be split in two.** Nearly every use of it meant "this foundation landed in
  existing code" — present tense, "what this is", the setup that already exists. Exactly that many
  uses would have become wrong the moment hidden stopped shipping `/cleanup`, and silently: the name
  would have kept reading true. `hasExistingCode` carries the old meaning to all of them, and
  `shipsCleanup` now answers only the question its name asks.
- **`/sync` writes one thing outside its own documents, and it is not code.** A hidden delivery ships
  `/sync` alone, and the `.git/info/exclude` line is what keeps the whole layout's promise (spec 187).
  Dropping it would have made hidden mode useless; leaving it unremarked would have made "changes
  nothing" quietly false. It is named in the command as the single exception, and asserted as such in
  `hidden-layout.test.ts`.

---

## Data model

**No schema changes.** Nothing here is stored: the map and the move plan live in the founder's own
repository, written by a command running on their machine.

---

## Security

`/cleanup` edits the founder's source code for the first time — but on their machine, run explicitly,
staged and never committed, with no remote, no history rewriting and no deletion without an explicit
yes. Airrow's servers still write nothing. The generated commands remain untrusted text that is
rendered, never executed by us.

---

## Edge cases

- **No `.git` at all** → offer `git init` and a first commit, then proceed. `/sync` runs unaffected
  and simply reports that there is no branch model to read.
- **The founder renamed the hidden folder** → `/sync` rewrites the documents to match the repository,
  never the other way round (the rule spec 187 already set).
- **An unrecognised stack** → no ecosystem convention to move toward; report what looked disorganised
  and move nothing.
- **A monorepo** → several roots, each tidied against its own ecosystem: the workspace root by what a
  workspace needs there, every package by its own idiom.
- **The verification bar was already red before `/cleanup` ran** → recorded as pre-existing; moves are
  judged on what changed, not on the absolute result.
- **`/cleanup` run twice on a tidy project** → moves nothing, and still removes itself if it had not
  already.
- **The founder discards the staged changeset** → the moves and `/cleanup`'s own deletion are all
  staged together, so discarding returns both. Worth an explicit test.

---

## Out of scope

- **Splitting oversized files.** Reported, never done — that is a `/createspec`.
- **A hidden `/cleanup`.** Restructuring the team's repository is the largest possible violation of
  hidden mode's promise that nothing outside the folder changes. Hidden ships `/sync` only, which also
  resolves half of [#207](https://github.com/MS-Flow/airrow/issues/207) by construction.
- **Changing dependencies, configs or migrations.** `/cleanup` moves and deletes; it does not upgrade,
  install or rewrite behaviour.
- **Anything on Airrow's servers.** No new generation-time analysis of the founder's code — the engine
  keeps paths and digests only.
