# Spec 199 — The interview asks an imported project about the code it already has

> **In one sentence:** An imported project answers the same questions as one that does not exist yet,
> so a founder with a running codebase is asked to *decide* a stack, a data model and a look their
> own code already settled — when the interview should be asking them to confirm what is there.

|                |                                      |
| -------------- | ------------------------------------ |
| **Status**     | 🔄 In progress                       |
| **Issue**      | [#199](https://github.com/MS-Flow/airrow/issues/199) — "Interview: ask an imported project about the code it already has" |
| **Branch**     | `199-import-interview-questions` (from `feature/import-existing-projects`) |
| **Feature**    | Import existing projects             |
| **Depends on** | [187-hidden-import-integration.md](187-hidden-import-integration.md) — the integrated/hidden choice this spec moves to the front · [63-import-existing-projects.md](63-import-existing-projects.md) — importing, and the analysis that prefills answers · [91-cleanup-command.md](91-cleanup-command.md) — `/cleanup`, which changes no code · [165-installable-ui-directions.md](165-installable-ui-directions.md) — owns the design question and what a picked direction installs |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
Mark anything undecided inline with [NEEDS CLARIFICATION: …] so /clarify can find it.
-->

---

## User story

_Who wants this, and what they get out of it._

As a **developer importing a codebase that already runs** I want **an interview that asks about the
project I have, offering what my own code already says as the answer** so that **I confirm and
correct instead of re-deciding, and the foundation describes my project rather than one I might have
built.**

---

## Background

_Filled in during `/implement`, grounded in `file:line`._

- **Today:** the question set is one list with no notion of origin
  (`packages/schemas/src/questions.ts`). The only import-awareness anywhere is that the analysis
  *prefills* answers and records why — `ImportAnalysis.answers` and `ImportEvidence`
  (`packages/schemas/src/types.ts:321-342`), where evidence carries strings like
  `package.json → dependencies.next`.
- **The problem:** prefilling a question written for a greenfield product does not make it the right
  question. "How should it look and feel?" shows five specimens to a founder whose app already has a
  visual language; "How is your data organized and isolated?" asks them to choose a strategy their
  schema already implements. The wording says *decide*, when for this founder the honest ask is
  *confirm*.
- **Already in place:** origin is resolved for the engine
  (`apps/web/src/features/import/origin.ts`), and it already carries what this spec needs —
  `stackDetected` and the chosen `delivery`. The integrated/hidden choice exists and is stored, on
  the import review screen (`apps/web/src/features/import/DeliveryLayoutChoice.tsx`, spec 187).

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

**A second phrasing of the interview, selected by origin — never a second interview.** Both paths
produce the same `InterviewAnswers`, so the engine, the authoring provider and every document
contract stay unaware that two phrasings exist. What changes is which questions are asked, in what
order, and how they are worded.

**How it lands is question one.** Integrated or hidden is the only answer that changes what the
founder's team sees, and someone who needs hidden should learn it is on offer before spending ten
minutes on anything else. It **moves** to the front of the interview rather than being duplicated
there — the import review screen shows the stored answer read-only, so there is one writer and one
stored value. Everything spec 187 settled travels with it: stored on `import_sources.delivery` and
never re-derived, folder name validated as a single path segment, no CI in hidden, and offered only
when the analysis found code. Changing it later is always allowed and never costs an answer.

**A picked direction is described, never installed.** An imported project already installs nothing
(spec 165), and `/cleanup` changes no code — so for an import the design question decides what
`UI_ARCHITECTURE.md` *says*, not what lands in the founder's dependencies. Keeping the existing look
is a stored value of `uiKit`, so editing the prose cannot cancel the decision.

**Everywhere else: what the codebase says is the first option, with its evidence beside it.** One
click to agree, and disagreeing never costs more than it does today.

**Not touched:** the **greenfield questionnaire**. Same questions, same wording, same order, proven
by a test rather than by reading. Also untouched: the `InterviewAnswers` contract, the analysis
itself, and the authoring provider.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] The question set an imported project sees is selected by **origin**, and the set a new project
      sees is **unchanged** — same questions, same wording, same order.
- [x] Both phrasings produce the same `InterviewAnswers` shape; nothing downstream of the interview
      learns that two exist.
- [x] The **first question for an import is integrated or hidden**, carrying spec 187's rules: the
      choice is stored on `import_sources.delivery`, the folder name is validated as a single path
      segment, and hidden is offered **only** when `stackDetected` is true.
- [x] The choice is **asked once**: it **moves** to the interview, and the import review screen shows
      the stored answer read-only with a way back to change it. One writer, one stored value.
- [x] Switching integrated ↔ hidden mid-interview is **always allowed**, warns what changes, and
      **keeps every answer already given**; questions the new mode makes meaningless drop out of the
      summary rather than being discarded.
- [x] The **design question asks whether to keep the look that is already there**, defaulting to yes.
      The curated directions appear only when the founder says no.
- [x] Keeping the existing look is **stored as a discrete value of `uiKit`**, not derived from prose
      or from an empty field — so editing the words cannot silently change the decision (spec 165).
- [x] A direction picked by an imported project is **described, never installed**:
      `UI_ARCHITECTURE.md` names the look, nothing is added to the founder's dependencies, and no
      `THIRD_PARTY_NOTICES.md` ships.
- [ ] Questions whose answer the analysis derived show the **detected value as the first option, with
      its evidence** (`ImportEvidence.source`), and can be accepted in one click.
- [x] Stack questions (`framework`, `database`, `hosting`, `repoProvider`) read as confirmation of
      what was found, not as a fresh choice.
- [x] Product questions ask what the project **already does** before what it should do next, and
      offer entities derived from the codebase rather than an empty field.
- [x] The interview asks what to do about **documents and conventions that already exist** (README,
      ADRs, an existing `CLAUDE.md` or equivalent): describe them, adopt them, or leave them alone.
- [x] In **hidden** mode, no question implies anything outside the founder's folder will change —
      because nothing may.
- [x] No question implies Airrow will **convert, migrate, restructure or rewrite** the project, or
      that it retained the source it analysed.
- [ ] The screen looks like the rest of the product: detected answers get a real treatment, reusing
      `components/ui` before anything new (§III), and the number of questions visibly shrinks as the
      analysis answers them.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — `packages/schemas/src/questions.test.ts`: the greenfield set is unchanged (a
  snapshot or deep-equality assertion is what makes "unchanged" hold for anyone editing later); the
  imported set leads with the delivery question; hidden is absent from the options when
  `stackDetected` is false; both phrasings satisfy the same answers contract.
- **New tests** — `apps/web/src/features/interview/InterviewRuntime.test.tsx`: the design question
  shows no curated directions until the founder declines the existing look; keeping the look is
  recorded on `uiKit` and survives a rewrite of the prose (the assertion spec 165 made for a picked
  direction, now for its opposite); a detected answer shows its evidence and is accepted in one
  click; switching integrated ↔ hidden mid-interview warns and keeps every answer already given.
- **New test** — an imported project that picks a direction installs nothing: no install command and
  no `THIRD_PARTY_NOTICES.md` in the generated tree. The engine already draws this line for imports;
  the test is what keeps the new question from crossing it.
- **Existing, must stay green** — `apps/web/src/features/import/DeliveryLayoutChoice.test.tsx` and
  the import delivery tests, since the choice they cover is what moves.
- **Manual check, in the spec** — one imported project taken end to end in each mode, at desktop and
  phone width.
- Full suite result + typecheck/lint status.

### Implementation notes (2026-08-03) — pass 1 of 2, the pure layer

**What shipped.** The question set, in `packages/schemas` — pure data, no app dependency, and the
place where "asks the wrong questions" actually lives. `interviewQuestions` is untouched and is now
explicitly the greenfield set; `importedQuestions` is **derived** from it so a question added later
reaches both phrasings and cannot be forgotten in one; `questionsFor(origin)` is the single place
that decides. The five evaluators take the set as an optional argument defaulting to the greenfield
one, so all fourteen existing callers keep their behaviour byte for byte and only the import path
will pass something else. `KEEP_EXISTING_UI` is a value of `uiKit` that `uiKitFor` resolves to
`null` — which is how "described, never installed" holds everywhere without a single extra branch.

**Verification run**

| Command | Result |
| --- | --- |
| `pnpm -r typecheck` | clean (3 projects) |
| `pnpm -r lint` | clean, no new issues |
| `pnpm -r test` | 1544 passed, 0 failed (schemas 122 / engine 335 / web 1087) |
| `pnpm --filter @airrow/schemas test` | 122 passed, up from 113 — 9 new |
| `pnpm test:scripts` | **1 pre-existing failure**, unchanged and unrelated: `scripts/capture-ui-kit-previews.test.mjs > adds the field once, and updates rather than duplicating on a re-run` (spec 165 tooling) |

### Implementation notes (2026-08-03) — pass 2, the wiring

An imported project now meets the imported interview: origin decides the set, how the foundation
lands is the first question, and the design question opens on keeping the look that is already there.

**Verification run**

| Command | Result |
| --- | --- |
| `pnpm -r typecheck` | clean (3 projects) |
| `pnpm -r lint` | clean, no new issues |
| `pnpm -r test` | **1549 passed, 0 failed** (schemas 122 / engine 335 / web 1092) |
| `pnpm --filter web test InterviewRuntime` | 20 passed, up from 15 — 5 new |
| `pnpm test:scripts` | **1 pre-existing failure**, unchanged and unrelated: `capture-ui-kit-previews.test.mjs` (spec 165 tooling) |

One small refactor came with the tests rather than as a change of its own: the complete answer set
the runtime tests seed from was inline in one helper and is now the shared `ANSWERED` const, because
the imported tests need the same thing and a second copy would drift from the first.

### Implementation notes (2026-08-03) — pass 3, one writer and the question content

**One writer, at last.** `DeliveryLayoutChoice` and `setDeliveryLayoutAction` are **deleted**, not
left beside the interview: two writers to one column was the thing worth removing, and keeping a
second form that happened to agree would only have deferred the disagreement. In their place
`DeliveryLayoutSummary` reports the stored answer, says the two things a label cannot (no CI in
hidden, integrated is what the team sees) and links back to the interview. The rules the deleted
action carried were not deleted with it — `hiddenFolderFrom`, `deliveryLayoutSchema` and the
`stackDetected` refusal all live in the write-through.

**The wording.** `IMPORT_WORDING` is a table of differences rather than a second set written out in
full, so everything not named in it stays word for word the greenfield question and the two phrasings
cannot drift into two interviews. The shape of every change is the same: *decide* becomes *confirm*.

**`existingDocs`** is the one genuinely new question, and it is asked **only when the foundation
lands integrated** — a hidden one may change nothing outside its folder, so `describe` would be the
only answer available, and a question with one answer is a sentence pretending to be one (§0). That
is also how the hidden-mode criterion is satisfied structurally rather than by careful wording.

**Verification run**

| Command | Result |
| --- | --- |
| `pnpm -r typecheck` | clean (3 projects) |
| `pnpm -r lint` | clean, no new issues |
| `pnpm -r test` | **1554 passed, 0 failed** (schemas 126 / engine 338 / web 1090) |
| `pnpm test:scripts` | **1 pre-existing failure**, unchanged: `capture-ui-kit-previews.test.mjs` (spec 165 tooling) |

Adding a required question broke three of the imported runtime tests, which is the seeding working as
intended: their answer set was no longer complete, so the interview no longer opened on review. The
seeds now answer it.

**Still open — one piece, and it is a screen rather than a rule**

- **Evidence-first options, and the craft that goes with them.** `ImportEvidence.source` already
  carries strings like `package.json → dependencies.next`, and the analysis already prefills the
  answers it derived — but the interview does not yet *show* the evidence beside the answer, or give
  a detected answer a visual treatment of its own, or shrink its question count as the analysis
  answers them. The wording now asks the founder to confirm; what is missing is showing them what
  they are confirming against. That needs `ImportAnalysis.evidence` passed into the runtime and a
  small component to render it, and it is the last criterion outstanding.

---

## Exact changes (file:line)

**Pass 1 — the pure layer (`packages/schemas`).** The question set is where "asks the wrong
questions" actually lives, and it is pure data with no app dependencies, so it was built and proven
on its own.

1. **`packages/schemas/src/types.ts`** — `InterviewAnswers` gains `deliveryLayout` and `hiddenFolder`
   ([:95-133](../packages/schemas/src/types.ts#L95-L133)), and `uiKit`'s doc records the `existing`
   value. The two delivery fields are **transient**: the interview collects them, the write-through
   puts them on `import_sources.delivery`, and they are never saved into the answers blob.
2. **`packages/schemas/src/ui-kits.ts`** — `KEEP_EXISTING_UI = "existing"`, the discrete `uiKit`
   value meaning "the look is already there". `uiKitFor` must keep returning `null` for it, which is
   what makes "described, never installed" hold with no new branch.
3. **`packages/schemas/src/index.ts`** — `interviewAnswersSchema` accepts the two new fields and the
   `existing` sentinel ([:104](../packages/schemas/src/index.ts#L104)), keeping the drop-unknown
   behaviour that spec 165 chose deliberately.
4. **`packages/schemas/src/questions.ts`** — the heart of it:
   - `interviewQuestions` **unchanged**, and now explicitly the greenfield set.
   - `importedQuestions`, derived from it by a pure transform: the delivery question first, then the
     same questions with import wording where it differs, and the design question gaining its
     "keep what is there" option.
   - `questionsFor(origin)` — one place that decides which set anyone gets.
   - `isQuestionVisible` / `visibleQuestions` / `pruneHiddenAnswers` / `firstUnanswered` /
     `withSuggestions` take the set as an optional argument defaulting to `interviewQuestions`
     ([:607-702](../packages/schemas/src/questions.ts#L607-L702)), so every existing caller keeps its
     behaviour and only the import path passes something else.
   - `TRANSIENT_ANSWERS` — the two fields the answers blob must never keep.

**Pass 2 — the wiring, so an imported project actually meets it.**

5. **`app/app/projects/[id]/interview/page.tsx`** — resolves `projectOrigin(id)` on the server and
   passes it down. The interview never guesses at its own origin.
6. **`features/interview/AuthedInterview.tsx`** — takes `origin`, hands the runtime
   `questionsFor(origin)`, and seeds `deliveryLayout` **only when regenerating**. The column has no
   undecided state — it defaults to `integrated` — so seeding it always would pre-answer question one
   and walk a fresh import straight past the only choice their team can see.
7. **`features/interview/InterviewRuntime.tsx`** — a `questions` prop threaded through all six
   evaluator calls, defaulting to the greenfield set so the guest interview is untouched; and the
   design question's gate, where the curated directions stay behind "keep what we have" until the
   founder declines. What an option records is now `kit?.id ?? KEEP_EXISTING_UI ?? undefined`, so
   keeping the look is a pick rather than the absence of one.
8. **`features/interview/actions.ts`** — `writeDeliveryThrough`: takes the two transient answers out,
   writes the layout to `import_sources.delivery` through the same `hiddenFolderFrom` +
   `deliveryLayoutSchema` path spec 187 uses, refuses hidden when `stackDetected` is false, and
   returns the answers without them. Both save and submit prune against `questionsFor(origin)`, so an
   import-only answer is not dropped for belonging to no greenfield question. A half-typed folder
   name leaves the stored choice alone rather than throwing at someone mid-word.

---

## Data model

**No schema changes.** `import_sources.delivery` already stores the layout choice (spec 187) and
`import_sources.analysis` already holds the derived answers and their evidence. The interview asking
the layout question changes who writes that column, not the column.

"Keep the existing look" is a **discrete value of `uiKit`** (`packages/schemas/src/types.ts:122`,
`:240`), which is an answer and travels in `InterviewAnswers` like every other — no new column, and
no second field that could disagree with the first. It is stored rather than derived for the reason
spec 165 gives: editing the prose must not cancel a decision. §I's preference for a union over a
boolean-with-meaning is why it is a value of the existing field rather than a new `keepExistingUi`
flag.

---

## Security

Nothing new is exposed: the interview already reads an analysis the founder uploaded, scoped by RLS
through the project, and this changes which questions are asked rather than what is reached. The one
thing to hold is customer IP — the analysis keeps paths and digests, never content
(`ImportedFileDigest`), so a question must not imply Airrow retained the source it read.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- **A documents-only import** (`stackDetected` false) → no hidden option, and the questions that
  confirm a stack have nothing to confirm; they must fall back to the greenfield wording rather than
  showing empty evidence.
- **The analysis derived a wrong answer** → disagreeing is one click, and the evidence is shown so the
  founder can see what it was read from.
- **The analysis derived nothing for a question** → it reads as it does today; no empty "detected"
  treatment.
- **Hidden mode** → questions about adopting the team's own files cannot be asked, since nothing
  outside the folder may change.
- **The founder switches integrated ↔ hidden after answering** → always allowed, never blocked. A
  notice names what the switch changes (hidden ships no CI, and nothing outside the folder may
  change), every answer already given is kept, and questions the new mode makes meaningless drop out
  of the summary rather than being discarded — switching back must not have cost anything.
- **An import whose foundation was already generated** → spec 187's existing rule holds: the choice
  reaches the *next* generation, and the screen says so.

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- **The greenfield interview.** Untouched, and tested to stay that way.
- **What `/cleanup` does with the answers.** This spec changes the asking; spec 91 owns the command.
- **Letting an imported project install a UI theme.** Decided, and the answer is no: a picked
  direction is **described, never installed**, which is what spec 165 already does and what
  `/cleanup`'s "changes no code" ceiling requires. Installing a pinned library into someone's running
  app is a far bigger promise than installing it into a fresh scaffold, hidden mode could not install
  anything in any case, and reversing this would take an amendment to §0 rather than a decision in
  this spec.
- Re-running the analysis, or analysing more of the codebase than it reads today.
- Any change to the engine, the authoring provider, or document contracts.
