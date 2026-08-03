# Spec 165 — Curated directions that install real code

> **In one sentence:** Turn the curated UI directions from prose the model interprets into named,
> version-pinned, permissively-licensed **themes** the founder picks by looking at a real render of
> them — so `UI_ARCHITECTURE.md` names what the first screen looks like and `/start` installs exactly
> that, while what is *on* the screen still comes from what the founder wrote.

|                |                                      |
| -------------- | ------------------------------------ |
| **Status**     | ✅ Done                              |
| **Issue**      | #165 — "Curated UI directions that install real code, so /start can reproduce them exactly" |
| **Branch**     | `165-installable-ui-directions` (from `feature/interview-generator`) |
| **Feature**    | Interview-driven project generator   |
| **Depends on** | [159-ui-reference-start.md](159-ui-reference-start.md) · [123-foundation-starts-strong.md](123-foundation-starts-strong.md) · [66-start-command.md](66-start-command.md) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

As a **founder who can recognise the look they want but cannot describe it** I want **to pick the
picture I like and have `/start` install exactly that theme** so that **the first screen looks like
the one I chose rather than like an interpretation of a sentence about it — while still being the
screen my own answers describe.**

---

## Background

_Filled in during `/implement`, grounded in `file:line`._

- **Today:** the five directions are `prefill` prose on the `uiDirection` `guided_text` question
  ([questions.ts:286–329](../packages/schemas/src/questions.ts#L286)); picking one writes a sentence
  into the field, the authoring provider turns it into a brief, and `/start` builds "in that spirit"
  ([scaffold.ts](../packages/engine/src/scaffold.ts), `startMinimum`). No direction names a library,
  a version, or a file the founder could open.
- **The problem:** prose is interpreted. Two runs of the same pick produce two different screens, and
  neither is the thing the founder had in mind. Spec 159 closed the gap between the founder's head and
  the brief; this closes the gap between the brief and the code.
- **Already in place:** `/start`'s section 2 already installs shadcn/ui for the Tailwind stacks, so
  installing a named component set on the founder's machine is an existing shape, not a new power.
  The `InferredStack` plumbing already varies `/start` per stack, and spec 159's reference rules
  ("interpret, never reproduce") already draw the trade-dress line this spec has to stay inside.

---

## Design decision

_The approach, and what we deliberately leave alone._

A curated direction stops being a sentence and becomes a record: a **name**, a **visual language**
(palette in both light and dark, brand treatment, headline, typography, radius, composition, spacing,
surfaces, motion), a **package coordinate with a pinned version**, and its **licence**. The interview
shows each direction as a real render of that theme and the founder picks one. `UI_ARCHITECTURE.md`
names the chosen theme and its version; `/start` installs it where it already installs shadcn/ui, and
builds the screens the founder's *answers* describe in it. Airrow still ships no application code —
what travels is a name, a version and an install command.

**A direction is a look, never a layout.** An earlier pass had each one install real registry blocks
— a navigation shell and a sign-in screen. That made a picked picture outrank what the founder wrote:
someone choosing a palette also chose a sidebar, and got one whether their product wanted it or not.
The blocks are gone, which is also what made `/start` fast again.

Three obligations the issue names, all of which this spec must discharge rather than assume:

1. **The picture is ours.** An MIT licence covers the code, not the upstream project's marketing
   images, so nothing of theirs may be shown. What ships instead is drawn from our own theme record —
   see the deviation under _Picking by picture_ — which is ours by construction rather than by
   permission.
2. **MIT requires attribution.** If `/start` installs MIT code, the generated repo carries the
   copyright notice — a real obligation, and one a founder should not discover two years later.
3. **Trade dress is not licensed by MIT.** A library may be reproduced; a real company's product may
   not. Spec 159's boundary is unchanged and this spec must not erode it.

**Not touched:** spec 159's reference-image path (a founder's own screenshot is still direction to
interpret, never an asset to reproduce); the engine's purity; the two-Claude-caller rule; `/cleanup`;
ZIP delivery working with no integration connected.

### The three decisions this rests on

**One question, and a pick that is stored rather than derived.** The picture lives *inside* the
existing `guided_text` option, beside its label, description and prefill — spec 159's single-answer
shape survives, and nothing downstream reconciles a pick with the words next to it. What does change
is that the pick is **saved as its own answer (`uiKit`)** instead of being derived from whether the
text still starts with the prefill. Spec 159 could derive it because the pick had no consequence; it
now decides what gets installed, and a founder rewriting their opening sentence must not silently
cancel an install. "None of these — my own words" clears `uiKit` as well as the field.

**One library, three themes.** shadcn/ui at an exact pinned version, plus three themes we author
ourselves as CSS variables. Not three separate libraries: one licence and one failure mode instead of
three, and daisyUI or Preline would bring class conventions that fight the token rule in §III.
`/start` already ran `shadcn@latest init`, so this pins something the foundation installs today
rather than adding a dependency.

**The attribution debt already exists.** That same line installs MIT code into every Tailwind
foundation, and no generated repo carries a notice for it. So the notice ships whenever `/start`
installs shadcn/ui — every Tailwind stack — not only when a direction was picked. This spec closes an
open obligation rather than creating one.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

**A direction is a record, not a sentence**

- [x] **Three curated directions, not five** — Soft minimal, Bold contrast, Stark & technical. §0 says
      to offer choices only where they genuinely matter, and three that differ in temperature and
      composition beat five that differ in hue. Every count is derived from `UI_KITS.length`, so
      cutting a fourth cannot leave a stale number behind in a test or in the question.
- [x] Each direction carries: display name, description, prefill, who it suits, palette in both light
      and dark, the `UiKitDesign` record (brand treatment, headline, typography, radius, composition,
      spacing, surfaces, motion), **pinned version**, licence identifier, and copyright holder —
      `ui-kits.ts`, asserted present and well-formed for every direction.
- [x] No direction can ship without a licence and a pinned version — a test fails if one is missing.
- [x] Versions are exact: asserted `/^\d+\.\d+\.\d+$/`, and `start-command.test.ts` asserts
      `shadcn@latest` appears nowhere — the line `/start` ran until this spec.
- [x] Only permissive licences are allowed (`PERMISSIVE_LICENCES`); anything outside the set fails the
      test rather than being reviewed by eye.
- [x] "None of these — my own words" still exists, installs no theme, and clears `uiKit`.

**One question — and now only one**

- [x] There is exactly **one** UI question. `uiReferenceLinks` stopped being a question and became a
      second answer on the design screen, so the founder is asked how their product should look once
      instead of on two consecutive screens. Asserted as `["uiDirection"]`, so a second cannot return.
- [x] The `references` question *type* is gone with it; `Question.references` is a flag on the one
      question that collects them.
- [x] Links and screenshots still behave exactly as spec 159 built them — links in the answer, bytes
      in `ui_references` — and the guest still sees "images need an account".
- [x] `uiReferenceLinks` stays in `FLAGGABLE_ANSWERS` despite no longer being a question. **This was
      spec 159's regression, one answer later:** that list is derived from the question set, so a
      founder-typed answer leaving the question set silently leaves the list, and the model loses the
      ability to point at what made an interview unusable.
- [x] The review screen's design row summarises the words **and** the links, since both now answer
      the same question.

> **Reverses part of spec 159, deliberately and on request.** Spec 159 gave references a screen of
> their own; this puts them back on the design question. The argument for splitting them was that
> they are a different kind of input — but they are not a different *question*: both answer "how
> should it look?", and asking that twice in a row is the bureaucracy §0 warns about. Nothing about
> where the two kinds of reference are *stored* changed.

**A stored pick**

- [x] The design question is still a single `guided_text` question — spec 159's assertion is
      untouched and still passes, so a second UI question cannot creep back in.
- [x] Picking a direction writes its prefill into the field **and** sets `uiKit` in one update;
      picking another replaces both; "my own words" clears both.
- [x] Editing the prose no longer cancels the pick — the regression test this spec exists for.
- [x] The question is still optional and still skippable, and skipping leaves `uiKit` unset.
- [x] `uiKit` survives `pruneHiddenAnswers` despite not being a question, via `SATELLITE_ANSWERS`,
      and would still be pruned if `uiDirection` ever became conditional.

**A look, never a layout**

- [x] A direction installs a **theme and nothing else** — no screens, no navigation shell, no layout
      blocks. Asserted from two sides: `UI_KITS` carries no block name and no `anatomy`, and the
      rendered `/start` matches no `add sidebar-*` / `add login-*` / `add dashboard-*`.
- [x] `/start` says so in words the assistant acts on: *"What is on the screen is still theirs to
      have decided"* and *"Never copy a layout from a swatch"* — both asserted.
- [x] The three differ where a founder can hold an opinion — accent, ground, surface treatment and
      brand treatment are unique per direction, and not all in one temperature. Asserted on the
      palette that is actually *shown*, so a dark-first direction cannot pass by its unused light one.
- [x] **This is also why `/start` got fast.** The removed step was `add` pulling a block's whole
      component tree, the provider it needs and a route it renders at. What is left is `init` plus a
      stylesheet write.

> **Why not a real company's site.** A screenshot of a named product is that company's trade dress,
> which no code licence grants — issue #165 says so and spec 159 drew the same line. What ships is a
> theme we wrote, rendered by us, on a permissively licensed library installed at a pinned version.

**Picking by picture**

- [x] The design question shows each direction as a **real capture** of that theme —
      `apps/web/public/ui-directions/*.jpg`, taken by `pnpm capture:ui-kits`, which scaffolds an app,
      runs the pinned CLI, writes the theme and photographs a **specimen** of it.
- [x] A specimen, never an application: no navigation, no sidebar, no table — asserted, so a picture
      can never start promising a layout again.
- [x] The three are genuinely different pages, not one page in three palettes: `design.composition`
      (`left-stacked`, `centred`, `terminal`) is part of the visual language, each is expressed in
      its own markup, and an unknown composition throws rather than silently photographing whichever
      page came first.
- [x] The captures are ours by construction — our theme, our markup, our Airrow branding, rendered by
      us. A test asserts no third-party product name appears in the question **or in the themes**
      (spec 159's rule, carried forward and widened), and that no literal colour reaches the markup.
- [x] **`UiKitPreview` falls back to a drawing when no capture is set**, generated from the same
      record — so a stale capture can always be deleted back to something that is true by
      construction. Both paths are pictures of the same visual language.
- [x] The caption describes the *look*, never a layout: `light-first · airy spacing · hairlines`,
      generated from `design`, capped at 70 characters, and a test fails on any layout word in it.
- [x] The label and description remain the accessible content; the drawn fallback is `aria-hidden`
      and the capture carries the direction's name and caption as its `alt`.
- [x] The sixth option is **"None of these — I'll show you"**: it opens the link field and the upload
      instead of leaving the founder in front of an empty box. It installs nothing, carries no
      prefill and resolves to no kit — asserted, including that exactly one option plays that role.

> **The capture pipeline is committed, not improvised.** `scripts/capture-ui-kit-previews.mjs` plus
> `scripts/specimen.mjs`, with the pure halves (reading the kits, building the theme, building the
> specimen, writing the result back) covered by `scripts/capture-ui-kit-previews.test.mjs`. The
> browser half cannot be tested and is a manual re-run whenever a token moves.

**Fewer questions, asked in a better order**

- [x] **`mvpFocus` merged into the vision question** — "What must it do first, and where is it
      heading?" The two only mean anything next to each other, and on consecutive screens a founder
      wrote the same sentence twice. The **field stays**, the `nonGoals` treatment from spec 159:
      `mvpFocus` is `/start`'s ceiling in §0 and appears in six generated documents, so removing the
      field would be a constitution change rather than one fewer question. `ANSWER_MAX_CHARS.vision`
      300 → 500, sized for two answers.
- [x] `coreAction(model)` replaced four copies of `mvpFocus || description`, so the fallback to the
      merged answer is decided in one place rather than four.
- [x] **`/start` is told which half of that answer is the ceiling.** The merged question produces a
      sentence containing both the first thing and the long-term one, and `/start` receives the whole
      of it as "the core action to perform" — so it now says plainly that a clause about where this
      is heading is context, never a second thing to build, and that the smaller reading wins when
      the two are hard to tell apart. Without it the question merge would have quietly widened §0's
      ceiling from `mvpFocus` to the vision.
- [x] **`integrations` merged into `coreEntities`** — "What are the main things in it, and what does
      it plug into?" — and that question **moved after `capabilities`**, because half of it is about
      the capabilities just chosen. Both asserted, order included. `integrationsText` points at that
      answer instead of claiming nothing was named.
- [x] A stored `uiKit` naming a **retired** direction is dropped, not rejected. Found in a real run:
      a project saved while `stark_technical` was on offer could no longer generate once that
      direction was renamed — the enum refused the id and took every other answer down with it. The
      list is still closed; nothing outside it ever reaches `uiKitFor`.
- [x] The interview's worked example is one product end to end (Pied Piper, file compression) rather
      than a different domain per placeholder.

**A way out of a project that was refused**

- [x] **Delete sits beside Generate on the review screen** — the screen a founder whose answers were
      refused is actually looking at, deciding between rewriting and abandoning. Until now the only
      way out was a project page they had no reason to visit.
- [x] Injected as a node (`destroy`), so the confirmation dialog and the server action stay in
      `features/projects` and the shared runtime keeps knowing nothing about how a project is
      deleted — and the guest path, which has no project, gets nothing.

**`UI_ARCHITECTURE.md` names it**

- [x] A tenth section, **Design system**, names the chosen theme, the pinned version and the licence,
      and points at `THIRD_PARTY_NOTICES.md`.
- [x] With no direction picked, the document says so plainly and every other section renders exactly
      what it rendered before — asserted.
- [x] The interpret-don't-reproduce rule for the founder's *own* references survives unchanged
      alongside the new "this one is ours" rule for the theme — both asserted in one test.
- [x] `DOCUMENT_MAX_CHARS` for the brief raised 5000 → 7000. **This was owed already:** spec 159 grew
      the document to nine sections and recorded the raise as done, but the code kept the
      four-section 5000 — so the brief has been one long answer from silently falling back to its
      template ever since. Recorded on spec 159 too.

**`/start` installs it**

- [x] `/start` installs the theme at the pinned version, at the point in section 2 where it already
      initialises shadcn/ui — no new section, no new power, no new step for the founder.
- [x] The build step is told to use that theme by name, and that overriding it by hand is a bug.
- [x] The `mvpFocus` ceiling (spec 123 / constitution §0) is intact — asserted with a picked theme,
      alongside the line-by-line assertions `start-command.test.ts` already carries.
- [x] On a stack the theme cannot install into, the foundation falls back to prose-only and **says
      so** in `UI_ARCHITECTURE.md`. Which directions are offered is never restricted: the design
      question is asked before the stack is known, so `resolveProjectModel` settles it in one place.
- [x] An **imported** project resolves to no theme for the same reason, one branch further: its
      `/cleanup` installs nothing at all.

**Attribution**

- [x] A foundation whose first-run command installs shadcn/ui carries the notice in
      `THIRD_PARTY_NOTICES.md` at the repo root — **every Tailwind stack, whether or not a direction
      was picked**, since that install already happens today.
- [x] The notice carries the licence in full with the real holder, not a summary — an MIT licence is
      satisfied whole or not at all.
- [x] It ships in the foundation itself, so ZIP delivery carries it exactly as a repo does.
- [x] A custom stack and an imported project get no notice — asserted in both directions, against a
      new project on the same stack as the contrast.
- [x] The notice says the theme itself is ours and carries no third-party claim.

**Keeping the pins honest**

- [x] The pins live in one checked-in record alongside the licence, and a test fails if any is
      missing or non-exact.
- [x] A weekly workflow (`.github/workflows/ui-kit-pins.yml`) compares each pin against the registry
      and **opens an issue** — commenting on the open one rather than opening a second. It never
      bumps anything: a version bump changes generated output, which is a product decision under §V's
      snapshot rule, not a chore a robot may land.
- [x] The checker fails loudly when it finds no pins at all, so a changed source shape reads as a
      broken check rather than a clean bill of health — covered in `scripts/`.

**Contract & consistency**

- [x] `INTERVIEW_SCHEMA_VERSION` → `"5"`, `GUEST_DRAFT_VERSION` → `8`, `PROMPT_VERSION` → `"11"`; an
      answer set saved before `uiKit` existed resolves to the no-pick path rather than failing.
- [x] The theme reaches the model as **facts to restate, not taste to choose** — `designSystem` in the
      shared answers block, plus one `UI_ADDENDUM` rule against contradicting or inventing one.
- [x] Constitution §0 and `CLAUDE.md` updated in the same change.
- [x] `specs/README.md` status set to ✅.
- [x] Typecheck passes; lint adds no new issues; tests green — see _Implementation notes_.

### Verification

> **Implementation notes (`/implement`, 2026-08-02).**
>
> **Three things the implementation decided that the plan left implicit.**
> 1. **The preview is drawn, not photographed** — see the deviation recorded above. The spec's own
>    goal (the picture and the theme must not disagree) is better served by deriving one from the
>    other than by capturing one and hoping.
> 2. **`uiKit` needed `SATELLITE_ANSWERS` to exist at all.** `pruneHiddenAnswers` walks
>    `interviewQuestions` and keeps what it finds, so an answer no question claims was dropped on
>    every save — spec 159 had noted exactly this as the reason not to store the pick. Rather than
>    make `uiKit` a question (which would un-merge the design screen spec 159 deliberately merged),
>    it is declared as an answer *owned by* `uiDirection`, so it is pruned precisely when its owner
>    stops being visible.
> 3. **An imported project resolves to no theme**, alongside the custom-stack case the spec named.
>    `/cleanup` installs nothing, so a foundation naming a theme it never installed would be the same
>    class of untrue statement the pin exists to prevent.
>
> **Two things found in the code that the spec was written without.**
> - **`shadcn@latest` was the line `/start` actually ran** ([scaffold.ts:550](../packages/engine/src/scaffold.ts#L550)),
>   and no generated repository has ever carried the MIT notice for it. Pinning the version forced
>   looking the licence up, which is how a two-year-old obligation nobody had discharged turned into
>   one file. The version and licence were verified against the registry, not assumed: `shadcn`
>   4.16.1, MIT, © 2023 shadcn.
> - **`DOCUMENT_MAX_CHARS` for the UI brief was still 5000**, though spec 159 had checked off raising
>   it to 7000 for its nine sections. The criterion was true in the spec and false in the code since
>   that branch. Raised here, and recorded on spec 159 rather than silently corrected.
>
> **One existing test changed, because the rule under it changed:** `start-command.test.ts`'s two
> assertions on `shadcn@latest` now assert the pin. That is the point of the change, not collateral.
>
> **Second pass, same branch — one question, and a picture worth choosing from.** Three changes, on
> explicit direction after the first pass landed:
> 1. **The two UI questions became one.** `uiReferenceLinks` stopped being a question and became a
>    satellite answer of `uiDirection`, collected on the same screen. The `references` question type
>    went with it, replaced by a `references` flag on the one question that has them.
> 2. **The previews became working screens.** Each direction now carries a `UiKitAnatomy` — where
>    navigation lives, how many destinations, summary tiles, what the working surface is, how many
>    rows at what height, whether there is a chart, what form the primary action takes — and the
>    preview draws exactly that. What a founder chooses between is a shape, not a palette.
> 3. **The description is generated from the same record.** `describeUiKit` writes the caption from
>    `anatomy`, so the words and the picture are one fact rather than two that have to be kept in
>    step. A hand-written caption is right once; this one is right after the next edit too.
>
> **One regression the second pass introduced and caught** — the same one spec 159 recorded, one
> answer later. `FLAGGABLE_ANSWERS` is derived from the question set, so `uiReferenceLinks` fell off
> it the moment it stopped being a question, and the model quietly lost the ability to name the
> reference list that made an interview unusable. It now derives from the questions **plus** the
> typed satellites, and `authoring.test.ts` asserts both that and that `uiKit` is never flaggable —
> a picked option cannot be the reason answers do not describe a software product.
>
> **Third pass, same branch — real templates, and a way out that leads somewhere.** Two changes, on
> explicit direction after the second pass:
> 1. **A direction now installs real published blocks**, not only a theme. Each carries a navigation
>    shell and a sign-in screen from the library's own registry, installed by name at the pinned
>    version. Every name was checked against the live registry before it was written down, and every
>    one carries no npm dependency of its own — which is what keeps this presentation rather than a
>    second feature. The registry's dashboard block was considered and left out for exactly that
>    reason: it brings a drag-and-drop table and a charting library for features nobody asked for.
> 2. **The sixth option stopped being an empty box.** "None of these — my own words" became "None of
>    these — I'll show you", and picking it opens the link field and the upload. The way out of five
>    pictures is now a sixth picture rather than a blank textarea, which is what a founder who
>    rejected all five was actually reaching for.
>
> **One thing attempted and withdrawn rather than shipped half-done.** A capture script, to produce
> real screenshots of the installed blocks, was written and deleted: it needed a running browser and
> a served app, and what existed was scaffolding with TODOs in it. `UiKit.screenshot` is the seam and
> `UiKitPreview` honours it; what is missing is one real run, named in the manual checks.
>
> **Closing pass (`/analyze`, 2026-08-03).** The cross-check failed on its first run and the failure
> was worth having: eleven passes of implementation had outgrown the criteria, and six ticked lines
> still described `blocks`, `anatomy` and an unset `screenshot` — none of which exist. Rewritten to
> what shipped, with criteria added for the three changes that had only ever been recorded in these
> notes (the vision merge, the integrations merge and its move after `capabilities`, the Pied Piper
> example). **Two bugs found by a real run against localhost and fixed here:**
> 1. **A retired `uiKit` bricked a saved project.** A project answered while `stark_technical` was on
>    offer failed `interviewAnswersSchema` outright once that direction was renamed — the enum
>    refused the id and took every other answer with it, so the founder could not generate at all.
>    Unknown ids are now dropped rather than rejected; the list stays closed.
> 2. **No way out of a refused project.** The "these answers weren't accepted" screen offered only
>    "generate again", and the delete button lived on a project page that founder had no reason to
>    visit. Delete now sits beside Generate, injected so the guest path still has nothing to delete.
>
> **And one gap `/analyze` found on its own:** `scripts/engine-smoke.mjs` still set `mvpFocus` and
> `integrations` on all five fixtures — answers no question produces any more — and asserted
> `VISION.md` contained the first. §V says adding a question requires updating fixtures; removing two
> does too. The MVP sentence is folded into each fixture's `vision`, the way the merged question asks
> for it, rather than deleted.
>
> **Eleventh pass — the real mark, and the MVP focus folded into the vision question.**
> 1. **The specimens carry the approved Airrow artwork**, copied into the scratch app rather than
>    redrawn — `components/brand/mark.tsx` records why there is no vector original, and a traced path
>    would be a different logo. Bold contrast shows **the mark alone**, which is the most direct thing
>    that direction says; the other two show the mark beside the word.
> 2. **`mvpFocus` merged into the vision question** rather than simply disappearing. "What must it do
>    first, and where is it heading?" — the two only mean anything next to each other, and on
>    consecutive screens a founder wrote the same sentence twice. `ANSWER_MAX_CHARS.vision` 300 → 500,
>    because a cap sized for one answer would cut the second off mid-sentence.
> 3. **`coreAction(model)` replaced four copies of `mvpFocus || description`.** With the answer now
>    living in `vision`, the fallback had to change at every site that decides what `/start` builds —
>    and four copies of that decision is four chances for one to fall out of step.
> 4. The remaining question was reworded ("What are the main things in it, and what does it plug
>    into?"), and the terminal direction was softened from a full shell session to a page *with* a
>    terminal in it: a headline, prose, and the session as one element beside them.
>
> **Tenth pass — a terminal direction, and two questions fewer.** On explicit direction:
> 1. **Clean product became Stark & technical:** a terminal. Near-black, phosphor green, monospace at
>    one size and one weight, sharp corners, single-pixel outlines. Its composition is `terminal` and
>    its brand mark is a shell prompt — the specimen is a command and its output, with no headline and
>    no marketing voice. `split` went with it rather than being left as a page nothing can reach.
> 2. **`mvpFocus` is no longer asked, and the field stays** — the `nonGoals` treatment (spec 159), and
>    for a stronger reason: it is `/start`'s ceiling in constitution §0 and appears in six generated
>    documents, so deleting the field would be a constitution change rather than one fewer question.
>    Every reader of it already fell back to the project description, and an import analysis can still
>    derive one. **Flagged rather than assumed:** if the intent was to remove the *concept*, that is a
>    §0 amendment and a separate spec.
> 3. **The core-objects and integrations questions became one.** They were circling the same ground —
>    what this product is made of, and what it talks to. `integrationsText` now points at that answer
>    instead of claiming nothing was named.
> 4. The radius left the caption (`0.125rem corners` is a value beside a picture that already shows
>    the corners), the terminal specimen was set much larger so it survives being a thumbnail, and the
>    Bold contrast mark was enlarged twice on request.
>
> **Ninth pass — Airrow's own brand in the specimens, and three pages instead of one.** On explicit
> direction, twice asked for and taken:
> 1. **The specimens are branded Airrow** and carry Airrow's own copy. I had argued against it — a
>    founder looking at these to picture *their* product might wonder why the preview is about
>    foundations — and was overruled. Recorded rather than re-argued; `scripts/specimen.mjs` is one
>    file to change if it reads wrong in front of a real founder.
> 2. **`design.composition` joined the visual language:** `left-stacked`, `centred`, `split`. It is
>    how the brand, headline and one action sit on a page someone lands on — the part of a look that
>    is visible in a thumbnail — and it is carefully *not* app layout: still no navigation, no
>    sidebar, no table, still asserted. Without it the three specimens were one page in three
>    palettes, which made the question a colour picker with extra steps.
> 3. **Three real pages now:** editorial left axis with a large wordmark; a centred statement with an
>    oversized headline and a mono command; a split product hero with a soft-shadowed panel. A test
>    asserts the three pages differ, that each composition is actually expressed in its markup, and
>    that an unknown composition throws rather than silently photographing whichever page came first.
> 4. The specimen moved to its own module — three compositions is a page of markup each, and it was
>    burying the runner.
>
> **Eighth pass — a direction is a look, not a layout.** On explicit direction, and it changed what
> the feature *is*:
> 1. **`blocks` is gone.** Installing `sidebar-07` meant a founder who picked a palette also picked a
>    navigation shell, and the first screen then had one whether or not their product wanted it — the
>    picture outranking what they wrote. `UiKitAnatomy` (nav position, row counts, surface kind) went
>    with it, replaced by `UiKitDesign`: brand treatment, headline, typography, radius, spacing,
>    surfaces, motion. `/start` installs the theme and the primitives, and builds the screens the
>    answers describe.
> 2. **That is also why `/start` is faster.** The removed step was `add` pulling a block's whole
>    component tree, the provider it needs and a route it renders at. What is left is `init` plus a
>    stylesheet write.
> 3. **Three new directions, aimed at someone launching a company:** Soft minimal, Bold contrast,
>    Clean product. All minimal, all leading with the brand mark; they differ in colour, contrast and
>    surface — asserted, since three near-neighbours would be a worse question than one.
> 4. **The preview is a specimen**, not an application: brand mark, headline, palette, one action,
>    two surfaces. The capture script renders that page instead of installing blocks, and a test
>    asserts no specimen contains a sidebar, a nav or a table.
> 5. **The caption stopped counting things.** It described navigation and rows, which is exactly the
>    promise this pass removes; it now names colour temperature, spacing, surface and corner, and a
>    test fails on any layout word appearing in it.
>
> **Seventh pass — content worth photographing.** The blocks ship their working area as grey
> placeholder rectangles, so two thirds of every capture was empty. `seedContent` now replaces them
> with a real screen — three figures and a table of accounts — built only from the theme's own tokens,
> so each direction colours it itself and no value is hardcoded. The sample data is deliberately
> ordinary rather than Airrow's own: a founder is looking at these to picture *their* product, and a
> preview full of our nouns invites the reasonable question of why their app is about foundations.
>
> Three things this pass got wrong first and fixed by looking:
> 1. **Matching the registry's exact markup was brittle.** The JSON says `h-[100vh]`; the CLI writes
>    `h-screen`. One direction came back with seeded tiles above an untouched grey slab. The matcher
>    now recognises the placeholder by its `bg-muted/50` and decides by shape, and the run warns when
>    any placeholder survives rather than leaving it to be noticed in the picture.
> 2. **A filled neutral badge was white on white.** `bg-muted` renders near-white in the two dark
>    themes, so "Review" was legible only in the theme it was written in. Bordered now, not filled.
> 3. Both are covered by tests over both spellings, plus one asserting no literal colour reaches the
>    markup — a hex there would look right in one direction and wrong in the other two.
>
> **Sixth pass — the captures exist, and looking at them changed two things.** `pnpm capture:ui-kits`
> was run for all three directions. Real screenshots of the real blocks now ship in
> `apps/web/public/ui-directions/`, and `UiKit.screenshot` points at them.
>
> Two defects were visible the moment there was something to look at, and neither was findable any
> other way:
> 1. **`sidebar-13` was the wrong block.** Its page renders a button that opens a settings dialog,
>    not an application shell — the capture was a black rectangle with one button on it. It had been
>    chosen from a description of the block rather than from what it renders. Replaced with
>    `sidebar-15`, which is a real dense workspace: two panels, a calendar, the blue accent.
> 2. **A capture breaks the caption guarantee unless the caption moves too.** `describeUiKit` is
>    generated from `anatomy`, which describes the *drawing*; the real blocks have their own
>    navigation and their own row counts, so that line became a confident description of a screen the
>    founder is not looking at — precisely the failure this record was built to prevent. `uiKitCaption`
>    now branches: photographed, and it names what was installed; drawn, and it names what was drawn.
>    Asserted in both directions.
>
> **Fifth pass — the first real run, and the two product bugs it found.** The capture script was run
> against the live registry, and the command `/start` ships turned out to be broken in two ways that
> no test could have caught, because both are facts about a CLI rather than about our text:
> 1. **`--base-color` does not exist in shadcn 4.x.** `init` failed outright with
>    `error: unknown option '--base-color'`. The base colour is a `components.json` field now. Every
>    founder on a Tailwind stack would have hit this on their first `/start`.
> 2. **`--yes` is not non-interactive.** `init` still asks which component library and which preset,
>    with arrow-key prompts an assistant cannot answer — it would have waited until something timed
>    out. The command is now `init --yes -b radix -p nova`, verified to run unattended.
> 3. **And the installed screen answered 500.** The sidebar blocks render tooltips; without
>    `TooltipProvider` around the root layout's children, `/dashboard` throws. `add` prints the
>    instruction on the way out, and `/start` now carries it — plus "load the route and confirm it
>    renders", because a command that stops at "installed" hands the founder a broken screen.
>
> All three were found by running `create-next-app` → `init` → `add` → `next dev` → HTTP against the
> real thing, and all three are now asserted. This is exactly the manual check the spec said it owed,
> and it earned its keep on the first attempt.
>
> **Fourth pass, same branch — fewer directions, shorter words.** Three changes, on explicit
> direction:
> 1. **Five directions became three.** Warm & consumer and Bright & editorial were cut. Every count
>    that used to be a literal — the option list length, the preset count — now derives from
>    `UI_KITS.length`, so the next cut cannot leave a test asserting a number nobody ships.
> 2. **Dense & operational took the editorial layout**, dark and blue: a top bar rather than a
>    sidebar, a reading list rather than a table, no summary tiles. Its `density` moved `compact` →
>    `regular` in the same edit, because `density` is what the caption turns into "spacing" and 28-unit
>    rows described as tight would have been the exact contradiction this record exists to prevent.
>    Its description and prefill were rewritten to match; leaving them would have left the words
>    describing the screen it used to be.
> 3. **The caption became a spec line.** One `·`-separated line under 70 characters, asserted.
>
> **Verification bar** (after all four passes): `pnpm -r typecheck` clean · `pnpm -r lint` clean ·
> `pnpm -r test` **1,308 passed** (110 schemas + 303 engine + 895 web; 103 skipped are the
> local-Supabase suites, unchanged) · `pnpm test:scripts` **95 passed** · `pnpm engine:smoke` passed
> on all fixtures. No pre-existing failures.
>
> **Still owed a real run.** No test installs anything: what is asserted is that `/start` *says* the
> pinned version and writes the theme's tokens. Running it against a real machine is the manual check
> below, and it is the one that proves the whole spec.

_Every criterion above is proven by a test, existing wiring, or the manual check named here._

- **New tests** — `packages/schemas/src/questions.test.ts` (5): each of the five options resolves to a
  kit and the sixth to none; every kit pins an exact version and a permissive licence with a holder;
  the licence text is carried in full; every palette value is a real colour in both themes; no
  third-party product name anywhere in the kits.
- **New tests** — `packages/schemas/src/questions.test.ts` (2): `uiKit` survives a save with drifted
  prose, and `SATELLITE_ANSWERS` ties it to the question that owns it.
- **New tests** — `apps/web/src/features/interview/InterviewRuntime.test.tsx` (5): picking records the
  kit alongside the words; **rewriting every word of the prose keeps the pick** — the regression that
  replaces spec 159's derivation; re-picking swaps it; "my own words" clears it; each direction that
  installs something is drawn and the one that does not is not.
- **New tests** — `packages/engine/src/scaffold.test.ts` (4): the brief names theme, version and
  licence; the no-pick path says so with the command rendered rather than tokenised; a custom stack
  installs nothing; the founder's own reference rule survives beside a picked theme.
- **New tests** — `packages/engine/src/start-command.test.ts` (10): the pin is exact and `@latest`
  survives nowhere; the base colour and both themes' tokens are written; the build step names the
  theme; no pick still pins; a custom stack gets no theme; the `mvpFocus` ceiling holds; and the
  notice ships with the licence in full, for a picked and an unpicked direction, and not at all to a
  stack that installs none of it.
- **New tests** — `packages/engine/src/cleanup-command.test.ts` (2): an imported project installs no
  theme and gets no notice, against a new project on the same stack as the contrast.
- **New tests** — `scripts/check-ui-kit-pins.test.mjs` (6): the pins are read out of the real source;
  an empty read is a failure, not a pass; version comparison is numeric, not lexical (`4.9.0` vs
  `4.16.1` is the case a string compare gets backwards); an unparseable version is quiet.
- **Changed tests** — `packages/engine/src/start-command.test.ts`: the two `shadcn@latest` assertions
  now assert the pin.
- **Manual, still owed** — `/start` run on a real machine for one picked direction: the pinned CLI
  installs, the blocks land as real files, the theme lands in the stylesheet, and the first screen is
  recognisably the picture that was picked. Nothing here installs anything, so this is the check that
  proves the spec.
- **Manual, still owed** — `pnpm capture:ui-kits`, run locally. It scaffolds a real app per
  direction, installs that direction's blocks with the pinned CLI, writes its theme, photographs
  `/dashboard`, and points `UiKit.screenshot` at the result. Its pure parts (reading the kits,
  building the theme, patching the source) are covered by `scripts/capture-ui-kit-previews.test.mjs`;
  the browser half cannot be, which is why this is a manual check. Until it is run the drawn preview
  ships — correct, but a drawing.

---

## Exact changes (file:line)

**Schemas (`packages/schemas`)**

1. **`src/ui-kits.ts`** (new) — `UiKitSource`, `UiKit`, `UiKitPalette`, `PERMISSIVE_LICENCES`,
   `SHADCN_UI` (pinned 4.16.1, MIT, © 2023 shadcn), the five `UI_KITS`, `uiKitFor`, `uiKitSources`.
2. **`src/types.ts`** — `uiKit?: string` on `InterviewAnswers`, `uiKit: UiKit | null` on `ProjectModel`.
3. **`src/questions.ts`** — `SATELLITE_ANSWERS`; `pruneHiddenAnswers` carries a satellite while its
   owner is visible; `uiDirection`'s help text says a pick installs a theme;
   `INTERVIEW_SCHEMA_VERSION` → `"5"`.
4. **`src/index.ts`** — `uiKit` in `interviewAnswersSchema`, closed to the five ids; re-export.
5. **`src/authoring.ts`** — UI brief ceiling 5000 → 7000 (owed since spec 159; see the notes).

**Engine (`packages/engine`)**

6. **`src/model.ts`** — resolve `uiKit`, null for a custom stack and for an imported project.
7. **`src/scaffold.ts`** — `designSystemStep` pins the CLI and passes the theme's base colour;
   `themeStep` writes both palettes; `uiDesignSystem` and `thirdPartyNotices` behind two new tokens;
   `startMinimum`'s styling line names the theme; `shipsPath` gates the notice.
8. **`template/docs/architecture/UI_ARCHITECTURE.md`** — the tenth section.
9. **`template/THIRD_PARTY_NOTICES.md`** (new) · **`template/.airrow-template.json`** — both tokens.

**App (`apps/web`)**

10. **`src/features/interview/UiKitPreview.tsx`** (new) — the drawn preview.
11. **`src/features/interview/InterviewRuntime.tsx`** — `applyAnswers` (a patch, so the words and the
    pick are never observed apart); the picker draws each kit and stores the pick.
12. **`src/features/interview/draft-schema.ts`** — `GUEST_DRAFT_VERSION` → `8`.
13. **`src/features/generation/author.ts`** — `designSystem` in the shared answers block, the
    `UI_ADDENDUM` rule, `PROMPT_VERSION` → `"11"`.

**Repo**

14. **`.github/workflows/ui-kit-pins.yml`** + **`scripts/check-ui-kit-pins.mjs`** (both new) — weekly
    pin check that reports and never bumps.
15. **`.claude/spec-kit/constitution.md`** §0, **`CLAUDE.md`**, **`specs/159-ui-reference-start.md`**.

**Barely changed:** the authoring provider. Theme name, version and licence are deterministic engine
output — `UI_ADDENDUM` gains one rule, *do not contradict or invent a named theme*. The model
describes the screen; it does not choose what is installed.

**No change needed:** `checkAllowance` and the plan model; the two-Claude-caller rule (the theme rides
the existing answers block); `memo.ts` (`inputsHash` hashes the answers, so `uiKit` is in it already).

---

## Data model

**No schema changes, and no assets either.** A direction is static data in `packages/schemas`, and its
picture is drawn from that same data at render time — nothing is stored, uploaded or served. `uiKit`
is one more optional string on `InterviewAnswers` (and a resolved `UiKit | null` on `ProjectModel`),
which is a contract change — `INTERVIEW_SCHEMA_VERSION`, `GUEST_DRAFT_VERSION` — rather than a
database one.

### Constitution Check

| Invariant | Verdict |
| --- | --- |
| §0 "never application code from our servers" | Held, if what ships is a name + version + install command. A vendored component would breach it. |
| §0 `/start` ceiling (`mvpFocus`) | Unchanged — this changes what the screen is built *from*, not how much gets built. |
| §0 trade dress (spec 159) | Held — our own blocks are ours to reproduce; a founder's reference stays direction to interpret. |
| §I engine purity | Held — static records, no env, no network. |
| §III tokens not literals | Held — the generated repo keeps its own design system. The theme *is* that system, shipped as CSS variables; components use tokens exactly as they do today. |
| §V fixtures | Adding/changing a question requires updating fixtures. |

---

## Security

Adds no server-side surface: the directions are static data, nothing is fetched from an upstream site
at generation time, and the install happens on the founder's machine under their own command. Supply
chain: `/start` installs a third-party package at a version we chose, and the mitigation is the exact
pin — which is a **tightening**, since the line it replaces is `shadcn@latest`. The founder's own
lockfile is the integrity record once installed; we deliberately do not invent a hash mechanism we
cannot verify offline.

---

## Edge cases

- Founder picks a direction, then attaches their own screenshot → the theme still installs, and their
  reference wins over it wherever the two disagree. The theme is the starting point, not the verdict.
  Spec 159's rule is untouched: their reference is direction to interpret, our theme is ours to
  reproduce.
- Founder picks a direction, then rewrites the prose completely → their words are the brief and the
  theme still installs. Only "None of these" unpicks it, which is the one place it is unambiguous.
- Upstream yanks or breaks the pinned version → the install fails, and `/start`'s existing rule
  applies unchanged: print the bar as far as it got, say which step failed, and stop
  ([start.md:36](../template/.claude/commands/start.md#L36)). No substitute is improvised, and no
  new rule was needed for it.
- Founder is offline when `/start` runs → the same path, for the same reason.
- Direction picked on a stack that cannot take one → `resolveProjectModel` resolves `uiKit` to null,
  and the brief says nothing was installed. Which directions are offered is never narrowed, because
  the design question is asked before the stack is known.
- Founder picks nothing → today's behaviour exactly, and the notice still ships: the library is
  installed either way, so the attribution is owed either way.
- Founder later removes the installed theme → their repo, their call; nothing in the foundation
  depends on it still being there.

---

## Out of scope

- Vendoring any third-party component source into Airrow or into a generated repo — that is the line
  §0 draws, and this spec stays on our side of it.
- Paid or restrictively-licensed sets (Tailwind Plus, ThemeForest and similar) — downloadable is not
  redistributable inside a generator.
- Generating images, icons or logos (spec 159, unchanged).
- Retroactively regenerating existing foundations — [spec 100](100-pro-upgrade-revisions.md) covers it.
- A general theme/token picker UI — still out, as it was in spec 159.
