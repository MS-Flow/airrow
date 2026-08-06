# Spec 217 — `/cleanup` makes a generated project inheritable, not just tidy

> **In one sentence:** `/cleanup` currently only moves files, so on a Lovable/v0/Bolt export — already
> structurally correct — it finds nothing and hands back an all-clear on a project that cannot build
> without a vendor's package; this spec makes it also *report* what the project is still tied to, what
> is load-bearing, and where to start reading — and makes shipping it at all the founder's own answer,
> because a command that moves someone's files should never arrive unasked.

|                |                                                                              |
| -------------- | ---------------------------------------------------------------------------- |
| **Status**     | 🔄 In progress                                                               |
| **Issue**      | #217 — "/cleanup: make a generated project genuinely inheritable, not just tidy" |
| **Branch**     | `217-cleanup-inheritable` (from `feature/import-existing-projects`)           |
| **Feature**    | Import existing projects                                                     |
| **Depends on** | [214](214-sync-cleanup-split.md) (the `/sync` + `/cleanup` split), [212](212-origin-aware-documents.md), [187](187-hidden-import-integration.md) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

As a **founder importing an app-builder export** I want **`/cleanup` to tell me what my project is
still tied to, what is load-bearing, and where a newcomer should start reading** so that **the report
is a verdict on whether anyone else could take this project over — not just a note that no files
needed moving**.

And as the **next developer or agent on that project**, I want the map to say where execution begins
and what breaks easily, so that my first change is not a guess.

And as a **founder who does not want their tree touched**, I want to be asked during the interview
whether Airrow may restructure the project at all, so that **the command that moves my files only
exists because I said yes** — not because I imported a project.

---

## Background

_Filled in during `/implement` with `file:line` links._

- **Today:** [template/.claude/commands/cleanup.md](../template/.claude/commands/cleanup.md) is
  entirely about file placement — plan moves (§2), apply them (§3), propose what nothing uses (§4),
  create branches (§5), repoint documents (§6), report and self-delete (§7). The target layout comes
  from `cleanupLayout()` in [packages/engine/src/scaffold.ts:2863](../packages/engine/src/scaffold.ts#L2863).
- **The problem:** a scaffolded export is already structurally correct, so every one of those sections
  is a no-op, and the report reads as an all-clear. Nothing in the command ever looks at a config
  import, a telemetry module, the manifest's name, or what a build preset resolves — the things that
  actually decide whether the project stands alone.
- **Already in place:** `/sync` writes `.claude/project-map.md`, which §1 requires before this command
  will run; `.claude/cleanup-plan.json` already carries per-entry state for resuming; §3 already has a
  baseline-and-revert rule this spec reuses per finding.
- **And nobody is asked.** An integrated import ships `/cleanup` unconditionally —
  `firstRunCommands` at [packages/engine/src/model.ts:313](../packages/engine/src/model.ts#L313)
  returns `["sync", "cleanup"]` for every project with code that is not hidden — and `START_HERE.md`
  tells the founder to run it. The only way to get an import without it today is to hide the whole
  foundation, which is a different decision entirely. A founder who wants the documents but not a
  restructure has no way to say so.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

`/cleanup` gains a **provenance section that reports and never removes**, run before the moves are
planned, and an **orientation section** appended to `.claude/project-map.md` after them. Everything
added is analysis, reporting, or stricter handling of work the command already does — the
constitutional ceiling is untouched: it moves rather than rewrites, deletes nothing without an
explicit yes, changes behaviour nowhere, stages without committing, and touches no remote.
De-vendoring itself changes behaviour, so the command hands off a paste-ready `/createspec` line
instead of doing it.

**The orientation section is part of the map's contract, not just `/cleanup`'s output.** The map is
`/sync`'s output and `/sync` regenerates it wholesale, so a section only `/cleanup` knows about
disappears the next time the founder syncs. `/sync` therefore writes it too, from the tree as it
stands; `/cleanup` rewrites it after the moves, exactly as it already repoints the rest of the map in
§6. That is the one place this spec reaches into `/sync`, and it reaches no further: no new reading,
no new document, and `/sync` still creates no branch and changes no code.

**Shipping `/cleanup` becomes an answer, not a consequence.** The interview asks an imported project
with code, landing integrated, whether Airrow may restructure it — asked outright, with restructuring
as the **recommended** answer, because the founder who most needs it is the one who least expects to
be offered it. A no ships `/sync` alone: the documents still get written, the map still gets built,
and no file of theirs ever moves. The decision is one condition inside `firstRunCommands`
([model.ts:313](../packages/engine/src/model.ts#L313)) — the single place the command set is decided —
so nothing downstream learns a new concept: the documents already know how to describe a set of one,
because hidden has shipped one since spec 214.

**The answer is stored, never re-derived.** It is an ordinary persisted answer, like `uiKit`
([types.ts:135](../packages/schemas/src/types.ts#L135)) and unlike `deliveryLayout` — those two are
transient only because `import_sources.delivery` is the durable record of *how the foundation lands*,
and this is not that. Nothing about it is visible to the founder's team, and it must not be inferred
from any other answer: editing the interview prose must never silently switch a restructure back on.

**Not touched:** a **hidden** foundation (it ships no `/cleanup` at all, spec 214, so the question is
never asked there), the constitution's own verification bar, and `/cleanup`'s self-deletion rule — it
still removes itself once its verification bar passes.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] **Provenance section.** `/cleanup` gains a section, before the moves are planned, that answers
      four questions with file evidence and removes nothing: (a) does the build depend on a vendor
      preset or wrapper — unpacked, with what it provides and what the project already depends on
      directly; (b) does anything phone home, and is it inert in production or genuinely active —
      reported as two different findings, never one; (c) do the manifest name, the name the app shows
      a user and the name in the documents agree; (d) what arrived via the vendor but is good on its
      own merit, named explicitly as **KEEP**.
- [x] **Never judge a file by its name or comments.** The section states that attribution comes from
      reading the file, and that security middleware is kept unless the framework provably covers it.
- [x] **Paste-ready handoff.** The report ends with the full `/createspec` line that would start the
      de-vendoring work, plus one sentence naming the capability it would cost (editor sync, preview,
      generated-code updates).
- [x] **Unused dependencies cannot cause damage.** No package is proposed for removal without stated
      evidence across source, config files, and transitive resolution through a build preset or
      plugin; a package imported only by files already proposed for removal is reported as conditional
      on that removal, not independently dead.
- [x] **The layout is stack-driven.** No framework's directory conventions are hardcoded in the
      command text; the layout comes from the project map's stack, keeping three stack-independent
      rules (the router's directory holds routes and nothing else; code with no UI lives apart from
      code with UI; tests sit beside what they cover, matching the runner's glob) and the existing
      unrecognised-stack escape hatch.
- [x] **Missing toolchain stops for a question.** The declared package manager is confirmed installed
      before a baseline is recorded; a substitute is never silent — recorded in the plan and the
      report, its lockfile named and left untracked — and declining leaves the bar unrunnable and
      **moves nothing**.
- [x] **Staging is precise.** Staging is per planned path, never `git add -A`; the staged set is
      diffed against the plan before finishing and anything unaccounted for is unstaged; a tracked
      generated file refreshed by the baseline run is restored and reported as stale, never staged.
- [x] **Orientation for whoever comes next.** `.claude/project-map.md` gains a section derived from
      the code — entry points in order, the critical path, load-bearing and easy to break, safe to
      change first, and four to six files to read in order. `/sync` writes it when it builds the map;
      `/cleanup` rewrites it after the moves, so a later `/sync` cannot silently drop it.
- [x] **The plan carries the audit.** `.claude/cleanup-plan.json` records the provenance findings, so
      a run interrupted after the moves still reports what it found without re-reading the project.
- [x] **A clean result is legible as a result.** A zero-move run enumerates what was checked and found
      already correct, so "clean" is distinguishable from "not examined".
- [x] **The verification bar is reported as a finding.** The report names where the bar CI or the
      constitution claims differs from what the project can actually run, which checks do not exist,
      and the pre-existing failure count.
- [x] **The interview asks.** An imported project with code, landing integrated, is asked outright
      whether Airrow may restructure and de-slop it, with restructuring recommended. The question is
      not asked for a hidden delivery, for an import with no code, or for a greenfield project —
      none of them can act on the answer.
- [x] **The answer decides the set.** Yes ships `/sync` + `/cleanup`; no ships `/sync` alone, and no
      generated document names, links to, or tells the founder to run a command that is not there.
- [x] **The answer is stored and never inferred** — a persisted answer read by `firstRunCommands`,
      not re-derived from prose or from the delivery layout.
- [x] Hidden foundations still ship no `/cleanup`, and nothing here changes that.
- [x] Tests in [packages/engine/src/cleanup-command.test.ts](../packages/engine/src/cleanup-command.test.ts)
      cover the above as the existing sections are covered — rendered for an imported project, no
      unrendered `{{PLACEHOLDER}}` left, prose assertions per rule.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — `packages/engine/src/cleanup-command.test.ts`: the provenance section renders for an
  imported project with all four questions; the KEEP tier and the "read the file" rule appear
  verbatim; the `/createspec` handoff line renders complete; the dependency-evidence prohibition
  appears; no framework directory names appear in the rendered layout for a stack the model did not
  choose; the package-manager gate and the precise-staging rule appear; a hidden model still ships no
  `/cleanup`.
- **New tests** — `packages/engine/src/sync-command.test.ts`: `/sync` writes the orientation section
  into the map, for both integrated and hidden imports.
- **New tests** — `packages/schemas/src/questions.test.ts`: the question is asked only for an
  integrated import with code, is required, recommends restructuring, and is **not** in
  `TRANSIENT_ANSWERS`.
- **New tests** — `packages/engine/src/cleanup-command.test.ts`: declining ships `/sync` alone and no
  document mentions `/cleanup`; accepting ships both, in that order. The existing set assertion at
  [:132](../packages/engine/src/cleanup-command.test.ts#L132) already compares what is generated
  against `commandPaths`, so it extends rather than duplicates.
- **No golden fixture to regenerate.** `packages/engine/src/__fixtures__/greenfield-golden.json` is
  greenfield only and ships `/start`, not `/cleanup` — no `cleanup.md` in it, so nothing there moves.

**Result, 2026-08-06.** 21 tests added or rewritten across four files; every criterion above is
covered by one of them.

| Check | Result |
| --- | --- |
| `pnpm -r typecheck` | Clean — schemas, engine, web |
| `pnpm -r lint` | Clean — no new issues |
| `pnpm -r test` | **1788 passed**, 0 failed — schemas 132, engine 445, web 1211 |
| `pnpm test:scripts` | 115 passed, **1 failed — pre-existing**: `capture-ui-kit-previews.test.mjs > adds the field once…`. Verified by stashing this branch's changes and re-running: it fails on a clean tree too. Untouched by this spec. |
| `pnpm engine:smoke` | SMOKE PASSED — four fixtures, manifest and personalization ok |

Three tests changed rather than being added, and each one was asserting something this spec
deliberately replaced: the layout test asserted the hardcoded `"The conventions below are Next.js's
own"`, the tidy-project test asserted the old bare hand-back, and two section-number assertions moved
from `## 5` to `## 6` because the provenance section took slot 2.

**Found by generating a foundation and reading it — not by the tests.** `START_HERE.md` picked its
first-session prose on `shipsCleanup`, and that branch's false arm was written for *hidden*: it talks
about "this folder" and links `<folder>/.claude/commands/sync.md`. Spec 217 pulled those two questions
apart, so a declined **integrated** import — which has no folder — rendered
``read `null/.claude/commands/sync.md` `` and a paragraph about a directory it does not have. The
branch now asks `hiddenFolder(model) === null` first and declined-integrated gets prose of its own;
the regression test asserts no delivered file contains `null/` or hidden's sentence. The deploy step
was saying "the `develop` branch" twice in one sentence for the same reason, and now reads once.

---

## Exact changes (file:line)

_As built._

1. **`template/.claude/commands/cleanup.md`** — the new §2, *What this project is still tied to*, with
   the four questions, the read-the-file rule and the keep tier; §1 gains the package-manager gate and
   "the bar itself is a finding"; §3's plan carries the findings; §4 stages per planned path and
   restores a refreshed generated file; §5's dependency category gains the evidence rule; §7 rewrites
   the map's Orientation section; §8 reports the findings and ends with the paste-ready `/createspec`
   line and the capability it costs; the zero-move ending enumerates. Sections 2–7 shifted by one.
2. **`template/.claude/commands/sync.md`** — §1 ends the map with an `## Orientation` section, so a
   later sync cannot drop what `/cleanup` wrote there, and a hidden foundation gets one too.
3. **`packages/engine/src/scaffold.ts`** — `cleanupLayout()` loses its Next.js / Vite-React directory
   lists for the project map's stack plus the three stack-independent rules. **And a consequence the
   spec did not foresee:** with `/cleanup` optional, an integrated import can have *no* branch-making
   command, so every document that credited one had to stop. `developBranchClause()` and
   `branchOwner()` are the two new helpers; they replace `branchCommandName()` and are read by the
   git-integration steps, `deploySteps`, `syncMode`, `integratedRepoWork` (now taking the model) and
   `syncReportItems`. A declined foundation tells the founder to run `git branch develop` instead of
   naming a file it never shipped.
4. **`packages/schemas/src/questions.ts`** — `restructureQuestion`, shown only when
   `deliveryLayout` is integrated, and `questionsFor` drops it for an import that arrived without
   code. Deliberately **not** in `TRANSIENT_ANSWERS`. **`types.ts`** gains `RestructureChoice`, the
   answer and the resolved `ProjectModel` field; **`index.ts`** the Zod enum.
5. **`packages/engine/src/model.ts`** — `firstRunCommands` returns `["sync"]` when the founder
   declined; `resolveProjectModel` defaults every other project to `restructure`, which is what they
   already got. Everything downstream (`commandPaths`, `firstCommand`, `shipsCleanup`, `shipsPath`)
   follows without a change.
6. **Tests** — `cleanup-command.test.ts` (the audit, the gates, the declined set, the layout),
   `sync-command.test.ts` (the orientation section), `questions.test.ts` (the question and its
   persistence), `hidden-layout.test.ts` and `InterviewRuntime.test.tsx` (section number, and the
   imported fixture now answering the new required question — factored into `IMPORT_ANSWERED` rather
   than repeated three times).
7. **`.claude/spec-kit/constitution.md`** and **`CLAUDE.md`** — §0's `/cleanup` paragraph gains the
   reporting duty and the founder's answer, recording the previous wording as every amendment there
   does.
8. **The hidden bootstrap line reads as two commands** — `cd <folder>; claude --add-dir ..` rather
   than `&&`, in `START_HERE.md` and the two other places that name it (`/sync`'s "if you cannot reach
   the project" and its report), plus the three canonical documents that quote it. `&&` reads as a
   conditional chain, which this is not — it is one `cd` and then one launch — and it is a **parse
   error in Windows PowerShell 5.1**, the shell a founder on Windows most likely has open. The folder
   is the one the founder named, interpolated as it always was; nothing here hardcodes a name.
9. **App copy that named the wrong command** — `features/chat/knowledge.ts`,
   `features/generation/author.ts`, `features/import/DeliveryLayoutSummary.tsx` and the import review
   page still told founders `/cleanup` reads the code and writes the `.git/info/exclude` line. That is
   `/sync`'s work since spec 214, and this spec made the sentences wrong twice over by making
   `/cleanup` optional. Corrected in the same change.

**No change needed:** the interview UI — questions are data, and `showIf` already gates one question
on another's answer. The hidden layout and CI are untouched.

---

## Data model

**No migration, and no new column.** The one new stored value is an interview answer, and answers
already live together in the project's existing answers blob — validated at the boundary by
`interviewAnswersSchema` like every other one, and reaching Postgres through the same RLS-scoped write
(`saveInterviewAnswers`). Nothing new is readable by anyone who could not already read that project's
answers. Everything else here is generated-template content plus the engine that renders it.

---

## Security

Nothing security-relevant is opened up: the command gains reporting, and the one security-shaped rule
it adds is protective — security middleware that arrived via a vendor is named KEEP so a founder
following a de-vendoring plan does not delete it. Telemetry findings are reported to the founder on
their own machine and sent nowhere.

---

## Edge cases

- **A vendor preset that genuinely provides something the project does not depend on directly** → the
  difference is the true cost of leaving, reported as such; nothing is proposed.
- **Telemetry that is active in production** → reported as active, not as leftovers, and never grouped
  with branding.
- **Declared package manager missing and the founder declines a substitute** → bar recorded as
  unrunnable, nothing moves.
- **The baseline run refreshes a tracked generated file** → restored to its committed state, reported
  as a stale commit, never staged.
- **Stack the project map does not identify** → move nothing, report — the existing escape hatch.
- **Project map missing** → unchanged: offer `/sync` and stop (§1).
- **Run interrupted after the moves** → the plan's recorded findings carry the report; the audit is
  not repeated.
- **A map written by an older `/sync` with no orientation section** → `/cleanup` writes it rather than
  failing to find it.
- **Founder declines the restructure** → `/sync` ships alone: documents written, map built, nothing
  moved and nothing proposed for deletion. The documents describe a one-command first session, the
  shape hidden has shipped since spec 214.
- **Founder switches from integrated to hidden after answering** → the question stops being shown and
  `pruneHiddenAnswers` drops the answer with it, exactly as it does for `existingDocs`. Nothing is
  left behind to act on a delivery it was never asked about, and hidden ships no `/cleanup` regardless.
- **An import whose analysis found no code** → the question is not in that project's set at all; it
  gets `/start`, and there is nothing to restructure.
- **An interview answered before this question existed** → resolves to `restructure`, which is what
  that foundation already shipped. A regeneration cannot silently take `/cleanup` away.
- **An integrated import that declined, reaching a document that named the branch-making command** →
  no command made the branches, so the documents say so and name `git branch develop`. Nothing points
  at a file that was not delivered.

---

## Out of scope

- **Actually removing vendor coupling.** It changes behaviour; this spec only requires `/cleanup` to
  find it, report it, and hand off precisely.
- **Any widening of `/cleanup`'s ceiling** — still moves rather than rewrites, deletes nothing without
  a yes, stages without committing, no remote.
- **The constitution's verification bar** — related, worth its own issue, not this one.
- **Hidden foundations** — they ship no `/cleanup` (spec 214). The orientation section reaches them
  only through `/sync`'s map, which stays inside the hidden folder like everything else it writes.
- **Retaining `/cleanup` when a live app-builder connection exists** (issue item 10) — dropped in
  `/clarify`. Self-deletion stays exactly as it is: once the verification bar passes, the command
  removes itself. A project that keeps receiving generated code is a real case, and it is its own
  issue.
