# Spec 159 — References the founder can point at, and a `/start` that finishes the job

> **In one sentence:** Let the founder show what they want their product to look like — screenshots,
> links, or a curated example to pick from — turn that into a `UI_ARCHITECTURE.md` detailed enough to
> build a beautiful first version from, make `/start` a much larger instruction that finishes that
> version to a professional standard and then removes itself, and give the three most-constraining
> interview questions a free-text escape hatch. Plus one small thing shipped ahead of the rest: Archer
> now answers inside the dashboard too.

|                |                                      |
| -------------- | ------------------------------------ |
| **Status**     | 🔄 In progress                       |
| **Issue**      | #159 — "import png and links to ui question etc" |
| **Branch**     | `159-ui-reference-start` (from `feature/interview-generator`) |
| **Feature**    | Interview-driven project generator   |
| **Depends on** | [123-foundation-starts-strong.md](123-foundation-starts-strong.md) · [66-start-command.md](66-start-command.md) · [65-authored-documents.md](65-authored-documents.md) · [91-cleanup-command.md](91-cleanup-command.md) · [69-import-file-picker.md](69-import-file-picker.md) · amends [158-archer-everywhere.md](158-archer-everywhere.md) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

> **Amends the constitution.** §0's `/start` paragraph gains one sentence: the command removes itself
> once it has verifiably finished. The previous wording is recorded in _Constitution amendment_ below.

---

## User story

As a **founder who knows what they want their product to look like but can't write a design brief** I
want **to show it instead — a screenshot, a link, or an example I recognise** so that **the first
version `/start` builds actually looks like the thing in my head, and I'm proud to open it.**

---

## Background

- **Today — the UI question is free text only.** `uiDirection`
  ([questions.ts:194](../packages/schemas/src/questions.ts#L194)) is a 500-character textarea
  (`ANSWER_MAX_CHARS.uiDirection`, [:69](../packages/schemas/src/questions.ts#L69)) rendered by the
  generic text branch in
  [InterviewRuntime.tsx:359](../apps/web/src/features/interview/InterviewRuntime.tsx#L359). There is no
  way to attach anything. Spec 123 explicitly put "a visual/upload-based UI input (screenshots, Figma,
  a theme picker)" _out of scope_ — this spec is that follow-up.
- **Today — `UI_ARCHITECTURE.md` is four sections.**
  [`template/docs/architecture/UI_ARCHITECTURE.md`](../template/docs/architecture/UI_ARCHITECTURE.md)
  is 18 lines: design direction, screens & navigation, states, design language — four tokens rendered
  by `uiDirectionSummary` / `uiScreens` / `uiStates` / `uiDesignLanguage`
  ([scaffold.ts:773–813](../packages/engine/src/scaffold.ts#L773)), authored as a 5000-char document
  when the API key is present. The deterministic fallback for screens is one sentence plus a
  `[NEEDS CLARIFICATION]` marker — honest, but nothing an assistant can build a beautiful screen from.
- **Today — `/start`.** `startMinimum()` ([scaffold.ts:714](../packages/engine/src/scaffold.ts#L714))
  renders ~40 lines into `{{START_MINIMUM}}` at
  [start.md:40](../template/.claude/commands/start.md#L40) — already the "build `mvpFocus` for real"
  ceiling from spec 123. What it is not is a *finishing* instruction: no bar for what "looks
  professionally good" means, and no reference to compare against. And `start.md:12` promises
  **"Re-runnable by design."**
- **Today — three closed option lists with no way out.** `productType` (8 options,
  [:133](../packages/schemas/src/questions.ts#L133)), `tenancy` (4,
  [:217](../packages/schemas/src/questions.ts#L217)) and `capabilities` (10,
  [:244](../packages/schemas/src/questions.ts#L244)) each force the nearest wrong answer on a project
  they don't cover. Only `framework` has an escape hatch (`custom` → `frameworkOther`,
  [:328](../packages/schemas/src/questions.ts#L328)) — the pattern this spec extends.
- **Today — an "optional" question still blocks the interview.** `firstUnanswered`
  ([:462](../packages/schemas/src/questions.ts#L462)) ignores `Question.required`, and the review
  screen's submit button is gated on it (`complete`,
  [InterviewRuntime.tsx:102](../apps/web/src/features/interview/InterviewRuntime.tsx#L102)). So
  `coreEntities` says "Skip it if you're not sure yet" and cannot be skipped. `validateCompleteAnswers`
  ([index.ts:250](../packages/schemas/src/index.ts#L250)) — the real gate — has always respected
  `required`. Only the UI disagrees, and every new optional question inherits the bug.
- **The problem.** A founder who cannot write a design brief gets a generic one, and a generic
  foundation is a top-severity bug by constitution §0. The one input that would have been effortless —
  "here's a screenshot of what I mean" — is the one we don't accept.
- **Already in place:** the authoring provider ([`author.ts`](../apps/web/src/features/generation/author.ts))
  already runs two independent calls (main + UI brief), each failing closed to deterministic output;
  `pickValid*` per-field fallback; the `custom` → `frameworkOther` escape-hatch pattern; the DataStore's
  service-role client and the org-scoped table + RLS + denial-test pattern
  ([`20260731150000_support_and_reviews.sql`](../supabase/migrations/20260731150000_support_and_reviews.sql));
  and `inputsHash` ([memo.ts:25](../apps/web/src/features/generation/memo.ts#L25)), which decides when
  authored prose may be reused.

---

## Design decision

Seven threads, one outcome: the founder shows what they want and gets it built.

1. **Two UI questions, not three.** `uiDirection` becomes a `guided_text` question: the five curated
   directions sit above the field, and picking one **writes its words into the field**, where the
   founder edits or extends them. What comes out is one answer in their own words, whether or not
   they started from ours. The separate "which of these is closest?" question is gone — asking for a
   brief and then asking which of five was nearest made the founder answer the same thing twice and
   left two answers that could disagree. References then get their own short screen: a `references`
   question holding pasted links and uploaded images, optional in the real sense (see 6).
2. **Images are stored, links are not.** An uploaded PNG/JPG/WebP goes to a private Supabase Storage
   bucket with a row in a new org-scoped `ui_references` table; links are an ordinary text answer that
   travels with the rest of the interview. Two destinations because they are two different things: the
   link is words, and words already have a home. **Bytes never enter `InterviewAnswers`** — that JSON
   is written on every keystroke, replayed into the guest draft in `localStorage`, and hashed into
   `inputsHash`.
3. **Uploading requires an account.** The guest interview writes nothing server-side before it is
   claimed ([draft.ts](../apps/web/src/features/interview/draft.ts)) — deliberately, so there is no
   orgless row and no unauthenticated write endpoint (§II). Rather than break that for a screenshot,
   the guest screen offers links and the curated examples, and says plainly that images need an
   account. A guest who signs up mid-interview keeps every answer and can then attach.
4. **Links are text to the model. Nothing is fetched.** Resolving a founder-supplied URL from our
   servers is an SSRF surface on a page anyone can reach, and it would buy markup that says little
   about how a page looks. The model knows what well-known products look like; the URL goes into the
   prompt as data, like every other answer.
5. **Five curated directions, as prefills rather than a picker.** Five named looks we wrote
   ourselves, each concrete enough that `UI_ARCHITECTURE.md` can be written from the pick alone, plus
   "None of these — my own words", which simply empties the field. They live *inside* the design
   question (see 1), so nothing downstream has to reconcile a pick with the words beside it.
6. **`required: false` starts meaning it.** `firstUnanswered` skips optional questions, and a text
   question's button reads "Skip" when it is optional and empty. This is a bug fix the new question
   forced into the open — without it, "optional" references would block submission exactly as
   `coreEntities` does today.
7. **`UI_ARCHITECTURE.md` becomes a real brief, and `/start` a finishing instruction.** The document
   grows from four sections to eight (screen inventory, navigation, layout & spacing, type scale,
   color, components, interaction, states), written from the references when there are any. `/start`
   grows a visual bar, the reference material, a self-check, and a final step: **it removes itself**.

**"Replicate 100%" has a hard boundary.** Applied to *our own* curated examples, replicate faithfully.
Applied to a real company's site, copying a named product's design one-to-one is someone else's trade
dress, and Airrow would be the tool that did it. **The rule:** curated examples are ours to reproduce;
a founder's own screenshot or link is *direction to interpret* — layout, density, tone, palette —
never an asset to reproduce. No logo, no brand name, no copied copy.

**Five escape hatches, built like `frameworkOther`.** `productType`, `tenancy`, `capabilities`,
`database` and `hosting` each gain an `other` option and a `showIf`-gated text question. The union
types gain `other` too, which is the point: TypeScript then finds every exhaustive map that has to say
what an unclassifiable answer renders as, rather than letting one silently fall through. The two
infrastructure ones need more than a label, because the generated setup guide makes claims about them:
a named database is not told it has a `DATABASE_URL` or a `psql`, and a named deploy target gets its
own setup section rather than the self-hosting story about a server the founder may not have.
`authModel` was considered and left alone — five multi-selectable methods already cover it.

**`nonGoals` is removed as a question, not as a field.** Asking a founder what they are *not* building
before they have built anything invites invention, and an invented boundary in the file a coding agent
reads before every session is worse than a missing one. The `ProjectModel` field, the `NON_GOALS` slot
and its "not yet decided" fallback all stay — an import analysis can still derive one, and answers
saved before the question went still resolve.

**Not touched:** the two-caller rule for the Claude API (a vision block is a different message shape,
not a third caller); the engine's purity (`packages/engine` still reads no env and takes what it is
given — images reach the *app's* authoring provider, never the engine); `checkAllowance` and the plan
model; the fixed workflow commands; ZIP delivery working with no integration connected.

### Constitution amendment

**§0** currently says of `/start`: *"run explicitly by the founder, on their own machine, it scaffolds
the stack and then builds the product's core action — `mvpFocus` — for real"*, and `start.md` promises
*"Re-runnable by design."*

**What changes:** `/start` is re-runnable **until it succeeds**, and removes itself when it has. The
promise it replaces was about safety — a founder who runs it twice must lose nothing — and that is
unchanged for every path except the one where there is nothing left to do. Removal happens only after
all five verification commands have actually run and passed; an interrupted, partial or failing run
leaves the command exactly where it was. Removing the command means removing the instruction to run
it: `START_HERE.md`'s step 1 is rewritten **first**, the file deleted **second**, so the worst an
interruption can produce is a command that is still there. `/cleanup` is untouched: it deletes nothing, including itself.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

**The design question**

- [x] Exactly two UI questions — `uiDirection` and `uiReferenceLinks` — asserted directly, so a third
      cannot creep back in.
- [x] `uiDirection` is a `guided_text` question: five prefilling directions plus "None of these — my
      own words", above the field they write into.
- [x] Picking one writes its words into the field; picking another replaces them rather than
      appending; picking "my own words" empties it; typing after any of those keeps what was typed.
- [x] No third-party product is named in the directions — asserted.
- [x] The question can be skipped, and the button says "Skip" rather than sitting disabled.

**References on the UI question**

- [x] A `references` question (`uiReferenceLinks`) follows `uiDirection`, holding pasted links and
      (signed in) uploaded images on one screen — `questions.ts`, `UiReferences.tsx`. Its help text is
      two lines, not five: the long version belonged on the question that asks for a brief.
- [x] Images are PNG/JPG/WebP, at most 4 per project and 2 MB each, checked server-side in
      `addUiReference` **and** in SQL; a rejected file says which rule it broke (`refusalMessage`).
- [x] Links are capped at 5 and shape-checked (`referenceLinksAnswer`), and nothing fetches them —
      there is no HTTP client anywhere on this path.
- [x] A guest sees links and examples and is told images need an account; no unauthenticated write
      path was added — `references-action.ts` opens with `requireSession()`.
- [x] Prose only, references only, or both — covered by the brief's own tests; the no-reference path
      renders exactly what it rendered before, plus a section saying so.
- [x] Uploaded images are never rendered to another user (RLS + a signed URL minted per read) and
      never written into the foundation — the engine has no access to them by construction.

**Curated examples**

- [x] Five named directions, each described in the terms a screen needs — space, contrast,
      information density — and each carrying a `prefill` inside `ANSWER_MAX_CHARS.uiDirection`.
- [x] The examples are ours — a test asserts no third-party product name appears anywhere in the
      question, and no third-party asset ships.

**Data**

- [x] `ui_references` is org-scoped, cascades with its project, and has RLS with access **and** four
      denial tests; writes are `service_role` only.
- [x] The bucket is private (asserted in the db test) and objects are removed on project delete —
      `deleteProject` → `removeProjectUiReferences`, before the rows that name them.
- [x] The migration is idempotent and replayed cleanly against local Supabase.

**`UI_ARCHITECTURE.md`**

- [x] Nine sections now: design direction, references, screens & navigation, layout/spacing/type,
      colour, components, interaction & motion, states, design language.
- [x] With references attached, the brief names them and carries the interpret-don't-reproduce rule
      into the document itself, so it survives the prompt that put it there.
- [x] With nothing attached and a thin `uiDirection`, every section still renders something worth
      reading — asserted directly.
- [x] No code fence, no command, no `{{TOKEN}}`; the unauthored path is the one the tests exercise.
- [x] `DOCUMENT_MAX_CHARS` for the brief raised 5000 → 7000, sized to nine sections rather than four.

**`/start`**

- [x] A "Finish it" section with the visual bar and a six-question self-check.
- [x] Names the reference material and how to use it, and says the opposite when none was attached.
- [x] The spec 123 ceiling is intact — asserted line by line in `start-command.test.ts`.
- [x] Section 6 removes the command, gated on all five verification commands having actually passed;
      `start.md`, constitution §0 and `CLAUDE.md` all carry the new wording.
- [x] Section 6 rewrites `START_HERE.md` **before** deleting the command — step 1 stops telling
      anyone to run it, and it leaves the list of commands the foundation ships. The four commands and
      the verification-bar sentence under them survive untouched; nothing else in the file is edited.
- [x] `START_HERE.md` says so at generation time: step 1 promises the rewrite and the stand-down, so
      a founder who finds the command gone recognises it as the plan.

**A command a founder on a fresh machine can actually follow**

- [x] Six numbered sections — Tools, Stack, Git, The first screen, Verify, Hand back — asserted as an
      ordered list of headings, with every cross-reference between them checked so none points at a
      section that moved.
- [x] A new **section 1** checks for git, this stack's runtime and the repo host's CLI, and installs
      only what is missing: `brew` / `winget` lines plus each tool's own install page, never a build
      from source, an installer downloaded into the repo, or a script piped into a shell.
- [x] The runtime is the stack's, not Node by default — a Django foundation checks `python3`, and a
      stack nothing recognised claims no runtime at all rather than guessing one.
- [x] `gh` for GitHub, `az` for Azure DevOps — never both, asserted in each direction.
- [x] `pnpm` is enabled through `corepack`, never installed globally; the npm stacks say nothing
      about it.
- [x] Nothing is upgraded and nothing is signed in to: `gh auth login` stays the founder's, in step 2
      of `START_HERE.md`, which now asks only for the sign-in — `/start` did the install.
- [x] A failed install is reported with the tool's page and the sections it blocks, not worked around.
- [x] Progress is reported as a twelve-cell bar after each section (`[██░░░░░░░░░░] 1/6 · Tools ✓`),
      an already-done section still counts, and a failed one prints the bar as far as it got and
      stops — asserted, including the `0/6` and `6/6` ends.
- [x] Every section ends with a **Done when:** line.

- [x] `START_HERE.md`'s step 1 opens with the one thing the founder installs by hand — **Claude
      Code**, with its install page and the npm alternative — and then says plainly that git, the
      runtime, the package manager and the repo CLI are all step 1 of `/start`, so nothing else is
      needed first. An imported project is told the truth for its own command instead: `/cleanup`
      installs nothing.
- [x] That paragraph survives section 6a's rewrite — it is about every command that follows, not
      about `/start`.
- [x] A tool that installed successfully but is not on the shell's `PATH` yet reads as a restart, not
      as a failed install: no second attempt, and no editing the founder's shell profile.

**The first session in a generated repo**

- [x] `CLAUDE.md` opens with "Starting a chat here": six rows, in order, from the first-run command to
      `/analyze → /push → /pr-check`, with the loop named as the thing that repeats.
- [x] Row 1 is conditional on the command's file still existing, so it stops applying the moment
      `/start` removes itself — and reads differently for an imported project, whose `/cleanup`
      changes no code and stays put (asserted in `cleanup-command.test.ts`).
- [x] The assistant is told what to do when a session opens with neither a spec nor a command: answer,
      then offer `/createspec` rather than starting.
- [x] `CLAUDE.md` also carries **"After a command finishes"**: one line per command saying what to do
      next and nothing else — including the step that happens outside the terminal, where a pushed
      branch is merged into its `feature/<name>`, in the vocabulary of this project's own host
      (**Squash and merge** on GitHub, **Complete** on Azure DevOps, each with the right `pr create`
      line). After `/start` the next move is the accounts step 2 names — this project's own database
      and host — or the first spec.
- [x] The table has a row for the command this project actually ships and no other, and a failed
      command gets what would unblock it rather than a pointer at the next step.
- [x] `/cleanup` still deletes nothing, including itself — its own test now says so.
- [x] Stack-correct across Next.js, Vite and a custom stack.

**Escape hatches**

- [x] `productType`, `tenancy`, `capabilities`, `database` and `hosting` each accept "something else —
      describe it", each with a `showIf`-gated text question and an `ANSWER_MAX_CHARS` entry.
- [x] Each reaches generated output: the product type names the product in every document, the
      tenancy answer lands in `TENANCY_MODEL`, a described capability gets its own spec brief, and the
      two infrastructure ones rewrite their own sections of the setup guide.
- [x] A named database is not assumed to be Postgres — no `DATABASE_URL`, no `psql`, and migrations
      are "that database's own migration tool".
- [x] A named deploy target gets its own setup section and an honest placeholder workflow, instead of
      the self-hosting section's story about a server they may not have.
- [x] `required: false` is honoured by `firstUnanswered`, so an optional question can be skipped —
      and the button says "Skip" rather than sitting disabled.
- [x] `INTERVIEW_SCHEMA_VERSION` → `"4"`, `GUEST_DRAFT_VERSION` → `7`; the server-side path still
      degrades gracefully through `.partial()` + `pruneHiddenAnswers`.

**Non-goals**

- [x] The "What is this explicitly not doing?" question is gone from `interviewQuestions`.
- [x] The field, the `NON_GOALS` slot and its "not yet decided" fallback all survive, so an import
      analysis or an older saved answer still reaches `CLAUDE.md` — both directions asserted.

**Archer in the dashboard** _(shipped in this branch ahead of the rest)_

- [x] `ChatWidget` is mounted from `app/app/layout.tsx`, so every `/app` screen carries it.
- [x] Still mounted from a **layout only** — exactly two mounts, one per tree, asserted by the
      rewritten structural tests in `app/(public)/layout.test.tsx`.
- [x] Its CTA points at `/app/projects/new` inside the app (`startCtaHref(true)`).
- [x] `z-30`, not `z-40`: above both sticky headers, below the mobile drawer and every dialog/toast.
- [x] Endpoint, knowledge base, limits and support hand-off unchanged.
- [x] `CLAUDE.md`, `docs/architecture/UI_ARCHITECTURE.md` and spec 158 updated in the same change.
- [ ] **Known consequence, not resolved here:** signed-in founders draw on the *anonymous* allowance
      (250/day global, 5/IP). A paying founder can be told "come back tomorrow" because visitors spent
      the day. [NEEDS CLARIFICATION: does a signed-in founder get their own allowance? `chat_rate_limits`
      is deliberately tenant-less (§II names it as the single exemption), so that means a second,
      org-scoped path with its own RLS — not a column on that table.]

**Contract & consistency**

- [x] `PROMPT_VERSION` → `"10"`; `inputsHash` takes the reference digests, so attaching a screenshot
      re-authors instead of serving prose written before it existed.
- [x] Constitution §0 and §II, `CLAUDE.md`, `DATABASE_DESIGN.md` and `UI_ARCHITECTURE.md` updated in
      the same change, previous `/start` wording recorded.
- [x] Typecheck clean; lint adds no new issues; tests green — see _Implementation notes_.

### Verification

> **Implementation notes (`/implement`, 2026-08-01).**
>
> **The four open decisions were taken by the runner before any code was written:** images are stored
> (Storage + table + RLS, the largest of the three options); `/start` deletes itself after verified
> success; links are never fetched; `productType`, `tenancy` and `capabilities` get the escape hatch.
> Everything above reflects those.
>
> **Three things the implementation decided that the plan had left implicit:**
> 1. **Uploading requires an account.** The guest interview writes nothing server-side before it is
>    claimed, and a screenshot was not reason enough to open the first unauthenticated write path.
>    The guest screen says so and keeps the links.
> 2. **`other` was added to the `ProductType`, `Tenancy` and `FeatureId` unions**, rather than being
>    carried only as loose text. That is what made TypeScript point at every exhaustive map and switch
>    that owed an answer — `capabilitySpecBrief` was found this way, not by review. `Tenancy: "other"`
>    is deliberately **not** multi-tenant: inferring shared access from an answer nothing here
>    understood is the one inference with a security consequence.
> 3. **`firstUnanswered` now respects `required`** — a real bug fix the new optional question forced
>    into the open. It gates the submit button, so every question marked optional was mandatory in the
>    interface while `validateCompleteAnswers` had always let them pass; `coreEntities` said "skip it
>    if you're not sure yet" and could not be skipped.
>
> **Two existing tests changed, both because the rule under them changed shape, and both recorded
> rather than quietly rewritten:** `questions.test.ts`'s "describes the stack whenever it recommends
> one the engine cannot derive commands for" now exempts `other` (nothing can describe a stack for a
> product nobody classified — that is the option's whole meaning), and the generate route's assertion
> gained the organization the runner now needs.
>
> **Second pass, same branch — the interview shape.** Five further changes, on explicit direction
> after the first pass landed:
> 1. **Two UI questions became one.** `uiDirection` is now `guided_text`: the five directions prefill
>    the field instead of being a question of their own. `uiExample` is gone from the answers, from
>    `ProjectModel` and from the engine — `UI_EXAMPLE_DIRECTION` in `scaffold.ts` went with it, since
>    the prefill *is* the founder's text now. One answer, no reconciliation.
> 2. **Which option is "selected" is derived, not stored.** The picked direction is highlighted by
>    testing whether the field still starts with that prefill. Storing it would mean keeping a second
>    answer that goes stale on the first keystroke, and `pruneHiddenAnswers` would drop it anyway
>    since it is no longer a question id.
> 3. **The references screen was cut to two lines of help.** The long explanation belonged on the
>    question that asks for a brief.
> 4. **`nonGoals` removed as a question**, kept as a field — see _Design decision_.
> 5. **`database` and `hosting` gained escape hatches**, which cost more than the other three did:
>    the setup guide makes claims about both. `postgresSetupSection` and `hostingSetupSection` now
>    branch on `other`, and `deployTargetSetup` says "set up" rather than "create" for a target whose
>    verb nobody here knows.
>
> **One regression the second pass introduced and caught.** `FLAGGABLE_ANSWERS` was derived from
> `type === "text"`, so `uiDirection` silently left the list the moment it became `guided_text` — the
> model could no longer point a founder at the design answer that had made an interview unusable
> (spec 128's whole mechanism). It now derives from every question with a field in it, and
> `authoring.test.ts` covers both directions.
>
> > **Third pass, same branch — the half of self-removal that was missing.** `/start` deleted itself
> but left `START_HERE.md` telling the founder to run it: step 1 described work already done, and the
> "how the commands work" list named a file that no longer existed. Section 5 is now two steps in a
> fixed order — **5a** rewrites those two places in `START_HERE.md`, **5b** deletes the command — so
> an interruption between them leaves a runnable command rather than instructions for a missing one.
> The rewrite is bounded on purpose: the four commands and the verification-bar sentence stay
> verbatim (that block is what the founder returns to), and no other section may be touched.
> `firstStep()` now promises this in the generated file itself — "safe to run again if it stops early
> … once it has finished and verified the result, it rewrites this step to say so and removes
> itself" — so the disappearance reads as the plan rather than as something having gone wrong.
> `/cleanup`'s step 1 is unchanged: it still deletes nothing and still says "safe to run again".
>
> **Fourth pass, same branch — the machine the founder is actually on.** Three changes, on explicit
> direction after the third pass landed:
> 1. **`/start` installs its own prerequisites.** Every version of this command assumed git, a
>    runtime and a package manager were already there, so a founder on a fresh laptop met
>    `pnpm: command not found` in the first instruction they followed. The new **section 1** checks
>    each tool and installs only what is missing (`startTools()`, `START_TOOLS`), including the repo
>    host's CLI — `gh` or `az`, whichever this project's answers chose. Four rules keep it inside §0's
>    machine boundary: check before installing, never upgrade what is already there, stop and report
>    rather than improvising an install, and **sign in to nothing** — `gh auth login` remains step 2
>    of `START_HERE.md`, which now asks for the sign-in alone. The runtime is looked up from the same
>    `InferredStack` the commands come from, so a Django project is told about `python3` and an
>    unrecognised stack is told about no runtime at all.
> 2. **Six sections and a progress bar.** The command was four sections of dense prose with no way to
>    tell how far in you were. It is now six named sections, each ending in a **Done when:** line,
>    with a fixed twelve-cell bar printed after each one. A real progress bar is not something
>    instruction text can render — what is testable, and what this ships, is the *shape* of the line
>    and the rules that stop it running ahead of the work: an already-done section counts, a failed
>    one prints where it actually got to and stops.
> 2b. **The one thing `/start` cannot install is the thing that runs it.** Section 1 installs Node —
>    but a founder with no assistant cannot type `/start` to get there, and the guide never said so.
>    `firstStep()` now opens with Claude Code (install page, plus the npm line for a machine that
>    already has Node) and then states that everything else is step 1 of the command, so nobody
>    installs by hand what the command was written to do. It survives the section 6a rewrite, being
>    about every command rather than that one. Section 1 also gained a fifth rule for the failure that
>    looks identical to a failed install and is not: a successful install the running shell cannot see
>    yet is a restart, not a second `winget install`.
> 2c. **And ends every command with the next move.** The eight-command workflow was documented as a
>    loop but never as a handover: a founder who has just run `/push` is looking at a branch on a
>    server, and the button that merges it is in a web interface this foundation never sees.
>    `afterEachCommand()` gives the assistant one line per command — the next action only, in the
>    provider's own words — and one rule that matters more than the table: a command that failed gets
>    what would unblock it, never a pointer at the step after it.
> 3. **`CLAUDE.md` opens with the first session.** The founder's first message in a generated repo
>    was "what do I do now?", and `CLAUDE.md` is what the assistant reads before answering. Six rows,
>    in order. Row 1 is conditional on the command's file still existing (`FIRST_COMMAND_PATH`), which
>    is what keeps it true after `/start` deletes itself — the alternative was a seventh thing for
>    section 6a to rewrite, and every extra file in that step is another chance to mangle one.
>
> **Verification bar** (after all four passes): `pnpm -r typecheck` clean · `pnpm -r lint` clean ·
> `pnpm -r test` **1,221 passed** (87 schemas + 264 engine + 870 web, 95 files) · `pnpm test:scripts`
> 88 passed · `pnpm engine:smoke` passed on all five fixtures. No pre-existing failures. The migration
> was applied to local Supabase (`supabase migration up`) and the RLS suite ran against real Postgres
> rather than being skipped.
>
> **Still owed a real run.** Sections 1 and 6 are the two the tests can only check the *text* of: no
> test installs `gh` on a bare machine, and none watches an assistant rewrite `START_HERE.md`. Both
> belong in the manual check below, on a machine that has neither git nor the runtime.

- **New tests** — `packages/schemas/src/questions.test.ts`: exactly two UI questions; every direction
  carries a prefill inside the field's own cap and "my own words" carries none; the reference question
  and all five escape hatches exist with caps; `nonGoals` is no longer asked but still capped;
  `firstUnanswered` skips optional questions and still stops on required ones.
- **New tests** — `apps/web/src/features/interview/InterviewRuntime.test.tsx`: picking a direction
  writes it into the field, picking another replaces it, "my own words" empties it, typing after any
  of them keeps what was typed, and the question can be skipped.
- **New tests** — `packages/engine/src/scaffold.test.ts` / `authored.test.ts`: every new UI section
  renders deterministically for a thin answer; the document is still rejected for a code fence or an
  unrendered token; all five `other` answers reach the output; a named database is never told it has a
  `DATABASE_URL`; a named deploy target never gets the self-hosting section; and `nonGoals` renders
  from a derived answer while asking for nothing when there is none.
- **New tests** — `packages/engine/src/start-command.test.ts`: the rendered `/start` carries the
  visual bar, the reference material and the self-removal step, and still differs across the three
  stack shapes; section 6 names both places in `START_HERE.md`, keeps the verification-bar block, and
  orders 6a before 6b; the rendered `START_HERE.md` promises the rewrite and the stand-down; the six
  headings in order with every cross-reference between them; the progress bar's shape and its two
  ends; section 1's checks, per-stack runtime, per-provider CLI, corepack over a global pnpm, no
  sign-in, no upgrade, an honest failure, and a stale `PATH` read as a restart; `START_HERE.md` naming
  Claude Code before the command, and section 6a keeping that paragraph.
- **New tests** — `packages/engine/src/scaffold.test.ts` / `cleanup-command.test.ts`: `CLAUDE.md`'s
  first-session table, in order, conditional on the command's file — and reading differently for an
  imported project; the after-each-command table covering all six loop commands, the merge named in
  each provider's own vocabulary, and an imported foundation carrying the `/cleanup` row and no
  `/start` row.
- **New tests** — `packages/engine/src/cleanup-command.test.ts`: `/cleanup` still deletes nothing and
  does not remove itself.
- **New tests** — `apps/web/src/features/generation/author.test.ts`: images reach the UI call as
  image blocks and only that call; no images means an unchanged request; the calls stay independent.
- **New tests** — `apps/web/src/lib/data/ui-references.db.test.ts`: RLS access **and** denial, writes
  refused to `authenticated`, cascade on project delete.
- **New tests** — `apps/web/src/features/interview/references.test.ts(x)`: type/size/count rejection
  messages, and the guest screen offering no upload.
- **Changed tests** — `apps/web/src/app/(public)/layout.test.tsx`: two mounts, one per layout.
- **Manual** — one generation per input shape (prose only, image only, link only, curated pick), each
  `UI_ARCHITECTURE.md` read end to end, then `/start` run against a real assistant on one of them.
  Spec 123 descoped exactly this; it should not be descoped twice.
- **Manual** — `/start` on a machine missing git, the runtime and the CLI: section 1 installs all
  three, signs in to nothing, and the progress bar reaches `6/6`; then `START_HERE.md` no longer names
  the command, the command is gone, and the four verification commands still run from the file.

---

## Exact changes (file:line)

**Schema (`packages/schemas`)**

1. **`src/types.ts`** — `"other"` added to `ProductType`, `Tenancy`, `FeatureId`, `Database` and
   `Hosting`; `productTypeOther`, `tenancyOther`, `capabilitiesOther`, `databaseOther`,
   `hostingOther`, `uiReferenceLinks` on `InterviewAnswers` and the resolved equivalents on
   `ProjectModel`; a `UiReferenceImage` type for the app's authoring provider (never for the engine).
2. **`src/questions.ts`** — the `guided_text` and `references` question types and
   `QuestionOption.prefill`; `uiDirection` rebuilt as `guided_text` with the five directions inside
   it; the `uiReferenceLinks` question; the `nonGoals` question **removed**; five `other` options and
   their text questions; `ANSWER_MAX_CHARS` entries; `STANDARD_STACK["other"]`;
   `INTERVIEW_SCHEMA_VERSION` → `"4"`; `firstUnanswered` respects `required`.
3. **`src/index.ts`** — the new enum members and text answers in `interviewAnswersSchema`; a
   `uiReferenceLinks` refinement (≤5, URL-shaped); `uiReferenceUploadSchema` for the upload boundary.
4. **`src/authoring.ts`** — `DOCUMENT_MAX_CHARS` for the UI brief raised 5000 → 7000
   ([:165](../packages/schemas/src/authoring.ts#L165)).

**Engine (`packages/engine`)**

5. **`src/model.ts`** — resolve the new answers; `other` entries in `productTypeLabel`,
   `featureLabel`, `tenancyLabel`, `hostingLabel` and `DATABASE_LABEL`; and the four
   founder's-own-words helpers the documents actually read — `productTypeName`, `tenancyName`,
   `hostingName`, and `databaseLabel` rewritten to prefer the described value.
6. **`src/scaffold.ts`** — the nine UI sections replacing four (`uiDirectionSummary` now reads one
   answer, `UI_EXAMPLE_DIRECTION` gone with the merged question); `startMinimum()` rewritten with the
   visual bar, the reference material, the self-check and self-removal; `startTools()` +
   `RUNTIME_TOOLS` + the `ProviderVocabulary` install fields (`cliBin` / `cliBrew` / `cliWinget` /
   `cliDocs` / `cliAuth` / `cliShort` / `cliExtra`) behind the new `START_TOOLS` token;
   `cliSetupStep()`, so an origin that got the install from `/start` is asked only to sign in;
   `firstCommandEffect()`, `FIRST_COMMAND_PATH` and `afterEachCommand()` for `CLAUDE.md`'s two new
   sections; `firstStep()`'s new-project branch listing the six steps and
   promising the `START_HERE.md` rewrite and the stand-down; `capabilitySpecBrief`'s
   `other` case; `postgresSetupSection` and `hostingSetupSection` branching on a named database and a
   named deploy target; `deployTargetSetup`'s verb; the token table.
7. **`template/docs/architecture/UI_ARCHITECTURE.md`** — the new section skeleton and tokens.
8. **`template/.claude/commands/start.md`** — rebuilt around six sections: a "How this runs" preamble
   with the section table, the progress-bar rule and the rewritten "Re-runnable until it succeeds";
   `{{START_TOOLS}}` as section 1; a **Done when:** line closing each section; section 6 after
   verification: **6a** rewrites `START_HERE.md`, **6b** deletes the command.
8b. **`template/CLAUDE.md`** — the "Starting a chat here" table, using `{{FIRST_COMMAND_EFFECT}}` and
   `{{FIRST_COMMAND_PATH}}`, and "After a command finishes" (`{{AFTER_EACH_COMMAND}}`).
9. **`template/.airrow-template.json`** — every new token documented.

**App (`apps/web`)**

10. **`src/lib/data/ui-references.ts`** (new) — save/list/delete/load-for-authoring, service-role and
    org-scoped like every other DataStore path.
11. **`src/features/interview/references-action.ts`** (new) — upload/remove server actions behind
    `requireSession()` + `getProject(org.id, …)`.
12. **`src/features/interview/UiReferences.tsx`** (new) — the reference screen; reuses the import
    picker's shape rather than inventing a second one.
13. **`src/features/interview/InterviewRuntime.tsx`** — the `guided_text` branch (directions above
    the field, selection derived from the text) and the `references` branch; "Skip" on an optional
    empty text question; injected `uploads` prop, like `persist`/`submit`.
14. **`src/features/interview/AuthedInterview.tsx` / `GuestInterview.tsx` / `draft-schema.ts`** —
    wire the prop; bump `GUEST_DRAFT_VERSION`.
15. **`src/features/generation/author.ts`** — `authorFoundation(model, references)`; image blocks on
    the UI call only; `UI_ADDENDUM` gains the reference rules and the eight sections;
    `PROMPT_VERSION` → `"10"` ([:38](../apps/web/src/features/generation/author.ts#L38)).
16. **`src/features/generation/runner.ts`** — load the references and pass them
    ([:128](../apps/web/src/features/generation/runner.ts#L128)); **`memo.ts`** — reference digests
    into `inputsHash` ([:25](../apps/web/src/features/generation/memo.ts#L25)).
17. **`src/lib/data/store.ts`** — `deleteProject` also removes the project's Storage objects
    ([:380](../apps/web/src/lib/data/store.ts#L380)).
18. **`supabase/migrations/20260801150000_ui_references.sql`** (new) — table, bucket, RLS, grants.

**Docs**

19. **`.claude/spec-kit/constitution.md`**, **`CLAUDE.md`**, **`template/CLAUDE.md`**,
    **`template/START_HERE.md`**, **`docs/architecture/DATABASE_DESIGN.md`**, **`specs/README.md`**.

**Already done in this branch (Archer in the dashboard):**

20. **`apps/web/src/app/app/layout.tsx`** — `ChatWidget` mounted, `ctaHref={startCtaHref(true)}`.
21. **`apps/web/src/features/chat/ChatWidget.tsx`** — `z-40` → `z-30`, comment names both mounts.
22. **`apps/web/src/app/(public)/layout.tsx`** + **`layout.test.tsx`** — comment and the two
    structural tests.
23. **`CLAUDE.md`**, **`docs/architecture/UI_ARCHITECTURE.md`**, **`specs/158-archer-everywhere.md`**.

---

## Data model

**One new table and one new bucket**, both org-scoped, shipped with their access control (§II).

```
public.ui_references
  id              uuid pk
  organization_id uuid not null → organizations(id) on delete cascade
  project_id      uuid not null → projects(id) on delete cascade
  storage_path    text not null unique     -- projects/<project_id>/<id>.<ext>
  media_type      text not null            -- image/png | image/jpeg | image/webp
  bytes           integer not null         -- ≤ 2 MB, checked in SQL and in the action
  created_by      uuid not null
  created_at      timestamptz not null default now()
```

RLS: org members `select`; **no** insert/update/delete for `authenticated` — writes go through the
server action, which has already resolved the organization from the session. Bucket `ui-references` is
private, served to nobody: the bytes are read server-side by the authoring provider and by the
interview screen's own signed URL, never made public. Deleting a project cascades the rows; the
Storage objects are removed explicitly in `deleteProject`, because Storage has no foreign key.

### Constitution Check

| Invariant | Verdict |
| --- | --- |
| §I one-way data flow | Held — screen → server action → `lib/data/ui-references.ts` → Supabase. No client reaches Storage. |
| §I two Claude callers | Held — images ride the existing UI call in `author.ts`. No third caller. |
| §I engine purity | Held — `packages/engine` never sees an image; `ProjectModel` carries links and the `other` texts, all strings. |
| §I no `any` | Held — the upload boundary is a Zod schema, the vision block a typed union. |
| §II tenancy | Held — `organization_id` on every row, resolved server-side from the session. |
| §II RLS + denial tests | Held — shipped in the same migration and covered by `ui-references.db.test.ts`. |
| §II customer IP | Held — private bucket, cascade on delete, no image content in any log. |
| §III sanitized rendering | Held — an uploaded image is rendered as an `<img>` from a signed URL to its own uploader; never markup, never executed. |
| §III tokens not literals | Held — the reference screen uses existing UI primitives and tokens. |
| §0 `/start` ceiling | **Amended** — self-removal, recorded above; the `mvpFocus` ceiling itself is unchanged. |
| §V fixtures | Adding questions requires updating fixtures — done with the engine tests. |

---

## Security

Adds a founder-supplied binary upload behind an authenticated, org-scoped action: type, size and count
are checked server-side, the bucket is private, and nothing about an image is logged. Pasted links are
never fetched, so no SSRF surface is opened on a page anyone can reach. Everything reaching the model
still goes through the single authoring provider and the unchanged document contract, so nothing
runnable can land in a foundation. Mounting Archer inside `/app` opens no new surface — `/api/chat`
was already public and the panel sends nothing about the session.

---

## Edge cases

- Reference uploaded, no prose → the brief is written from the image alone and says so.
- Prose contradicts the reference → the brief names the tension and follows the founder's words.
- Image is not a UI at all (a photo, a logo, a whiteboard) → described as direction where it can be,
  ignored where it can't; never invented into screens.
- Link is dead or behind a login → nothing fetched, nothing failed; the model works from the name.
- Reference describes something the stack cannot do → the brief describes what the stack can honour
  and marks the mismatch (unchanged from spec 123).
- Founder picks a direction and then rewrites half of it → their version is the answer; the pick stops
  being highlighted the moment the text no longer starts with it, which is honest rather than sticky.
- Founder picks a direction, then picks another → the field is replaced, not appended. Losing an
  edited sentence to a mis-click is the cost, and it is the right way round: the alternative is two
  directions glued together, which describes nothing.
- Curated direction *and* an uploaded screenshot → both feed the brief; the screenshot wins where they
  disagree, since it is theirs.
- Guest attaches nothing because they cannot → the interview completes; references are optional and
  the brief is written from words.
- Founder attaches a reference after a generation → `inputsHash` changes, so the next run re-authors
  instead of reusing prose written without it.
- Storage unreachable at generation time → the UI call runs without images, exactly like a founder who
  attached none. Never a failed generation.
- Machine has none of the tools → section 1 installs git, the runtime and the CLI, then carries on.
- Machine has no Claude Code → nothing in the foundation can run, which is why step 1 of
  `START_HERE.md` names it before anything else. `/start` cannot bootstrap the thing that runs it.
- Tool installs, shell still says "not found" → reported as needing a restart. Not reinstalled, and
  the founder's shell profile is not edited.
- Machine has an old but working version → left alone. Which one and how old is reported; upgrading
  someone's whole laptop to satisfy one project is not this command's call.
- No `brew`, no `winget`, and apt too old → the install page for each missing tool, and an honest
  report of which sections that blocks. No source builds, no installer downloaded into the repo, no
  script piped into a shell.
- `sudo` prompts for a password nobody can type → reported as a blocked step, not worked around.
- Founder already signed in to `gh` → irrelevant; `/start` neither checks nor uses the session, and
  step 2 of `START_HERE.md` is a no-op they will notice takes one command.
- `/start` interrupted, or a verification command fails → the command stays, and so does the step 1
  that names it. It removes itself only after all five pass.
- Interrupted between 5a and 5b → `START_HERE.md` no longer names the command but the command is
  still there. Harmless and re-runnable; the other order would leave a first-run guide pointing at a
  file that does not exist.
- Founder looks for `/start` after it removed itself → step 1 says the stack is already running and
  `START_HERE.md`'s loop points at `/createspec`, which is where they should be by then.
- Imported project (`shipsCleanup`) → gets `/cleanup`, which builds nothing and deletes nothing,
  including itself.
- Generation with no `ANTHROPIC_API_KEY` → references ignored, deterministic brief, complete
  foundation.

---

## Out of scope

- Figma or design-tool integration, and any theme/token *picker* UI.
- Generating images, icons or logos. Airrow writes text.
- Retroactively regenerating existing foundations — [spec 100](100-pro-upgrade-revisions.md)'s
  revisions path already covers it.
- A signed-in chat allowance (see the open criterion under _Archer in the dashboard_).
- Pricing changes, even though vision inputs cost more per generation.
- The `START_HERE.md` full rewrite still owed from [spec 123](123-foundation-starts-strong.md).
