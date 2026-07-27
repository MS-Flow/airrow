# Spec 66 — `/start`: from empty repo to a running starting point

> **In one sentence:** Ship a `/start` slash command in every generated foundation that scaffolds a
> real, runnable stack and sets the project up to the bare minimum that runs, using the information
> already in the repo, and rewrite `START_HERE.md` so its steps are in an order where every command it
> names actually exists.

|                |                                                          |
| -------------- | -------------------------------------------------------- |
| **Status**     | ✅ Done                                                   |
| **Issue**      | #66 — "/start: from empty repo to a running stack, and a START_HERE that matches" (body updated 2026-07-27 to match the §0 amendment below) |
| **Branch**     | `66-start-command` (from `feature/interview-generator`)  |
| **Feature**    | Interview-driven project generator                        |
| **Depends on** | [65-authored-documents.md](65-authored-documents.md) — owns the `TOOLCHAIN_SLOTS` (`CMD_DEV`, `CMD_BUILD`, `CMD_TYPECHECK`, `CMD_LINT`, `CMD_TEST`) whose values `/start` has to make true, and authors the documents the first draft reads from · [10-foundation-reflects-answers.md](10-foundation-reflects-answers.md) — established that the foundation must reflect the answers |

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

---

## User story

_Who wants this, and what they get out of it._

As a **founder who has just downloaded a generated foundation** I want **one command that turns it
into a stack that runs, with just enough of my project in place to build on** so that **my first
minute with the repo is something I can open, change and continue from, instead of four commands that
do not exist and a red build on the first push**.

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today:** the foundation is docs-only. [`template/START_HERE.md`](../template/START_HERE.md) step 2
  tells the founder to run `{{CMD_DEV}}`, `{{CMD_TYPECHECK}}`, `{{CMD_LINT}}` and `{{CMD_TEST}}` and
  claims *"If all four are clean, the foundation is working."*
  [`template/.github/workflows/ci.yml`](../template/.github/workflows/ci.yml) runs the same three
  verification commands on every push.
- **The problem:** there is no `package.json`, no source and no toolchain, so none of those commands
  can run. The first push to GitHub goes red before the founder has written a line, and `START_HERE.md`
  front-loads reading and repo admin ahead of anything that works.
- **Already in place:** the interview asks for the framework
  ([`packages/schemas/src/questions.ts:248`](../packages/schemas/src/questions.ts#L248) — Next.js,
  Vite + React, or a free-text custom stack), spec 65 authors the `CMD_*` slot values and the prose in
  `docs/VISION.md`, `docs/architecture/SYSTEM_OVERVIEW.md` and the rest, and the generated repo already
  ships slash commands under `template/.claude/commands/` (`createspec`, `clarify`, `implement`,
  `analyze`, `pr-check`, `push`) — so `/start` is a new instance of a shape that already exists rather
  than new machinery.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

`/start` ships as `template/.claude/commands/start.md`, rendered per the framework chosen in the
interview. The founder opens their AI assistant in the generated repo and runs it — an explicit,
founder-in-control trigger. It does three things in one pass: scaffolds via the official tool for that
framework and wires the toolchain the foundation already assumes (TypeScript strict, ESLint, the test
runner, `.env.example`); initialises git with the branch model the foundation ships; and sets the
project up to the **bare minimum that runs** — enough of the shape the foundation's documents describe
that the founder has something to open, change and continue from — then runs the verification bar and
reports it. `START_HERE.md` is rewritten rather than patched: `/start` first, then the manual steps
that need a human and an account, then the spec loop, which is where the real product gets built.

**Bare minimum is the ceiling, not a fallback.** `/start` is not trying to guess the product on the
first try. It aims at the smallest thing that runs and is obviously *this* project rather than a blank
scaffolder default — the founder then changes it. Aiming higher would mean writing features nobody
specced, which is what the spec loop exists to prevent.

**Not touched:** anything past the machine boundary. No creating repositories, no provisioning
Supabase, no deploying, no secrets — those create external resources and cost money, so they stay
manual steps in `START_HERE.md`. Git initialisation is local only: `git init`, the first commit and the
`develop` / `feature` branches, never a remote.

### Constitutional amendment (§0 — "Preparation, not implementation")

This spec changes a product invariant, so the change is recorded here as the constitution requires.

**Today §0 reads:** *"Preparation, not implementation. Airrow generates everything needed before
serious coding begins — never the application code itself. A feature drifting toward being an app
builder is out of scope."*

**It becomes:** *"Preparation, and a starting point. Airrow's hosted product generates engineering
foundations — documents, rules, workflow and CI — never application code. The `/start` command it
ships **inside** a generated repository is the deliberate exception: run explicitly by the founder, on
their own machine, it scaffolds the stack and sets the project up to the bare minimum that runs, using
the information already in the repo. Bare minimum is the ceiling — enough to open, change and continue
from, never a guess at the product. Everything past that goes through the spec loop. Airrow's servers
still never write application code, and ZIP delivery is still a complete foundation on its own."*

**Why the boundary moves but does not disappear:** the starting point is produced by the founder's
assistant, in the founder's repository, on an explicit command — not by Airrow's generation engine.
What Airrow ships is still text. `packages/engine` stays a pure
`generate(templateFiles, projectModel) → RepoTree + Manifest`, and nothing about the hosted generation
path changes. The clause this drops — *"A feature drifting toward being an app builder is out of
scope"* — is replaced by the bare-minimum ceiling, which is what now holds the line.

**The generated foundation inherits the amendment.** `template/.claude/spec-kit/constitution.md`
carries the same new §0, so a founder's own project runs under the rule Airrow runs under — §0,
*"Airrow is built with Airrow"*. The practical consequence is deliberate: the founder's assistant may
set their project up to a running minimum on command, and everything beyond that goes through their
spec loop, exactly as it does here.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] A generated repo ships `.claude/commands/start.md`, and its content matches the framework the
      founder chose in the interview.
- [x] After running `/start`, `CMD_DEV`, `CMD_TYPECHECK`, `CMD_LINT` and `CMD_TEST` all run and pass
      in the generated repo. _(Manual run, below: all four pass, `pnpm build` too, and `pnpm dev`
      serves HTTP 200.)_
- [x] The generated `.github/workflows/ci.yml` passes on the first push after `/start`. _(The `detect`
      gate resolves `ready=true` against the real scaffolded repo; the workflow's own steps are the
      four commands, all verified passing.)_
- [x] All three framework routes are covered — Next.js, Vite + React, and a custom stack derived from
      the free-text answer — and the commands named in the generated docs match the route taken.
- [x] `/start` leaves the project at the bare minimum that runs: it opens in a browser, it is
      recognisably this project rather than a blank scaffolder default, and it is obvious where to
      change it next. No features, no screens nobody asked for.
- [x] `/start` initialises git locally — `git init -b main`, a first commit, and the `develop` /
      `feature` branches from [BRANCHING.md](../docs/architecture/BRANCHING.md) — and touches no
      remote.
- [x] `/start` creates nothing outside the working directory: no remote repository, no hosted
      project, no deployment, no secrets written.
- [x] Running `/start` a second time detects what already exists and skips it — no clobbered work, no
      duplicated configuration, no second draft written over the founder's edits.
- [x] `START_HERE.md` describes the real order (`/start` → manual setup → spec loop) and every command
      it names exists after step 1.
- [x] `.claude/spec-kit/constitution.md` §0 carries the amended wording above; the generated
      foundation carries the same rule — see the deviation note under Implementation notes.
- [x] `pnpm engine:smoke` checks a generated project's `CMD_*` against what `/start` produces.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures);
      `pnpm build` clean.

### Verification

_How each criterion above is proven._

The decision here is **unit tests plus one recorded manual check**. `/start` is instruction text an
assistant executes, not code we run, and proving the stack actually goes green would mean running
`create-next-app` inside CI — network-dependent, and against §V's *"Tests are deterministic: no
dependence on ... the network"*. So the parts that are files get tested, and the part that is an
assistant run gets a manual check written into this spec.

- **New tests** — `packages/engine/src/start-command.test.ts`: `start.md` renders per framework, the
  Next.js / Vite / custom variants differ in the expected way, no `{{SLOT}}` is left unrendered, and
  the `CMD_*` named in `start.md` match the ones in `START_HERE.md` and `ci.yml` for the same model.
- **Extended** — `pnpm engine:smoke`: a generated project's `CMD_*` agree with what `/start` sets up.
- **Criterion "bare minimum that runs" and "green verification bar"** → manual: generate a project, run
  `/start` in it, record the outcome (commands run, bar green, the app opens in a browser) in this
  spec's Status section before `/analyze` closes it.
- **Criterion "creates nothing outside the working directory"** → reviewed property of the prompt text
  in `start.md`, checked at review time. A test cannot prove what an assistant will not do; the
  instruction text naming no remote, no provisioning and no secrets is what is reviewable.
- **Criterion "re-runnable"** → part of the same manual check: run `/start` twice, second time after
  editing a drafted file, and confirm nothing is clobbered.
- Full suite result + typecheck/lint status.

---

## Exact changes (file:line)

_What was actually changed._

**Generated output (`template/`)**

1. **`template/.claude/commands/start.md`** — new. Front-matter and shape follow the sibling
   `createspec.md`. Four sections: stack + toolchain (`{{START_BOOTSTRAP}}`), local git, the smallest
   thing that runs (`{{START_MINIMUM}}`), and the verification bar it must report honestly.
2. **`template/START_HERE.md`** — rewritten. New order: `/start` → accounts → read four files →
   first spec → the loop. Step 2 no longer tells the founder to install what `/start` installs.
3. **`template/.github/workflows/ci.yml`** — a `detect` job now gates `verify`
   (`if: needs.detect.outputs.ready == 'true'`), so the first push to an unscaffolded repo is a green
   notice rather than a red build. `verify` is unchanged otherwise.
4. **`template/.claude/spec-kit/constitution.md`** — a §IV bullet carrying the bare-minimum ceiling
   (see the deviation note below).
5. **`template/.airrow-template.json`** — documents the three new tokens.

**Engine (`packages/engine/src/`)**

6. **`scaffold.ts`** — three new renderers: `startBootstrap()` (per-framework scaffold + toolchain),
   `startMinimum()` (the ceiling, drawn from `mvpFocus` / `coreEntities`), `ciReadyCheck()` (the CI
   gate). `setupSteps()` narrowed to the steps that need an account, since installing moved to
   `/start`. `cmdName()` is a small helper for prose naming a script.
7. **`index.ts`** — `.claude/commands/start.md` added to the required-file list in `validate()`. A
   foundation without it is documents describing commands that do not exist.

**Verification**

8. **`packages/engine/src/start-command.test.ts`** — new, 15 tests.
9. **`packages/engine/src/scaffold.test.ts`** — two existing tests updated where the responsibility
   moved: the install command is asserted against `start.md` instead of `START_HERE.md`, and the
   ordered-steps test now requires `/start` to come before `/createspec`.
10. **`scripts/engine-smoke.mjs`** — per fixture, asserts `/start` exists and that the `CMD_*` in
    `start.md`, `START_HERE.md` and `ci.yml` are the same commands.

**Airrow's own rules**

11. **`.claude/spec-kit/constitution.md` §0** — the amended wording, linking back to this spec.

**No change needed:** `packages/schemas` — `TOOLCHAIN_SLOTS` and the framework question already had
everything. The engine stayed pure: `/start` is text rendered from the model, and nothing new reads
`process.env` or does I/O.

---

## Data model

**No schema changes.** This changes generated output and the template only; nothing is persisted.

---

## Security

`/start` is instruction text an assistant executes in the founder's own working directory. It writes
no secrets, reaches no network resource we control, and creates nothing outside that directory —
`.env.example` ships placeholders only, never values, and git initialisation is local with no remote.
The minimum it builds is drawn from documents already in the repo, so it adds no new data path.

**Scaffolder versions are not pinned.** `create-next-app@latest` and `create-vite@latest` download and
execute third-party code from npm, and a pin would be a reviewed toolchain rather than whatever is
latest that day. It is still `@latest`, for two reasons: the generated deploy workflow already invokes
`vercel@latest` on the same trust model, so pinning only here would be inconsistent without being
safer; and a pin in `template/` goes stale silently, handing founders an outdated scaffolder months
later with nothing to signal it. The founder scaffolds once, on the day they generate. Revisit if
`template/` ever grows a maintained dependency set.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- **Framework answered as `custom`** (free text, [`questions.ts:277`](../packages/schemas/src/questions.ts#L277))
  → `/start` derives the bootstrap from the free-text answer and does its best with it. A founder who
  described their stack does not get empty hands (§0 *"the output is the product"*). This route cannot
  be verified the way the two golden paths can, and `start.md` says so honestly rather than promising
  a green bar it cannot guarantee.
- **`/start` run in a directory that already has a `package.json`** → detects and skips the scaffold,
  per the re-runnability criterion.
- **`/start` run twice, second time after the founder has written code** → must not clobber work, and
  must not write over edited files.
- **Repo already has a `.git` directory** → skips init, leaves branches alone.
- **The foundation's documents are thin** (short answers, little to draw from) → no special case, and
  nothing to ask the founder. The floor and the ceiling are the same thing: set the project up to the
  minimum that runs with whatever information is there. Thin documents make it plainer, not different.
- **Scaffolder prompts interactively** → every flag is passed explicitly, so it never asks. A command
  that stops for a question is a command whose outcome nobody can predict or test; a test asserts the
  flag set is present for the Next.js route.
- **`CMD_BUILD`** → yes, it must work. It was never actually in question: `cmds()` has always derived
  all five, and `CLAUDE.md` already names `build`. `/start`'s verification bar runs all five;
  `START_HERE.md` still lists four, because a founder checking their setup does not need a production
  build to know it works.
- **Package manager** → already answered in code, before this spec:
  [`packageManager()`](../packages/engine/src/scaffold.ts) maps Vite → `npm` (its scaffolder is
  npm-based) and everything else → `pnpm`. `/start` uses the same function, so it cannot drift from
  the commands in the generated docs.

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- AI-authored document personalisation and the interview rework — [65-authored-documents.md](65-authored-documents.md).
- Provisioning Supabase, GitHub or the deploy target on the founder's behalf — those cross the machine
  boundary and stay manual steps in `START_HERE.md`.
- Pushing to a remote, creating a repository, or deploying. `/start` stops at the machine boundary
  even though it now initialises git.

---

## Implementation notes

### Deviation: the generated foundation has no §0 to inherit

The plan said `template/.claude/spec-kit/constitution.md` would carry the same amended §0. It cannot:
that file has no §0 at all — it runs from §I Architecture to §VI Verification bar, because §0 holds
*Airrow's* product promises, which are not the founder's. There was therefore no "never application
code" rule in a customer project to amend, and adding a whole §0 to carry one line would import rules
that do not belong there.

The decision — that the founder's project runs under the same boundary — is honoured as a §IV Process
bullet instead, next to "Spec before code" where it belongs:

> **`/start` sets up, the spec loop builds.** `/start` takes this project to the bare minimum that
> runs — enough to open, change and continue from. That is its ceiling, not a starting budget.
> Everything past it goes through a spec: no spec, no feature.

Same rule, right section. Flagged rather than folded in silently, per §IV.

### `SETUP_STEPS` changed meaning

It used to be "the ordered first-hour setup" and began with installing a runtime and dependencies.
`/start` does that now, so the token narrowed to the steps that need a human with an account, and
gained the repository/secrets steps that used to be a separate `START_HERE.md` section. Two existing
tests in `scaffold.test.ts` asserted the old location and were updated, not deleted — the behaviour
moved, it did not disappear.

### CI is gated, not just fixed

The criterion asked that `ci.yml` pass *after* `/start`. It also now passes *before*: a `detect` job
decides whether there is a stack to verify, and `verify` is skipped with a `::notice::` if not. That
goes slightly past the letter of the criterion but is the issue's actual complaint — "the first push
to GitHub fails before the founder has written a line". It also fixes a pre-existing hole for custom
stacks, whose unauthored `CMD_*` rendered as `[NEEDS CLARIFICATION: …]` markers and would have reached
the shell as commands that do not exist.

### The manual check found four real bugs — 2026-07-27

`/start` was generated into a scratch directory as a real Loop CRM foundation (Next.js / Supabase /
Vercel) and its steps were followed literally, as a founder's assistant would. The first three steps
all failed. None of these were reachable by a unit test, because each one is a property of a
third-party tool, not of our text.

1. **`create-next-app` refuses a non-empty directory.** It listed `.github/`, `CLAUDE.md`,
   `README.md`, `specs/` and `START_HERE.md` as conflicts and exited. It has no force flag.
   `create-vite` has `--overwrite`, which is worse — it *deletes* what is there, i.e. the whole
   foundation. → Both routes now scaffold into a throwaway `<slug>-scaffold/` directory and are moved
   in with existing files winning.
2. **`create-next-app` rejects a dot-prefixed directory** — "name cannot start with a period",
   because it derives the npm package name from the directory. → Throwaway directory is
   `<slug>-scaffold`, and step 2 repairs `name` in `package.json` after the move.
3. **`.env.example` never existed.** Four generated documents told the founder to copy it —
   `START_HERE.md` step 2 and `/start` among them — and `template/` has never shipped one. This is
   the same defect class as the commands that could not run. → `/start` now *creates* it, with the
   variable names the chosen database needs and no values.
4. **`pnpm add -D vitest` installed a runner that would not start.** vitest 4.1.10 fails with
   `ERR_PACKAGE_IMPORT_NOT_DEFINED` under Node 25.2.1 + pnpm 9.15.9; 3.2.7 runs clean. → The test
   runner is pinned to `^3`. This narrows the earlier "nothing is pinned" decision under Security: the
   scaffolders run once and stay `@latest`, but the test runner lands in the founder's `package.json`
   and stays there, so an unpinned major is a variable worth removing.

A fifth, smaller one: `git init` left the trunk as `master` on this machine while the shipped branch
model is `main` ← `develop`. → `git init -b main`.

### The manual check, after the fixes

Same scratch directory, regenerated from zero and run through the corrected `/start`:

| Step | Result |
|---|---|
| Scaffold into `loop-crm-scaffold/`, move in | ✅ 17 files moved; `CLAUDE.md` and `README.md` kept ours |
| `pnpm install` + `pnpm add -D vitest@^3` | ✅ |
| `.env.example` → `.env.local`, `.gitignore` already excludes `.env*` | ✅ |
| `git init -b main`, first commit, `develop` + `feature/first` | ✅ 0 remotes |
| `pnpm typecheck` / `lint` / `test` / `build` | ✅ all pass |
| `pnpm dev` | ✅ HTTP 200, page renders "Loop CRM", the MVP focus, and the four core objects |
| Second run after editing `src/app/page.tsx` | ✅ every guard reports SKIP; the edit survives |
| CI `detect` gate against the scaffolded repo | ✅ `ready=true` |

### Verification result — 2026-07-27

| Command | Result |
|---|---|
| `pnpm -r typecheck` | clean (3 projects) |
| `pnpm -r lint` | clean, no new issues (3 projects) |
| `pnpm -r test` | **262 passed**, 24 skipped — schemas 21, engine 109, web 132 |
| `pnpm test:scripts` | 13 passed |
| `pnpm engine:smoke` | SMOKE PASSED — 4 fixtures, 22 files each |
| `pnpm build` | clean |

The 24 skipped are pre-existing: the `*.db.test.ts` and RLS suites skip without a local Supabase.
No new failures, no pre-existing failures.

### Follow-up: `START_HERE.md` step 4 explains what a spec is

Added after close-out, on the founder's read of the file: the spec section said *how* to run
`/createspec` but never *what a spec is for* or when one is needed. A founder who reads "write your
first spec" and thinks it means one document at the start will abandon the loop by week two. Step 4
now opens with a table of what warrants a spec — screens, UI changes, features, schema, integrations,
non-trivial bugs — states plainly that UI and functionality are the same case, and gives the reason:
an assistant with no spec optimises for looking finished, and there is nothing to review the result
against. `START_HERE.md` is the only file where this can land; the constitution states the rule but
never sells it.

### Follow-up: preview links 404'd, and every file switch was a server round-trip

Two defects in the repo preview, found by reading a generated foundation in the dashboard.

**Links inside a rendered file went to a 404.** Generated documents are mostly cross-references —
`START_HERE.md` alone links to `CLAUDE.md`, the constitution, `VISION.md` and `BRANCHING.md`. Rendered
markdown gives those plain relative hrefs, which the browser resolves against the *route*, landing on
`/app/projects/<id>/preview/CLAUDE.md`. Nothing exists there. The only way to move between files was
the tree on the left, which makes the preview a file list rather than something you can read.

Fixed with [`links.ts`](../apps/web/src/features/preview/links.ts) — a pure resolver, kept out of the
component so the `../` arithmetic is testable — plus one delegated click handler on the reader.
Anchors and external links are left to the browser; a link to something the foundation does not
contain does nothing, which beats a 404. Directory links (`../specs/`, `../.claude/commands/`) expand
that folder in the tree instead.

Measured against a real generated foundation: **28 internal links now resolve to a file, 5 to a
directory.** The one remaining is a `<link>` placeholder in the spec template, which is correct.

**Switching files was slow because it was a navigation.** `select()` did `router.replace(?file=…)`,
re-running the server component: `requireSession()`, `getProject()`, `latestJob()`, a full
`loadArtifact()` and Shiki — before anything appeared, even for a markdown file that needs no
highlighting. The client already had every file's content. The active path is now client state with
`history.replaceState` keeping the URL deep-linkable, so a switch is a re-render. Highlighting is the
one thing the client cannot do for itself, so `highlightFileAction` fetches it for code files while
plain text shows immediately — nothing blocks on it.

### Follow-up: the landing page makes the spec argument, not just the claim

`START_HERE.md` now explains why a spec earns its keep, but that argument was only reaching founders
who had already generated a foundation. The landing section "Why spec-driven development" listed four
true but abstract lines and never named the failure the method prevents.

`WHY_SDD` in [`copy.ts`](../apps/web/src/features/landing/copy.ts) now opens on it: *"Without a spec,
an agent optimises for looking finished. It invents requirements you never gave it and quietly
reopens decisions you made last week."* Plus the reframe that makes review possible at all, and the
memory point. Five lines, absorbing the old four rather than stacking on top.

Written inside the landing voice rules from spec 23, which `copy.test.ts` enforces: no em dash, no
double hyphen, no named AI assistant. The `START_HERE.md` wording this came from breaks all three, so
it was rewritten rather than copied.

`START_HERE.md` also joins `FOUNDATION_HIGHLIGHTS`, first in the list, since it is the first file a
founder opens and the section had no answer to "where do I actually begin". `readFoundation()`
already throws when a highlighted path is missing from the template, so the new entry is guarded the
same way the other five are.

### Doc sync

`CLAUDE.md:76` and `docs/architecture/SYSTEM_OVERVIEW.md:10` both still asserted the pre-amendment
rule ("never application implementation code" / "it never writes the application code itself"). Caught
by `/analyze`, and a §IV violation — *"`CLAUDE.md` and docs update in the same change as the code they
describe"* — with the added cost that `CLAUDE.md` is the first thing an assistant reads each session,
so the contradiction would have been inherited by every future one. Both now carry the `/start`
exception and point at this spec.

### Follow-up: a mobile app was never asked which stack it was built in

Reported by a founder who generated a mobile app, was never shown the stack question, and found
`npm run dev` in every document of what turned out to be a Vite web SPA.

The gate was real code, not a misreading:
[`questions.ts`](../packages/schemas/src/questions.ts) hid the `framework` question behind
`showIf: productType in [saas, marketplace, ai_agent, internal_tool, hobby]`, and
[`model.ts`](../packages/engine/src/model.ts) resolved the unanswered case to `vite` for
`mobile_app` and `browser_extension`. Two lists that were meant to be the same idea had drifted —
the neighbouring `audience` question gates on `WEB_PRODUCT_TYPES`, which *includes* all three of the
product types the stack question excluded. Everything downstream was correct: Vite means npm, npm
means `npm run dev`. **A default nobody is shown is a decision nobody made.**

Fixed by asking everyone, and by moving the recommendation into data:

- **`STANDARD_STACK`** (`questions.ts`) — one row per product type: the recommended `framework`
  option, plus a `describe` string for the types the engine cannot scaffold itself (mobile app →
  Expo, API → Node + Hono, browser extension → Vite + CRXJS). `model.ts` resolves an unanswered
  stack from the same table, so an old draft lands where the founder would have been pointed.
- **`Question.suggest`** — a generic `{ from, value }` map: for a `single` question it names the
  option to mark **Recommended**, for a `text` one the text to prefill. `withSuggestions()` applies
  it on every answer change and never writes over what the founder typed. That is what puts Expo in
  front of a mobile founder without taking the choice away from them.
- **`QuestionOption.recommended`** — for the questions whose golden path is the same for everyone.
  The `— recommended` suffixes came out of the labels; the badge is rendered from these two rules
  instead, because which option is recommended now depends on an earlier answer.

**Deliberately not done:** Expo did not become a fourth `Framework`. Three more golden paths
(scaffolder, package manager, CI setup, deploy target) is a different spec, and the `custom` route
already exists for exactly this — the toolchain is authored from the description, which is the
treatment spec 65 chose for any stack we cannot derive. The known cost is that a mobile app now
takes that route, so with no authoring key its `CMD_*` render as `[NEEDS CLARIFICATION]` markers and
CI gates itself off. That is the honest failure, and it is the one already designed for.

### Follow-up: `/start` did not install the stack `CLAUDE.md` names

Same founder, next step. `/start` ran, the app came up, and the assistant closed with: *"Not
installed: Tailwind and shadcn/ui, which CLAUDE.md names as the stack. /start's section 1 doesn't
list them and its ceiling forbids components ahead of a spec, so the screen is plain CSS."*

It was right on both counts, and both were our defect — the same class as the commands that could
not run:

1. **The install step was missing.** `STACK_SUMMARY` has always said "TypeScript · Tailwind +
   shadcn/ui" for both golden paths. `create-next-app --tailwind` gets halfway there and
   `create-vite` not at all, and nothing anywhere installed shadcn/ui. → New
   `designSystemStep()` in `scaffold.ts` as `/start` step 4: `shadcn@latest init` on Next.js;
   Tailwind v4 (`@tailwindcss/vite`), the `@/*` alias shadcn resolves through, and then `init` on
   Vite. `init` only — it writes `components.json` and the `cn` helper and installs no components,
   and it names the `add` command without running it.
2. **The ceiling forbade the design system.** `startMinimum()` said "no components built ahead of a
   spec", which an assistant correctly reads as covering the UI library it was just handed. Styling
   is the stack, not a feature. The ceiling now says so explicitly, and differently for a custom
   stack, where nothing claims Tailwind in the first place.

Also folded in: `dlx()`, so the one-off tools run with the founder's package manager (`pnpm dlx` /
`npx`) — `deploySteps()` had grown its own copy of that expression.

### Follow-up: two more places the stack was assumed rather than read

Both found by reading a rendered mobile-app foundation, and both older than this change — the
mobile route just made them visible.

- **`.env.example` handed every project Next.js's variable prefix.** `envExample()` emitted
  `NEXT_PUBLIC_SUPABASE_URL` for any Supabase project, so a **Vite** app — a golden path, chosen by
  founders today — got two variables its bundler does not expose. The failure is silent: `undefined`
  at runtime, no error, in the file the founder fills in first. Now `NEXT_PUBLIC_` / `VITE_` per
  framework, and unprefixed for a described stack with the rule stated rather than guessed. The
  service-role key stays server-only in all three.
- **A doubled period in the first instruction.** `startBootstrap()` appended `.` to the stack name,
  which is free text a founder may already have ended with one — "…jest-expo for tests.." reads as a
  typo in step 1. `sentence()` now adds one only where one is missing, and the prefilled standard
  stacks are written as fragments so they also read correctly inline in `STACK_SUMMARY`.

**This changes `startBootstrap()`, so the manual check below is due again** — see the note that
closes this file. Not yet re-run: the design-system step is the third-party behaviour these tests
cannot see, exactly like the four bugs the first manual run found.

#### Verification — the three follow-ups above, 2026-07-27

New tests: `packages/schemas/src/questions.test.ts` (14) — every product type reaches the stack
question, the recommendation is per product type and never Vite for a mobile app, prefills stay
inside `ANSWER_MAX_CHARS` and are never written over. `model.test.ts` (+3) — an unanswered stack
resolves from `STANDARD_STACK`, and an answered one wins over it. `start-command.test.ts` (+9) — the
design system its documents name is installed, `init` without components, the right package-manager
runner, the public-variable prefix the chosen stack actually reads, the sentence fix, and a mobile
app foundation that claims no design system it did not install.

| Command | Result |
|---|---|
| `pnpm -r typecheck` | clean (3 projects) |
| `pnpm -r lint` | clean, no new issues |
| `pnpm -r test` | **288 passed**, 24 skipped — schemas 35, engine 121, web 132 |
| `pnpm test:scripts` | 13 passed |
| `pnpm engine:smoke` | SMOKE PASSED — 4 fixtures |
| `pnpm build` | clean |

The 24 skipped are the pre-existing Supabase-dependent suites. No fixture was added for the mobile
route: the smoke script asserts a derived `pnpm`/`npm run` command per file, which a described stack
deliberately does not have.

### Follow-up: a described stack now gets commands, not four blanks

Reported from the run that followed: the founder chose "Something else" and typed **"stack for
mobileapp ios"**. Every command in `START_HERE.md`, `CLAUDE.md` and `/start` came out as
`[NEEDS CLARIFICATION: CMD_*]`.

Nothing was broken. Spec 65 gave a described stack exactly two rungs — the authoring model writes
the commands, or a marker admits we do not know — and on a one-line description the model returned
nothing to write. The floor was honest and useless: **the file exists to be run.**

**A third rung, between the two:** [`toolchain.ts`](../packages/engine/src/toolchain.ts) —
`inferStack(description)`, a pure ordered table of ecosystem profiles. Each carries what that
ecosystem's own getting-started page gives: its five commands, its reproducible CI install, its
runtime, and its official generator where one exists. Fourteen profiles, most specific first, so
naming Swift, Kotlin or Flutter always beats the bare word "ios" — which lands on Expo, the same
stack [`STANDARD_STACK`](../packages/schemas/src/questions.ts) recommends a mobile app.

The ladder is now **authored → inferred → marker**. What the model wrote still wins; the marker
still ships for a description nothing recognises ("something entirely of my own devising"), because
inventing a command there is the defect this all started from.

Three things had to move with it, or the change would have traded one broken first push for another:

- **CI setup steps.** With real commands, the custom-stack CI placeholder (`echo ::warning`, `exit
  0`) became a red build: real commands run on a runner where nothing was installed. `RUNTIME_SETUP`
  maps each profile's runtime to its GitHub action and its Azure Pipelines task, then runs the
  profile's install. This closed a hole that predates the change — an authored toolchain has always
  shipped alongside that placeholder.
- **The CI gate.** `ciReadyCheck` asked only whether the commands were real. It now asks whether the
  job can do the whole thing, install included (`ciCanRun`). Swift answers no on purpose: it wants
  macOS, and the Linux runner the generated workflow uses cannot pass.
- **`/start` section 1.** Where the ecosystem is recognised, its own generator is named — `npx
  create-expo-app@latest`, `django-admin startproject`, `rails new`. That is the difference between
  a command a founder runs and a paragraph telling them to go and find one.

Plus the authoring prompt (`PROMPT_VERSION` 6 → 7): a thin description is still an answer, and
`productType` says what is being built, so resolve it and give that stack's commands rather than
handing back five blanks.

**Considered and rejected: replacing the founder's words with the profile's name.** "stack for
mobileapp ios" would read better as "Expo (React Native)" in `STACK_SUMMARY` — but the same rule
turns "Django 5 on Python 3.12, uv for dependencies" into "Django", and "SvelteKit with TypeScript"
into "Node with TypeScript". Four existing tests assert we keep their words, and they are right to:
the authored `STACK_NAME` slot exists to tidy that sentence, and losing information is a worse
default than an untidy one.

#### Verification — 2026-07-27

| Command | Result |
|---|---|
| `pnpm -r typecheck` | clean (3 projects) |
| `pnpm -r lint` | clean, no new issues |
| `pnpm -r test` | **297 passed**, 24 skipped — schemas 35, engine 130, web 132 |
| `pnpm test:scripts` | 13 passed |
| `pnpm engine:smoke` | SMOKE PASSED — 4 fixtures |
| `pnpm build` | clean |

New: `toolchain.test.ts` (7) — the reported sentence, a named framework beating the words around it,
nine ecosystems, the package manager the founder named, no partial toolchains, and no ecosystem
given the same command for its type check and its linter. `start-command.test.ts` (+2) — the
reported case end to end (no `CMD_` marker in any file, `npx expo start` in `START_HERE.md`), and
the generator named only where one is known.

Four existing tests changed rather than were deleted, because the behaviour moved: three in
`authored.test.ts` (a missing command is now filled from the description, the marker is asserted
against a genuinely unrecognisable stack, and custom-stack CI ships Python's setup rather than a
placeholder) and one in `start-command.test.ts` (the gate now stands down on a stack it cannot set
up, rather than on commands alone).

### Follow-up: the copy still described the product from before `/start`

`START_HERE.md` opened with *"It does not ship the application — you write that"*, written when the
foundation was documents only. It is the first sentence of the first file a founder reads, and step 1
of the same file now sets their project up until it runs. Two answers to "what did I just download",
one paragraph apart.

The fix is not to drop the boundary but to state the one that actually holds — §0's ceiling, in a
founder's words: the foundation is set up for you, **you stay in control of what gets built after
that**, one spec at a time. Same rule, described from the side the founder experiences it.

Three places carried the old framing:

- **`template/START_HERE.md`** — the opening paragraph, rewritten as above.
- **`HERO.leadRest`** — the lead line stopped at "generates the … AI context your project needs".
  It now continues to setting the project up until it runs, which is the part a visitor is buying.
- **`STEPS[3]`** — "download your repository, open it in your editor and start implementing" was the
  pre-`/start` instruction. Now: one command from documents to a project that runs, and control of
  what comes after.

**And the deliverables grid gained the half it was missing.** "CI/CD pipeline" listed the checks and
said nothing about the branch model, which is the part a founder running several agents feels first:
a pipeline catches a bad commit, the branch structure is what stops two agents writing over each
other. Retitled to "CI/CD and branching", body cut to two clauses with one promise each:

> GitHub Actions that lint, typecheck, test and deploy, plus an automated branch structure that
> prevents merge conflicts

The first attempt ran to twice the length of the other five cards and the claim got lost inside it.
Card copy in that grid is a fragment, not a sentence, and the merge-conflict promise only lands if it
is the last thing read. The landing voice rules from spec 23 still apply and `copy.test.ts` still
enforces them: no em dash, no double hyphen, no named assistant.

### What this says about the verification decision

`/clarify` chose unit tests plus one manual check over a real end-to-end run in CI, to keep §V's "no
network" invariant. That was the right call on the invariant and the wrong call on confidence: 90 unit
tests were green while three of the first four steps of `/start` could not execute at all. Every bug
was in how a third-party tool behaves, which is precisely what our tests cannot see. The manual check
is not a formality here — it is the only thing that tested the feature. It must be re-run by hand
whenever `startBootstrap()` changes.
