# Spec 128 — Reject unusable interview answers instead of generating

> **In one sentence:** When the answers don't describe a software product, stop before generating and
> send the founder back to the review screen with the offending answer named — instead of silently
> handing them a deterministic foundation.

|                |                                                        |
| -------------- | ------------------------------------------------------ |
| **Status**     | 🔄 In progress                                         |
| **Issue**      | #128 — "not generate when unallowed answers"           |
| **Branch**     | `128-reject-invalid-answers` (from `feature/interview-generator`) |
| **Feature**    | Interview & generator                                  |
| **Depends on** | [spec 65](65-authored-documents.md) (authored documents), [spec 123](123-foundation-starts-strong.md) (two-call authoring), [spec 100](100-pro-upgrade-revisions.md) (allowance messaging on the review screen) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

As a **founder filling in the interview** I want **to be told which answer isn't usable, back on the
review screen where I can fix it** so that **I don't get handed a generic foundation and only work out
later that my answers were the reason.**

---

## Background

- **Today:** the authoring call returns `null` on every rejection path —
  `describesSoftwareProduct !== true`, a leaked-canary prompt injection, assistant-voice markers, a
  contract violation, or an ordinary network failure ([author.ts:428-472](apps/web/src/features/generation/author.ts#L428-L472)).
  The job runner treats `null` as "derive everything" and completes the job normally
  ([runner.ts:67](apps/web/src/features/generation/runner.ts#L67)), so the founder lands on a finished
  foundation with no indication that none of the prose came from their answers.
- **The problem:** "the model refused these answers" and "our Claude integration was unavailable" are
  the same value today. The first is a founder-fixable input problem and must stop generation; the
  second must not, because ZIP delivery has to work with no integration connected (constitution §0).
- **Already in place:** the review ("Change answers") screen already renders a server-returned error
  inline and keeps the answers intact ([InterviewRuntime.tsx:129-137](apps/web/src/features/interview/InterviewRuntime.tsx#L129-L137),
  [:197-199](apps/web/src/features/interview/InterviewRuntime.tsx#L197-L199)), and the submit action
  already returns `{ error }` for structural validation failures
  ([actions.ts:43-45](apps/web/src/features/interview/actions.ts#L43-L45)). Per-question editing from
  review already exists ([InterviewRuntime.tsx:163-175](apps/web/src/features/interview/InterviewRuntime.tsx#L163-L175)).

---

## Design decision

Distinguish **rejection** (the answers are not usable) from **unavailability** (we could not ask), and
act on only the first. `authorFoundation` stops returning `AuthoredFoundation | null` — where `null`
meant both — and returns a three-arm discriminated union instead: `authored` · `rejected` ·
`unavailable`. Unavailability keeps today's behaviour exactly, so ZIP delivery still works with no
integration connected.

**The verdict is acted on inside the running job**, not in a pre-flight gate. The authoring call
already produces it, so this costs no extra Claude call; a rejected job ends `failed`, which the usage
ledger already excludes from the allowance (`chargedUsage`, [store.ts:467](apps/web/src/lib/data/store.ts#L467));
and every path that generates — first run, regeneration, a claimed guest draft, an imported project —
goes through the same runner, so one change covers all of them. The founder watches the progress screen
for the length of the authoring call before being sent back, which is the honest cost of actually
asking.

**The founder never reads model prose.** When the model answers `describesSoftwareProduct: false` it
also names, in `unusableAnswers`, which answers led it there. Those ids are allowlisted against the
interview's own **free-text** questions — a picked option came from a list we wrote and cannot be
"not a software product" — and the sentence the founder reads is written by us from those questions'
titles. Nothing the model wrote reaches the screen, so there is nothing to sanitize and no channel
back to someone probing the prompt boundary.

**A prompt-injection signal stays unavailability**, not rejection: the canary and the assistant-voice
markers are detective checks on *our model's* response, not a verdict on the founder's answers, and a
false positive there must not block a legitimate founder. It falls back deterministically, exactly as
today.

**Not touched:** the deterministic generation path itself, `pickValidSlots` / `pickValidDocuments`
per-field fallback (an over-long single field is still a partial loss, not a rejection), ZIP delivery
without an integration, and the `queued`/`running`/`completed`/`failed` job statuses.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] Answers the authoring layer rejects as "not a software product" do **not** produce a foundation —
      no completed job, no artifact, no `ready` project.
- [x] The founder is returned to the review / "Change answers" screen with their answers intact and an
      inline message that says the answers were not accepted and **names the question(s) at fault**.
- [x] The message is distinct in wording and tone from both the allowance/upgrade notice (spec 100) and
      the generic "generation failed" error — a founder can tell "fix your answer" from "try again".
      It is a `Notice` (warn), where the upgrade path is `UpgradeNotice` (accent) and a failure is
      `InlineError` (danger); the retry panel is deliberately not offered.
- [x] A **missing API key, a network error, a timeout, or malformed JSON** still generates a
      deterministic foundation exactly as today — never a rejection, never a block.
- [x] A prompt-injection signal (canary leak, assistant-voice marker) stays a deterministic fallback —
      it is a check on the model's response, not a verdict on the answers, and it tells the founder
      nothing that would help someone probing the prompt boundary.
- [x] A rejected submission does **not** consume the founder's free-plan allowance.
- [x] The rejection reaches the founder on every path that generates — first run, regeneration from a
      `ready` project, a claimed guest draft, and an imported project — because all four run the same
      job runner.
- [x] Only ids that name a real free-text interview question are ever flagged; anything else the model
      returns is dropped.
- [x] No model-written text reaches the founder: the message is composed from the interview's own
      question titles.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — `apps/web/src/features/generation/author.test.ts`: `describesSoftwareProduct: false`
  reports `rejected` carrying the named answers; a thrown call, a missing key, a refusal and a leaked
  canary all report `unavailable`; ids the model invents are dropped.
- **New tests** — `apps/web/src/features/generation/runner.test.ts`: a rejected verdict ends the job
  `failed` with `rejectedAnswers` set, saves no artifact, never writes `completed`, and puts the
  project back where the founder can act (`interviewing`, or `ready` when a foundation already exists).
- **New tests** — `apps/web/src/features/generation/rejection.test.ts`: the message names the flagged
  questions by their interview titles and reads sensibly when the model named none.
- **New tests** — `packages/schemas/src/authoring.test.ts`: only free-text question ids are flaggable.
- Allowance: no new code — a `failed` job is already excluded from the ledger by `chargedUsage`
  ([store.ts:454-468](apps/web/src/lib/data/store.ts#L454-L468)); the runner test pins the status the
  exclusion keys on.
- Manual check (outstanding): submit an interview whose `problem` / `mvpFocus` answers are gibberish
  against a live key, and confirm the review screen names them and no project reaches `ready`. The
  automated tests cover every step of that path with the SDK mocked; what they cannot show is the live
  model actually filling `unusableAnswers` when it refuses.
- **Result (2026-07-31):** `pnpm -r typecheck` clean · `pnpm -r lint` clean · `pnpm -r test`
  **436 passed, 43 skipped** (the skips are the RLS suites that need a local Supabase, pre-existing) ·
  `pnpm test:scripts` **80 passed**. New: 46 tests in `author.test.ts` (was 33), 15 in `runner.test.ts`
  (was 10), 4 in `rejection.test.ts`, 30 in `packages/schemas/src/authoring.test.ts` (was 23).

### Also fixed here: "Generation was interrupted" on a working generation

Reported on the develop deployment while this spec was in flight, and fixed in this branch because it
lands in the same file and would otherwise hide this change behind a broken generator.

- **What happened:** spec 123 split authoring into two calls and ran them **in sequence**. Their
  latencies add up, and the sum crossed the 60 seconds after which
  [`api/projects/[id]/job/route.ts:16`](apps/web/src/app/api/projects/[id]/job/route.ts#L16) declares a
  job dead. Authoring is one long `await` with no writes in it, so a call that merely ran long was
  indistinguishable from a crashed one — the founder was told the run was interrupted while it was
  still working. Spec 123 met this same wall and narrowed it by choosing a faster model, which moved
  the margin without removing the failure.
- **Two changes, one for each half of it.** `authorFoundation` now fires both calls together
  (`Promise.all`), halving the stage to its slowest call — this **amends spec 123's sequencing
  decision**, whose only benefit was the second call reading the first's cached prefix, and that
  saving is zero today: Haiku 4.5's minimum cacheable prefix is 4096 tokens and the shared preamble is
  far below it, as `callAuthoring`'s own note already said. And `runner.ts` now writes a heartbeat
  every 15s while the call is in flight, so however long authoring takes, a live job is never read as
  a dead one.
- **Verification:** `runner.test.ts` — a 50-second authoring call still beats at least three times,
  and the beating stops when the call does. Both fail without the fix: nothing else in the runner
  writes an empty patch.
- `maxDuration` stays 60 on the generate route — that is the platform plan's ceiling, not a
  preference. Concurrency is what buys headroom under it; if generations ever crowd 60s again, raising
  it needs a Vercel plan that allows more.

### Implementation notes

- **`PROMPT_VERSION` 8 → 9.** The rule is to bump only when identical answers would produce different
  prose, and adding a field to the contract should not. It bumps anyway because provenance is the
  point: two different prompt texts sharing one version makes the manifest's record of what wrote a
  file untrue. The cost is one memo miss per project.
- **The flagged ids are re-checked on the way out of the database**, not only on the way in
  (`toJob` → `pickFlaggedAnswers`). A question removed from the interview after a row was written
  would otherwise reach a screen that looks its title up and finds nothing.
- **`previousCompletedJob` decides where the project lands.** Refusing a *regeneration* must not take
  away the foundation the founder already has, so the project goes back to `ready` in that case and to
  `interviewing` only when there was nothing to fall back on.
- **CI note:** the migration-drift check reports a migration added in its own pull request rather than
  failing it ([`supabase-migration-drift.mjs:189`](scripts/supabase-migration-drift.mjs#L189)); the
  column is applied by the `Supabase migrations` workflow when this reaches `develop`. Until then a
  deployment running ahead of its migrations reads `rejected_answers` as absent, which `toJob` maps to
  `null` — the pre-spec behaviour, not a crash.
- **Writing it degrades too, which the first branch deploy proved.** A refused generation surfaced
  `Supabase: Could not find the 'rejected_answers' column of 'generation_jobs' in the schema cache`:
  the branch deploy shares the database, so the code got there before its migration. `updateJob` now
  drops that one column and retries when the database says it does not have it — the founder keeps
  the explanation, which travels in `error`, and loses only the per-question marks. `isMissingColumn`
  grew a third shape for it: a **write** never reaches Postgres, so it comes back as PostgREST's
  `PGRST204` rather than the `42703` the read path already handled. Covered by
  `store.rejection-compat.test.ts`, including that an unrelated error still throws.

---

## Exact changes (file:line)

1. **`packages/schemas/src/types.ts`** — export `AnswerId` (`keyof InterviewAnswers`), the type the
   interview already uses inline for every question id ([:40](packages/schemas/src/questions.ts#L40)).
2. **`packages/schemas/src/authoring.ts`** — a "refusing the answers" section: `FLAGGABLE_ANSWERS`,
   derived from the interview's free-text questions rather than listed again, and
   `pickFlaggedAnswers(raw)`, which keeps only allowlisted ids — the same shape as the existing
   `pickValid*` helpers ([:244](packages/schemas/src/authoring.ts#L244)).
3. **`apps/web/src/features/generation/author.ts`** — the SCOPE rule asks for `unusableAnswers`
   alongside `describesSoftwareProduct: false`, both Shape lines carry it, `PROMPT_VERSION` → `9`, and
   `callAuthoring` / `authorFoundation` return the three-arm `AuthoringOutcome` instead of `| null`.
4. **`apps/web/src/features/generation/rejection.ts`** (new) — the founder-facing sentence, composed
   from question titles. Sits beside `allowance.ts`, which is the same shape: a verdict, and the one
   place its wording lives.
5. **`apps/web/src/features/generation/runner.ts`** — on `rejected`, end the job `failed` with
   `rejectedAnswers`, write no artifact, and set the project back to `interviewing` (or `ready` when
   `previousCompletedJob` finds an earlier foundation) instead of `failed`.
6. **`apps/web/src/lib/data/store.ts`** — `rejected_answers` on `JobRow` / `JobRecord`, through
   `toJob` (via `pickFlaggedAnswers`, so a row is re-checked on the way out) and `jobPatchToRow`.
7. **`apps/web/src/features/generation/GenerationProgress.tsx`** — a failed job carrying
   `rejectedAnswers` sends the founder to the interview instead of offering a retry.
8. **`apps/web/src/app/app/projects/[id]/interview/page.tsx`** — read the latest job and pass its
   flagged answers down.
9. **`apps/web/src/features/interview/AuthedInterview.tsx`** → **`InterviewRuntime.tsx`** — the review
   screen shows a `Notice` naming the flagged questions, and marks those rows in the answer list.

**No change needed:** `api/projects/[id]/job` returns the whole job, so the new field travels with it;
the allowance ledger already ignores failed jobs; the guest and import flows reach the same runner.

---

## Data model

One nullable column on `generation_jobs`:

```sql
alter table public.generation_jobs
  add column if not exists rejected_answers text[];
```

Non-null (including empty) on a `failed` job means the run stopped because the answers were not usable;
null means it failed for our own reasons. No new table, so it inherits `generation_jobs`' existing
RLS policy scoped by `is_project_member` — the same argument the authoring-provenance columns were
added under. Idempotent, replays from zero. Job status values are untouched, deliberately: a new
`rejected` status would have to be threaded through the check constraint, the usage ledger's
exclusions, and every screen that reads a status, to say something a column already says.

---

## Security

Nothing the model wrote reaches the founder: only ids matching a real free-text question survive
`pickFlaggedAnswers`, and the sentence is composed from the interview's own titles — so there is no
untrusted text to escape and no channel that reports back what the prompt did. Injection detection stays
silent for the same reason. No new data is exposed: the flagged ids ride on `generation_jobs`, already
RLS-scoped through project membership.

---

## Edge cases

- Answers rejected on one authoring call but authored on the other → the prose wins. If either call
  wrote something usable, the answers evidently did describe a product; a rejection stands only when
  nothing was authored at all.
- The model rejects but names no answer, or names something that is not a question → still a rejection,
  and the founder gets the sentence without a list rather than an invented culprit.
- A regeneration whose answers are unchanged and whose authored payload is memoized
  ([runner.ts:59-67](apps/web/src/features/generation/runner.ts#L59-L67)) → a reused payload was
  already accepted, so it must not be re-judged.
- Answers rejected while the founder is out of allowance → the allowance message wins; the founder is
  not charged and is not told two different things at once.
- The founder edits the flagged answer and resubmits → the second submission is judged fresh, not
  against the cached verdict.

---

## Out of scope

- Any client-side or heuristic "is this gibberish" check on individual answers as they are typed — this
  spec acts on the authoring layer's verdict only.
- Changing what the deterministic foundation contains.
- Warning the founder when *some* fields fell back to deterministic prose while the rest were authored
  — that is a partial-quality signal, not a rejection.
