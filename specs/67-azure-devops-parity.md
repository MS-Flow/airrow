# Spec 67 — Azure DevOps gets its own workflow, not GitHub's with different labels

> **In one sentence:** A founder who picks Azure DevOps in the interview currently receives GitHub
> Actions workflows, `gh` commands in every slash command, and a constitution telling them a feature
> is a GitHub Project — this makes the answer reach the workflow instead of only the prose.

|                |                                                          |
| -------------- | -------------------------------------------------------- |
| **Status**     | 🔄 In progress                                            |
| **Issue**      | #TBD — `[NEEDS CLARIFICATION: assign issue #]`            |
| **Branch**     | `66-start-command` — see the process note below           |
| **Feature**    | Interview-driven project generator                        |
| **Depends on** | [66-start-command.md](66-start-command.md) — owns `START_HERE.md`, the CI gate and `/start`, all of which this makes provider-aware |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## Process note — this one was written after the code

The constitution requires a spec before implementation (§IV) and that decisions are recorded "with or
before the implementing PR, never reconstructed after the fact". This spec is a reconstruction: the
work was asked for and done in one pass while spec 66 was being finished, and it rode that branch.
Recorded plainly rather than quietly backdated. The follow-up is to open an issue, and if the work is
big enough to want its own review, split it onto its own branch before the PR.

---

## User story

_Who wants this, and what they get out of it._

As a **founder whose company runs on Azure DevOps** I want **a foundation that describes my actual
workflow** so that **I am not translating GitHub instructions into Azure Boards and Pipelines before I
can use anything I was given**.

---

## Background

- **Today:** the interview asks for the repository provider
  ([`questions.ts`](../packages/schemas/src/questions.ts)) and the answer reached exactly one thing —
  the `{{REPO_PROVIDER}}` label. Nine generated files were hardcoded to GitHub: `gh issue view` and
  `gh issue develop` in `createspec.md`, `gh pr create` in `analyze.md` and `pr-check.md`, "a feature
  is a GitHub Project" in both the constitution and `CLAUDE.md`, a `.github/workflows/` reference in
  `BRANCHING.md` and in `/start`, and the four GitHub Actions workflows themselves.
- **The problem:** an Azure DevOps team got a foundation about someone else's tooling. The CI would
  never run, the slash commands would fail on a CLI they do not have, and the constitution described a
  process they do not follow. §0 calls generic output a top-severity bug; this is worse than generic,
  it is wrong.
- **Already in place:** `BRANCHING.md` already used `{{REPO_PROVIDER}}`, and `repoLabel()` already
  knew both providers — the plumbing existed, it just stopped at the noun.

---

## Design decision

One `ProviderVocabulary` record in [`scaffold.ts`](../packages/engine/src/scaffold.ts) holds
everything that differs — the word for a unit of work, what groups them, the CI and deploy file
paths, where secrets live, and the three CLI commands the slash commands invoke. Every generated file
renders from it through ordinary tokens. `renderScaffold` gains a file filter (`shipsPath`) so a
project ships GitHub Actions **or** Azure Pipelines and never both.

**Not touched:** the branch model, the spec loop, and the verification bar are identical on both
providers — they are the portable part, and §IV says so. Only the tooling that expresses them changes.

**Why one record rather than a branch per file:** nine files name a provider. The failure mode of
branching in each is a half-migrated foundation — `az repos` in the documentation and `gh pr create`
in the command an assistant actually runs — and nothing would catch it.

---

## Acceptance criteria

- [x] A project on Azure DevOps ships `azure-pipelines.yml` and `azure-pipelines-deploy-dev.yml`, and
      no `.github/` directory. A GitHub project ships the reverse.
- [x] The Azure pipeline is written in Pipelines' own syntax — `##vso[task.setvariable]`,
      `NodeTool@0`, stage `dependsOn`/`condition` — not Actions YAML re-indented.
- [x] The `/start` CI gate from spec 66 works on both: the verification stage is skipped with a
      warning until `/start` has run.
- [x] The slash commands invoke the CLI that exists on the chosen provider: `az boards work-item
      show` / `az repos pr create` versus `gh issue view` / `gh pr create`.
- [x] The constitution, `CLAUDE.md` and `BRANCHING.md` use the provider's vocabulary — "work item"
      and "Azure Boards area path" versus "issue" and "GitHub Project".
- [x] The word "GitHub" appears nowhere in an Azure DevOps foundation, and "Azure DevOps" nowhere in a
      GitHub one. Asserted per fixture in `pnpm engine:smoke`.
- [x] `START_HERE.md` step 2 tells an Azure DevOps founder the things that are genuinely different:
      pipelines are registered by hand, branch policies replace a committed workflow, and Boards area
      paths map to `feature/<name>`.
- [x] Choosing Azure **hosting** produces real deploy steps (`azure/webapps-deploy` on GitHub,
      `AzureWebApp@1` on Pipelines), guarded on the credential — not the "no deploy steps wired"
      placeholder. Self-hosting still gets the placeholder, because that one is genuinely unknowable.
- [x] Step numbering in `START_HERE.md` is continuous on both providers, which differ in step count.
- [x] Typecheck passes; lint adds no new issues; tests green; `pnpm build` clean; smoke passes.

### Verification

- **New tests** — `packages/engine/src/provider.test.ts`, 14 tests across five groups: file selection,
  Pipelines syntax, provider vocabulary, the Azure-specific setup steps, and step numbering.
- **Updated** — `scaffold.test.ts`: the hosting test now asserts Azure is wired rather than warned
  about, plus a new test that self-hosting still gets the honest placeholder.
- **Extended** — `scripts/engine-smoke.mjs`: expected file count is now provider-aware, the CI path is
  resolved per provider, and each fixture asserts no cross-provider naming leaks.
- Manual: an Ops Console foundation (Azure DevOps + Azure hosting) was generated and its file list and
  `START_HERE.md` step 2 read end to end.

---

## Exact changes (file:line)

**Engine**

1. **`model.ts`** — `usesAzureRepos()`, next to `usesSupabase()`.
2. **`scaffold.ts`** — `ProviderVocabulary` + `provider()`; `shipsPath()`; `ciSetupStepsAzure()` and
   `ciReadyCheckAzure()`; `repoSetupSteps()` replacing the two hardcoded repository steps in
   `setupSteps()`; real Azure branches in `deploySteps()` and `deployTargetSetup()`; nine new tokens.
3. **`index.ts`** — exports `shipsPath` for the smoke script.

**Generated output**

4. **`template/azure-pipelines.yml`**, **`template/azure-pipelines-deploy-dev.yml`** — new.
5. **`createspec.md`**, **`analyze.md`**, **`pr-check.md`**, **`start.md`** — provider tokens.
6. **`.claude/spec-kit/constitution.md`**, **`CLAUDE.md`**, **`docs/architecture/BRANCHING.md`** —
   provider vocabulary.
7. **`.airrow-template.json`** — the eleven new tokens documented.

---

## Data model

**No schema changes.** Generated output and the template only.

---

## Security

Credentials are named per provider and never rendered: GitHub gets `${{ secrets.* }}` references,
Azure Pipelines gets a variable-group reference. Both deploy paths are guarded on the credential
being present and exit cleanly when it is not, so a foundation pushed before secrets exist does not
fail loudly or half-deploy. No value is ever written into generated output.

---

## Edge cases

- **Custom stack on Azure DevOps** → the pipeline's toolchain step becomes a `logissue type=warning`
  placeholder, matching what the GitHub path already did, and the CI gate holds `ready=false` until
  the commands are filled in.
- **Azure hosting on GitHub, or Vercel on Azure DevOps** → the two answers are independent and both
  combinations render correctly; hosting drives the deploy step, the provider drives the file it
  lands in.
- **`git init` default branch** → unchanged from spec 66; `main` on both providers.

---

## Out of scope

- Azure Static Web Apps and Container Apps as deploy targets — App Service is the golden path, and
  the interview does not ask which Azure service.
- An `az`-based equivalent of `close-issue-on-merge.yml` and `branch-policy.yml`. Azure DevOps
  expresses both as branch policies and PR work-item links configured in the UI, not as committed
  files, so they became setup steps rather than generated automation.
