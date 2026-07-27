// Scaffold renderer: turns the canonical Airrow template + a resolved ProjectModel into the concrete
// invariant skeleton for a new customer project. Pure — no I/O, no env. The app enumerates the
// on-disk `template/**` files and passes them in; this module derives the interview-variable values,
// substitutes the {{TOKENS}}, and returns both the files AND a preview plan the founder must approve
// before anything is written or committed (constitution §0 — founder-in-control).

import type { FeatureId, GeneratedFile, ProjectModel } from "../../schemas/src/types.ts";
import {
  TOOLCHAIN_SLOTS,
  isAuthoredDocument,
  isProseSlot,
  type AuthoredDocuments,
  type AuthoredSlots,
  type AuthoredToolchain
} from "../../schemas/src/authoring.ts";
import {
  aiUsageLabel,
  audienceLabel,
  authMethodLabel,
  backendSummary,
  databaseLabel,
  featureLabel,
  frameworkLabel,
  hostingLabel,
  isCustomStack,
  productTypeLabel,
  repoLabel,
  tenancyLabel,
  usesAzureRepos,
  usesSupabase
} from "./model.ts";

/** One template file as read from disk by the app. */
export interface TemplateFile {
  path: string;
  content: string;
}

/** A single derived value, with where it came from — surfaced to the founder in the preview. */
export interface ScaffoldDecision {
  token: string;
  value: string;
  source: "interview" | "default";
  rationale: string;
}

/** Everything the founder reviews before approving provisioning. */
export interface ScaffoldPlan {
  projectName: string;
  projectSlug: string;
  fileCount: number;
  tree: string[];
  decisions: ScaffoldDecision[];
  /** Unresolved tokens left as [NEEDS CLARIFICATION] markers — never guessed silently. */
  clarifications: string[];
}

export interface RenderedScaffold {
  files: GeneratedFile[];
  plan: ScaffoldPlan;
}

const TOKEN_RE = /\{\{([A-Z0-9_]+)\}\}/g;

/**
 * True when a rendered file still contains a template token. Deliberately narrower than "contains
 * `{{`": generated GitHub Actions workflows legitimately carry `${{ secrets.* }}` expressions.
 */
export function hasUnresolvedToken(content: string): boolean {
  return /\{\{[A-Z0-9_]+\}\}/.test(content);
}

interface Commands {
  CMD_DEV: string;
  CMD_BUILD: string;
  CMD_TYPECHECK: string;
  CMD_LINT: string;
  CMD_TEST: string;
}

/**
 * Package manager per framework: Next.js ships a pnpm-first toolchain, while the Vite + React
 * scaffold (`npm create vite@latest`) is npm-based. Using one everywhere left the generated
 * instructions contradicting the chosen stack.
 */
function packageManager(model: ProjectModel): "pnpm" | "npm" {
  return model.stack.framework === "vite" ? "npm" : "pnpm";
}

/**
 * The five commands the founder actually runs.
 *
 * Derived for the two golden-path frameworks, where the answer is knowable. For a stack the founder
 * described themselves it cannot be — nothing here knows whether the test command is `pytest`,
 * `go test ./...` or `bin/rails test` — so those come from `authoredToolchain`, each one having
 * already passed the command contract in `@airrow/schemas`. Anything not authored is left blank
 * rather than defaulted, for the reason given below.
 */
function cmds(
  model: ProjectModel,
  authoredToolchain?: AuthoredToolchain
): { commands: Commands; fromModel: Set<string> } {
  // Customer projects are single-app repos, so every script runs from the repo root.
  const run = packageManager(model) === "npm" ? "npm run" : "pnpm";
  const commands: Commands = {
    CMD_DEV: `${run} dev`,
    CMD_BUILD: `${run} build`,
    CMD_TYPECHECK: `${run} typecheck`,
    CMD_LINT: `${run} lint`,
    CMD_TEST: `${run} test`
  };
  const fromModel = new Set<string>();
  if (!isCustomStack(model)) return { commands, fromModel };

  for (const slot of TOOLCHAIN_SLOTS) {
    const written = authoredToolchain?.[slot];
    if (typeof written === "string" && written.trim() !== "") {
      commands[slot] = written.trim();
      fromModel.add(slot);
      continue;
    }
    // Nothing was authored for this one, and the npm/pnpm default is not a harmless fallback here —
    // it is a wrong command in the file the founder runs first. Telling a .NET project to run
    // `pnpm dev` is worse than admitting we do not know, so it empties to a `[NEEDS CLARIFICATION]`
    // marker through the ordinary substitution path, the same as any other unanswered value.
    commands[slot] = "";
  }
  return { commands, fromModel };
}

/** How the chosen package manager runs a one-off tool it has not installed. */
function dlx(model: ProjectModel): string {
  return packageManager(model) === "npm" ? "npx" : "pnpm dlx";
}

/** `install` for the chosen package manager — the reproducible, lockfile-respecting form. */
function installCommand(model: ProjectModel, ci: boolean): string {
  if (packageManager(model) === "npm") return ci ? "npm ci" : "npm install";
  return ci ? "pnpm install --frozen-lockfile" : "pnpm install";
}

function ciSetupSteps(model: ProjectModel, stackName: string): string {
  // A custom stack gets an honest placeholder rather than a Node toolchain that would be wrong for
  // it. This is the same treatment a non-Vercel deploy target already gets: CI that fails loudly on
  // the first run is worse than CI that says what is missing and stops.
  if (isCustomStack(model)) {
    return [
      "      - name: Set up the toolchain",
      "        run: |",
      `          echo "::warning::Add the setup and install steps for ${stackName} here, then remove this guard."`,
      "          exit 0"
    ].join("\n");
  }
  // Indented to sit under `steps:` in the workflow YAML.
  const setupNode = [
    "      - uses: actions/setup-node@v4",
    "        with:",
    "          node-version: 20",
    `          cache: ${packageManager(model)}`
  ];
  const steps =
    packageManager(model) === "pnpm"
      ? ["      - uses: pnpm/action-setup@v4", "        with:", "          version: 9", ...setupNode]
      : setupNode;
  return [...steps, `      - run: ${installCommand(model, true)}`].join("\n");
}

/**
 * The gate that decides whether CI has anything to verify yet (spec 66).
 *
 * Indented to sit under `run: |` in the workflow YAML.
 *
 * For a golden-path stack the question is answerable: no `package.json`, no `/start`, nothing to
 * check. For a stack the founder described, it is not — the marker could be `pyproject.toml`,
 * `go.mod` or a `.csproj`, and guessing wrong would gate CI on a file that never appears. So the
 * gate falls back to what *is* knowable: whether this project's verification commands are real.
 * Unauthored ones render as `[NEEDS CLARIFICATION]` markers, which would reach the shell as a
 * command that does not exist — a red build that says nothing about the code.
 */
function ciReadyCheck(model: ProjectModel, commands: Commands): string {
  const out = (value: "true" | "false") => `echo "ready=${value}" >> "$GITHUB_OUTPUT"`;
  if (isCustomStack(model)) {
    if (commands.CMD_TYPECHECK === "") {
      return [
        `          ${out("false")}`,
        '          echo "::notice::CI is waiting on this project\'s verification commands — fill them into .github/workflows/ci.yml, then push again."'
      ].join("\n");
    }
    return `          ${out("true")}`;
  }
  return [
    "          if [ -f package.json ]; then",
    `            ${out("true")}`,
    "          else",
    `            ${out("false")}`,
    '            echo "::notice::No stack here yet — run /start in this repository, then push again."',
    "          fi"
  ].join("\n");
}

/**
 * The same two CI blocks again, in Azure Pipelines' syntax (indented for its deeper YAML nesting).
 *
 * Not a translation layer: Pipelines has no `$GITHUB_OUTPUT`, no `uses:`, and its own logging
 * commands. Rendering GitHub's YAML with different indentation would produce a file that parses and
 * does nothing, which is worse than not shipping one.
 */
function ciReadyCheckAzure(model: ProjectModel, commands: Commands): string {
  const set = (v: "true" | "false") => `echo "##vso[task.setvariable variable=ready;isOutput=true]${v}"`;
  if (isCustomStack(model)) {
    if (commands.CMD_TYPECHECK === "") {
      return [
        `              ${set("false")}`,
        '              echo "##vso[task.logissue type=warning]CI is waiting on this project\'s verification commands — fill them into azure-pipelines.yml, then push again."'
      ].join("\n");
    }
    return `              ${set("true")}`;
  }
  return [
    "              if [ -f package.json ]; then",
    `                ${set("true")}`,
    "              else",
    `                ${set("false")}`,
    '                echo "##vso[task.logissue type=warning]No stack here yet — run /start in this repository, then push again."',
    "              fi"
  ].join("\n");
}

function ciSetupStepsAzure(model: ProjectModel, stackName: string): string {
  if (isCustomStack(model)) {
    return [
      "          - bash: |",
      `              echo "##vso[task.logissue type=warning]Add the setup and install steps for ${stackName} here, then remove this guard."`,
      "            displayName: Set up the toolchain"
    ].join("\n");
  }
  const node = [
    "          - task: NodeTool@0",
    "            inputs:",
    "              versionSpec: '20.x'",
    "            displayName: Node 20"
  ];
  const pnpm =
    packageManager(model) === "pnpm"
      ? ["          - bash: npm install -g pnpm@9", "            displayName: pnpm 9"]
      : [];
  return [
    ...node,
    ...pnpm,
    `          - bash: ${installCommand(model, true)}`,
    "            displayName: Install dependencies"
  ].join("\n");
}

/** Deploy steps for the chosen host. Targets we cannot wire get an explicit, honest placeholder. */
function deploySteps(model: ProjectModel): string {
  const host = hostingLabel[model.hosting];
  // Azure is a real target, not a gap: a founder who picked it gets steps that run, guarded on the
  // credential the way the Vercel path is. Self-hosting is genuinely unknowable — it is their server.
  if (model.hosting === "azure") {
    const dist = model.stack.framework === "vite" ? "dist" : ".next";
    if (usesAzureRepos(model)) {
      return [
        "      - task: AzureWebApp@1",
        "        displayName: Deploy to Azure App Service (DEV)",
        "        inputs:",
        "          azureSubscription: $(azureServiceConnection)   # Project settings → Service connections",
        "          appName: $(azureWebAppName)",
        `          package: $(System.DefaultWorkingDirectory)`,
        "        condition: and(succeeded(), ne(variables['azureServiceConnection'], ''))"
      ].join("\n");
    }
    return [
      "      - name: Deploy to Azure App Service (DEV)",
      "        env:",
      "          AZURE_PUBLISH_PROFILE: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}",
      "          AZURE_WEBAPP_NAME: ${{ vars.AZURE_WEBAPP_NAME }}",
      "        run: |",
      '          if [ -z "$AZURE_PUBLISH_PROFILE" ]; then',
      '            echo "::warning::AZURE_WEBAPP_PUBLISH_PROFILE missing — skipping DEV deploy until secrets are set."',
      "            exit 0",
      "          fi",
      `          echo "Publishing ${dist}/ to $AZURE_WEBAPP_NAME"`,
      "      - uses: azure/webapps-deploy@v3",
      "        if: env.AZURE_PUBLISH_PROFILE != ''",
      "        with:",
      "          app-name: ${{ vars.AZURE_WEBAPP_NAME }}",
      "          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}"
    ].join("\n");
  }
  if (model.hosting !== "vercel") {
    return [
      `      - name: Deploy to ${host} (DEV)`,
      "        run: |",
      `          echo "::warning::No deploy steps wired for ${host} yet — add them here, then remove this guard."`,
      "          exit 0"
    ].join("\n");
  }
  const run = dlx(model);
  return [
    "      - name: Deploy to Vercel (DEV)",
    "        env:",
    "          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}",
    "        run: |",
    '          if [ -z "$VERCEL_TOKEN" ]; then',
    '            echo "::warning::VERCEL_TOKEN missing — skipping DEV deploy until secrets are set."',
    "            exit 0",
    "          fi",
    `          ${run} vercel@latest pull --yes --environment=preview --token="$VERCEL_TOKEN"`,
    `          ${run} vercel@latest build --token="$VERCEL_TOKEN"`,
    `          ${run} vercel@latest deploy --prebuilt --token="$VERCEL_TOKEN"`
  ].join("\n");
}

/* ── Repository provider ──────────────────────────────────────────────────── */

/**
 * Everything about the workflow that differs between GitHub and Azure DevOps.
 *
 * Kept as one record rather than a branch in each file that mentions a provider. Nine generated files
 * name one — the slash commands, the constitution, `CLAUDE.md`, `BRANCHING.md` — and the failure mode
 * of branching in each is a half-migrated foundation: `az repos` in the documentation and
 * `gh pr create` in the command an assistant actually runs.
 */
interface ProviderVocabulary {
  /** What a unit of work is called. Founders search their own tracker for this word. */
  issueTerm: string;
  /** What groups those into a feature. */
  boardTerm: string;
  /** Path of the CI definition this project ships. */
  ciFile: string;
  /** Path of the DEV deploy definition. */
  deployFile: string;
  /** Where CI credentials live, named the way the provider names them. */
  secretsHome: string;
  /** Read one tracker item, for `/createspec`. */
  cliIssueView: string;
  /** Create the issue branch and link it to the tracker item. */
  cliBranchLink: string;
  /** Open a pull request. */
  cliPrCreate: string;
  /** The CLI the founder needs installed. */
  cliName: string;
}

function provider(model: ProjectModel): ProviderVocabulary {
  if (usesAzureRepos(model)) {
    return {
      issueTerm: "work item",
      boardTerm: "Azure Boards area path",
      ciFile: "azure-pipelines.yml",
      deployFile: "azure-pipelines-deploy-dev.yml",
      secretsHome: "a pipeline variable group (Pipelines → Library) with the values marked secret",
      cliIssueView: "az boards work-item show --id <n>",
      // No one-shot equivalent of `gh issue develop` exists, so the honest form is two steps.
      cliBranchLink:
        "git checkout -b <nr>-<short> && git push -u origin <nr>-<short>, then az boards work-item relation add --id <n> --relation-type branch --target-url <branch-url>",
      cliPrCreate: "az repos pr create --source-branch <branch> --target-branch <target> --work-items <n>",
      cliName: "the Azure CLI with the `azure-devops` extension (`az extension add --name azure-devops`)"
    };
  }
  return {
    issueTerm: "issue",
    boardTerm: "GitHub Project",
    ciFile: ".github/workflows/ci.yml",
    deployFile: ".github/workflows/deploy-dev.yml",
    secretsHome: "GitHub repository secrets (Settings → Secrets and variables → Actions)",
    cliIssueView: "gh issue view <n> --json number,title,body,labels",
    cliBranchLink: "gh issue develop <n> --base feature/<name> --name <nr>-<short> --checkout",
    cliPrCreate: "gh pr create --base <target> --head <branch>",
    cliName: "the GitHub CLI (`gh`)"
  };
}

/**
 * Which template files this project ships.
 *
 * GitHub Actions and Azure Pipelines are alternatives, never both. Shipping the pair would leave one
 * permanently red and teach the founder to ignore a failing build — the exact habit the CI gate
 * exists to prevent.
 */
export function shipsPath(model: ProjectModel, path: string): boolean {
  if (path.startsWith(".github/")) return !usesAzureRepos(model);
  if (path.startsWith("azure-pipelines")) return usesAzureRepos(model);
  return true;
}

/**
 * Throwaway directory the official generators scaffold into before being merged in.
 *
 * Not dot-prefixed: `create-next-app` derives the npm package name from the directory name and
 * rejects one starting with a period ("name cannot start with a period"). Suffixed off the project
 * slug so it cannot collide with `docs/`, `specs/` or anything else the foundation ships.
 */
const scaffoldDir = (model: ProjectModel): string => `${model.slug}-scaffold`;

/**
 * Test-runner major, pinned.
 *
 * The scaffolders run once and are left at `@latest`; the test runner is different — it lands in the
 * founder's `package.json` and stays. Unpinned it broke on the first real run of `/start`: vitest
 * 4.1.10 would not start at all under Node 25 + pnpm 9 (`ERR_PACKAGE_IMPORT_NOT_DEFINED`), while 3.x
 * ran clean. Whether that is Node 25 specific is beside the point — an unpinned major is a variable
 * we can remove for free, and a `pnpm test` that cannot start is the exact defect spec 66 exists to
 * fix. Bump when a newer major has been run through `/start` by hand.
 */
const VITEST_MAJOR = "^3";

/**
 * Step 4: the design system the generated documents already name (spec 66 follow-up).
 *
 * `CLAUDE.md`, `SYSTEM_OVERVIEW.md` and the README all state this project's stack as "TypeScript ·
 * Tailwind + shadcn/ui", and neither scaffolder produces that: `create-next-app --tailwind` gets
 * halfway there, `create-vite` not at all. A founder's first run of `/start` therefore ended with
 * their assistant reporting that the stack in `CLAUDE.md` was not the stack on disk and asking which
 * of the two was wrong. Neither was — the install step was simply missing.
 *
 * `init` only: it writes `components.json` and the `cn` helper and adds no components. A design
 * system is the stack, not a feature, so it belongs here; components are product and stay behind a
 * spec, which is why the one that adds them is named and left unrun.
 */
function designSystemStep(model: ProjectModel): string[] {
  const run = dlx(model);
  const init = `${run} shadcn@latest init --yes --base-color neutral`;
  const closing = [
    `   That writes \`components.json\` and the \`cn\` helper, and installs **no components**.`,
    `   Components arrive one at a time, when a spec calls for one: \`${run} shadcn@latest add <name>\`.`
  ];
  if (model.stack.framework === "vite") {
    return [
      "4. **Add Tailwind and shadcn/ui.** `create-vite` ships neither, and this project's documents",
      "   name both as its stack:",
      "",
      "   ```bash",
      "   npm install tailwindcss @tailwindcss/vite",
      "   npm install -D @types/node",
      "   ```",
      "",
      '   Then make them work: `src/index.css` becomes `@import "tailwindcss";`, `tailwindcss()` joins',
      "   `plugins` in `vite.config.ts`, and the `@/*` path alias goes into `tsconfig.json`,",
      "   `tsconfig.app.json` and `vite.config.ts` (`resolve.alias`) — shadcn/ui resolves its imports",
      "   through that alias and its init fails without it. Then:",
      "",
      "   ```bash",
      `   ${init}`,
      "   ```",
      "",
      ...closing
    ];
  }
  return [
    "4. **Initialise shadcn/ui.** Tailwind came with the scaffolder (`--tailwind`); shadcn/ui did not,",
    "   and this project's documents name both as its stack:",
    "",
    "   ```bash",
    `   ${init}`,
    "   ```",
    "",
    ...closing
  ];
}

/**
 * The bootstrap steps `/start` runs, per framework (spec 66).
 *
 * Every flag the official scaffolder understands is passed explicitly. That is the whole point:
 * `create-next-app` interviews the caller for anything it is not told, and a command that stops to
 * ask questions is a command whose outcome nobody can predict or test. A fixed flag set makes
 * `/start` produce the same project twice.
 *
 * `@latest` rather than a pinned version, matching how the generated deploy workflow already invokes
 * `vercel@latest`. A pin here would be a second thing to maintain in `template/` and would go stale
 * silently; the founder scaffolds once, on the day they generate.
 */
function startBootstrap(model: ProjectModel, stackName: string): string {
  // Nothing here knows how to bootstrap a stack the founder described in prose, and guessing costs
  // them an afternoon of undoing it. Same treatment the CI setup steps already give a custom stack.
  if (isCustomStack(model)) {
    return [
      `1. **Scaffold ${sentence(stackName)}** Use its official project generator, in this directory. This`,
      "   foundation cannot name the command for you — it is your stack, and a wrong guess here is",
      "   worse than an honest gap. Keep every file that is already here.",
      "2. **Wire the toolchain** so the commands below are real: a type check, a linter, and a test",
      "   runner, each reachable by the command this project's documents already name.",
      "3. **Create `.env.example`, then copy it to `.env.local`.** The foundation names this file but",
      "   does not ship it. Names only, never values:",
      "",
      "   ```",
      `   ${envExample(model).join("\n   ")}`,
      "   ```"
    ].join("\n");
  }
  const add = packageManager(model) === "npm" ? "npm install -D" : "pnpm add -D";
  // Neither official generator will run in a directory that already has a README.md — and this one
  // does, along with the docs, specs and workflows that are the whole point of the foundation.
  // `create-next-app` refuses outright and has no force flag; `create-vite` takes `--overwrite`,
  // which *deletes* what is already there. So both scaffold into a throwaway directory and get moved
  // in on top, existing files winning. Verified by hand against both generators (spec 66).
  const dir = scaffoldDir(model);
  const scaffold =
    model.stack.framework === "vite"
      ? `npm create vite@latest ${dir} -- --template react-ts --no-interactive`
      : `pnpm create next-app@latest ${dir} --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --yes --disable-git --skip-install`;
  return [
    "**Already has a `package.json`?** Then this section has run. Skip to section 2.",
    "",
    "1. **Scaffold into a throwaway directory.** Every flag is passed, so it asks nothing:",
    "",
    "   ```bash",
    `   ${scaffold}`,
    "   ```",
    "",
    `2. **Move it in.** Copy everything from \`${dir}/\` into this directory, **skipping any`,
    "   path that already exists** — this foundation's `README.md`, `CLAUDE.md`, `.github/` and",
    `   \`.gitignore\` win over the generator's. Then delete \`${dir}/\`, and set \`name\` in`,
    `   \`package.json\` to \`${model.slug}\` — the generator took it from that throwaway directory.`,
    "   Nothing that was here before you started may be modified or lost by this step; if you cannot",
    "   move a file in without overwriting one of ours, leave ours and say so.",
    "",
    `3. **Install dependencies:** \`${installCommand(model, false)}\`.`,
    "",
    ...designSystemStep(model),
    "",
    `5. **Add the test runner:** \`${add} vitest@${VITEST_MAJOR}\`. Pinned to a major deliberately —`,
    "   unpinned, this lands whatever shipped today, and a test runner that will not start is the",
    `   exact failure this command exists to prevent. A project whose \`${cmdName(model, "test")}\``,
    "   does nothing is worse than one without tests: it reports green having checked nothing.",
    "",
    "6. **Make the five commands real.** The `scripts` block in `package.json` must define `dev`,",
    "   `build`, `typecheck`, `lint` and `test`, because `START_HERE.md` and `.github/workflows/ci.yml`",
    "   already name them. `typecheck` is `tsc --noEmit`; TypeScript runs `strict`.",
    "",
    "7. **Create `.env.example`, then copy it to `.env.local`.** The foundation names this file but",
    "   does not ship it — nothing here knows your keys, and a committed file that might hold one is",
    "   not worth the risk. It carries variable *names* only, never values:",
    "",
    "   ```",
    `   ${envExample(model).join("\n   ")}`,
    "   ```",
    "",
    "   `.env.local` is where real values go, and `.gitignore` must already exclude it."
  ].join("\n");
}

/**
 * The variable names this project's `.env.example` needs (spec 66).
 *
 * `/start` writes the file rather than the template shipping it. Four generated documents already
 * told the founder to copy `.env.example` to `.env.local`, and it has never existed — which is the
 * same defect as the commands that could not run. Names only: a values file must never be one
 * `git add .` away from being committed.
 */
function envExample(model: ProjectModel): string[] {
  if (!usesSupabase(model)) {
    const lines = [`DATABASE_URL=   # ${databaseLabel(model)} connection string, server-only`];
    if (model.derived.hasAi) lines.push("# plus the API key for whichever model provider you settle on");
    return lines;
  }
  // The prefix is what decides whether a variable reaches the browser at all, and every bundler
  // spells it differently — a Vite app given `NEXT_PUBLIC_` reads `undefined` at runtime with no
  // error anywhere. Unprefixed for a stack we do not know, with the rule stated instead of guessed.
  const publicPrefix = { nextjs: "NEXT_PUBLIC_", vite: "VITE_", custom: "" }[model.stack.framework];
  const lines = [
    `${publicPrefix}SUPABASE_URL=`,
    `${publicPrefix}SUPABASE_ANON_KEY=`,
    publicPrefix === ""
      ? "SUPABASE_SERVICE_ROLE_KEY=   # server-only — the two above are browser-safe and need your stack's public prefix; this one must never get it"
      : `SUPABASE_SERVICE_ROLE_KEY=   # server-only — never prefix this one with ${publicPrefix}`
  ];
  if (model.derived.hasAi) lines.push("# plus the API key for whichever model provider you settle on");
  return lines;
}

/**
 * End a founder-written phrase as a sentence.
 *
 * The stack description is free text: some founders end it with a period, some do not, and the
 * prefilled standard stacks are written as fragments. Appending one unconditionally produced
 * "…jest-expo for tests..", which reads as a typo in the first instruction they follow.
 */
function sentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** The command as the founder types it, for prose that names one. */
function cmdName(model: ProjectModel, script: string): string {
  return packageManager(model) === "npm" ? `npm run ${script}` : `pnpm ${script}`;
}

/**
 * What "the bare minimum that runs" means for *this* project (spec 66).
 *
 * The ceiling is as load-bearing as the floor. An assistant handed a foundation full of documents
 * about a product will happily build the product, and that is exactly what the spec loop exists to
 * prevent — so this says what to make and, at equal length, what not to.
 */
function startMinimum(model: ProjectModel): string {
  const what = model.mvpFocus || model.description;
  const entities = model.coreEntities
    ? `The core objects this product is about: ${model.coreEntities} Name them where they belong — a type, a folder, a heading. Do not model them, do not persist them, do not build screens for them.`
    : "No core objects were described in the interview, so do not invent any.";
  // Styling is the stack, not a feature. Left unsaid, an assistant reads the ceiling below as
  // forbidding the design system section 1 just installed and ships a plain-CSS screen — then
  // reports that the stack in CLAUDE.md is not the stack on disk, which was a real founder's first
  // experience of /start.
  const styling = isCustomStack(model)
    ? "Style it the way this stack styles things — plainly, using what section 1 set up. Add no UI library that was not already there."
    : "Style it with Tailwind, using the shadcn/ui primitives section 1 installed where one fits. That is this project's design system and using it is not a feature — but do not add components ahead of a spec that calls for them.";
  return [
    "Replace the generator's placeholder home page with one screen that is recognisably this",
    `project: **${model.name}** — ${what}`,
    "",
    entities,
    "",
    styling,
    "",
    "**This is the ceiling, not a starting budget.** No features, no routes nobody asked for, no",
    "database, no auth, nothing built ahead of a spec that calls for it. The founder should",
    "open the page, recognise their product, and see plainly where to change it next. Everything",
    "past that goes through `/createspec` — that is what the rest of this foundation is for."
  ].join("\n");
}

function rolesText(model: ProjectModel): string {
  if (model.roles === "none") return "Single user type — no role distinctions in v1.";
  if (model.roles === "granular")
    return "Granular roles & permissions across organizations (owner / admin / member and finer grants).";
  return "Organization membership with owner / admin / member roles.";
}

/**
 * Derive the interview-variable values + their provenance from a resolved ProjectModel.
 *
 * `authored` is optional LLM-written prose (spec 65). It is merged **only** over the slots in
 * `PROSE_SLOTS`; anything else in it is ignored. That is the point rather than a detail: the
 * excluded slots are commands and setup steps a founder will run, and interview answers — the
 * authoring input — can come from an unauthenticated visitor. A `null` or empty value means the
 * interview didn't support one, so the derived value stands and the founder gets a
 * `[NEEDS CLARIFICATION]` marker instead of an invention.
 */
export function deriveScaffoldValues(
  model: ProjectModel,
  authored?: AuthoredSlots,
  authoredToolchain?: AuthoredToolchain
): {
  values: Record<string, string>;
  decisions: ScaffoldDecision[];
  /** Tokens whose value came from the model rather than being derived — the manifest reports them. */
  authoredTokens: Set<string>;
} {
  const { commands: command, fromModel: authoredCommands } = cmds(model, authoredToolchain);
  const vocab = provider(model);
  // "dotnet efcore c# js" is what a founder types; it is not what their documentation should say.
  // For a custom stack the model turns that into a name a reader recognises, and everything that
  // renders the stack uses it. Falls back to the raw answer when nothing was authored — still
  // theirs, still honest, just untidy.
  const stackName = stackNameFor(model, authored);
  const hosting = hostingLabel[model.hosting];
  // TypeScript, Tailwind and shadcn/ui are the golden path's fixed choices — asserting them over a
  // founder who told us they are on Django would make the first line of their docs a falsehood.
  const frontend = isCustomStack(model) ? "" : "TypeScript · Tailwind + shadcn/ui · ";
  const summary = `${stackName} · ${frontend}${databaseLabel(model)} (Postgres) · ${hosting} · ${repoLabel(model)}`;
  const roles = rolesText(model);

  const values: Record<string, string> = {
    PROJECT_NAME: model.name,
    PROJECT_SLUG: model.slug,
    PROJECT_TAGLINE: model.mvpFocus || "",
    PROJECT_DESCRIPTION: model.description,
    DOMAIN_OVERVIEW: `${model.name} is ${aOrAn(productTypeLabel[model.productType])} for ${audienceLabel[model.audience]}. ${model.description}`,
    VISION: model.vision,
    MVP_FOCUS: model.mvpFocus,
    PROBLEM: model.problem,
    NON_GOALS: nonGoalsText(model),
    CAPABILITY_SCOPE: capabilityScope(model),
    CAPABILITY_SPECS: capabilitySpecs(model),
    TENANCY_MODEL: tenancyModel(model),
    AUTH_MODEL: authModelText(model),
    CORE_ENTITIES: model.coreEntities,
    INTEGRATIONS: integrationsText(model),
    SECURITY_POSTURE: securityPosture(model),
    SCALE_POSTURE: scalePosture(model),
    ROLES: roles,
    STACK_SUMMARY: summary,
    STACK_NAME: stackName,
    STACK_DETAIL: `${stackName} · ${frontend}${backendSummary(model)} · deployed to ${hosting} · code on ${repoLabel(model)}`,
    REPO_PROVIDER: repoLabel(model),
    SETUP_STEPS: setupSteps(model, stackName),
    START_BOOTSTRAP: startBootstrap(model, stackName),
    START_MINIMUM: startMinimum(model),
    FIRST_SPEC_HINT: firstSpecHint(model),
    DEPLOY_TARGET: hosting,
    CI_SETUP_STEPS: ciSetupSteps(model, stackName),
    CI_READY_CHECK: ciReadyCheck(model, command),
    CI_SETUP_STEPS_AZ: ciSetupStepsAzure(model, stackName),
    CI_READY_CHECK_AZ: ciReadyCheckAzure(model, command),
    DEPLOY_STEPS: deploySteps(model),
    ISSUE_TERM: vocab.issueTerm,
    BOARD_TERM: vocab.boardTerm,
    CI_FILE: vocab.ciFile,
    DEPLOY_FILE: vocab.deployFile,
    SECRETS_HOME: vocab.secretsHome,
    CLI_NAME: vocab.cliName,
    CLI_ISSUE_VIEW: vocab.cliIssueView,
    CLI_BRANCH_LINK: vocab.cliBranchLink,
    CLI_PR_CREATE: vocab.cliPrCreate,
    ARCHITECTURE_INVARIANTS: architectureInvariants(model),
    DATA_INVARIANTS: dataInvariants(model),
    DESIGN_INVARIANTS:
      "- Use the design-system tokens (color, spacing, radii, type) — never hardcode values in components.\n" +
      "- Reuse shared UI components before writing a new one.",
    ARCHITECTURE_LAYERS: architectureLayers(model),
    KEY_CONVENTIONS: keyConventions(model),
    ...command
  };

  // Commands the model wrote count as authored too: the manifest has to say which files a prompt
  // change can move, and for a custom stack that includes every file carrying a command.
  const authoredTokens = new Set<string>(authoredCommands);
  for (const [token, prose] of Object.entries(authored ?? {})) {
    if (!isProseSlot(token)) continue;
    if (typeof prose !== "string") continue;
    const trimmed = prose.trim();
    if (trimmed === "") continue;
    values[token] = trimmed;
    authoredTokens.add(token);
  }

  const decisions: ScaffoldDecision[] = [
    dec("PROJECT_NAME", model.name, "interview", "Product name from the interview."),
    dec("STACK_SUMMARY", summary, "default", "Golden-path stack (Next.js/TS/Tailwind/Supabase), narrowed by the interview."),
    dec("CMD_TEST", command.CMD_TEST, "default", `${packageManager(model)} — the package manager the ${stackName} toolchain defaults to.`),
    dec("DEPLOY_TARGET", hosting, model.hosting === "vercel" ? "default" : "interview",
      model.hosting === "vercel"
        ? "Golden-path hosting."
        : `Chosen in the interview — the DEV deploy workflow ships as a placeholder for ${hosting}.`),
    dec("TENANCY_MODEL", tenancyLabel[model.tenancy], "interview", "Data isolation model chosen in the interview — drives the access-control invariant."),
    dec("AUTH_MODEL", model.authModel.map((a) => authMethodLabel[a]).join(", "), "interview", "Sign-in methods chosen in the interview."),
    dec("ROLES", roles, model.roles === "none" ? "default" : "interview", "Derived from the tenancy and roles answers."),
    dec("CAPABILITY_SCOPE", model.features.join(", ") || "(none)", "interview", "Capabilities selected for year one, plus the identity features implied by tenancy/auth."),
    dec("SECURITY_POSTURE", model.dataSensitivity, "interview", "Data-sensitivity answer — drives the encryption/audit posture."),
    dec("SCALE_POSTURE", model.scale, "interview", "Scale target for v1 — drives the caching/database posture.")
  ];
  if (!model.mvpFocus) {
    decisions.push(dec("PROJECT_TAGLINE", "(unset)", "default", "No MVP focus given — left for the founder to fill."));
  }
  decisions.push(
    model.vision
      ? dec("VISION", model.vision, "interview", "Long-term vision from the interview.")
      : dec("VISION", "(unset)", "default", "No vision given — flagged for the founder to fill, never invented.")
  );
  decisions.push(
    model.coreEntities
      ? dec("CORE_ENTITIES", model.coreEntities, "interview", "Core objects described in the interview.")
      : dec("CORE_ENTITIES", "(unset)", "default", "No core entities given — flagged for the founder to fill, never invented.")
  );
  return { values, decisions, authoredTokens };
}

function dec(token: string, value: string, source: "interview" | "default", rationale: string): ScaffoldDecision {
  return { token, value, source, rationale };
}

/**
 * Non-goals are optional in the interview, but the slot is not: it lands in the generated CLAUDE.md,
 * where an empty value would read as "there are none" — an invitation to build anything. Unanswered
 * gets an explicit note to fill it in, matching how an unanswered vision is handled.
 */
function nonGoalsText(model: ProjectModel): string {
  return model.nonGoals || "_Not yet decided — add what this product is deliberately not doing._";
}

/**
 * The name to print for this project's stack.
 *
 * Only a custom stack can be renamed, and only by the model: the golden-path labels are already the
 * names people use. `STACK_NAME` is an ordinary prose slot, so it is subject to the same allowlist
 * and length contract as every other authored value — nothing about this widens what the model can
 * reach.
 */
function stackNameFor(model: ProjectModel, authored?: AuthoredSlots): string {
  if (!isCustomStack(model)) return frameworkLabel(model);
  const written = authored?.STACK_NAME;
  return typeof written === "string" && written.trim() !== "" ? written.trim() : frameworkLabel(model);
}

function aOrAn(label: string): string {
  return /^[aeiou]/i.test(label) ? `an ${label}` : `a ${label}`;
}

function capabilityScope(model: ProjectModel): string {
  if (model.features.length === 0) {
    return "Nothing beyond the core product itself — no auth, payments, or other platform capabilities in v1.";
  }
  return model.features.map((f) => `- **${featureLabel[f]}**`).join("\n");
}

/** What each selected capability's first spec must cover — one section per capability, never for an unselected one. */
function capabilitySpecs(model: ProjectModel): string {
  if (model.features.length === 0) {
    return "No platform capabilities were selected. Spec the core product flow first — see `docs/VISION.md`.";
  }
  return model.features.map((f) => `### ${featureLabel[f]}\n${capabilitySpecBrief(f, model)}`).join("\n\n");
}

function capabilitySpecBrief(feature: FeatureId, model: ProjectModel): string {
  const scoping = model.derived.multiTenant ? "organization" : "owning user";
  switch (feature) {
    case "auth":
      return `Sign-in via ${model.authModel.map((a) => authMethodLabel[a]).join(", ")}. Cover session handling, the post-signup record every other table hangs off, and what an unauthenticated request may reach.`;
    case "organizations":
      return `Organizations, membership, and invitations. Every table carries \`organization_id\`; cover the join flow, the last-owner rule, and a denial test proving a non-member sees nothing.`;
    case "roles":
      return "Role assignment and permission checks, decided server-side. Cover the default role, who may change roles, and a denial test per protected action.";
    case "payments":
      return `Plans, checkout, and the webhook that is the source of truth for entitlement. Cover the ${scoping} the subscription attaches to, failed payments, and idempotent webhook handling.`;
    case "notifications":
      return "In-app notification records, delivery, and read state. Cover per-type preferences and what happens when the recipient never opens the app.";
    case "search":
      return `Searchable fields, ranking, and the empty-result state. Cover how results stay scoped to the ${scoping}.`;
    case "storage":
      return `Uploads, allowed types and size limits, and access control on every object. Cover ${usesSupabase(model) ? "signed URLs with a short expiry" : "how you sign and expire download URLs"}, and deletion cascading with its owner row.`;
    case "ai":
      return `${model.aiUsage === "none" ? "[NEEDS CLARIFICATION: what kind of AI does this product use?]" : `AI approach: ${aiUsageLabel[model.aiUsage]}.`} Cover the provider call site (server-side only), schema validation of every model response before it is accepted, cost/rate limits, and the failure path when the model is unavailable.`;
    case "analytics":
      return "The handful of events that actually inform decisions, and who may read them. Cover what is never sent to a third party.";
    case "realtime":
      return `Which entities push live updates, the channel per ${scoping}, and reconnection behaviour. Cover authorization on subscribe — not just on read.`;
    case "email":
      return "Transactional templates, the sending provider, and bounce handling. Cover unsubscribe and what must never appear in an email body.";
    case "admin":
      return "The internal-only surface, who may reach it, and every action it can take. Cover the audit trail for privileged actions.";
    case "audit_logs":
      return "An append-only record of actor, action, entity, and timestamp. Cover retention, who may read it, and the absence of update/delete paths.";
  }
}

function tenancyModel(model: ProjectModel): string {
  const base = `Data is organized as ${tenancyLabel[model.tenancy]}.`;
  if (model.derived.multiTenant) {
    return `${base} Every table carries \`organization_id\`, access control is enforced in the database, and every new table ships with a denial test proving a non-member cannot read it.`;
  }
  if (model.tenancy === "internal") {
    return `${base} Rows belong to the organization as a whole; enforce access in the database, and keep an explicit answer for "who may see this row" on every table.`;
  }
  return `${base} Rows are scoped to their owning user and enforced in the database, not just in the application layer.`;
}

function authModelText(model: ProjectModel): string {
  if (!model.derived.needsAuth) {
    return "No accounts — the product is used without signing in. Nothing is user-scoped, so keep the data model free of per-user ownership until that changes.";
  }
  const methods = model.authModel.map((a) => authMethodLabel[a]).join(", ");
  const provider = usesSupabase(model) ? "Supabase Auth" : `your own auth layer on ${databaseLabel(model)}`;
  return `Users sign in with ${methods}, handled by ${provider}. The signed-in user id is the anchor every ${model.derived.multiTenant ? "organization membership" : "owned row"} hangs off.`;
}

function integrationsText(model: ProjectModel): string {
  if (model.integrations) return model.integrations;
  if (model.derived.hasPayments) {
    return "[NEEDS CLARIFICATION: payments were selected but no payment provider was named — decide the provider before the first payments spec.]";
  }
  return "None named in the interview. Record each external system here as you integrate it.";
}

function securityPosture(model: ProjectModel): string {
  switch (model.dataSensitivity) {
    case "regulated":
      return "Regulated data (health, finance, or minors). Security work is feature work: encrypt sensitive fields at rest, keep an audit trail of every access to regulated records, never log values, and ship deletion + export paths with the first data-bearing feature.";
    case "pii":
      return "Personal data at scale. Minimize what you collect, never log personal values, encrypt sensitive fields at rest, and ship deletion + export paths with the first data-bearing feature.";
    case "standard":
      return "Standard business data. Least privilege, secure defaults, secrets only in environment variables, and no personal data in logs beyond IDs.";
  }
}

function scalePosture(model: ProjectModel): string {
  switch (model.scale) {
    case "validate":
      return "Optimize for speed of learning, not throughput. Boring queries, no caching layer, no premature sharding — add them when a real number demands it.";
    case "growth":
      return "Build growth-ready: index every column you filter on, paginate every list, and cache the expensive read paths behind an explicit key. Conservative data modeling now beats a migration under load later.";
    case "high_scale":
      return "Expect rapid adoption. Index and paginate from day one, cache expensive reads, keep write paths idempotent, and leave headroom in the data model — measure before optimizing, but design so the measurement has somewhere to go.";
  }
}

/**
 * The setup only a human with an account can do (spec 66).
 *
 * Installing a runtime and dependencies used to head this list. `/start` does that now, so leaving it
 * here would be the same instruction in two files — and the one a founder reads second would be the
 * one already done. What is left is everything that creates something outside this machine, which is
 * exactly what `/start` refuses to touch.
 */
function setupSteps(model: ProjectModel, stackName: string): string {
  const steps: string[] = [];
  if (usesSupabase(model)) {
    steps.push(
      "1. Create a **Supabase** project, then copy the project URL and anon key from Project Settings → API.",
      "2. Copy `.env.example` to `.env.local` and fill in those two values (plus the service-role key, server-side only — never expose it to the browser).",
      "3. Apply the database migrations to your Supabase project; every schema change from here is a committed migration, never a dashboard edit."
    );
  } else {
    steps.push(
      `1. Provision a **${databaseLabel(model)}** instance and note its connection string.`,
      "2. Copy `.env.example` to `.env.local` and fill in the connection string (server-side only — never expose it to the browser).",
      "3. Apply the database migrations; every schema change from here is a committed migration, never a hand-edit."
    );
  }
  steps.push(...repoSetupSteps(model, 4));
  if (isCustomStack(model)) {
    // The one machine-level step /start could not spell out, because nothing here knows this stack.
    // Numbered off the list length: the provider steps above differ in count between GitHub and
    // Azure DevOps, and a hardcoded number was wrong the moment that stopped being fixed.
    steps.push(
      `${steps.length + 1}. Confirm the **${stackName}** runtime and package manager are installed, if \`/start\` could not.`
    );
  }
  return steps.join("\n");
}

/**
 * Getting the code hosted, the pipeline running and the branch rules enforced — in the provider's own
 * terms (spec 66 follow-up).
 *
 * Azure DevOps is not GitHub with different nouns. Pipelines are registered by hand rather than
 * discovered from a directory, branch protection is a per-branch policy instead of a committed
 * workflow, and the work-item link that closes an item on merge is set on the pull request. A founder
 * handed "create a repo and add secrets" has to translate all of that themselves, which is exactly
 * the moment a foundation stops feeling like a senior team set it up.
 */
function repoSetupSteps(model: ProjectModel, from: number): string[] {
  const vocab = provider(model);
  const n = (offset: number) => from + offset;
  if (usesAzureRepos(model)) {
    return [
      `${n(0)}. In **Azure DevOps**, create a project and an empty **Azure Repos** repository, then push this foundation — including the \`develop\` branch \`/start\` created.`,
      `${n(1)}. **Register the pipelines.** Pipelines → New pipeline → Azure Repos Git → this repo → Existing YAML file: \`${vocab.ciFile}\` for CI, then again for \`${vocab.deployFile}\`. Azure DevOps does not pick up YAML from a directory the way Actions does — an unregistered pipeline simply never runs.`,
      `${n(2)}. **Set the branch policies** the branch model depends on, under Repos → Branches → \`main\` / \`develop\` → Branch policies: require a pull request, require the CI build to pass, and block direct pushes. In this workflow these are the rules — there is no committed file enforcing them.`,
      `${n(3)}. **Create the Boards structure:** one area path (or team) per \`feature/<name>\`, so a ${vocab.issueTerm} always belongs to exactly one feature. That mapping is what \`/createspec\` asks you about.`,
      `${n(4)}. Install ${vocab.cliName} and run \`az login\`, so the spec commands can read ${vocab.issueTerm}s and open pull requests.`,
      `${n(5)}. ${deployTargetSetup(model)}, and put the credentials in ${vocab.secretsHome}.`
    ];
  }
  return [
    `${n(0)}. Create an empty repository on ${repoLabel(model)} and push this foundation, including the \`develop\` branch \`/start\` created.`,
    `${n(1)}. **Protect \`main\` and \`develop\`** (Settings → Branches): require a pull request and a passing CI check. The workflows in \`.github/workflows/\` run on their own once pushed.`,
    `${n(2)}. Install ${vocab.cliName} and run \`gh auth login\`, so the spec commands can read ${vocab.issueTerm}s and open pull requests.`,
    `${n(3)}. ${deployTargetSetup(model)}, and put the credentials in ${vocab.secretsHome}.`
  ];
}

/** How the founder prepares the deploy target — a hosted project, or their own server. */
function deployTargetSetup(model: ProjectModel): string {
  if (model.hosting === "self_host") return "Prepare the server you will deploy to";
  // "Create the Azure project" would sit two steps below "create an Azure DevOps project" and mean
  // something entirely different. Name the service.
  if (model.hosting === "azure") return "Create the **Azure App Service** you will deploy to";
  return `Create the ${hostingLabel[model.hosting]} project you will deploy to`;
}

function firstSpecHint(model: ProjectModel): string {
  if (!model.mvpFocus) {
    return "Start with the single flow the product is useless without. [NEEDS CLARIFICATION: the MVP focus was left blank — decide it before writing the first spec.]";
  }
  return `Start with the flow the MVP is useless without: **${model.mvpFocus}** Spec that one flow end to end — not the whole product.`;
}

function architectureInvariants(model: ProjectModel): string {
  const web = frameworkLabel(model);
  return (
    `- One-way data flow through the ${web} app; routes stay thin, logic lives in features, pure logic in packages.\n` +
    "- External calls (database, third-party APIs) happen server-side only, in a typed data layer — never from components.\n" +
    "- `any` is forbidden (TypeScript strict); validate every boundary with a schema; return typed errors, not thrown strings.\n" +
    "- Autogenerated files (lockfile, build output, generated types) are never hand-edited."
  );
}

function dataInvariants(model: ProjectModel): string {
  const lines = [
    model.derived.multiTenant
      ? "- Every resource hangs off `organization_id`; Row-Level Security on every table, with denial tests."
      : "- Rows are scoped to their owning user; enforce it in the database, not just the app.",
    "- Access control on every table/resource from day one; authorization decided server-side.",
    "- Migrations are the only way the schema changes: idempotent, replay cleanly from zero, committed to the repo — never hand-edited in a dashboard."
  ];
  if (model.dataSensitivity !== "standard") {
    lines.push(
      model.dataSensitivity === "regulated"
        ? "- Regulated data: encrypt sensitive fields at rest, audit every access, and never log values — only IDs."
        : "- Personal data: collect the minimum, never log values, and ship deletion + export paths with the first data-bearing feature."
    );
  }
  return lines.join("\n");
}

function architectureLayers(model: ProjectModel): string {
  return (
    `${frameworkLabel(model)} with a typed data layer:\n\n` +
    "```\nroutes / pages (server-first)\n  → components\n    → server actions / API handlers\n      → data layer (typed)\n        → database & external services\n```\n\n" +
    "External calls happen only in the data layer, server-side. Pure logic lives in packages, free of I/O and env access."
  );
}

function keyConventions(model: ProjectModel): string {
  const lines = [
    "- Server-first: server components/actions by default; client components only where interactivity needs them.",
    "- Data access only through the typed data layer — no ad-hoc queries in components.",
    "- Feature-module organization: a feature's UI, logic, and types live together."
  ];
  if (model.derived.multiTenant) lines.push("- Every query is organization-scoped; RLS + a denial test accompany every new table.");
  if (model.derived.hasAi) {
    lines.push(
      `- AI (${model.aiUsage === "none" ? "kind not yet decided" : aiUsageLabel[model.aiUsage]}): provider calls happen server-side only, and every model response is validated against a schema before it is accepted — generated text is untrusted.`
    );
  }
  if (model.dataSensitivity !== "standard") {
    lines.push("- Sensitive data: no personal values in logs; review the security posture in `docs/architecture/SYSTEM_OVERVIEW.md` before any feature that touches user data.");
  }
  if (model.scale !== "validate") lines.push("- Index what you filter on and paginate every list — the scale target assumes real growth.");
  return lines.join("\n");
}

/** Substitute {{TOKENS}} in one template string; unknown tokens become NEEDS CLARIFICATION markers. */
function substitute(
  content: string,
  values: Record<string, string>,
  missing: Set<string>
): string {
  return content.replace(TOKEN_RE, (_match, token: string) => {
    const value = values[token];
    if (value === undefined || value === "") {
      missing.add(token);
      return `[NEEDS CLARIFICATION: ${token}]`;
    }
    return value;
  });
}

/**
 * Render the full scaffold from template files + a resolved model.
 * Returns the files plus a ScaffoldPlan for the founder to approve before provisioning.
 * `EXCLUDED` meta files (e.g. .airrow-template.json) are dropped by the caller before passing in.
 */
export function renderScaffold(
  template: TemplateFile[],
  model: ProjectModel,
  authored?: AuthoredSlots,
  authoredDocuments?: AuthoredDocuments,
  authoredToolchain?: AuthoredToolchain
): RenderedScaffold {
  const { values, decisions, authoredTokens } = deriveScaffoldValues(
    model,
    authored,
    authoredToolchain
  );
  const missing = new Set<string>();

  /**
   * A narrative document the model wrote end to end replaces the template's scaffolding, so the
   * headings and transitions belong to this project rather than being the same in every one. Only
   * the paths in `AUTHORED_DOCUMENTS` are eligible — everything else, including every file carrying
   * a command, renders from the template exactly as before. Substitution still runs over the result:
   * the contract rejects unrendered tokens, so it is a no-op, and if one ever slipped through the
   * founder gets a `[NEEDS CLARIFICATION]` marker rather than a literal `{{TOKEN}}`.
   */
  const bodyFor = (tf: TemplateFile): string => {
    if (!isAuthoredDocument(tf.path)) return tf.content;
    const written = authoredDocuments?.[tf.path];
    return typeof written === "string" && written.trim() !== "" ? written : tf.content;
  };

  /**
   * `authored` means the model's words are in this file — either it wrote the whole body, or the
   * template left a slot open that the model filled. Asked against the template body, before
   * substitution, because that is where the `{{TOKEN}}` still is.
   *
   * Everything else is `static`: the same words every project gets. The distinction is the point of
   * recording it — it is what tells a reader months from now which files a prompt change can move.
   */
  const files: GeneratedFile[] = template
    .filter((tf) => shipsPath(model, tf.path))
    .map((tf) => {
      const body = bodyFor(tf);
      const fromModel =
        body !== tf.content || [...authoredTokens].some((t) => body.includes(`{{${t}}}`));
      return {
        path: tf.path,
        content: substitute(body, values, missing),
        source: fromModel ? ("authored" as const) : ("static" as const),
        templateId: `template/${tf.path}`
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  const plan: ScaffoldPlan = {
    projectName: model.name,
    projectSlug: model.slug,
    fileCount: files.length,
    tree: files.map((f) => f.path),
    decisions,
    clarifications: [...missing].sort().map((t) => `[NEEDS CLARIFICATION: ${t}]`)
  };

  return { files, plan };
}
