# Spec 123 — A foundation that starts strong

> **In one sentence:** Ask fewer and sharper questions, let the founder describe how their product
> should look, turn that into a `UI_ARCHITECTURE.md` detailed enough to build from, and make a much
> bigger `/start` build the product's first actual feature instead of a placeholder screen.

|                |                                                                              |
| -------------- | ---------------------------------------------------------------------------- |
| **Status**     | ✅ Done — with deliberate scope cuts at closeout (see _Out of scope_ → "Descoped at closeout") |
| **Issue**      | #123 — "A foundation that starts strong: fewer sharper questions, a UI architecture the founder describes, and a /start that builds the first real feature" |
| **Branch**     | `123-foundation-starts-strong` (from `feature/interview-generator`)          |
| **Feature**    | Interview-driven project generator                                           |
| **Depends on** | [65-authored-documents.md](65-authored-documents.md) · [66-start-command.md](66-start-command.md) · [91-cleanup-command.md](91-cleanup-command.md) · [10-foundation-reflects-answers.md](10-foundation-reflects-answers.md) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

> **Amends the constitution.** This spec changes the `/start` ceiling in
> [`constitution.md` §0](../.claude/spec-kit/constitution.md) — see _Constitution amendment_ below. The
> previous wording is recorded there.

---

## User story

As a **founder who just paid for a foundation** I want **an interview that only asks what matters, a
say in how my product looks, and a `/start` that leaves me looking at the first real feature of my
product** so that **the foundation is obviously worth what I paid the moment I open it, and I know
exactly how to keep going.**

---

## Background

- **Today — the interview.** `packages/schemas/src/questions.ts:132` defines **19 questions**, ~14 of
  them always visible. Several no longer change the output enough to earn a screen: `scale`
  (`:311`), `team` (`:428`), `roles` (`:243`) and `repoProvider` (`:418`) each feed a single prose
  slot or a label. Nothing anywhere asks what the product should *look* like.
- **Today — the authored foundation.** `AUTHORED_DOCUMENTS`
  (`packages/schemas/src/authoring.ts:143`) is three files: `docs/VISION.md`,
  `docs/architecture/SYSTEM_OVERVIEW.md`, `docs/README.md`. `DESIGN_INVARIANTS` exists as a prose
  slot (`:49`) but there is no UI document at all — `template/docs/architecture/` holds only
  `BRANCHING.md` and `SYSTEM_OVERVIEW.md`. Airrow's own repo has `UI_ARCHITECTURE.md` and treats it as
  canonical; customers get nothing equivalent.
- **Today — `/start`.** `template/.claude/commands/start.md:40` renders `{{START_MINIMUM}}` from
  `startMinimum()` (`packages/engine/src/scaffold.ts:712`), which instructs the assistant to *replace
  the placeholder home page with one screen* and then spends four lines forbidding everything else:
  "no features, no routes nobody asked for, no database, no auth". The founder's first sight of their
  own project is one styled page that names the product.
- **Today — onboarding.** `template/START_HERE.md` is six sections and already good on the *workflow*
  (`:91`). It is thin on why any of it was the right choice, and step 1 (`:14`) hands the founder
  four commands with no picture of what they are about to see.
- **The problem.** The path interview → authored documents → `/start` → START_HERE produces something
  correct that lands flat. Nineteen questions of effort buy a page. Constitution §0 says the output
  *is* the product and that generic output is a top-severity bug; a placeholder screen is the most
  generic output we ship.
- **Already in place:** the authoring contract with per-field caps and fallback to deterministic
  output (`authoring.ts`), `suggest`/`STANDARD_STACK` for derived answers (`questions.ts:100`),
  `TOOLCHAIN_SLOTS` as the one audited hole where a model may write something runnable (`:268`), and
  the `shipsCleanup` split that decides which first-run command a foundation ships
  (`scaffold.ts:750`).

---

## Design decision

Six changes, one path:

1. **Trim the interview to 11–13 questions.** Remove or merge every question whose answer does not
   visibly change the output; derive what can be derived (as `STANDARD_STACK` already does for the
   stack). Each surviving question states what it changes, and the set that remains is chosen for one
   job: pointing a real build in the right direction from the first day.
2. **One new free-text question, `uiDirection`** — how the product should look and feel, and how
   people move through it. Free text, because a picker cannot capture taste and a taste we invent is
   worse than one we ask for. It carries `help` and a worked suggestion so a founder who has never
   written a design brief still writes one that produces a good-looking first version, and it says
   plainly that the answer is a starting point they can change later in `UI_ARCHITECTURE.md`.
3. **`docs/architecture/UI_ARCHITECTURE.md` becomes a fourth authored document — and the brief
   `/start` builds from.** Written end to end from `uiDirection` plus the product answers: the
   screens, the navigation, the layout language, the explicit loading/error/empty states, the design
   tokens. It has two readers and must serve both: the founder, who reads it to know what their
   product looks like, and the assistant running `/start`, for which it is a *detailed build brief* —
   so it is written to be specific enough to act on, not merely to describe. It is still prose and
   headings; the existing `CODE_FENCE_RE` ban (`authoring.ts:174`) applies, so nothing runnable can
   reach it.
4. **A much bigger `/start`, which builds the first real feature.** `{{START_MINIMUM}}` becomes a
   substantially larger instruction that reads `UI_ARCHITECTURE.md` and `mvpFocus` and builds the
   product's core action for real, to the design the founder described. The brief is where the detail
   lives; `/start` reads it as direction and is trusted to interpret it — including filling in the
   layout, states and polish a thin `uiDirection` left open, using the foundation's own design system.
   What it may not do is drift from the answers: see _Constitution amendment_ for the traceability
   rule that bounds the latitude.
5. **Onboarding that carries one person, all the way to a live product.** `START_HERE.md` and the
   surrounding guides rewritten so a founder alone can follow them end to end and keep moving — from
   the foundation to a real product built on it — and so the reason Airrow was the right call is
   evident from reading them rather than asserted. This includes a **new generated guide,
   `docs/guides/INFRASTRUCTURE_SETUP.md`**: the real step-by-step for the database and the host the
   founder chose — creating the Supabase project, where the three keys are and which of them never
   reaches the browser, applying migrations, creating the Vercel project, connecting the repository,
   the branch-to-URL mapping, the deploy credentials, and how to verify the whole thing end to end.
   Airrow's own [`INFRASTRUCTURE_SETUP.md`](../docs/guides/INFRASTRUCTURE_SETUP.md) is 331 lines of
   exactly this; §0 says what we run, customers get. `START_HERE.md` step 2 stays a short ordered list
   and links into that guide per step, so the path is skimmable but nothing is left to be guessed.
   Easy to walk, and still written for a developer: no screenshots-as-instructions, no hand-holding
   prose, the provider's own vocabulary.
6. **A sharper authoring prompt.** `SYSTEM_PROMPT` is revised, not merely extended: the documents it
   writes must be worth reading on day one. The existing bars (no invented specifics, no restating the
   founder's own sentence, no interview classifications read back) stay; what changes is how much is
   demanded of what it does write.
7. **A raised authoring ceiling — tried, and reverted.** A better prompt on a small model is still a
   small model, so authoring moved from `claude-haiku-4-5` to `claude-opus-5`. In practice, two
   sequential Opus-5 calls (main + UI brief) ran long enough to trip the hosted job runner's
   stale-heartbeat check — a live generation surfaced as "Generation was interrupted" rather than
   producing an authored foundation. Landed on **`claude-sonnet-5`** instead, with `thinking`
   explicitly *disabled* and `effort: "low"` — a deliberate choice, not a default: Sonnet 5 also runs
   adaptive thinking when the parameter is omitted, the same behavior that caused the Opus 5 incident,
   so speed here is guaranteed by the request shape rather than hoped for. The split-call architecture,
   the sharper prompt, and the UI-brief authoring all stayed. See _The authoring ceiling_ below for
   what was actually shipped versus attempted.

**The infrastructure guide is derived, never authored.** It is procedures a founder runs against live
accounts, and `authoring.ts:23` already names `SETUP_STEPS` among the values the model may never write
because they must be *correct*, not well phrased. The new guide is the same kind of thing, only longer,
so it is rendered deterministically from `database`, `hosting` and `repoProvider` — the sharper
authoring prompt (6) must not leak into it. A wrong key name in a document nobody derived is a founder
stuck for an afternoon; a wrong *command* there is worse than that.

**Not touched:** the fixed workflow files (`.claude/commands/**`, `.github/workflows/**`,
`BRANCHING.md`, `specs/README.md`) stay identical per project — a process that varies cannot be
relied on. `TOOLCHAIN_SLOTS` stays the only place a model writes a command. The engine stays pure and
synchronous. ZIP delivery with no integration connected still produces a complete foundation.

### The authoring ceiling

Today: `claude-haiku-4-5`, no `effort`, no prompt caching, `MAX_TOKENS` derived as
`(21,640 slot chars + 11,500 document chars) / 4 + 2000` = **10,285**.

**Model → `claude-opus-5`.** The largest available lift in what the foundation reads like, and the one
this spec's other five items all depend on: a build brief detailed enough for `/start` is a writing
task, not a filling-in task.

**A bare model swap breaks generation silently, and this is the part to get right.** On Opus 5 thinking
is **on by default** when the `thinking` parameter is omitted — which is exactly what
[`author.ts:326`](../apps/web/src/features/generation/author.ts#L326) does today — and `max_tokens`
caps thinking *plus* response text together. A 10,285 ceiling would be partly consumed by thinking, the
JSON would be cut mid-response, `JSON.parse` would throw, the `catch` at
[:380](../apps/web/src/features/generation/author.ts#L380) would return `null`, and the founder would
get a deterministic foundation **with no error anywhere**. That is the precise failure the note at
[:52](../apps/web/src/features/generation/author.ts#L52) was written about, and raising the model is
what would trigger it. So: `max_tokens` sized for thinking as well as output, `thinking` set
deliberately rather than by omission, and `output_config.effort` chosen rather than defaulted (Haiku 4.5
took no `effort` at all — see the comment at
[:35](../apps/web/src/features/generation/author.ts#L35) — so this is a new parameter, not a changed one).

**Prompt caching, which the foundation is not getting today.** The minimum cacheable prefix is 4096
tokens on Haiku 4.5 and **512 on Opus 5**. `SYSTEM_PROMPT` is roughly 1,750 tokens — under Haiku's
minimum, so it has never cached, silently. On Opus 5 it caches, and with two calls per generation
(_Design decision_ 3) the shared preamble should be ordered deliberately: the invariant part first
(who reads this, the injection rules, the never-bends list), a `cache_control` breakpoint, then the
call-specific instructions — so the UI-brief call reads the prefix the main call just wrote. Caching is
a prefix match, so nothing volatile may precede the breakpoint.

**Refusals become a real path, and there is something better than failing closed.** Opus 5 carries
elevated cybersecurity safeguards and can decline a request as an HTTP 200 with
`stop_reason: "refusal"`. That is already handled ([:333](../apps/web/src/features/generation/author.ts#L333))
and already fails closed to a deterministic foundation. Better: opt into server-side
`fallbacks: "default"`, which re-runs a declined request on Anthropic's recommended fallback inside the
same call — so a founder whose interview happened to trip a classifier gets an authored foundation
rather than a template. Fails closed exactly as today if the whole chain declines.

**Worth re-testing, not assuming:** structured outputs were abandoned because Haiku 4.5 rejected the
schema as too complex ([:214](../apps/web/src/features/generation/author.ts#L214)) — the measured
ceiling sat between 10 and 16 fields. Opus 5 supports structured outputs, and splitting the UI brief
into its own call lowers the field count per request. If the schema is accepted now, a validation layer
that had to be given up comes back.

**Cost, stated plainly because Pro is unlimited.** Worst-case output per generation at today's budget:

| Model | Input / output per Mtok | Worst case / generation | Free tier ceiling (1 + 2 regens) |
| ----- | ----------------------- | ----------------------- | -------------------------------- |
| `claude-haiku-4-5` (today) | $1 / $5 | ~$0.05 | ~$0.16 |
| `claude-sonnet-5` | $3 / $15 ($2 / $10 intro through 2026-08-31) | ~$0.11–0.16 | ~$0.32–0.48 |
| `claude-opus-5` | $5 / $25 | ~$0.27 | ~$0.80 |

Two calls and a larger UI-brief ceiling raise all three roughly proportionally; prompt caching pulls
the second call's input back down. Free is bounded by `checkAllowance`; **Pro is unlimited, so Pro is
where this lands as an unbounded per-founder cost.** That is a pricing question this spec does not
answer — it names it, and `AIRROW_AUTHORING_MODEL` already exists as the escape hatch if the number
turns out wrong.

[NEEDS CLARIFICATION: effort level. `high` is the API default; `xhigh` is the documented starting point
for the hardest work but this is prose authoring rather than agentic coding, and `low`/`medium` are
reported to punch above their weight on this model. Pick with a measured sweep on a fixture interview,
comparing read quality against tokens spent — not by argument.]

### Constitution amendment

**§0, "Preparation, and a starting point"** currently reads, of `/start`: *"it scaffolds the stack and
sets the project up to the bare minimum that runs, using the information already in the repo. **Bare
minimum is the ceiling** — enough to open, change and continue from, never a guess at the product."*

**New ceiling: a first version the founder is glad to keep building on.** `/start` scaffolds the stack
and then builds the product's core action — `mvpFocus` — to the design in `UI_ARCHITECTURE.md`,
finished well enough that opening it feels like the beginning of the real product rather than a
scaffold. Everything past that goes through the spec loop, unchanged.

**The ceiling is a judgement, and that is deliberate.** The old rule was a hard line ("bare minimum")
and it produced something nobody wanted. A hard line drawn one feature further out would produce the
same problem one step later. So the ceiling is stated as what the founder should get, and `/start` is
given the interpretive room to reach it — a surrounding shell, a navigation frame, the states, a
sign-in surface where the core action makes no sense without one.

**What bounds the latitude is traceability, not a list.** Every screen, field, label and route
`/start` creates must trace back to something the founder wrote — an answer, `mvpFocus`,
`coreEntities`, `uiDirection`, `UI_ARCHITECTURE.md`. That is the test a reviewer applies, and it is
stricter than it sounds: it permits a login screen when the product is plainly account-based, and
forbids a settings page nobody asked for, however tasteful. *Relevance to the founder's own answers is
the ceiling* — not a count of files.

**Two lines the amendment does not move.** Features the answers do not imply are still never invented:
where `/start` cannot derive something, it leaves a `[NEEDS CLARIFICATION]` marker rather than
deciding for the founder, exactly as today. And Airrow's servers still never write application code —
`/start` runs on the founder's machine, on their explicit command.

**Data stays out.** Schema, migrations and persistence are out of scope (issue #123, "Decisions taken
up front"). `/start` builds against local state; the table is the founder's first spec, which is what
`FIRST_SPEC_HINT` already points them at. **Auth follows the same rule** — this resolves the open
question: `/start` may build the sign-in *surface* when the core action requires it, wired to the auth
the chosen stack already provides, but it provisions no auth service, writes no secret and creates no
user table. On Supabase that means the screens and the client call, against a project the founder
connects in step 2 of `START_HERE.md`; where the surface cannot work without data, `/start` says so
plainly instead of faking a session silently.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

**Interview**

- [x] `interviewQuestions` is trimmed from 21 entries to **17** (not the originally-estimated 11–13 —
      revised during implementation; see the note below). `audience`, `roles`, `dataSensitivity`,
      `scale` and `team` are removed and now resolve to their existing default (`resolveProjectModel`
      already had `?? "default"` fallbacks for all five, so removing the questions changed nothing in
      `model.ts` — only what is asked). `audience` is additionally *derived* rather than dropped
      outright: unanswered, it now falls back through `tenancy` before the old `productType`-only
      guess. [NEEDS CLARIFICATION resolved: 11–13 was a target, not a floor. `problem`, `vision`,
      `mvpFocus`, `tenancy`, `authModel`, `capabilities`, `framework`, `database`, `hosting` and
      `repoProvider` all demonstrably change generated output and constitution §0 forbids removing a
      question that would change the result — cutting to 11–13 would have meant dropping one of those.
      17 is the number that survives "adaptive, never bureaucratic" applied honestly rather than
      applied to hit a target.]
- [x] Every surviving question's `help` names what the answer *changes* in the output (added to
      `repoProvider`, which had none; the rest already did).
- [x] A new `uiDirection` free-text question exists, with an entry in `ANSWER_MAX_CHARS` (500) and a
      placeholder that shows a founder what a useful answer looks like.
- [x] Its `help` gets a founder who has never written a design brief to a usable answer, and says that
      the answer is a starting point they can change later in `docs/architecture/UI_ARCHITECTURE.md`.
- [x] `InterviewAnswers` (`packages/schemas/src/types.ts:51`) and `ProjectModel` (`:88`) carry the new
      field. The five dropped questions' fields are *not* removed from either type — `resolveProjectModel`
      still reads `a.scale`, `a.team`, etc. for the `?? default` fallback, and a stale import-analysis
      answer or an old server-side saved draft still resolves correctly through them.
- [x] Answers no question can produce any more are pruned by `pruneHiddenAnswers` (generic — it only
      keeps ids present in `interviewQuestions`, so this required no code change). The two persistence
      paths differ deliberately: the **server-side** interview record has no version gate and degrades
      gracefully (Zod `.partial()` strips what it doesn't recognise, `pruneHiddenAnswers` drops the
      rest) — covered by existing coverage of partial answer objects. The **guest** `localStorage` draft
      has its own stricter, pre-existing policy (`GUEST_DRAFT_VERSION`, bumped 4→5 here): a
      shape-changing question set discards the old draft outright rather than resuming it half-restored
      — that policy predates this spec and this change follows it rather than overriding it.

**UI_ARCHITECTURE.md**

- [x] `template/docs/architecture/UI_ARCHITECTURE.md` exists and is listed in `tailoredPaths` in
      `template/.airrow-template.json`.
- [x] It is a member of `AUTHORED_DOCUMENTS` with its own `DOCUMENT_MAX_CHARS` ceiling (5000 chars —
      the largest of the four, sized as a brief), and an unauthored generation still produces a usable
      deterministic version (`uiDirectionSummary`/`uiScreens`/`uiStates`/`uiDesignLanguage` in
      `scaffold.ts`; covered by `authored.test.ts` and `start-command.test.ts`).
- [x] It is authored by its own request, and the two calls are independent: the UI call failing leaves
      the other three documents and every slot authored, and vice versa. Proven by a test per direction
      — `author.test.ts` → "the main and UI calls are independent".
- [x] The document contains no code fence, no command and no `{{TOKEN}}` (enforced by the existing,
      unmodified document schema — `CODE_FENCE_RE` / `UNRESOLVED_TOKEN_RE` in `authoring.ts` apply to
      every member of `AUTHORED_DOCUMENTS` generically). The deterministic fallback names concrete
      screens where it can (the first screen, from `mvpFocus`) and leaves an explicit
      `[NEEDS CLARIFICATION]` for what it cannot derive (screens beyond the first) rather than
      inventing a navigation structure.
- [x] Prose-quality judged only by request/response *mechanics* (independence, caching, fallback
      opt-in) via `author.test.ts` — a live-API read of authored prose quality was not run; see
      _Out of scope_.
- [x] A generation with `ANTHROPIC_API_KEY` unset still delivers a complete foundation including this
      file — unchanged mechanism (`authorFoundation` returns `null` before any network call when the
      key is absent; `generate(..., { authored: undefined })` derives everything deterministically),
      exercised by the existing engine test suite's unauthored-generation paths.

**`/start`**

- [x] `template/.claude/commands/start.md` instructs the assistant to read
      `docs/architecture/UI_ARCHITECTURE.md` before writing any UI — the instruction is inside
      `startMinimum()`'s rendered output, which lands at the `{{START_MINIMUM}}` token in that file
      (`scaffold.ts:714`, first line).
- [x] The rendered instruction tells the assistant to build the `mvpFocus` action for real, states the
      new ceiling explicitly ("The ceiling is `mvpFocus`, built well"), and still forbids everything
      past it ("Still a ceiling, not a starting budget").
- [x] It tells the assistant to finish the screen visually when `uiDirection` was thin — layout,
      states, placeholder content in the shape the real content will take.
- [x] It states the traceability rule as the bound on its latitude: everything created traces to
      something the founder wrote, and what cannot be derived becomes a marker rather than a decision.
- [x] It permits the sign-in surface when the core action requires one, and forbids provisioning an
      auth service, writing a secret, or creating a user table.
- [x] `start-command.test.ts` proves the rendered *instruction* is correct; an end-to-end manual run
      of `/start` against a live AI assistant was not done in this pass — see _Out of scope_.
- [x] The instruction is stack-correct: a Next.js project, a Vite SPA and a custom stack each get
      guidance that is true of them (as `startBootstrap` already does) — `isCustomStack` branches the
      styling paragraph exactly as before.
- [x] `/start` is still re-runnable, still touches nothing outside the directory, still creates no
      remote and writes no secret — untouched: only `startMinimum()`'s *content* changed, not
      `template/.claude/commands/start.md`'s structure or `/start`'s file-system behaviour.
- [x] `/cleanup` (imported projects) is updated consistently: `cleanupScope()` already covers
      "everything under `docs/`" generically, so `UI_ARCHITECTURE.md` inherits describe-only, changes-
      no-code, deletes-nothing scope with no code change required; `cleanup-command.test.ts` is green.

**Onboarding**

- [x] `START_HERE.md` got targeted additions rather than the full rewrite originally scoped — a new
      "How the commands work" section (what `/something` means and what's needed to run one), a link
      to the infrastructure guide in step 2, a fifth reading-table row for `UI_ARCHITECTURE.md`, and a
      table-formatting fix. Step 1's prose and §4–§6 stay as they were. Deliberately reduced scope at
      closeout — see _Out of scope_.
- [x] Descoped at closeout, same reason — see _Out of scope_.
- [x] Descoped at closeout, same reason — see _Out of scope_.
- [x] `docs/guides/DEVELOPER_GUIDE.md` and `docs/README.md` point at `UI_ARCHITECTURE.md` and
      `INFRASTRUCTURE_SETUP.md` in the reading order.

**Infrastructure setup**

- [x] **Merged into `DEVELOPER_GUIDE.md`, not a standalone file.** Shipped first as its own
      `template/docs/guides/INFRASTRUCTURE_SETUP.md`, then folded into a new "Getting to a deployed
      product" section in `template/docs/guides/DEVELOPER_GUIDE.md` — one foundation file fewer, per
      explicit direction: the guide is content a founder reads once, and a second file for it wasn't
      earning its place. The `{{INFRASTRUCTURE_SETUP}}` token, and the deterministic rendering behind
      it, are unchanged — only which template file the token lands in moved. `tailoredPaths` in
      `.airrow-template.json` drops the standalone entry accordingly. No prose slot and no authored
      document reaches it either way (`AUTHORED_DOCUMENTS`/`PROSE_SLOTS` in `authoring.ts` untouched).
- [x] For Supabase + Vercel + GitHub it covers, in order: the Supabase project and its three keys
      (naming which is browser-safe and which is server-only), which environment file each goes in,
      applying migrations via the CLI and why a dashboard edit is wrong, the Vercel project and its own
      environment variables, connecting the repository, protecting `main`/`develop`, and a three-step
      end-to-end verification.
- [x] Money/card and one-time-vs-repeated are implied by the guide's own steps (free tiers named,
      "create" vs "apply" as distinct verbs) rather than stated as their own explicit line — accepted
      as-is; see _Out of scope_.
- [x] Every command in the guide is a `CMD_*`-equivalent or a provider CLI already named by
      `provider()` — compliant by construction. No automated test enforces this generically going
      forward; see _Out of scope_.
- [x] **Every combination gets a guide that is good on its own terms.** Four functions
      (`supabaseSetupSection`/`postgresSetupSection`/`hostingSetupSection`/`repoAndCiSection`) branch on
      `usesSupabase`/`model.hosting`/`usesAzureRepos` independently, so all combinations render, not
      just the golden path. `scaffold.test.ts`'s "never contradicts itself across documents" test now
      also exercises `postgres` + `self_host` + `vite` and passes with zero cross-contamination.
- [x] The four combinations were reviewed by reading their generated sections directly (catching two
      real leaks in the process — see Implementation notes), not read side by side as one exercise, and
      no test locks this in; see _Out of scope_.
- [x] `START_HERE.md` step 2 links to the guide once, not per step — a deliberate, smaller version of
      the original ask; see _Out of scope_.
- [x] An imported project (`shipsCleanup`) gets the same guide, phrased for infrastructure it may
      already have — `envFileNoun()` and the `imported` flag thread the same "if you do not already
      have one" wording `setupSteps` already used.
- [x] Read and judged by the implementer against four rendered fixtures (`pnpm engine:smoke`), not
      against real Supabase/Vercel accounts; see _Out of scope_.

**Authoring quality**

- [x] `SYSTEM_PROMPT` is split and revised into `INVARIANT_PREAMBLE` + `MAIN_ADDENDUM` + a new
      `UI_ADDENDUM` — materially different from the prior single prompt, not just longer. "Visible in a
      before/after read" is a qualitative judgement for a reviewer; the code-level change is real and
      in place.
- [x] No new prose slot lets the model write a command, a script name or an install step; the
      `TOOLCHAIN_SLOTS` hole stays the only one — `UI_ADDENDUM` explicitly forbids code fences and
      command-shaped text in its own rules, on top of the unchanged `authoring.ts` contract.

**The authoring ceiling**

- [x] **Settled on `claude-haiku-4-5`, after three live-API attempts.** First: `claude-opus-5`, two
      sequential calls, each thinking by default, pushed the "author" stage past the 60-second
      stale-heartbeat window checked in `apps/web/src/app/api/projects/[id]/job/route.ts:16` — the
      generation job runner is `await`ed inside the request (never fire-and-forget; see `runner.ts:1`),
      so a slow-enough live call is indistinguishable from a crashed one, and the founder saw
      "Generation was interrupted." Second: `claude-sonnet-5` with `thinking: { type: "disabled" }` +
      `output_config: { effort: "low" }` sent unconditionally — fixed the latency, since Sonnet 5 also
      thinks by default when the parameter is omitted and disabling it outright is what actually
      guarantees speed rather than hoping a smaller model is fast enough. Settled: `claude-haiku-4-5` —
      faster still, judged good enough for this job, and `thinking`/`output_config` removed again since
      Haiku 4.5 doesn't accept either (400). `AIRROW_AUTHORING_MODEL` still overrides the default with
      no code change; note the request is model-shape-coupled either way now — a model that *does*
      support `thinking`/`effort` (Sonnet 5, Opus-tier, Fable 5) would need those added back to run at
      anything but its own thinking-on default.
- [x] `betas`/`fallbacks` (the Claude-API-only server-side fallback) stay removed — that was an
      Opus-5-tier safety-classifier feature and never applied to Sonnet 5 or Haiku 4.5.
      `cache_control` on the shared system block was left in place: harmless either way, and currently a
      no-op — the shared preamble sits under Haiku 4.5's 4096-token cache minimum.
- [x] `MAX_TOKENS` reverted to the single character-derived formula per call, with no thinking headroom
      — Haiku never ran thinking by default, so the headroom this criterion originally asked for was
      solving a problem specific to the model this spec no longer uses by default.
- [x] A test (`author.test.ts` → "returns null when the main call's JSON is malformed") proves a
      response the JSON parser cannot complete still returns `null`, never a partial foundation — the
      existing behaviour, still covered, now against the split-call architecture.
- [x] `SYSTEM_PROMPT`'s replacement, `INVARIANT_PREAMBLE`, carries a `cache_control` breakpoint and is
      byte-identical across both calls up to that point — proven by
      `author.test.ts` → "caches the shared preamble". Moot now that authoring is back on
      `claude-haiku-4-5`: the shared preamble sits under Haiku's 4096-token cache minimum, so
      `usage.cache_read_input_tokens` would read zero either way.
- [x] **Implemented as the array form, not `"default"`.** `betas: ["server-side-fallback-2026-06-01"]`
      + `fallbacks: [{ model: "claude-opus-4-8" }]` — a deliberate deviation from this spec's earlier
      text, which described the `"default"` scalar form (`server-side-fallback-2026-07-01`). The array
      form pins the exact fallback Opus 5's own cyber-refusal routing already recommends, needs no
      newer beta flag, and is what `author.test.ts` → "opts into the server-side fallback on every
      call" verifies is present on every request. Revisiting for `"default"` is a smaller follow-up,
      not blocking.
- [x] Structured outputs were not re-tested against the live API — moot once authoring settled on
      Haiku 4.5, which is exactly where the original ~10–16 field ceiling was measured; see
      _Out of scope_.
- [x] **Estimated, not measured** (see the cost table under _The authoring ceiling_ in Design decision):
      ~$0.05 → ~$0.27 per generation worst case, moving from Haiku 4.5 to Opus 5. Flagged in this spec
      as a Pro-plan cost exposure for whoever owns pricing to weigh — not resolved here, and not
      silently absorbed either.

**Contract & consistency**

- [x] `PROMPT_VERSION` is `"8"` (`author.ts:29`), and `INTERVIEW_SCHEMA_VERSION` is `"2"`
      (`questions.ts:6`).
- [x] **Superseded by a design change, not literally followed.** `MAX_TOKENS` (singular, combined) was
      replaced by `MAIN_MAX_TOKENS` + `UI_MAX_TOKENS` (split, per call) — the fourth document's budget
      is accounted for by being its *own* call's budget rather than added to one shared ceiling, which
      is the point of splitting the calls in the first place (Design decision 3).
- [x] Constitution §0 carries the amended ceiling with the previous wording recorded
      (`.claude/spec-kit/constitution.md`), and `CLAUDE.md` is updated in the same change. The
      customer-facing equivalent — `commandRule()` in `scaffold.ts`, which is what a *generated*
      project's own constitution states — was updated too, since that is the copy a founder and their
      assistant actually read.
- [x] Typecheck passes (`pnpm -r typecheck`); lint adds no new issues (`pnpm -r lint`); tests green —
      `pnpm -r test`: 723 passed (35 schemas + 223 engine + 465 web); `pnpm test:scripts`: 80 passed.
      No pre-existing failures encountered.

### Verification

_How each criterion above is proven._

> **Implementation notes (this pass).** Two real bugs were caught by running the existing test suite
> against the new code, not by review — both fixed:
> 1. `template/docs/architecture/UI_ARCHITECTURE.md`'s own static prose hardcoded `` `/start` ``,
>    which broke `cleanup-command.test.ts`'s "never names /start anywhere in an imported foundation"
>    for a project shipping `/cleanup` instead. Fixed by routing it through the existing
>    `{{FIRST_COMMAND}}` token instead of a literal string.
> 2. The new `repoAndCiSection()`'s Azure DevOps branch said "the way **GitHub Actions** does" inside
>    an explanatory aside, tripping `provider.test.ts`'s "names no GitHub anywhere in an Azure DevOps
>    foundation". Fixed to say "the way Actions does" — matching how the pre-existing
>    `repoSetupSteps()` already threads this exact needle.
>
> A third, `postgresSetupSection()` naming "Supabase" by way of contrast when the founder chose
> Postgres, was caught the same way (`scaffold.test.ts` → "never contradicts itself across documents")
> and fixed by describing what a self-hosted Postgres project has to build without naming the
> alternative not chosen.
>
> The Verification plan below was written before implementation; two items changed on contact with the
> code and are noted where they diverge: no standalone assertion was added to `questions.test.ts` for
> the array length (the criterion itself now states the actual count and reasoning inline instead), and
> no dedicated "every fenced command traces to a derived one" test was added to `scaffold.test.ts` (the
> content is compliant by construction — see the Infrastructure setup criteria — but nothing enforces
> it going forward). Both are named as open items in Acceptance criteria above rather than silently
> dropped.
>
> **Closeout (`/analyze`, 2026-07-30).** First pass failed the gate on three categories: unmet
> acceptance criteria (11 items, all pre-existing and self-documented above), spec ↔ code drift (this
> "Exact changes" section hadn't caught up with the merge of `INFRASTRUCTURE_SETUP.md` into
> `DEVELOPER_GUIDE.md`, nor with `START_HERE.md`'s "How the commands work" section and the
> `firstStep()` wording change — both now recorded as items 19–21), and verification gaps (the same two
> missing tests named above). Constitution compliance and PR direction both passed cleanly (no `any`,
> no `process.env` in `packages/engine`/`packages/schemas`, branch correctly 2 commits ahead of
> `feature/interview-generator`). On explicit direction, closed anyway: every previously-open
> criterion is now checked as *accepted in its actual, reduced-scope state* — none were marked done
> without being done — and the substance of what's missing moved to _Out of scope_ → "Descoped at
> closeout" so it reads as a decision, not a gap someone has to rediscover. `/pr-check` still applies
> before this branch goes anywhere.

- **New tests** — `packages/schemas/src/questions.test.ts`: the question count is in range, every
  question has `help`, `uiDirection` has a `maxChars` entry, and no `showIf` references a removed id.
- **New tests** — `packages/engine/src/authored.test.ts`: `UI_ARCHITECTURE.md` is authored when the
  model supplies it, falls back deterministically when it does not, and is rejected when it carries a
  code fence or an unrendered token.
- **New tests** — `apps/web/src/features/generation/author.test.ts`: the two calls are independent in
  both directions — the UI request throwing, refusing, or returning malformed JSON leaves the main
  foundation authored, and the reverse leaves the UI document authored.
- **New tests** — `packages/engine/src/start-command.test.ts`: the rendered `/start` names
  `UI_ARCHITECTURE.md` and the `mvpFocus` action, and differs correctly across the three stack shapes.
- **New tests** — `packages/engine/src/cleanup-command.test.ts`: `/cleanup` covers the new document
  and still claims to change no code.
- **New tests** — `packages/engine/src/scaffold.test.ts`: the infrastructure guide renders per
  `database` × `hosting` × `repoProvider` combination the model allows; it names the service-role key
  as server-side only; it contains no `{{TOKEN}}`; and every fenced command in it also appears among
  the derived `CMD_*` or the provider CLI — the test that stops a plausible invented command.
- **Snapshot** — `packages/engine/src/scaffold.test.ts` golden fixtures regenerated deliberately; the
  diff is reviewed as a product decision. Fixture interviews updated to the new question set
  (constitution §V: adding a question requires updating fixtures).
- **Migration check** — a draft holding the old answer shape loads and prunes cleanly
  (`apps/web/src/features/interview/draft.test.ts`).
- **Manual** — one real generation per stack shape (Next.js, Vite, custom), read end to end, then
  `/start` run on the Next.js one in a scratch clone and the resulting first feature judged against
  `UI_ARCHITECTURE.md`.
- **Manual** — the infrastructure guide walked start to finish against real Supabase and Vercel
  accounts on a scratch project, following only what the file says, and every place it was ambiguous
  fixed. This is the criterion that cannot be met by reading.
- **Manual** — one generation with `ANTHROPIC_API_KEY` unset, ZIP downloaded and read.
- Full suite result + typecheck/lint status.

---

## Exact changes (file:line)

_Expanded by `/implement`. Touchpoints, grounded in current code._

1. **`packages/schemas/src/questions.ts`** — trim `interviewQuestions` ([:132](../packages/schemas/src/questions.ts#L132)),
   add `uiDirection`, extend `ANSWER_MAX_CHARS` ([:62](../packages/schemas/src/questions.ts#L62)),
   bump `INTERVIEW_SCHEMA_VERSION` ([:6](../packages/schemas/src/questions.ts#L6)). Candidates to
   remove or derive: `scale` ([:311](../packages/schemas/src/questions.ts#L311)),
   `team` ([:428](../packages/schemas/src/questions.ts#L428)),
   `roles` ([:243](../packages/schemas/src/questions.ts#L243)),
   `repoProvider` ([:418](../packages/schemas/src/questions.ts#L418)),
   `dataSensitivity` ([:300](../packages/schemas/src/questions.ts#L300)).
   [NEEDS CLARIFICATION: confirm the final list — which of these five go, which merge, and whether
   `audience` folds into `productType`.]
2. **`packages/schemas/src/types.ts`** — `uiDirection` on `InterviewAnswers`
   ([:51](../packages/schemas/src/types.ts#L51)) and `ProjectModel`
   ([:88](../packages/schemas/src/types.ts#L88)); remove fields for dropped answers.
3. **`packages/schemas/src/authoring.ts`** — add `docs/architecture/UI_ARCHITECTURE.md` to
   `AUTHORED_DOCUMENTS` ([:143](../packages/schemas/src/authoring.ts#L143)) with a
   `DOCUMENT_MAX_CHARS` ceiling ([:162](../packages/schemas/src/authoring.ts#L162)) sized to a build
   brief rather than a page — the note at that line records why an undersized ceiling silently falls
   back to the template on every generation, and this is the document that can least afford it; reconcile
   `PROSE_SLOTS` ([:27](../packages/schemas/src/authoring.ts#L27)) — `DESIGN_INVARIANTS` and
   `SCALE_POSTURE` change meaning or go.
4. **`template/docs/architecture/UI_ARCHITECTURE.md`** — new file: the deterministic version, with
   `[NEEDS CLARIFICATION]` markers where the interview gave nothing.
5. **`template/.airrow-template.json`** — the new path under `tailoredPaths`, and token docs for any
   new/renamed token (`START_MINIMUM` → its successor).
6. **`packages/engine/src/scaffold.ts`** — rewrite `startMinimum`
   ([:712](../packages/engine/src/scaffold.ts#L712)) into the first-feature instruction; add the
   deterministic UI document body; update the token table
   ([:912](../packages/engine/src/scaffold.ts#L912)) and `firstStep`
   ([:748](../packages/engine/src/scaffold.ts#L748)).
7. **`packages/engine/src/model.ts`** — carry `uiDirection` into the model; drop resolution for
   removed answers.
8. **`apps/web/src/features/generation/author.ts`** — revise `SYSTEM_PROMPT` for the sharper bar and
   add the UI-document section ([:54](../apps/web/src/features/generation/author.ts#L54)),
   `uiDirection` into `userPrompt`'s `answers`
   ([:260](../apps/web/src/features/generation/author.ts#L260)), `MAX_TOKENS`
   ([:52](../apps/web/src/features/generation/author.ts#L52)), `PROMPT_VERSION`
   ([:33](../apps/web/src/features/generation/author.ts#L33)).
   **Two calls.** `UI_ARCHITECTURE.md` gets its own request; the other three documents and the slots
   keep theirs. The brief's detail is the point of this spec, and one response carrying 4 documents +
   ~24 slots puts it in competition with everything else for the same token budget — the note at
   [:214](../apps/web/src/features/generation/author.ts#L214) records what that costs when it goes
   wrong: a response cut mid-JSON parses as nothing and silently loses the *whole* authored
   foundation. Splitting also turns that failure from total into partial, which is the same
   per-field-fallback principle `pickValid*` already applies. The price is a second system prompt and
   losing one voice across all four documents; the UI document overlaps least with the other three, so
   it is the cheapest one to separate. Both calls still fail closed to deterministic output, and a
   failure of either must not take the other down.
   Also here: `AUTHORING_MODEL` ([:36](../apps/web/src/features/generation/author.ts#L36)), the
   `thinking` / `effort` / `max_tokens` triple, the `cache_control` breakpoint in `SYSTEM_PROMPT`, and
   `fallbacks` — all per _The authoring ceiling_ above. Note the stale comment at
   [:35](../apps/web/src/features/generation/author.ts#L35) ("Haiku 4.5 … takes no `effort` parameter")
   describes the model being replaced and must go with it.
9. **`template/.claude/commands/start.md`** — read `UI_ARCHITECTURE.md` up front; the new ceiling at
   [:40](../template/.claude/commands/start.md#L40).
10. **`template/.claude/commands/cleanup.md`** — the new document in its scope, read-and-describe only.
11. **`template/START_HERE.md`** — rewrite step 1 ([:14](../template/START_HERE.md#L14)) and the
    reading table ([:35](../template/START_HERE.md#L35)); sharpen §4–§6. Step 2
    ([:26](../template/START_HERE.md#L26)) keeps `{{SETUP_STEPS}}` as its ordered list, with each step
    linking into the new guide.
12. **~~`template/docs/guides/INFRASTRUCTURE_SETUP.md`~~ — shipped, then merged away.** Landed first as
    its own file, sectioned per provider the way Airrow's own guide is (`1. Supabase project` →
    `2. Vercel project` → `3. Git integration` → `4. Verify end to end`), modelled on
    [`docs/guides/INFRASTRUCTURE_SETUP.md`](../docs/guides/INFRASTRUCTURE_SETUP.md) minus everything
    specific to Airrow's own product. Deleted one commit later on explicit direction — "we don't need
    two separate files" — and folded into a new "Getting to a deployed product" section in
    `template/docs/guides/DEVELOPER_GUIDE.md`. The `{{INFRASTRUCTURE_SETUP}}` token and its rendering
    (item 13) are unchanged; only the file it lands in moved.
13. **`packages/engine/src/scaffold.ts`** — the new guide's tokens, derived alongside the existing
    `setupSteps` ([:1149](../packages/engine/src/scaffold.ts#L1149)),
    `repoSetupSteps` ([:1195](../packages/engine/src/scaffold.ts#L1195)) and
    `deployTargetSetup` ([:1231](../packages/engine/src/scaffold.ts#L1231)) — those three hold the
    facts already and must stay the single source, with `SETUP_STEPS` reduced to the list that links
    into the guide rather than duplicating it.
    **One token** holds the whole guide body, so `template/docs/guides/INFRASTRUCTURE_SETUP.md` is a
    title and `{{INFRASTRUCTURE_SETUP}}`. The consequence is that the guide's shape stops being
    reviewable by reading the template and lives in `scaffold.ts` instead — so the tests in
    _Verification_ carry that weight, and the renderer is written as one function per section joined at
    the end rather than one long string, to keep a provider's steps diffable.
14. **`template/docs/guides/DEVELOPER_GUIDE.md`**, **`template/docs/README.md`**,
    **`template/CLAUDE.md`** — reading order and conventions include the UI document and the
    infrastructure guide.
15. **`.claude/spec-kit/constitution.md`** ([:21](../.claude/spec-kit/constitution.md#L21)) and
    **`CLAUDE.md`** — the amended `/start` ceiling, previous wording recorded.
16. **`apps/web/src/features/interview/*`** — the new question renders as a textarea with its
    `maxChars`; the draft schema accepts the new shape and tolerates the old one.
17. **`template/.airrow-template.json`** — the infrastructure guide under `tailoredPaths`, and its
    tokens documented in `tokens` (the file is the token contract, and an undocumented token is a
    silent one).
18. **`specs/README.md`** — status row for this spec.
19. **`template/START_HERE.md`, added post-hoc, not in the original plan** — a "How the commands work"
    section (what a `/command` is, and what's needed to run one) ahead of step 1; the credit-card
    aside dropped from step 2's intro; the reading-table fix (item 21). **`packages/engine/src/scaffold.ts`**
    — `firstStep()`'s opening line changed from "Open your AI assistant" to "Open Claude Code", read
    verbatim in `START_HERE.md` step 1 for both the `/start` and `/cleanup` branches.
20. **`apps/web/src/features/generation/author.ts`, `apps/web/src/features/generation/runner.ts` —
    the authoring-ceiling attempts, in the order they actually happened**, not as a single planned
    change: `claude-opus-5` (thinking/effort/fallbacks added) → `claude-sonnet-5` (thinking explicitly
    disabled, `effort: "low"`) → `claude-haiku-4-5` (thinking/effort/fallbacks all removed again — the
    model this spec ships with). `runner.ts`'s `BEAT` constant raised 260ms → 700ms, unrelated to the
    model changes: the four non-authoring stages were "almost instant" beside a live authoring call,
    which read as stuck rather than working.
21. **`template/START_HERE.md`** — the reading-order table's separator row had an extra column and was
    missing its `SYSTEM_OVERVIEW.md` row (four rows under a "five files" heading); both were leftover
    damage from an earlier manual edit, not part of any planned change here. Fixed to five matched rows.

**No change needed:** `TOOLCHAIN_SLOTS` and the command allowlist — `/start` builds the feature, it
does not need a new command from the model. `pickValid*` already gives per-field fallback, so a
rejected UI document costs only that file.

---

## Data model

**No schema changes.** Interview answers already persist as JSON; the manifest already records prompt
version and inputs hash per file, so the bumped `PROMPT_VERSION` and new document are recorded by the
existing plumbing.

---

## Security

Widens what the model writes by one document and what `/start` writes by one feature. Both are already
contained structurally: the document goes through `authoredDocumentsSchema`, which caps length and
rejects code fences, template tokens and assistant voice — so `uiDirection`, an untrusted answer that
may come from someone without an account, still cannot put anything runnable in front of a founder.
`/start` runs on the founder's machine on their explicit command; Airrow's servers write no
application code, and no new command reaches a shell.

---

## Edge cases

- `uiDirection` left empty or thin ("clean and modern") → the UI document is written from the product
  answers plus the foundation's own design language, says plainly which choices are ours rather than
  the founder's, and is still detailed enough for `/start` to build a finished-looking screen from.
  A thin answer costs the founder specificity, never polish.
- `uiDirection` describes something the stack cannot do (a native iOS look on a Vite SPA) → the
  document describes what the chosen stack can honour and marks the mismatch.
- `mvpFocus` too vague for `/start` to build (`"help people"`) → `/start` builds the screen the UI
  document describes, leaves the action unbuilt with a marker, and says what it could not derive. It
  never guesses a feature — polish is allowed to fill a gap in taste, never one in function.
- Authoring returns three documents but not the UI one → deterministic UI document, everything else
  authored (existing per-field fallback).
- Response truncated mid-JSON at the new model → `null`, deterministic foundation, unchanged. The point
  of the raised `max_tokens` is that this stops being the *common* case; it must stay safe when it happens.
- The model declines the request (`stop_reason: "refusal"`) → the server-side fallback answers. If the
  whole chain declines, `null` and a complete deterministic foundation, as today.
- `AIRROW_AUTHORING_MODEL` set to a model that takes no `effort`, or rejects an explicit `thinking` →
  the request must not 400 into a silent `null`. Either the override is validated, or the parameters are
  derived from the model, or the env var is documented as golden-path-only. Decide in `/implement`.
- Imported project (`shipsCleanup`) → gets `/cleanup`, and the UI document describes the UI already
  there; `/start` and its ceiling do not apply. The infrastructure guide is phrased for a founder who
  may already have half of it.
- `hosting: self_host` or `azure` → the guide's deploy section describes preparing their own target and
  says the deploy workflow ships as a placeholder to finish. It does not pretend Vercel's flow applies.
- `database: postgres` (not Supabase) → the guide covers provisioning and the connection string, and
  names what the founder now has to build that Supabase would have provided: auth, storage, RLS
  wiring. No Supabase key names appear anywhere in that variant.
- `repoProvider: azure_devops` → registered pipelines and branch policies, in Azure DevOps' own terms,
  not GitHub's steps relabelled ([spec 67](67-azure-devops-parity.md)).
- A draft saved under `INTERVIEW_SCHEMA_VERSION` `"1"` → loads, drops answers to removed questions,
  and asks the new question.
- Founder regenerates after `/start` has already run → unchanged: generation writes the foundation, not
  their code, and `/start` remains re-runnable and non-destructive.

---

## Out of scope

- Schema, migrations and persistence for `mvpFocus` — decided out, per issue #123. `/start` builds the
  core action against local state; the table is the founder's first spec.
- A visual/upload-based UI input (screenshots, Figma, a theme picker). Free text only here.
- Regenerating existing foundations to add `UI_ARCHITECTURE.md` retroactively — revisions
  ([spec 100](100-pro-upgrade-revisions.md)) already cover regeneration.
- Changing the pricing or entitlement model. `checkAllowance` is untouched.
- Any change to the workflow commands' own behaviour (`/createspec`, `/clarify`, `/implement`,
  `/analyze`, `/pr-check`, `/push`).

**Descoped at closeout** (`/analyze` found these open on 2026-07-30; scope was cut rather than left
half-open — a decision, not an oversight):

- **`START_HERE.md`'s full rewrite.** Step 1's prose and §4–§6 were never rewritten to the persuasive,
  carry-a-founder-past-month-two bar Design decision 5 set. What shipped instead: a new "How the
  commands work" section, a link to the infrastructure guide, a reading-table fix. Follow-up: a spec
  of its own, scoped to `START_HERE.md` alone.
- **Every live-API / manual check.** Authored prose quality (UI brief and the four narrative
  documents), a live `/start` run against a real AI assistant, the infrastructure guide walked against
  real Supabase/Vercel accounts, and a measured (not estimated) per-generation cost on `claude-haiku-4-5`
  — none were run. Everything mechanical (request shape, fallback behaviour, contract enforcement,
  independence of the two authoring calls) is tested; what a live model actually writes and what a
  founder actually experiences are not. Follow-up: run all four once, by hand, before this becomes load
  -bearing for a real customer cohort.
- **Two verification tests named in the original Verification plan.** A `questions.test.ts` assertion
  on the interview's final question count, and a `scaffold.test.ts` test proving every command in the
  infrastructure guide traces to a derived `CMD_*`/provider CLI. Both are true by construction today;
  neither is enforced going forward.
- **Explicit money/one-time-vs-repeated framing** in the infrastructure guide, and **per-step** (rather
  than once) links from `START_HERE.md` into it.
- **Re-testing structured outputs** against the live API now that the field count is lower — moot while
  authoring stays on `claude-haiku-4-5`, worth revisiting if it moves back to an Opus/Sonnet-tier model.
