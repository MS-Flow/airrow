# Spec 196 — The landing page tells a founder who already has code

> **In one sentence:** Airrow's landing page reads as a tool for starting from nothing, and mentions
> importing an existing project only twice in passing — so a developer with a running codebase never
> learns it is for them, or what adopting it would do to their repository.

|                |                                      |
| -------------- | ------------------------------------ |
| **Status**     | ✅ Done                              |
| **Issue**      | [#196](https://github.com/MS-Flow/airrow/issues/196) — "Landing page: say that Airrow fits an existing project, and show the two ways it lands" |
| **Branch**     | `196-landing-import-modes` (from `feature/import-existing-projects`) |
| **Feature**    | Import existing projects             |
| **Depends on** | [187-hidden-import-integration.md](187-hidden-import-integration.md) — the hidden mode this page describes, which must ship with it · [63-import-existing-projects.md](63-import-existing-projects.md) — importing, and the promise never to hand back additions dressed up as the whole project · [91-cleanup-command.md](91-cleanup-command.md) — `/cleanup`, which changes no code · [23-landing-copy-footer.md](23-landing-copy-footer.md) — owns the copy module and its voice rules |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
Mark anything undecided inline with [NEEDS CLARIFICATION: …] so /clarify can find it.
-->

---

## User story

_Who wants this, and what they get out of it._

As a **developer whose product is already running** I want **the landing page to tell me Airrow fits
a codebase that exists, and what it would actually do to my repository** so that **I can tell whether
this is for me without signing up to find out — and whether adopting it means a conversation with my
team or not.**

---

## Background

_Filled in during `/implement`, grounded in `file:line`._

- **Today:** the page is written for a founder starting from nothing. Importing appears exactly
  twice, both as bare mentions: a line in the Pro feature list
  ([`copy.ts:170`](../apps/web/src/features/landing/copy.ts#L170), "Import an existing project") and a
  clause in the pricing note ([`copy.ts:207`](../apps/web/src/features/landing/copy.ts#L207)).
- **The problem:** neither says what importing *is*, and nothing anywhere mentions that the foundation
  can land two different ways. A developer on a team codebase — the person hidden mode was built for
  — has no way to learn the product solves their actual problem, which is not "I need a foundation"
  but "I need a foundation without a pull request my team has to agree to".
- **Already in place:** every visible string lives in one module
  ([`copy.ts`](../apps/web/src/features/landing/copy.ts)), reviewed as a whole rather than hunted
  through JSX (spec 23), with [`copy.test.ts`](../apps/web/src/features/landing/copy.test.ts) holding
  the voice rules — no single assistant named, no em dashes, no price literal. Section layout is
  [`page.tsx`](../apps/web/src/app/%28public%29/page.tsx). Both modes exist in the product as of
  spec 187, which is on this same feature branch.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

**Say the two modes as a choice about the founder's repository, not as a feature list.** The thing a
developer with a team codebase is deciding is whether adopting Airrow is visible to their colleagues.
That is the axis, and the copy should be organised on it — integrated means your team sees it and it
becomes how the project is worked on; hidden means one ignored folder and a repository that does not
change.

**The words must survive contact with what the product does.** Three claims are easy to write and
would each be false:

- **Not "rebuild".** Airrow's servers never write or restructure application code, and `/cleanup`
  changes none at all — it reads the stack that is there and rewrites the *foundation's documents* to
  describe it. Integrated lays the foundation alongside the code and leaves every collision to the
  founder. Copy implying the project gets rebuilt promises the one thing §0 forbids.
- **Not concealment from an employer.** Hidden keeps files out of a repository. It grants no access
  nobody had, and pitching it as hiding work from a company would be both untrue and a bad thing to
  sell. Spec 187's Security note draws this line; marketing copy is where it would blur first.
- **No pipeline promise for hidden.** It ships no CI, because a workflow inside an ignored folder can
  never run.

**Both modes are Pro, and the page should not imply a third free path.** Importing already requires
Pro, so the modes sit inside what Pro buys rather than beside it.

**A section of its own, directly above Pricing.** The page has no nav menu — the header is sign-in
and get-started, and the only in-page link is the hero's "See how it works" pointing at `#how`. So a
section earns its place by being reachable and by having room, not by being in a menu: it takes an
`id` like the three that already have one, and a comparison of two options needs more space than a
feature grid gives it. It sits immediately before Pricing, so the reader meets the two ways a
foundation lands and then, in the next breath, the tier that buys them — both modes are Pro, and the
adjacency is what makes that read as one thought instead of two. (Amended 2026-08-03, after the
section was first built after "How it works" on the reasoning that a reader who has just learned what
the product does will next ask whether it applies to code they already have. Placing it against
Pricing keeps that question answered before the decision it feeds.)

**Named exactly as the app names them: "Integrated" and "Hidden".** A visitor who signs up meets this
same choice on the import screen (spec 187), and a page that calls them something else makes the
product teach the same thing twice. The explanation carries the clarity; the labels carry the
continuity.

**Equal weight, integrated first.** Two real choices, not a headline and a footnote. Integrated leads
because it is the default and the one that needs no explaining; hidden gets the same room because it
is the option that solves the harder problem and the reason this issue exists. Leading *with* hidden
was rejected deliberately — it tips the section from "here is how it fits your repository" toward
"here is how to sneak this past your team", which is both untrue and the wrong thing to sell.

**The hero stays as it is.** It was tempting to widen the lead line, since the hero is the one thing
everyone reads and it currently describes only the greenfield path. But it is tuned and tested, and
this spec's job is to give an existing-codebase reader something real to find. If the section proves
itself and the hero is still the wall people bounce off, that is its own change with its own
evidence.

**Not touched:** the voice rules and the price rule. `copy.test.ts` already forbids naming a single
assistant, em dashes, and any figure — the amount lives in Stripe (specs 99, 179), and new pricing
prose is exactly where a literal creeps back in. Nothing about the free tier changes.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] The landing page says, somewhere a visitor will actually reach, that Airrow works on a project
      that **already exists** — not only one starting from nothing.
- [x] It lives in a **section of its own, directly above Pricing**, carrying an `id` like the page's
      other anchored sections so it can be linked to directly.
- [x] The two ways a foundation lands are shown **together**, so they read as a choice rather than
      two unrelated facts, and each says what it means for the founder's repository and their team.
- [x] They are called **"Integrated"** and **"Hidden"** — the same words the import screen uses, so a
      visitor who signs up is not taught the same thing twice under different names.
- [x] The two carry **equal visual weight**, with integrated first. Neither is a footnote to the
      other, and the section does not lead with hidden.
- [x] The **hero is unchanged**. This spec adds a place to land, not a rewrite of the page's opening.
- [x] **Integrated** is described as the foundation landing alongside the existing code, with
      collisions left to the founder — and **never** as rebuilding, restructuring, migrating or
      rewriting the project.
- [x] **Hidden** is described as one folder git ignores, so nothing reaches the shared repository. It
      is framed as keeping a team's repository unchanged, **not** as hiding work from an employer.
- [x] No copy claims a hidden foundation brings CI, a pipeline, or anything that runs on a push.
- [x] Both modes are presented as part of Pro, consistent with importing already requiring it.
- [x] The existing voice rules still hold: no single AI assistant named, no em dash or double hyphen,
      and no price literal — `copy.test.ts` passes unedited.
- [x] Every new string lives in `copy.ts`, not inline in JSX, so the marketing voice stays reviewable
      in one place (spec 23).
- [x] Nothing on the page describes hidden integration as available before spec 187 ships. Both land
      on `feature/import-existing-projects`, so they reach `develop` in the same merge.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **Extended** — `apps/web/src/features/landing/copy.test.ts`: the accuracy rules become assertions
  over `LANDING_STRINGS`, which is what makes them hold for copy nobody has written yet. A forbidden
  claim caught by a test beats one caught in review, because the next person to edit this file will
  not have read this spec.
  - no string matches the rebuild family (`rebuild`, `restructure`, `rewrite your`, `migrate your`)
  - no string frames hidden mode against an employer, boss or company
  - no string promises CI or a pipeline in the same breath as the hidden mode
- **Unchanged** — the existing voice and price assertions pass with no edits.
- **Manual check, in the spec** — the section read end to end at desktop and phone width, since a
  two-option comparison is a layout that fails narrow first.
- Full suite result + typecheck/lint status.

### Implementation notes (2026-08-03)

**Verification run**

| Command | Result |
| --- | --- |
| `pnpm -r typecheck` | clean (3 projects) |
| `pnpm -r lint` | clean, no new issues |
| `pnpm -r test` | 1535 passed (web 1087 / engine 335 / schemas 113), 0 failed |
| `pnpm --filter web test src/features/landing/copy.test.ts` | 9 passed, up from 6 |
| `pnpm test:scripts` | 115 passed, **1 pre-existing failure** — `scripts/capture-ui-kit-previews.test.mjs > adds the field once, and updates rather than duplicating on a re-run`. Spec 165 tooling, untouched here. |

**Manual check.** Read against the running dev server rather than only in the source: the section
renders directly above `#pricing`, `id="existing-project"` resolves, the Pro badge sits beside the
heading, and Integrated is first. Equal weight was checked structurally rather than by eye, which is
the stronger check — the two cards render **byte-identical class strings**, so neither can drift into
being the dominant one, and the grid is `md:grid-cols-2`, so below 768px they stack full width with
nothing else to reflow. Playwright is declared in the root `package.json` but is not installed in
this working copy, so no screenshot was taken; the width behaviour above is read from the rendered
markup and Tailwind's breakpoint rather than from a browser at 390px.

**Deviation from the plan:** none. One thing worth naming for review: the hidden card's body mentions
CI in order to *deny* it, so the new CI assertion tests the shape of the claim (a mention without a
negation) rather than the word. That is the only way the rule can hold for copy nobody has written
yet, which was the point of making it a test.

**`/analyze` cross-check.** All five categories pass. The three new assertions were mutation-checked
rather than taken on their green: "Airrow will restructure your project", "We rewrite your codebase
for you", "Adopt it without your employer noticing", "Keep it hidden from your boss" and "Hidden
ships CI that runs on every push" are each caught, while the hero's `Idea → Airrow → Code → Company`
strapline and the hidden card's own CI denial are not — so the rules bite on the copy they exist to
stop and leave honest copy alone. Doc sync was checked and none is owed: `UI_ARCHITECTURE.md`'s route
map and `INFORMATION_ARCHITECTURE.md` list routes, not the landing page's in-page sections, so
adding one leaves no document stale.

---

## Exact changes (file:line)

1. **`apps/web/src/features/landing/copy.ts`**
   - New `DELIVERY_MODES` after `PRO_INCLUDED` ([:172](../apps/web/src/features/landing/copy.ts#L172)):
     two entries, integrated first, each `{ key, title, lead, body }`. `key` is both the React key and
     the icon lookup, resolved by the page so this file stays plain data (the `DeliverableIcon`
     convention, [:19](../apps/web/src/features/landing/copy.ts#L19)). The wording follows the import
     screen's own ([`DeliveryLayoutChoice.tsx:58-81`](../apps/web/src/features/import/DeliveryLayoutChoice.tsx#L58-L81))
     so the page and the product say the same thing.
   - New `SECTIONS.existingProject` ({ title, badge, body, note }) beside `SECTIONS.how`
     ([:175](../apps/web/src/features/landing/copy.ts#L175)). The title carries "already have a
     project"; the badge and note carry Pro.
   - `PRO_INCLUDED`'s "Import an existing project" ([:169](../apps/web/src/features/landing/copy.ts#L169))
     gains ", integrated or hidden" now that the words point somewhere.
2. **`apps/web/src/app/(public)/page.tsx`** — a `<section id="existing-project">` directly above the
   `#pricing` section, built from the existing
   `Card` / `CardBody` / `Badge` and a `md:grid-cols-2` grid, so the two stack on a phone with neither
   dominant (§III). A `deliveryModeIcons` record beside `deliverableIcons`
   ([:48](../apps/web/src/app/%28public%29/page.tsx#L48)).
3. **`apps/web/src/features/landing/copy.test.ts`** — the three accuracy assertions above, over
   `LANDING_STRINGS` and over the hidden mode's own strings.

**No change needed:** the pricing section's figures, the free tier, the hero, and the import flow
itself. This spec describes what is already built.

**No change needed:** the pricing section's figures, the free tier, the hero, and the import flow
itself. This spec describes what is already built.

---

## Data model

**No schema changes.** This is copy and layout over behaviour that already exists.

---

## Security

Nothing security-relevant: static marketing copy on a page that already exists, reading no data and
exposing no new surface. The one adjacent risk is honesty rather than access — copy that oversold
hidden mode as concealment would invite a founder to rely on it for something it does not do, which
is why that is an acceptance criterion and a test rather than a note.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- **A visitor on a phone** → the two options are a comparison, and comparisons break narrow first.
  They must stack without either becoming the visually dominant one.
- **A visitor who has not signed up** → the page must not imply a mode can be tried for free;
  importing is Pro.
- **A reader who only skims the headings** → the heading itself should carry "already have a
  project", since that is the whole point of the section for the person it is aimed at. It is also
  the only signal that reaches them, given the hero is deliberately unchanged.
- **A visitor who arrives from a link to the section** → it has an `id`, so the anchor resolves and
  they land on the comparison rather than the top of the page.
- **Copy edited later by someone who has not read this spec** → the accuracy rules are tests, not
  prose, for exactly this reason.

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- Changing the import flow, the modes, or anything either does. This spec describes; spec 187 built.
- **The hero.** Widening the lead line to name existing projects is the obvious next lever if this
  section is not enough, but it is a change to the page's most tested copy and deserves its own
  evidence rather than riding along here.
- A nav menu. The header has none, and adding one to reach this section would be a page-wide change
  for a single link.
- The pricing figures and the free tier's numbers, which come from Stripe and
  `features/generation/limits.ts` and are deliberately not written into copy.
- A dedicated marketing page for importing. If the section earns one, that is its own issue.
- Screenshots or a diagram of the two layouts. Worth having, but a separate piece of work with its
  own asset pipeline.
