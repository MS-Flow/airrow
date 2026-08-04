# Spec 212 — Every document knows where the project came from

> **In one sentence:** A foundation generated for an existing codebase should read as though it was
> written for one — in every document, not just the four that already branch — and integrated and
> hidden should read differently where they genuinely differ.

|                |                                                                   |
| -------------- | ----------------------------------------------------------------- |
| **Status**     | 🔄 In progress                                                     |
| **Issue**      | #212 — "Every generated document is written for a project that doesn't exist yet — tailor them by origin, and by integrated vs hidden" |
| **Branch**     | `212-origin-aware-documents` (from `feature/import-existing-projects`) |
| **Feature**    | Import existing projects                                           |
| **Depends on** | [63](63-import-existing-projects.md) (import), [91](91-cleanup-command.md) (`/cleanup`), [187](187-hidden-import-integration.md) (integrated vs hidden), [199](199-import-interview-questions.md) (the import interview) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

As a **founder importing a codebase I already run**, I want **every document in the foundation to be
written about the project I have, in the layout I chose**, so that **I can trust what it says instead
of running `/cleanup` to find out which half of it was never true**.

---

## Background

- **Today:** `generate()` knows the origin (`commandFor`, `shipsCleanup`, `hiddenFolder` —
  `packages/engine/src/model.ts:283`, `:299`, `:314`) and 35 call sites in `scaffold.ts` ask. They are
  concentrated in the first-run command, `START_HERE.md`'s first step, the CI sections and the
  infrastructure walkthrough.
- **The problem:** every other document ships identical bytes to a running codebase and to an empty
  folder, and the authoring provider does not receive the origin at all
  (`apps/web/src/features/generation/author.ts:388`), so the four whole-authored documents are written
  in the future tense for a product already in production.
- **Already in place:** the seams (`shipsCleanup` / `hiddenFolder`), the layout tests
  (`hidden-layout.test.ts`), and the precedent for a per-origin branch that leaves greenfield
  untouched (spec 199's questionnaire).

**Four contradictions found while implementing, none of which the issue had listed:**

1. **`/createspec` pushes a `feature/*` branch to the team's remote** — in a layout whose whole
   promise is that the repository's diff stays empty. The founder's first spec would have created a
   remote branch everyone can see. The commands are documents that *act*, so "no document instructs a
   change outside the folder" has to cover them.
2. **`START_HERE.md` told a hidden founder that `/cleanup` "creates the local branches this workflow
   runs on"** — which hidden's `/cleanup` is forbidden from doing. The first file anyone opens,
   describing something that will not happen.
3. **`SYSTEM_OVERVIEW.md`'s template fallback asserts an architecture** for a codebase nobody read.
   The prompt now covers the authored path; the fallback is what ships when authoring is unavailable,
   and it needed the same honesty.
4. **A documents-only import would have dropped its `existingDocs` answer.** Most wording keys off
   `shipsCleanup` ("arrived with code"), and a documents-only import ships `/start` — but it is the
   one import made *entirely* of the founder's documents, so that test was exactly backwards there.
   Hence `isImport` (`model.ts:369`) beside `shipsCleanup`, with the distinction written down.

---

## Design decision

Push what is knowable at generation time into generation time. Every document that currently asserts
something only true of a greenfield repository either branches on origin, or is rewritten to a
sentence that is true in all three variants — **new**, **imported-integrated**, **imported-hidden** —
and the authoring provider is told the origin so the prose it writes describes a product that exists.

**The branch model is asked for, not assumed — and only where the answer changes something.** Hidden
promises the team's branch rules are untouched (`scaffold.ts:1412`) while shipping documents and
commands that prescribe `main ← develop ← feature/<name> ← NNN-kort`; nothing in the model carries the
project's real one. The imported interview gains a branching question, and its answer rewrites
`BRANCHING.md` **for hidden**. Integrated is unchanged: it keeps Airrow's model, which `/cleanup`
already establishes locally (`scaffold.ts:1830-1850`), because an integrated foundation is one the
founder is adopting into the repository rather than hiding beside it.

Since the answer changes hidden's output and nothing else, §0's "adaptive, never bureaucratic" puts
the question **on the hidden path only** — which spec 199 already made reachable by moving the layout
choice to the front of the interview. `/cleanup` then reconciles the foundation's documents and specs
to the branch rules it actually finds in the repository, in both layouts; where the answer and the
repository disagree, the repository wins and `/cleanup` says so.

**The authoring prompt learns the origin without splitting the cache.** `answersSection` is in the
user message and `INVARIANT_PREAMBLE` carries the cache breakpoint (`author.ts:511`), so origin and
delivery go in as data in `answersSection`, and the short instruction that changes the *voice* —
present tense, a system that already runs — goes in each call's addendum, after the breakpoint. The
preamble stays byte-identical, so new and imported projects keep warming one shared prefix.
`PROMPT_VERSION` bumps to `"12"`: the same answers now produce different prose, which is exactly what
that constant is for (`author.ts:34-39`).

**`README.md` becomes a foundation README for both import layouts** — it describes what landed and
points at `START_HERE.md` rather than presenting itself as the project's front door. That is correct
in hidden, where it is the folder's README, and honest in integrated, where it is read as
`README.airrow.md` beside a real one. Greenfield keeps today's project README.

**Not touched:** the greenfield foundation, byte for byte. `/cleanup`'s ceiling — changes no code,
deletes nothing (spec 91, §0) — and hidden's "nothing outside the folder" ceiling (spec 187). The
engine stays pure — everything here is derivable from `ProjectModel.origin` plus the one new answer.

**`/cleanup` is trimmed here, redefined elsewhere.** This spec removes only the instructions that
become redundant because the documents now generate correctly — narrowing what the command does, which
needs no amendment. The larger idea it surfaced — `/cleanup` narrowed to clearing AI slop and
structuring the project, with a new self-removing `/sync` owning the reconciliation for imported
projects — is a **separate issue and spec**, because it needs a §0 amendment on two counts: §0 says a
foundation ships *exactly one* of `/start` and `/cleanup`, and that `/cleanup` **deletes nothing**.
Neither is decided here.

**`specs/README.md` stops presenting the project's own features as a to-do list.** The imported
interview asks `capabilities` as *"What does it already do? — The capabilities that exist"*
(`questions.ts:730-733`), and `capabilitySpecs` renders that same answer under **"What to spec
first"** (`scaffold.ts:2197`). For an import the section turns around: it says what the project
already does, and that the next spec is the first *change* the founder wants — not a rebuild of what
is there. No new evidence is needed, because the answer already means this. Greenfield keeps today's
wording, where the same answer genuinely is a to-do list.

**`existingDocs` finally does something.** Spec 199 added it — `describe` | `adopt` | `leave`, asked
only in integrated (`questions.ts:763`, `index.ts:144`) — and nothing reads it: outside tests there is
no reference in `packages/engine` or `apps/web`. §0 says a question whose answer changes nothing
should not be asked, so this spec makes it change something: it decides what `CLAUDE.md` and
`docs/README.md` say about the team's existing README, ADRs and instruction files, and what
`/cleanup` proposes for them. Hidden does not ask it and does not need to — `describe` is the only
answer available there.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] A foundation generated for `origin: { kind: "new" }` is **byte-identical** to the one generated
      before this change — the whole `RepoTree`, not a sample.
- [x] The authoring provider receives the origin and the delivery layout **as data in
      `answersSection`**, with the voice instruction in each call's addendum; `INVARIANT_PREAMBLE` is
      byte-identical to before, so the cache prefix is not split. `PROMPT_VERSION` is `"12"`.
- [ ] The four authored documents (`docs/VISION.md`, `docs/architecture/SYSTEM_OVERVIEW.md`,
      `docs/README.md`, `docs/architecture/UI_ARCHITECTURE.md`) describe an imported project in the
      present tense. **Instructed, not yet observed** — the prompt now carries it and a test proves
      the instruction reaches both calls, but what the model writes can only be judged by a live
      authoring run. Left unchecked deliberately; see _Implementation notes_.
- [x] `SYSTEM_OVERVIEW.md` for an import says what it is based on — the interview answers, not the
      code — and does not assert an architecture it has not read.
- [x] `CLAUDE.md` for an import does not say "New to this project?", does not promise "the accounts
      only you can create", and does not head its product section "What we're building".
- [x] `docs/README.md` does not claim "Root keeps only `README.md`, `START_HERE.md`, and `CLAUDE.md`"
      for an imported project; in hidden mode it says which root it means.
- [x] `specs/README.md` for an import presents the capabilities as **what the project already does**,
      with the next spec framed as the first change — not as a list of things to build. Greenfield
      keeps today's "what to spec first" wording.
- [x] `existingDocs` reaches the engine and changes what `CLAUDE.md` and `docs/README.md` say about the
      team's existing documents, and what `/cleanup` proposes for them. A test proves each of
      `describe` / `adopt` / `leave` produces different output.
- [x] `START_HERE.md` §1 does not claim the verification bar proves "the foundation is working" when
      the four commands are the founder's own and may already fail.
- [x] `docs/guides/DEVELOPER_GUIDE.md` § Setup describes how an existing project is started, not a
      bare `{{CMD_DEV}}`.
- [x] The imported interview asks how the team branches today, **on the hidden path only**; the answer
      is persisted on `InterviewAnswers` (not in `TRANSIENT_ANSWERS`) and reaches `ProjectModel`, so a
      regeneration produces the same `BRANCHING.md`.
- [x] Hidden's `BRANCHING.md` is written from that answer and no longer prescribes
      `main ← develop ← feature/<name> ← NNN-kort` over a team that branches differently — so it no
      longer contradicts `repoAndCiSection`'s promise that the team's branch rules are untouched.
- [x] Integrated's branch documents are unchanged, and the greenfield questionnaire does not gain the
      question.
- [x] `/cleanup` reconciles the foundation's documents and spec files to the branch rules it finds in
      the repository, in both layouts, and says so when they disagree with the interview answer.
      Hidden gained the step (`cleanupRepoWork` §5.5); integrated already had it (§5.4, spec 91), and
      has no interview answer to disagree with because the question is hidden-only. `specs/README.md`
      was already inside `/cleanup`'s rewrite scope; existing specs stay deliberately outside it.
- [x] No document in hidden mode instructs a change to anything outside the folder — including by
      implication.
- [x] No document implies Airrow inspected, retained, migrated or restructured the founder's code.
- [x] Every document is readable end to end in all three variants; no unresolved token
      (`hasUnresolvedToken`) and no orphaned sentence in any of them.
- [x] `README.md` for an import is a foundation README pointing at `START_HERE.md`, not the project's
      front door; greenfield keeps today's project README.
- [x] `/cleanup` no longer instructs the assistant to fix a document this change now generates
      correctly, and its ceiling — changes no code, deletes nothing — is unchanged. **Nothing turned
      out to need removing**, and that is the honest result rather than a skipped step: every
      instruction in `/cleanup` is about facts only the repository holds (the real commands, the real
      branches, the founder's own files), and none of those became knowable at generation time. What
      it gained is one *check* in hidden mode, which narrows nothing and widens nothing.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New test** — `packages/engine/src/scaffold.test.ts` (or a new `origin-documents.test.ts`): a
  greenfield `RepoTree` compared against a committed golden fixture, so any accidental drift into the
  new-project path fails loudly. This is the criterion the whole spec hangs on.
- **New tests** — the three-variant sweep: for each of new / integrated / hidden, assert the
  document-level claims above by content, in the style `hidden-layout.test.ts:303` already uses.
- **New test** — `apps/web/src/features/generation/author.test.ts`: the payload carries origin and
  delivery, the addendum differs by origin, and `INVARIANT_PREAMBLE` is asserted byte-identical
  across origins so the cache prefix cannot be split by accident.
- **New tests** — `packages/schemas/src/questions.test.ts`: the branching question appears only on the
  imported-hidden path, the greenfield set is unchanged (the assertion spec 199 established), and the
  answer survives a round-trip through the schema rather than being stripped as transient.
- **New test** — the three `existingDocs` values produce three different foundations, which is what
  proves the question is no longer decorative.
- **Existing wiring** — `cleanup-command.test.ts` proves the command's scope did not widen;
  `hidden-layout.test.ts` proves the folder still contains everything and the layout still ships no CI.
- Full suite result + typecheck/lint status.

### Implementation notes

**What was built** — `greenfield-golden.test.ts` + `__fixtures__/greenfield-golden.json` (a SHA-256
per delivered file, captured from the pre-change code and normalised to LF so it is not
machine-dependent under `core.autocrlf`), `origin-documents.test.ts` (31 tests across the three
variants), and additions to `questions.test.ts` and `author.test.ts`.

The golden fixture earned itself immediately: it caught greenfield drift **three times** during
implementation — twice from token values whose line breaks did not reproduce the original bytes, once
from a token placed on its own line where the original was inline. None of the three would have been
visible by reading the diff.

**Verification, run at the end:**

- `pnpm -r typecheck` — clean.
- `pnpm -r lint` — clean, no new issues.
- `pnpm -r test` — **1,712 passed**, 0 failed (schemas 129, engine 372, web 1,211).
- `pnpm test:scripts` — 115 passed, **1 failed**: `pointing the kits at their captures > adds the
  field once, and updates rather than duplicating on a re-run`. **Pre-existing** — it fails
  identically on the unmodified tree (verified by stashing), is about `capture:ui-kits`, and is
  untouched by this spec.

**Left for `/analyze` or a live run:**

- The authored documents' *tense* is instructed and tested at the prompt boundary, not observed. A
  real authoring run against an imported project is the only way to confirm what the model writes.
- `PROMPT_VERSION` `"12"` means every imported project regenerates its prose. That is the intended
  consequence of the prompt changing, and it is what the constant is for.

---

## Exact changes (file:line)

**Schemas — the one new answer.**

1. **`packages/schemas/src/types.ts`** — `BranchingModel` (`trunk` | `integration_branch` | `other`),
   `InterviewAnswers.branchingModel` / `.branchingModelOther`, and two new `ProjectModel` fields:
   `existingDocs` and `branching` (null wherever the question was not asked).
2. **`packages/schemas/src/questions.ts`** — `branchingQuestions`, shown only for
   `deliveryLayout: hidden`, appended to `importedQuestions`; `ANSWER_MAX_CHARS.branchingModelOther`.
3. **`packages/schemas/src/index.ts`** — both fields on `interviewAnswersSchema`, kept out of
   `TRANSIENT_ANSWERS`.

**Engine — the seam and the documents.**

4. **`packages/engine/src/model.ts`** — `hiddenFolderOf(origin)` so `resolveProjectModel` can ask the
   layout while building the model it would otherwise need; `isImport` beside `shipsCleanup`, with the
   distinction between them documented; both new fields resolved.
5. **`packages/engine/src/scaffold.ts`** — the token functions: `branchVocabulary` (the one answer,
   read by six documents), `branchingSummary`, `branchModelSection`, `branchSyncSection`,
   `firstSessionIntro`, `firstSessionStepTwo`, `productHeading`, `readFirst`, `readmeTitle`,
   `readmeOrientation`, `readmeWorkflowPointer`, `docsIndexIntro`, `capabilitySpecsIntro`,
   `setupSection`, `verificationBarClaim`, `systemOverviewProvenance`, `createspecBranchStep`,
   `createspecReportLine`, `prCheckTarget`, `pushBranchGuard`, `pushReportLine`; plus the hidden
   branches in `firstStep`, `afterEachCommand` and `capabilitySpecs`, and the branch-check step in
   `cleanupRepoWork`.
6. **`template/**/*.md`** — `CLAUDE.md`, `README.md`, `docs/README.md`,
   `docs/architecture/BRANCHING.md`, `docs/architecture/SYSTEM_OVERVIEW.md`,
   `docs/guides/DEVELOPER_GUIDE.md`, `specs/README.md`, `START_HERE.md`, and the three commands
   (`createspec.md`, `pr-check.md`, `push.md`): fixed prose replaced by tokens whose greenfield value
   reproduces today's bytes exactly.

**App — the prompt.**

7. **`apps/web/src/features/generation/author.ts`** — `originAddendum` appended to both calls'
   addenda (after the cache breakpoint); `existingProject` in `answersSection`; `PROMPT_VERSION` →
   `"12"`. `INVARIANT_PREAMBLE` untouched, asserted by test.

**No change needed:** `shipsPath`, `commandFor`, `hiddenFolder`, `shipsCleanup` — the seams already
existed and were already correct. `packages/schemas/src/authoring.ts` — the document contracts did not
need to change; the origin travels in the prompt, not in the response shape.
`InterviewRuntime.tsx` — the interview is driven by `questionsFor(origin)`, so the new question
renders with no UI change, and `actions.ts` already prunes against the imported set (spec 199).

---

## Data model

**No schema changes.** The branching answer is a new field on `InterviewAnswers`
(`packages/schemas/src/types.ts`) and its Zod schema, not a new table or column — interview answers
are already stored as a blob.

It is **persisted**, not transient. `deliveryLayout` and `hiddenFolder` are in `TRANSIENT_ANSWERS`
because they have another home — `import_sources.delivery` — and two copies of one decision would
eventually disagree (`types.ts:135-140`). The branching answer has no second home, so transient would
mean a regeneration silently rewriting hidden's `BRANCHING.md` into something the founder never
chose.

---

## Security

Nothing new is reached: this changes the words in generated files, all derived from a model the
process already holds. The one thing to hold is negative — a document must not imply Airrow retained
the founder's source, because it did not (`ImportedFileDigest` keeps paths and digests only), and the
authored documents stay prose-only under the existing contract (no code fences), so a wider prompt
cannot put something runnable in front of a founder.

---

## Edge cases

- **Documents-only import** (`stackDetected` false) — gets `/start` and stays integrated
  (spec 187). It is an import whose documents must not describe code that was not found.
- **Import whose analysis found almost nothing** — the documents must degrade to "we don't know yet,
  `/cleanup` will tell you" rather than asserting.
- **Hidden folder renamed by the founder after download** — documents naming the folder are already
  `/cleanup`'s to fix (spec 187 §5); this change must not add new hard-coded folder names it cannot.
- **Custom stack + import** — no `THIRD_PARTY_NOTICES.md`, no installed theme, `uiKit` is `existing`
  (spec 199). Documents must not name a design system.
- **Hidden, and the team's branching answer is "something else" / free text** — `BRANCHING.md` must
  describe the spec loop without inventing a hierarchy it was not given, and say what `/cleanup` will
  confirm against the repository.
- **The branching answer disagrees with what `/cleanup` finds** — the repository wins, and the report
  says which document changed and why.
- **An import with no capabilities selected** — `capabilitySpecs` already has a zero-length branch
  (`scaffold.ts:2198`); its greenfield wording ("spec the core product flow first") is wrong for a
  project that has one, and needs its own import sentence.
- **`existingDocs: "adopt"` where the project's documents contradict the foundation's** — the
  documents say what was adopted; resolving the contradiction stays `/cleanup`'s, on the founder's
  machine.
- **Azure Repos import** — the provider vocabulary and the origin branch must compose, not collide.

---

## Out of scope

- **The greenfield foundation.** Untouched and tested to stay that way.
- **Reading the founder's code at generation time.** The analysis reads paths and digests; describing
  the codebase itself remains `/cleanup`'s job, on the founder's machine.
- **Widening `/cleanup`'s write scope**, in either layout. This spec only removes work from it.
- **Redefining `/cleanup`, and the new `/sync` command.** Narrowing `/cleanup` to clearing AI slop and
  structuring the project, and adding a self-removing `/sync` that reconciles the foundation with an
  imported project's existing structure, is its own issue and its own spec. It needs a §0 amendment on
  two counts — "a foundation ships exactly one of the two" and "`/cleanup` … deletes nothing" — and an
  amendment belongs in the spec that makes it, never as a criterion at the end of another.
- **The integrated branch model.** Unchanged here; `/cleanup` still establishes `develop` and the
  first `feature/<name>` locally as spec 91 defined.
- **Where a hidden session starts and what it may read** — that is #207.
- **Installing anything into an imported project.** Settled by spec 199; reversing it would take a §0
  amendment.
