# Spec 187 — Hidden integration: the foundation in one folder nobody else sees

> **In one sentence:** Let a Pro founder importing an existing project choose whether Airrow's
> foundation is **integrated** into the codebase (today's behaviour) or **hidden** — every generated
> file under a single folder named after them, ignored by git, so the team's repository is unchanged
> and the foundation lives only on their machine.

|                |                                      |
| -------------- | ------------------------------------ |
| **Status**     | 🔄 In progress                       |
| **Issue**      | [#187](https://github.com/MS-Flow/airrow/issues/187) — "Pro: hidden integration for imported projects — foundation in one gitignored folder" |
| **Branch**     | `187-hidden-import-integration` (from `feature/pro`) |
| **Feature**    | Pro                                  |
| **Depends on** | [63-import-existing-projects.md](63-import-existing-projects.md) — the import flow, the diff and `applyResolutions` · [91-cleanup-command.md](91-cleanup-command.md) — `/cleanup`, the origin on the model, and the sidecar rule this mode makes moot · [74-pro-entitlements.md](74-pro-entitlements.md) — the plan that already gates importing |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
Mark anything undecided inline with [NEEDS CLARIFICATION: …] so /clarify can find it.
-->

---

## User story

_Who wants this, and what they get out of it._

As a **developer on a team codebase I do not own alone** I want **Airrow's foundation to land in one
folder that git ignores, named after me** so that **I get the documents, rules and workflow working
for me without changing a single line my teammates will see — and if anyone asks about the ignored
folder, the honest answer is that it is my own notes, which nobody needs to pull.**

---

## Background

_Filled in during `/implement`, grounded in `file:line`._

- **Today:** an import has exactly one shape. `generate()` returns repo-relative paths — `CLAUDE.md`,
  `docs/**`, `.claude/commands/*`, `.github/workflows/ci.yml` — and the delivery lays them straight
  over the founder's tree ([`import.ts`](../packages/engine/src/import.ts), `mergeOverlay` and
  `applyResolutions`). Every collision with an existing file becomes a conflict the founder must
  decide, and an undecided markdown conflict ships beside theirs as `README.airrow.md` (spec 91).
- **The problem:** that is the right shape for a founder's own project and the wrong one for someone
  bringing Airrow into a codebase they share. Adopting it means a pull request that adds twenty-odd
  files to a repository the rest of the team did not agree to change — which is a conversation, a
  review, and often a no. The tool that would help them most is the one they cannot introduce.
- **Already in place:** importing is **already Pro** — the gate sits in
  [`import/actions.ts:130`](../apps/web/src/features/import/actions.ts#L130), after the analysis and
  before the first durable write. The origin already travels to the pure engine as data rather than
  being guessed there ([`origin.ts`](../apps/web/src/features/import/origin.ts),
  `ProjectModel.origin`), which is the precedent this spec follows for the layout. `/cleanup` already
  exists, already ships only for imports with a code signal, and already changes no application code.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

**The delivery layout is stored data on the import, not something derived at delivery time.** Same
reasoning as `uiKit` in spec 165: a founder who edits their answers must not silently cancel the
choice that decides where their files land. It travels to the engine on `ProjectModel.origin`'s
`imported` arm as a discriminated union — `{ layout: "integrated" } | { layout: "hidden"; folder }` —
never as a boolean with meaning (§I).

**Hidden mode is one pure path transform, not a second generation path.** `generate()` is untouched:
it produces the same foundation it always did, and the delivery nests every path under
`<folder>/`. Two consequences fall out for free, and they are the point:

1. **Nothing can collide.** Every generated path moves into a folder that does not exist in the
   founder's tree, so `diffAgainstExisting` finds no conflicts, `applyResolutions` has nothing to
   resolve, and the `.airrow.md` sidecar mechanic never fires. The conflict step of the import stops
   being a step.
2. **Nothing is destructive.** The founder's tree gains one directory and loses nothing.

**One folder, and the founder names it — prefilled, not decided for them.** The field arrives filled
with a slug of their account name, so the default matches the issue's "a folder named after the
user", but it is editable, because the cover story is only a cover story if the founder gets to pick
a word that fits their repository. `notes`, `scratch`, their initials — all better than
`sebastian-breuker/` sitting at the root of a shared codebase, and none of them something Airrow can
choose on their behalf. Deriving it silently would also break the moment they rename their account.

The name is concatenated into delivered paths, so it is slugified and Zod-validated as a single path
segment on the same rule as every other imported path (spec 63): no separators, no `..`, no leading
dot, never absolute, never empty.

**The ignore rule is the only thing that touches the shared repository — if it touches it at all.**
There are two ways to make git ignore the folder and they differ in exactly the thing this feature is
about:

- **`.gitignore`** — one appended line. It is a real change to a tracked file, so it *is* pushed,
  and it is the line the issue describes as plausibly deniable: a folder of somebody's own notes.
  It also means the founder's `.gitignore` is modified, which every other part of the import is
  forbidden from doing to a founder's file.
- **`.git/info/exclude`** — the same rule, per-clone, never committed and never pushed. The shared
  repository ends up with a **literally empty diff**. A ZIP cannot write into `.git/`, so this one
  has to be installed by `/cleanup` on the founder's machine — which is where `/cleanup` already
  lives and already does work of exactly this kind.

**Both, with `.git/info/exclude` as the default.** The default has to be the one that leaves the
shared repository with an empty diff — a founder who chose hidden mode chose it to change nothing,
and defaulting to a pushed line would hand them a conversation they were trying to avoid.
`/cleanup` installs it, on their machine, where it already runs.

The `.gitignore` line stays available as an explicit second step, because per-clone is genuinely
weaker: it protects this clone and no other, so a founder who works from two machines, or who would
rather the folder be ignored for everyone including teammates who create one, needs the committed
rule. `/cleanup` offers it and waits — writing to a file the team owns is a decision, and §0 says
the founder makes it.

**A nested foundation is a foundation whose tooling has to still find itself.** This is the part that
is not a path rewrite, and it is what `/cleanup` is for in hidden mode. `CLAUDE.md`, `.claude/`
and `.github/workflows/` are discovered by *location*: an assistant started at the repository root
will not see `<folder>/.claude/commands/cleanup.md`, and GitHub Actions never runs a workflow that is
neither at `.github/workflows/` nor pushed. So hidden mode has to say where the founder runs their
assistant from, and that instruction has to be true for the folder they actually got.

**Hidden mode ships no CI files.** `.github/workflows/ci.yml` and `azure-pipelines.yml` are dropped
from the delivery, not moved: a workflow inside an ignored folder can never fire and can never be
pushed, so shipping one is a file that looks like it does something and does nothing — the kind of
thing spec 66 was written to get rid of. The team's repository already has CI, and the documents say
so rather than describing a pipeline that isn't there. This is the one place hidden mode changes
*what* is delivered rather than only where it lands, and `shipsPath()` is already the function that
decides that (spec 91).

**`/cleanup` in hidden mode reads the codebase and writes only inside the folder.** Its scope in
spec 91 was already "documents, never code"; here it narrows to "documents inside the folder, never
anything outside it". Specifically, in hidden mode it does **not** create the branch model
(`develop`, `feature/<name>`) — the team has one, and inventing branches in a shared clone is exactly
the visible change this mode exists to avoid — does **not** rewrite the founder's root `CLAUDE.md`,
and does **not** report the team's `.cursorrules` or `AGENTS.md` as slop to reconsider. What it gains
is a verification job: the foundation's own files are internally consistent, the assistant can find
its commands and documents from wherever the founder runs it, the ignore rule is actually in effect
(`git check-ignore`), and nothing under the folder has leaked into the index.

**No second Pro gate.** Importing already requires Pro, so hidden mode is a choice inside a flow only
Pro reaches. Adding a second check would be a second place that decides the same thing (§IV).

**Not touched:** `generate()` and the authoring provider — the foundation's *content* is identical in
both modes. The integrated path, which stays the default and stays exactly as it is. `/start`, and
projects that began from nothing. The plan model, `checkAllowance` and `claimAllowance`.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] The import flow asks how the foundation should land — **Integrated** (default, today's
      behaviour) or **Hidden** — with the consequence of each written next to it, before anything
      durable is written.
- [x] Hidden mode is offered only when the analysis found a code signal. A documents-only import gets
      `/start` (spec 91) and is Integrated-only, because there is no team codebase to hide from and
      nothing `/start` can usefully scaffold inside an ignored folder.
- [x] Choosing Hidden reveals a folder-name field, **prefilled** with a slug of the founder's account
      name and **editable** — the founder can name it anything valid, and Airrow never overrides what
      they typed.
- [x] The choice is **stored** on the import, not derived from the answers: editing the interview and
      regenerating keeps the layout the founder picked.
- [x] The layout reaches the engine as data on `ProjectModel.origin`'s `imported` arm, as a
      discriminated union validated by Zod — never guessed inside `packages/engine`.
- [x] In hidden mode every generated file is delivered under a single top-level folder named after the
      founder, and **no** generated file is delivered anywhere else — provable by asserting on the
      delivered paths, not by inspection.
- [x] The folder name is a validated single path segment: slugified, never containing `/`, `\` or
      `..`, never absolute, never empty, and never a name that would be hidden from the founder
      themselves.
- [x] In hidden mode the diff reports **zero conflicts** by construction, and the conflict step is not
      shown; `applyResolutions` is a no-op because nothing collides. The closing note says what a
      hidden delivery actually does rather than promising `.airrow.md` files that cannot exist.
- [ ] `/cleanup` installs the ignore rule in **`.git/info/exclude`** by default, and `git status` in
      the founder's repository afterwards shows **nothing at all** — an empty diff, not a small one.
      *(Command text written and asserted; the run itself is outstanding — see Implementation notes.)*
- [ ] The committed alternative exists and is never taken silently: `/cleanup` offers the
      `.gitignore` line, explains that it is pushed and applies to everyone, and writes it only on an
      explicit yes (§0). *(Text asserted; the run is outstanding.)*
- [x] Hidden mode delivers **no** CI files — neither `.github/workflows/ci.yml` nor
      `azure-pipelines.yml` — and no delivered document describes a pipeline the founder does not
      have.
- [ ] ZIP delivery works in hidden mode with no integration connected — the constitution's standing
      requirement, unchanged by the layout. *(The route needed no change and the paths it zips are
      already nested; not yet exercised end to end in a browser.)*
- [x] A foundation delivered hidden still works as a foundation: the founder is told, in
      `START_HERE.md`, exactly where to run their assistant from so it finds `CLAUDE.md` and the
      commands — and that instruction is true for the folder they actually got.
- [x] Every path a hidden foundation's own documents reference resolves inside the delivered tree; no
      document points at a root-relative path that hidden mode moved.
- [ ] `/cleanup` in hidden mode changes **nothing** outside the folder: no file written, renamed or
      deleted outside it, no branch created, no remote touched, no history rewritten — verified by
      `git status` and `git branch` after a real run. *(The command's text forbids all of it and the
      tests assert the text; the run is the proof and is outstanding.)*
- [ ] `/cleanup` in hidden mode verifies the foundation instead of integrating it: the documents
      describe the real stack, the commands are discoverable, the ignore rule is in effect
      (`git check-ignore`), and nothing under the folder is staged or tracked. It reports what it checked and what it could not
      derive as `[NEEDS CLARIFICATION: …]`, never as a guess. *(Outstanding — same run.)*
- [x] `/cleanup` in hidden mode does not report the team's own AI instruction files, and never
      proposes deleting anything — spec 91's rule, unchanged.
- [x] Hidden mode adds no second Pro gate; the existing check at
      [`import/actions.ts:130`](../apps/web/src/features/import/actions.ts#L130) remains the only one.
- [x] Nothing about hidden mode reaches Airrow's servers beyond the stored choice and the folder name
      — no path, no file content, no confirmation that the founder is hiding anything from anyone.
- [x] `pnpm engine:smoke` covers a hidden-layout fixture beside the existing integrated import.
- [x] `CLAUDE.md`, `SYSTEM_OVERVIEW.md` and the constitution say what hidden mode is and what
      `/cleanup` may do in it, in the same change as the code (§IV).
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — `packages/engine/src/hidden-layout.test.ts` (27): the nesting transform (every path
  prefixed, exactly once, order-independent), folder-name validation including the rejected shapes
  (`a/b`, `..`, `.hidden`, `/abs`, empty), that a hidden delivery produces an empty conflict set
  against any imported tree, that `shipsPath()` drops both CI files in hidden mode and keeps them in
  integrated, and that the hidden foundation is the integrated one *moved* — same documents, same
  validation bar, one folder deeper.
- **New tests** — `apps/web/src/lib/data/import-delivery.db.test.ts` (6): the check constraint. The
  two columns are one fact, and the states that would break the delivery — `hidden` with no folder,
  `integrated` carrying one, a folder that is a path rather than a segment — are refused by Postgres,
  not only by Zod (§II, defence in depth).
- **Extended** — `packages/engine/src/import.test.ts`: `diffAgainstExisting` and `applyResolutions`
  under a hidden layout.
- **Extended** — `packages/engine/src/cleanup-command.test.ts`: the hidden variant of `/cleanup`
  renders, leaves no `{{SLOT}}`, and no hidden foundation's documents name the branch-model step or a
  root-relative path.
- **Extended** — `scripts/engine-smoke.mjs`: a hidden-layout fixture.
- **Manual run, in the spec** — import a real team codebase, choose Hidden, name the folder something
  other than the prefill, unpack the ZIP, run `/cleanup`, and show `git status` **empty**,
  `git check-ignore -v <folder>` pointing at `.git/info/exclude`, `git branch` unchanged, and an
  assistant session started per `START_HERE.md` that actually finds the commands. Then take the
  `.gitignore` offer and show that it is the only thing that ever appears in the diff. Same reasoning as specs 66 and 91: the command is
  instruction text, and the defects live in what it does, not in what the renderer writes.
- **RLS** — access and denial for whatever the _Data model_ section lands on, alongside the existing
  `import_sources` cases in `schema.rls.test.ts`.
- Full suite result + typecheck/lint status.

---

## Exact changes (file:line)

**Contracts (`packages/schemas/src/`)**

1. **`types.ts`** — `DeliveryLayout` (`{ kind: "integrated" } | { kind: "hidden"; folder }`) and the
   `delivery` field on `ProjectOrigin`'s `imported` arm. Required, not optional: the layout is a
   property every import has, and an optional field would be a third state meaning "unknown".
2. **`index.ts`** — `hiddenFolderSchema` (the single-path-segment rule) and `deliveryLayoutSchema`;
   `projectOriginSchema` carries `delivery` with `.default({ kind: "integrated" })`, so rows written
   before this spec parse into what actually happened to them.

**Engine (`packages/engine/src/`)**

3. **`model.ts`** — `hiddenFolder(m)`, the one place the layout is read; `deliveredPath(m, path)`;
   `hiddenFolderFrom(raw)`, deliberately **not** `slugify` (see _Implementation notes_).
   `resolveProjectModel` normalises an origin arriving without a layout.
4. **`import.ts`** — `nestUnder(files, model)`, beside `sidecarPath` and `applyResolutions` where the
   other delivery-shape decisions live.
5. **`scaffold.ts`** — `shipsPath()` drops both CI files in hidden mode; `firstStep()` says where to
   start a session; `cleanupScope()`, `cleanupMode()`, `cleanupRepoWork()` and `cleanupReportItems()`
   render `/cleanup`'s two shapes.
6. **`index.ts`** — `generate()` applies `nestUnder` once, before `validate()`, which now asks for its
   required list through `deliveredPath`.

**Generated output (`template/`)**

7. **`.claude/commands/cleanup.md`** — sections 4–6 replaced by `{{CLEANUP_REPO_WORK}}`, report items
   3–5 by `{{CLEANUP_REPORT_ITEMS}}`, and a `{{CLEANUP_MODE}}` in the header promises.
8. **`.airrow-template.json`** — the three new tokens.

**App (`apps/web/src/`)**

9. **`lib/data/store.ts`** — `delivery` on `ImportSourceRecord`, mapped from the two columns as one
   union; `setDeliveryLayout()`.
10. **`features/import/origin.ts`** — passes `source.delivery` through the schema; falls back to
    integrated, the mode that changes nothing.
11. **`features/import/actions.ts`** — `setDeliveryLayoutAction`, gated on `stackDetected` and
    carrying no second Pro check.
12. **`features/import/DeliveryLayoutChoice.tsx`** (new) and
    **`app/app/projects/[id]/import/page.tsx`** — the choice, with each mode's consequence written
    beside it.

**No change needed:** the ZIP route, the preview tree, `diffAgainstExisting` and `applyResolutions`.
Nesting during generation means what is stored is already what is delivered, so every stage after it
is correct without knowing the mode exists — which is the whole reason the transform sits there.

**Docs + constitution** — `CLAUDE.md`, `SYSTEM_OVERVIEW.md`, `.claude/spec-kit/constitution.md` §0.

---

## Data model

**Two new facts to store: the layout, and the folder name.** Both are properties of the import, and
`import_sources` is already the single row that records where a project came from (spec 91 chose it
for exactly this reason), so they belong there rather than in a second place on `projects` that could
disagree. A migration adds the columns with `integrated` as the default, so every existing import
keeps behaving exactly as it does now. RLS is unchanged — no new table, and `import_sources` is
already scoped through `is_project_member()`.

**The folder name is stored, not derived at delivery.** The founder typed it, which already settles
it — a value they chose is not something to recompute. It also has to survive them renaming their
account: a derived name would quietly move the folder on the next download, leaving the first one
behind on disk, still ignored, still full of a foundation nothing points at any more.

---

## Security

The folder name is concatenated into delivered paths, so it is validated as a single path segment
before it is ever used — the same untrusted-path rule spec 63 applies to imported archives. Nothing
else changes: no new external call, no new table, no new reader, and the hidden foundation's contents
never leave the founder's machine. The one thing worth naming plainly is what this feature is *not* —
it hides files from a repository, not from an employer, and it grants no access anybody did not
already have.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- **The folder name already exists at the root of the imported project** → the founder is told before
  delivery and picks another; a hidden delivery must never merge into a directory that is already
  theirs.
- **The project has no `.gitignore`** → irrelevant to the default; `.git/info/exclude` needs no file
  of the founder's. If they take the committed alternative, one is created.
- **The project has no `.git` at all** → there is no `.git/info/exclude` to write to. `/cleanup` says
  so and offers the `.gitignore` line instead; it never runs `git init` in someone else's checkout.
- **The founder works from a second clone** → `.git/info/exclude` does not travel, so the folder is
  untracked-and-visible there until `/cleanup` runs again. The command says this when it installs the
  per-clone rule, so the limitation is known rather than discovered at the wrong moment.
- **An import with no code signal** (documents only) → hidden mode is not offered; the flow shows
  Integrated only, and says why in one line rather than presenting a disabled control.
- **The founder switches Integrated → Hidden (or back) and regenerates** → the stored layout changes
  and the next delivery uses it; already-downloaded files are not reached, which is the same promise
  regeneration makes today.
- **The founder's own name slugifies to nothing** (non-Latin script, punctuation only) → a validated
  fallback, never an empty segment and never a silent `airrow`.
- **A hidden folder that has been committed anyway** (the founder staged it before the ignore landed)
  → `/cleanup` reports it, because an ignore rule does not untrack an already-tracked path, and
  says how to untrack it. It does not run the command itself — that is a change to the shared repo.
- **Monorepo** → the folder still goes at the repository root, once. One foundation, one folder.

---

## Implementation notes

### The nesting moved earlier than the spec said, and that is what made it cheap

The plan said the delivery nests the paths — which read as "at download time", where
`applyResolutions` already runs. Doing it there would have meant the stored artifact and the
delivered archive disagreeing about every path, and three separate places (the ZIP route, the preview
tree, the diff) each needing to know about the mode and each able to forget.

`nestUnder` runs **once, inside `generate()`, before `validate()`** instead. What gets stored is what
gets delivered, so the ZIP route, the preview tree, `diffAgainstExisting` and `applyResolutions`
needed **no change at all** — and "a hidden delivery has zero conflicts" stopped being a rule anybody
enforces and became a fact about where the files are. `validate()` asks for its required list through
`deliveredPath`, so a hidden foundation is held to the same completeness bar in its own folder.

### `slugify` would have silently accepted garbage

The first version normalised the founder's folder name with the existing `slugify`, whose empty case
falls back to `"project"`. That fallback is right for a project slug and wrong here: a founder who
typed punctuation would have got a folder called `project` in their team's repository — a name they
never chose and would not recognise. `hiddenFolderFrom` answers `null` instead, and the caller
decides: the action refuses, the prefill falls back to `notes`. Covered both ways in
`hidden-layout.test.ts`.

### A required field found a caller that had no types to catch it

Making `delivery` required broke `scripts/engine-smoke.mjs` at runtime — plain JavaScript, so nothing
warned it that the `Ledgerly` fixture's origin was now incomplete, and `hiddenFolder` threw on
`undefined.kind`. Fixed where the model is built rather than in the fixture: `resolveProjectModel`
normalises an imported origin with no layout to integrated, the same "the default is a fact, not a
guess" reasoning already governing `origin` itself. The fixture is deliberately left without a
`delivery` so the normalisation stays exercised.

### The CI file had to be interpolated, not tokenised

`/cleanup`'s integrated sections 4–6 moved into a TypeScript string so the two modes could be one
seam. They mention `{{CI_FILE}}` — and `substitute()` is a single pass over the template, so a token
inside a substituted value is never reached and would have shipped to the founder as
`[NEEDS CLARIFICATION: CI_FILE]`. `cleanupRepoWork` takes `ciFile` and interpolates it directly.

### `/analyze` — 2026-08-03: three findings, all fixed

The cross-check failed on its first pass. Recorded because two of the three were criteria
`/implement` had already ticked, which is the failure mode §IV exists to catch.

**1. Five documents promised a pipeline the layout does not ship.** `shipsPath` dropped
`.github/workflows/**`, but nothing touched the *prose* naming it: `START_HERE.md` said "the
workflows in `.github/workflows/` run on their own once pushed", `DEVELOPER_GUIDE.md` said "CI should
run and go green", `README.md` listed CI among what the foundation brought, `CLAUDE.md` told the
founder to wait for a CI check, and `/cleanup` §3 sent the assistant to reconcile a `ci.yml` that was
never delivered. Exactly the defect class spec 91's manual run found, and the criterion "no delivered
document describes a pipeline the founder does not have" was ticked while it was false.

Fixed by making the prose layout-aware rather than deleting it: `repoSetupSteps`, `repoAndCiSection`,
`verifyEndToEndSection`, `afterEachCommand` and the new `branchingCiSection` / `cleanupCommandsRule` /
`CI_TARGET` / `FOUNDATION_PARTS` all render a hidden variant that says what is true — the repository,
its branch rules and its pipeline are the team's, and the verification bar is commands the founder
runs by hand.

**Why the tests missed it:** `hidden-layout.test.ts` asserted the CI *files* were absent and never
that the documents stopped naming them. Three tests added, one of which walks every generated file
looking for a CI path — and a fourth asserting the integrated foundation still says all of it, so the
fix cannot silently strip prose from the mode that needs it.

**2. The conflict step still rendered in hidden mode.** The Conflicts card, the "0 conflicts" badge
and the closing paragraph were unconditional, and that paragraph told a hidden-mode founder their
undecided conflicts would arrive as `.airrow.md` — impossible when nothing collides. The card and
badges are now suppressed and the note has a hidden variant.

**3. `DeliveryLayoutChoice` hand-rolled its radios.** Raw `<input type="radio">` where
`RadioGroup`/`RadioItem` already exist in `components/ui/choice.tsx` — §III, "reuse before create".
Swapped, with `DeliveryLayoutChoice.test.tsx` (6) covering that both consequences are stated before
the founder picks and that the folder prefill stays editable.

### Verification — 2026-08-03

| Command | Result |
| --- | --- |
| `pnpm -r typecheck` | clean (3 projects) |
| `pnpm -r lint` | clean, no new issues (3 projects) |
| `pnpm -r test` | **1469 green**, 0 skipped — schemas 113, engine 335, web 1021 |
| `pnpm test:scripts` | 114 green, **1 pre-existing failure** |
| `pnpm engine:smoke` | SMOKE PASSED — 6 fixtures (Keystone Ops is the new hidden path) |
| `pnpm --filter web build` | clean |

New tests: `packages/engine/src/hidden-layout.test.ts` (30),
`apps/web/src/features/import/DeliveryLayoutChoice.test.tsx` (6) and
`apps/web/src/lib/data/import-delivery.db.test.ts` (6). The DB suites ran for real against local
Supabase — the migration was applied and **replayed clean twice**, confirming idempotency.

**One flake observed, not caused here, mechanism unknown.**
`MergedDownload > opens the file picker on the first click` failed once and has not failed since:
ten clean full runs, three isolated runs of `features/import/`, and a deliberate attempt to trip it
under six concurrent full suites. Nothing in this change touches that component or its dependencies.

An early guess that it was CPU-contention-sensitive is **not supported** — the load run failed only
the `*.db.test.ts` suites, and for an unrelated reason (see below). What the test does have is a
latent diagnostic weakness worth its own issue: it looks the file input up with
`document.querySelector(…)` and attaches through `picker?.addEventListener`, so a null lookup would
silently skip the listener and report "expected 1, got 0" with nothing pointing at why.

**Side finding, filed for its own issue, not fixed here:** running several full suites concurrently
fails ~20–70 data-layer tests. The `*.db.test.ts` files share one local Postgres and seed
deterministic fixture ids (§V requires the determinism), so concurrent runs collide on the same rows.
Harmless for one run at a time — which is how CI and everyone runs them — but it means "run the suite
twice in parallel to check for flakes" is not a technique that works in this repo.

**Still not covered by a test:** that the conflict card is suppressed in hidden mode. The import
review is an async server component and this repo has no harness for rendering one; the condition is
a single guard reviewed by inspection, the same way the rest of that page's behaviour is verified.

**The pre-existing failure** is `scripts/capture-ui-kit-previews.test.mjs` → "adds the field once, and
updates rather than duplicating on a re-run" (spec 165). Confirmed unrelated by stashing this branch's
changes and re-running: identical single failure on the clean tree. Nothing here touches that script.

**Still outstanding: the manual run.** Five acceptance criteria are unchecked because they describe
what `/cleanup` *does* in a real repository, and that has not been run. Specs 66 and 91 both found
defects there that a green suite missed — spec 91's four bugs were found by the run, not by its 90
unit tests — so these are deliberately left open rather than inferred from the command's text. What
the tests do prove is that the text says the right things and that the engine puts the files in the
right places.

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- **Hidden mode for projects started from nothing.** A new project's repository is the founder's own;
  there is nobody to hide it from, and `/start` needs the root.
- Any change to what `generate()` produces. The foundation's content is identical in both modes; only
  where it lands differs.
- Concealment beyond git: nothing here hides the folder from an editor, a file search, a backup, or
  anyone with access to the machine, and the documents must not imply otherwise.
- Delivery as a PR back to the imported repository — still blocked on the same GitHub App work as
  spec 63, and meaningless in hidden mode besides.
- Changes to `/start`, to the interview, or to the plan and entitlement model.
