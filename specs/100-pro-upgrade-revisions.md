# Spec 100 — The upgrade moment, and revising a foundation

> **In one sentence:** Make the free limit something a founder sees coming rather than collides with,
> and give them the thing that makes hitting it bearable — reopening the interview, changing an
> answer, and seeing exactly which files that moves before anything is written.

|                |                                                          |
| -------------- | -------------------------------------------------------- |
| **Status**     | ⏳ Not started                                            |
| **Issue**      | #100 — "Uppgraderingsögonblicket: var foundern möter Pro, och vad hen ser" · #101 — "Pro: ändra ett svar och generera om — med diff mot förra versionen" |
| **Branch**     | `100-pro-upgrade-revisions` (from `feature/pro`)         |
| **Feature**    | Pro                                                       |
| **Depends on** | [74-pro-entitlements.md](74-pro-entitlements.md) — the plan, the free ceiling and the repair window · [99-stripe-checkout.md](99-stripe-checkout.md) — makes Pro purchasable. **Not yet merged into `feature/pro`**; `/implement` needs it there first, the same way this branch needed 74. |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Canonical single-file spec format for Airrow. One file per issue: specs/NNN-kort.md. It holds the WHAT,
the HOW (exact file:line changes), acceptance criteria, verification and edge cases together — do NOT
split into separate plan.md / tasks.md files.
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
Mark anything undecided inline with [NEEDS CLARIFICATION: …] so /clarify can find it.
Keep the section names as they are — the slash commands and the constitution refer to them by name.
-->

**Why two issues in one spec.** #100 asks for Pro-locked surfaces shown "disabled with an
explanation", and names revisions as one of them — which cannot be built until revisions exist. #101
is that feature, and its own last task ("free: one revision inside the repair window; Pro:
unlimited") is a paywall decision. Splitting them would mean one spec waiting on the other and a
locked state written twice. They are one slice: *what happens when a founder wants to change
something after their free foundation.*

The halves are still separable at PR time if this grows too large — §IV asks for small PRs, and the
acceptance criteria below are grouped so that "the upgrade moment" could ship first.

---

## User story

_Who wants this, and what they get out of it._

As a **founder who has used their free foundation** I want **to know that before I start another
one, and to be offered Pro at the moment it actually stops me** so that **the limit reads as a price
list rather than an ambush**.

As a **founder whose understanding of their own product changed** I want **to reopen the interview,
fix one answer, and see exactly which files that moves before anything is written** so that **a
foundation is something I can steer rather than a lottery ticket I already spent**.

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today, the limit:** `checkAllowance` refuses at `submitInterviewAction` and
  `retryGenerationAction` — which is already the right place, at generate rather than at project
  creation, so a founder out of allowance *can* click through a whole interview and is stopped at the
  end. Nothing tells them in advance, and the refusal is an inline error string rather than a screen
  that offers anything.
- **Today, revisions:** none. `project_models` are already versioned and immutable
  (`DATABASE_DESIGN.md`), and spec 65's memoisation means an unchanged rerun costs nothing — so the
  machinery for "generate again from a changed answer" mostly exists. What is missing is the way back
  into the interview, and any way to see what changed.
- **The problem, and it is live:** the landing page still badges Pro "Coming soon" with the action
  "Not available yet" (`features/landing/copy.ts:201,206`). Spec 99 made Pro purchasable. The moment
  99 reaches production the pricing section is **lying to visitors**, and it is the one screen whose
  entire job is to be believed.
- **Already in place:** spec 74's settings plan card, the locked import state and `ProPreview`, and
  spec 99's upgrade buttons and billing portal. Roughly half of #100's task list is built — what is
  left is the *advance notice*, the *upgrade screen*, and the landing page.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

**The wall stays at generate.** A founder who is out may still create a project and answer every
question; they meet Pro when they press the button that would cost a Claude call. That is already how
the code behaves, so this spec's job is to make it *legible* — a standing line on the project and
interview screens saying where they stand, and a real upgrade screen where there is currently an
inline error string.

**A revision is a regeneration with a diff in front of it.** Reopen the completed interview
prefilled, change answers, resolve the model, and show the founder which files the change moves —
added, changed, removed — before anything is written. §0 requires that approval step anyway; this
makes it useful rather than ceremonial.

**Not touched:** `checkAllowance` and the entitlement model. Free gets its repairs inside the window
that spec 74 already built, Pro gets no limit, and neither of those is a new rule — this spec only
gives the founder a way to *use* the repairs they already have.

[NEEDS CLARIFICATION: how deep is the diff? A list of affected paths with added/changed/removed is
cheap and probably enough to decide with. A per-file content diff is much more convincing and much
more work, and the preview already renders file bodies — so it may be closer than it looks.]

[NEEDS CLARIFICATION: #100 lists "history" among the Pro-locked surfaces to show disabled. There is
no history feature and no spec for one. Show it as a disabled teaser here, or leave it out until
something real exists? Showing a lock on a thing that has never been built is how a product starts
feeling like a mockup.]

[NEEDS CLARIFICATION: does the landing pricing card now show an actual figure? Spec 99 deliberately
keeps every amount in Stripe, and the landing page is static copy. Either it names a price that then
lives in two places, or it says "from $X" / links to checkout without a number. Decide before writing
the copy.]

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

### The upgrade moment (#100)

- [ ] The project list and the interview screen state where the founder stands before they start —
      not only once they are refused.
- [ ] A founder with no allowance left can still create a project and complete the entire interview.
      They are stopped at generate, and nowhere earlier.
- [ ] That refusal is a real screen that says what Pro gives and that existing projects and downloads
      are never affected — not an inline error string.
- [ ] The landing page stops badging Pro "Coming soon" and stops saying "Not available yet".
- [ ] Loading, error and empty are real components, not conditionals in JSX (§III).
- [ ] No screen in the path — free interview → generate → refusal → upgrade → generate — is a dead
      end.

### Revisions (#101)

- [ ] A completed interview can be reopened with its answers prefilled.
- [ ] Changing an answer and regenerating produces a preview of what moves — added, changed and
      removed files — which the founder approves before anything is written (§0).
- [ ] An unchanged regeneration makes no Claude call and spends no allowance, and says so rather than
      silently doing nothing (spec 74 built the behaviour; this makes it visible).
- [ ] A founder's own files in an imported project are never touched by a revision.
- [ ] Free gets the repairs spec 74 defines; Pro is unlimited. No new entitlement rule is introduced.
- [ ] Pro-locked surfaces are shown disabled with an explanation rather than hidden.

- [ ] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — the refusal path: a founder with no allowance reaches the end of the interview and
  is offered an upgrade, rather than being blocked at project creation.
- **New tests** — landing copy: the pricing section contains no "coming soon" or "not available"
  wording, so this cannot silently regress the way it just did.
- **New tests** — revision diff: a changed answer moves only the files that depend on it; an
  unchanged one moves nothing and calls nothing. Snapshot against golden fixtures, reviewed as a
  product decision rather than regenerated (§V).
- Full suite result + typecheck/lint status.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

Left for `/implement`. Spec 99 is not yet on `feature/pro`, so the billing surfaces this builds
beside are not on this branch — the anchors would be invented. Fill this in once 99 has merged.

---

## Data model

_Any database change. Most specs have none — say so plainly._

**No schema changes expected.** `project_models` are already versioned and immutable, which is what a
revision needs, and `generation_usage` already records what was charged. If the diff turns out to need
persisting rather than recomputing, that is a table and it ships with RLS and denial tests in the same
migration (§II) — but recomputing from two model versions should be enough.

---

## Security

Nothing new is exposed: every screen here is inside `/app`, scoped by the session's organization, and
the revision path runs through the same server actions and the same `checkAllowance` gate as a first
generation. The one thing to hold: a founder must not be able to reach another organization's
interview by id when reopening it, which is the existing `getProject(org.id, id)` scoping and must
stay that way.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- Founder is out of allowance and starts a project → allowed all the way through the interview,
  refused at generate with an offer.
- Founder upgrades mid-interview → returns to the interview and generates; nothing they answered is
  lost.
- Revision with no answers changed → no Claude call, no allowance spent, and the founder is told that
  rather than watching a progress screen that changes nothing.
- Revision on an imported project → the founder's own files are untouched, and conflicts resolve
  through the machinery spec 63 already built.
- Revision that removes a file the previous foundation had → shown as removed in the diff, and only
  written after approval.
- Free founder inside the repair window → allowed; outside it, or past the count, refused with the
  reason spec 74's `allowanceMessage` already distinguishes.

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- Foundation history and restore — a related idea, no spec, and named here only because #100 asks
  whether to show it locked. That question is a marker above, not a commitment.
- Push to GitHub and repository drift watch — the other Pro capabilities, each its own issue.
- Any change to the entitlement model. Free stays at one foundation plus its repairs; Pro stays
  unlimited.
- Pricing. If the landing card names a figure, that decision is recorded above and the figure still
  belongs in one place.
