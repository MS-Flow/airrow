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
import { SHADCN_UI, type UiKit, type UiKitPalette } from "../../schemas/src/ui-kits.ts";
import { inferStack, type InferredStack, type Runtime } from "./toolchain.ts";
import {
  aiUsageLabel,
  audienceLabel,
  authMethodLabel,
  backendSummary,
  commandName,
  coreAction,
  commandPath,
  databaseLabel,
  featureLabel,
  frameworkLabel,
  hiddenFolder,
  hostingName,
  isCustomStack,
  isImport,
  productTypeName,
  repoLabel,
  shipsCleanup,
  tenancyName,
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
  inferred: InferredStack | null,
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
    // Nothing authored for this one. The npm/pnpm default is still not a fallback — telling a .NET
    // project to run `pnpm dev` is a wrong command in the file the founder runs first — but
    // `inferStack` reads what they wrote and gives that ecosystem's own documented command, which
    // is what an engineer reading the same sentence would write down.
    //
    // Only a description nothing recognises empties to a `[NEEDS CLARIFICATION]` marker through the
    // ordinary substitution path, the same as any other unanswered value.
    commands[slot] = inferred?.commands[slot] ?? "";
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

/**
 * The GitHub Action that installs each runtime, and the Azure Pipelines task that does the same.
 *
 * Only the ones with a canonical answer are listed. `other` is not a gap to fill in later — it is
 * the ecosystems whose CI needs something this file cannot decide, Swift wanting macOS being the
 * clear case, and for those the honest placeholder still ships.
 */
const RUNTIME_SETUP: Record<Runtime, { github: string[]; azure: string[] }> = {
  node: {
    github: ["      - uses: actions/setup-node@v4", "        with:", "          node-version: 20"],
    azure: ["          - task: NodeTool@0", "            inputs:", "              versionSpec: '20.x'"]
  },
  python: {
    github: ["      - uses: actions/setup-python@v5", "        with:", "          python-version: '3.12'"],
    azure: ["          - task: UsePythonVersion@0", "            inputs:", "              versionSpec: '3.12'"]
  },
  go: {
    github: ["      - uses: actions/setup-go@v5", "        with:", "          go-version: '1.22'"],
    azure: ["          - task: GoTool@0", "            inputs:", "              version: '1.22'"]
  },
  dotnet: {
    github: ["      - uses: actions/setup-dotnet@v4", "        with:", "          dotnet-version: '8.0.x'"],
    azure: ["          - task: UseDotNet@2", "            inputs:", "              version: '8.0.x'"]
  },
  ruby: {
    github: ["      - uses: ruby/setup-ruby@v1", "        with:", "          ruby-version: '3.3'"],
    azure: ["          - task: UseRubyVersion@0", "            inputs:", "              versionSpec: '3.3'"]
  },
  java: {
    github: [
      "      - uses: actions/setup-java@v4",
      "        with:",
      "          distribution: temurin",
      "          java-version: '21'"
    ],
    azure: [
      "          - task: JavaToolInstaller@0",
      "            inputs:",
      "              versionSpec: '21'",
      "              jdkArchitectureOption: x64",
      "              jdkSourceOption: PreInstalled"
    ]
  },
  // Both hosted runner images ship a Rust and a PHP toolchain, so the install command is the whole
  // setup. A version-pinning step here would be a third-party action bought for nothing.
  rust: { github: [], azure: [] },
  php: { github: [], azure: [] },
  flutter: {
    github: ["      - uses: subosito/flutter-action@v2", "        with:", "          channel: stable"],
    azure: ["          - bash: git clone -b stable --depth 1 https://github.com/flutter/flutter.git $(Agent.ToolsDirectory)/flutter", "            displayName: Flutter SDK"]
  },
  other: { github: [], azure: [] }
};

/** True when CI knows both how to install this stack and what to run — the two it needs to pass. */
function ciCanRun(model: ProjectModel, inferred: InferredStack | null): boolean {
  return !isCustomStack(model) || (inferred !== null && inferred.runtime !== "other");
}

function ciSetupSteps(model: ProjectModel, stackName: string, inferred: InferredStack | null): string {
  if (isCustomStack(model)) {
    // A stack we recognise gets its real setup: the runtime, then that ecosystem's reproducible
    // install. Anything else keeps the honest placeholder — CI that fails loudly on the first run is
    // worse than CI that says what is missing and stops.
    if (!ciCanRun(model, inferred) || !inferred) {
      return [
        "      - name: Set up the toolchain",
        "        run: |",
        `          echo "::warning::Add the setup and install steps for ${stackName} here, then remove this guard."`,
        "          exit 0"
      ].join("\n");
    }
    return [...RUNTIME_SETUP[inferred.runtime].github, `      - run: ${inferred.install}`].join("\n");
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
 * gate falls back to what *is* knowable: whether this job can do the whole thing, install included.
 *
 * Both halves matter. Real commands run against a runner where nothing was installed is a red build
 * on the first push — which is the defect spec 66 exists to remove, arriving from the other side.
 */
/**
 * What CI says when it finds no stack to verify.
 *
 * "Run /start" is the right instruction only where that command exists. A foundation generated for a
 * project that already has a stack ships `/cleanup`, which scaffolds nothing — telling that founder
 * to run a command their repository does not contain would make the first CI run they ever see a
 * piece of wrong advice.
 */
function noStackNotice(model: ProjectModel): string {
  return shipsCleanup(model)
    ? "No stack here yet — this foundation was generated for an existing project, so push that project's code alongside these documents."
    : `No stack here yet — run ${commandName(model)} in this repository, then push again.`;
}

function ciReadyCheck(model: ProjectModel, inferred: InferredStack | null): string {
  const out = (value: "true" | "false") => `echo "ready=${value}" >> "$GITHUB_OUTPUT"`;
  if (isCustomStack(model)) {
    if (!ciCanRun(model, inferred)) {
      return [
        `          ${out("false")}`,
        '          echo "::notice::CI is waiting on this project\'s setup and verification commands — fill them into .github/workflows/ci.yml, then push again."'
      ].join("\n");
    }
    return `          ${out("true")}`;
  }
  return [
    "          if [ -f package.json ]; then",
    `            ${out("true")}`,
    "          else",
    `            ${out("false")}`,
    `            echo "::notice::${noStackNotice(model)}"`,
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
function ciReadyCheckAzure(model: ProjectModel, inferred: InferredStack | null): string {
  const set = (v: "true" | "false") => `echo "##vso[task.setvariable variable=ready;isOutput=true]${v}"`;
  if (isCustomStack(model)) {
    if (!ciCanRun(model, inferred)) {
      return [
        `              ${set("false")}`,
        '              echo "##vso[task.logissue type=warning]CI is waiting on this project\'s setup and verification commands — fill them into azure-pipelines.yml, then push again."'
      ].join("\n");
    }
    return `              ${set("true")}`;
  }
  return [
    "              if [ -f package.json ]; then",
    `                ${set("true")}`,
    "              else",
    `                ${set("false")}`,
    `                echo "##vso[task.logissue type=warning]${noStackNotice(model)}"`,
    "              fi"
  ].join("\n");
}

function ciSetupStepsAzure(model: ProjectModel, stackName: string, inferred: InferredStack | null): string {
  if (isCustomStack(model)) {
    if (!ciCanRun(model, inferred) || !inferred) {
      return [
        "          - bash: |",
        `              echo "##vso[task.logissue type=warning]Add the setup and install steps for ${stackName} here, then remove this guard."`,
        "            displayName: Set up the toolchain"
      ].join("\n");
    }
    return [
      ...RUNTIME_SETUP[inferred.runtime].azure,
      `          - bash: ${inferred.install}`,
      "            displayName: Install dependencies"
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
  const host = hostingName(model);
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
  /** The CLI the founder needs installed, with whatever extension it takes to be useful. */
  cliName: string;
  /** The same CLI named in three words, for a table cell and a bullet (spec 159). */
  cliShort: string;
  /** What still has to be added after the CLI installs, where anything does. */
  cliExtra?: string;
  /** The binary, for the check `/start` runs before installing anything (spec 159). */
  cliBin: string;
  /** Package ids for the two package managers a developer machine most often already has. */
  cliBrew: string;
  cliWinget: string;
  /** Where to send a founder whose machine has neither, rather than improvising an install. */
  cliDocs: string;
  /** The sign-in the founder does themselves — never `/start`. */
  cliAuth: string;
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
      cliName: "the Azure CLI with the `azure-devops` extension (`az extension add --name azure-devops`)",
      cliShort: "the Azure CLI (`az`)",
      cliExtra: "az extension add --name azure-devops",
      cliBin: "az",
      cliBrew: "azure-cli",
      cliWinget: "Microsoft.AzureCLI",
      cliDocs: "https://learn.microsoft.com/cli/azure/install-azure-cli",
      cliAuth: "az login"
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
    cliName: "the GitHub CLI (`gh`)",
    cliShort: "the GitHub CLI (`gh`)",
    cliBin: "gh",
    cliBrew: "gh",
    cliWinget: "GitHub.cli",
    cliDocs: "https://github.com/cli/cli#installation",
    cliAuth: "gh auth login"
  };
}

/** The two first-run commands: a foundation ships exactly one of them (spec 91). */
const FIRST_RUN_COMMANDS = [".claude/commands/start.md", ".claude/commands/cleanup.md"];

/**
 * Which template files this project ships.
 *
 * GitHub Actions and Azure Pipelines are alternatives, never both. Shipping the pair would leave one
 * permanently red and teach the founder to ignore a failing build — the exact habit the CI gate
 * exists to prevent.
 *
 * `/start` and `/cleanup` are alternatives for the same reason (spec 91): one scaffolds a stack, the
 * other reads the stack that is already there. A repository holding both would be a repository where
 * one of them is wrong, and nothing in it says which.
 *
 * `THIRD_PARTY_NOTICES.md` ships only where there is something to attribute (spec 165): a foundation
 * whose stack the founder named themselves installs no library of ours, and a notice for code that
 * was never installed is a file they cannot explain.
 *
 * A **hidden** delivery ships no pipeline at all (spec 187). Both CI files are discovered by
 * location — `.github/workflows/` for Actions, the repository root for Azure — and a hidden
 * foundation is neither of those places, nor is it ever pushed. The file could not run if it wanted
 * to. Shipping one anyway would be a workflow that looks like it guards the project and guards
 * nothing, which is the failure spec 66 exists to prevent; the team's own pipeline is the one that
 * matters, and the documents say so instead.
 */
export function shipsPath(model: ProjectModel, path: string): boolean {
  const ci = path.startsWith(".github/") || path.startsWith("azure-pipelines");
  if (ci && hiddenFolder(model) !== null) return false;
  if (path.startsWith(".github/")) return !usesAzureRepos(model);
  if (path.startsWith("azure-pipelines")) return usesAzureRepos(model);
  if (FIRST_RUN_COMMANDS.includes(path)) return path === commandPath(model);
  if (path === "THIRD_PARTY_NOTICES.md") return !isCustomStack(model) && !shipsCleanup(model);
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
  const kit = model.uiKit;
  // Pinned, unlike the framework scaffolders above (see `VITEST_MAJOR` for why they are not): this
  // one writes `components.json` and the theme every later `add` resolves against, and
  // `UI_ARCHITECTURE.md` now names the version it wrote. `@latest` there is a document that stops
  // being true on someone else's release schedule (spec 165).
  const cli = `${SHADCN_UI.pkg}@${SHADCN_UI.version}`;
  // Every flag here is load-bearing, and each one was found by running this command rather than by
  // reading about it. `--yes` alone is not non-interactive: `init` still asks which component
  // library and which preset, and an assistant running `/start` cannot answer an arrow-key prompt —
  // it waits until something times out. `-b radix` is the primitive set this project's documents
  // name; `-p nova` is the library's own default preset. There is no `--base-color` flag: the base
  // colour is a `components.json` field now, and the theme below overrides those values anyway.
  const init = `${run} ${cli} init --yes -b radix -p nova`;
  const closing = [
    `   That writes \`components.json\` and the \`cn\` helper, and installs **no components**.`,
    `   Components arrive one at a time, when a spec calls for one: \`${run} ${cli} add <name>\`.`,
    ...(kit
      ? [`   Set \`tailwind.baseColor\` to \`${kit.baseColor}\` in \`components.json\` — this direction's neutral family.`]
      : []),
    ...(kit ? themeStep(kit) : [])
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
 * The theme the founder picked, written into the stylesheet `init` just created (spec 165).
 *
 * The values come from the same `UiKit` record the interview drew its preview from, so the screen a
 * founder chose by looking at it and the theme they end up with cannot disagree. Written as CSS
 * custom properties because that is what shadcn/ui's own theming is: there is nothing to install
 * beyond the values, and nothing here is anyone else's code.
 */
function themeStep(kit: UiKit): string[] {
  const vars = (p: UiKitPalette): string[] => [
    `     --background: ${p.bg};`,
    `     --card: ${p.surface};`,
    `     --foreground: ${p.fg};`,
    `     --muted-foreground: ${p.muted};`,
    `     --border: ${p.border};`,
    `     --primary: ${p.accent};`
  ];
  return [
    "",
    `   Then apply the **${kit.name}** theme this project chose. In the stylesheet \`init\` just`,
    "   touched, set these on `:root` and the `.dark` block, keeping every other variable it wrote:",
    "",
    "   ```css",
    "   :root {",
    `     --radius: ${kit.design.radius};`,
    ...vars(kit.light),
    "   }",
    "   .dark {",
    ...vars(kit.dark),
    "   }",
    "   ```",
    "",
    `   That is the whole install — no component library beyond the primitives above, and no screens.`,
    `   **${kit.name}** is a visual language, not a layout: ${kit.design.typography} ${kit.design.headline}`,
    `   Surfaces are separated by ${kit.design.surfaces}, spacing is ${kit.design.spacing}, and the brand`,
    `   leads with a ${kit.design.logo}. ${kit.design.motion}`,
    `   ${kit.darkFirst ? "Dark is the default theme; light is the alternative." : "Light is the default theme; dark is the alternative."}`,
    "   These values are the design system now; a hardcoded colour or radius in a component is a bug."
  ];
}

/**
 * A tool `/start` checks for, and installs when it is missing (spec 159).
 *
 * `brew` and `winget` are named by package id because those two cover the machines a founder is most
 * likely to be on and both install non-interactively. `docs` is the honest floor: a machine with
 * neither gets the ecosystem's own install page rather than an improvised curl-into-a-shell.
 */
interface DevTool {
  name: string;
  check: string;
  reason: string;
  brew?: string;
  winget?: string;
  docs: string;
}

/** The runtime each ecosystem needs before any of its commands mean anything. */
const RUNTIME_TOOLS: Partial<Record<Runtime, Omit<DevTool, "reason">>> = {
  node: {
    name: "Node.js 20 or newer",
    check: "node --version",
    brew: "node",
    winget: "OpenJS.NodeJS.LTS",
    docs: "https://nodejs.org/en/download"
  },
  python: {
    name: "Python 3.11 or newer",
    check: "python3 --version",
    brew: "python@3.12",
    winget: "Python.Python.3.12",
    docs: "https://www.python.org/downloads/"
  },
  go: { name: "Go", check: "go version", brew: "go", winget: "GoLang.Go", docs: "https://go.dev/dl/" },
  dotnet: {
    name: "the .NET SDK",
    check: "dotnet --version",
    brew: "dotnet-sdk",
    winget: "Microsoft.DotNet.SDK.8",
    docs: "https://dotnet.microsoft.com/download"
  },
  ruby: {
    name: "Ruby 3.2 or newer",
    check: "ruby --version",
    brew: "ruby",
    winget: "RubyInstallerTeam.RubyWithDevKit.3.3",
    docs: "https://www.ruby-lang.org/en/documentation/installation/"
  },
  rust: {
    name: "Rust (via rustup)",
    check: "cargo --version",
    brew: "rustup",
    winget: "Rustlang.Rustup",
    docs: "https://www.rust-lang.org/tools/install"
  },
  java: {
    name: "a JDK, 17 or newer",
    check: "java -version",
    brew: "openjdk@21",
    winget: "EclipseAdoptium.Temurin.21.JDK",
    docs: "https://adoptium.net/"
  },
  php: {
    name: "PHP 8.2 or newer, with Composer",
    check: "php --version && composer --version",
    brew: "php composer",
    winget: "PHP.PHP.8.3",
    docs: "https://getcomposer.org/download/"
  },
  flutter: {
    name: "the Flutter SDK",
    check: "flutter --version",
    // No winget/brew formula that installs a usable Flutter with its Android toolchain — the
    // official installer is the only honest answer here.
    docs: "https://docs.flutter.dev/get-started/install"
  }
};

/**
 * Section 1 of `/start`: the tools this project cannot be built without (spec 159).
 *
 * Every earlier version assumed git, a runtime and a package manager were already there — so a
 * founder on a fresh machine met `pnpm: command not found` in the first instruction they followed,
 * with nothing in the foundation telling them what to do about it. The rule is check, then install
 * only what is missing: never an upgrade of something the founder already has, and never a sign-in.
 * `{{FIRST_COMMAND}}` holding a credential is exactly what §0's machine boundary forbids — the CLI
 * is installed here so that the founder's own `gh auth login` in step 2 is one command, not two.
 */
function startTools(model: ProjectModel, inferred: InferredStack | null): string {
  const vocab = provider(model);
  const runtimeId: Runtime = isCustomStack(model) ? (inferred?.runtime ?? "other") : "node";
  const runtime = RUNTIME_TOOLS[runtimeId];
  const tools: DevTool[] = [
    {
      name: "Git",
      check: "git --version",
      reason: "section 3, and every branch you push after it",
      brew: "git",
      winget: "Git.Git",
      docs: "https://git-scm.com/downloads"
    }
  ];
  if (runtime) {
    tools.push({ ...runtime, reason: `running ${model.name} at all — section 2 cannot start without it` });
  }
  tools.push({
    name: vocab.cliShort,
    check: `${vocab.cliBin} --version`,
    reason: `step 2 of [START_HERE.md](../../START_HERE.md), and \`/pr-check\` opening pull requests later`,
    brew: vocab.cliBrew,
    winget: vocab.cliWinget,
    docs: vocab.cliDocs
  });

  const brew = tools.map((t) => t.brew).filter((id): id is string => Boolean(id));
  const winget = tools.filter((t) => t.winget);
  const noPackage = tools.filter((t) => !t.brew && !t.winget);
  const lines = [
    "**Check first, install only what is missing.** Run every check below before installing anything.",
    "",
    "| Tool | Check | Why this project needs it |",
    "| --- | --- | --- |",
    ...tools.map((t) => `| **${t.name}** | \`${t.check}\` | ${t.reason} |`),
    "",
    "Install what is missing with the package manager this machine already has — **one** of these,",
    "not all three:",
    "",
    "```bash",
    "# macOS",
    `brew install ${brew.join(" ")}`,
    "",
    "# Windows",
    ...winget.map((t) => `winget install --id ${t.winget} -e`),
    "",
    "# Debian / Ubuntu — git comes from apt; take the rest from the install pages below",
    "sudo apt-get update && sudo apt-get install -y git",
    "```",
    ""
  ];
  if (vocab.cliExtra) {
    lines.push(
      `Then add the part the spec commands actually read ${vocab.issueTerm}s through — the CLI alone`,
      "does not have it:",
      "",
      "```bash",
      vocab.cliExtra,
      "```",
      ""
    );
  }
  const pages = tools.filter((t) => t.name !== "Git");
  if (pages.length > 0) {
    lines.push(
      "Install pages, for a machine with neither package manager, or an apt version too old for this",
      "project:",
      "",
      ...pages.map((t) => `- ${t.name} — ${t.docs}`),
      ""
    );
  }
  if (noPackage.length > 0) {
    lines.push(
      `**${noPackage.map((t) => t.name).join(" and ")}: use the install page above.** No package-manager`,
      "formula here produces a toolchain that actually builds, and one that half-works costs an",
      "afternoon to undo.",
      ""
    );
  }
  if (!isCustomStack(model) && packageManager(model) === "pnpm") {
    lines.push(
      "**pnpm comes with Node.** Run `corepack enable` — never `npm install -g pnpm`, which installs a",
      "second copy that shadows the one this project pins.",
      ""
    );
  }
  return [
    ...lines,
    "**The five rules of this section:**",
    "",
    "1. **Check before you install.** A tool that answers its `--version` is done — say so, and move on.",
    "2. **Never upgrade what is already there.** A machine-wide version bump is not this command's to",
    "   make, and it can break every other project on the founder's laptop. If a version is genuinely",
    "   too old for this project, say which and leave the decision to them.",
    "3. **If an install fails, stop trying and say so.** Print the tool's own install page, and do not",
    "   build from source, download an installer into this repository, or pipe a script into a shell.",
    "   `sudo` may ask for a password you cannot answer from here — that is a report, not a puzzle.",
    "   Then carry on with the sections that do not need it: a missing runtime stops section 2, a",
    "   missing `git` stops section 3, and both belong in your final report.",
    `4. **Sign in to nothing.** \`${vocab.cliAuth}\` is the founder's own, in step 2 of`,
    "   [START_HERE.md](../../START_HERE.md). This command installs tools; it never holds a credential.",
    "5. **A tool installed just now may not be on this shell's `PATH` yet.** If a command you have just",
    "   installed successfully still reports \"not found\", that is what happened — say so and ask the",
    "   founder to restart their terminal (and this session) before you continue. Do not install it a",
    "   second time, and do not edit their shell profile to work around it.",
    "",
    "**Done when:** every check above either passes or is reported as something you could not install."
  ].join("\n");
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
function startBootstrap(model: ProjectModel, stackName: string, inferred: InferredStack | null): string {
  if (isCustomStack(model)) {
    // Where the ecosystem is recognised, its own generator is named — that is the difference
    // between a command a founder runs and a paragraph telling them to go and find one. Where it is
    // not, the gap stays honest: guessing a scaffolder costs them an afternoon of undoing it.
    const scaffold = inferred?.scaffold
      ? [
          `1. **Scaffold ${sentence(stackName)}** Its own generator, run in this directory:`,
          "",
          "   ```bash",
          `   ${inferred.scaffold}`,
          "   ```",
          "",
          "   Keep every file that is already here — if the generator would overwrite one of ours,",
          "   keep ours and say so. Adjust the command if your project needs different options."
        ]
      : [
          `1. **Scaffold ${sentence(stackName)}** Use its official project generator, in this directory. This`,
          "   foundation cannot name the command for you — it is your stack, and a wrong guess here is",
          "   worse than an honest gap. Keep every file that is already here."
        ];
    return [
      ...scaffold,
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
    "**Already has a `package.json`?** Then this section has run. Skip to section 3.",
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
 * The `/start` ceiling: the MVP focus, built for real (spec 123 — amends constitution §0).
 *
 * Previously "the bare minimum that runs" — one placeholder screen with the product's name swapped
 * in. That ceiling produced something nobody was glad to open. The new one is a judgment, not a hard
 * line: `/start` is trusted to build `mvpFocus` well, including the shell a real product needs to
 * present it honestly, bounded by one test — everything created must trace back to something the
 * founder actually wrote. Data and real auth stay out; see the two closing rules.
 */
function startMinimum(model: ProjectModel): string {
  const what = coreAction(model);
  const entities = model.coreEntities
    ? `The core objects this product is about: ${model.coreEntities}`
    : "No core objects were described in the interview — do not invent any.";
  // Styling is the stack, not a feature. Left unsaid, an assistant reads the ceiling below as
  // forbidding the design system section 2 just installed and ships a plain-CSS screen — then
  // reports that the stack in CLAUDE.md is not the stack on disk, which was a real founder's first
  // experience of /start.
  const styling = isCustomStack(model)
    ? "Style it the way this stack styles things — plainly, using what section 2 set up. Add no UI library that was not already there."
    : model.uiKit
      ? `Style it with the **${model.uiKit.name}** theme section 2 installed — its tokens, its \`${model.uiKit.design.radius}\` corners, its ${model.uiKit.design.spacing} spacing, ${model.uiKit.design.surfaces} between surfaces, and the brand leading with a ${model.uiKit.design.logo}. The founder chose that look by looking at it, so it should be recognisable. **What is on the screen is still theirs to have decided** — build what their answers describe, laid out the way this product needs, and let the theme make it look like the picture. Never copy a layout from a swatch. Overriding the theme with hand-written colours is a bug.`
      : "Style it with Tailwind, using the shadcn/ui primitives section 2 installed. That is this project's design system, and using it is not a feature.";
  // What the founder pointed at, if anything. The brief describes the references in words — nothing
  // here has ever seen an image — so this is a pointer to the section, not a second copy of it.
  const references =
    model.uiReferenceLinks.length > 0 || model.uiReferenceImageCount > 0
      ? "The founder showed us what they had in mind, and the brief's references section says what it said. Read it as direction — the layout, the density, the tone — never as something to copy: no logo, no brand name, no borrowed wording. This product is not theirs and must not look like it is."
      : "The founder attached no visual references, so the brief's own direction is the whole of it. Follow it, and where it was thin, finish the screen to this project's design system rather than inventing a look nobody asked for.";
  return [
    "Read `docs/architecture/UI_ARCHITECTURE.md` before writing anything. It is the build brief for",
    "what you are about to make — the screens, the navigation, the layout, the states, the design",
    `language — written for this project. The core action it should perform: **${what}**`,
    "",
    // That answer comes from a question asking two things at once — what it must do first, and where
    // it is heading (spec 165) — so it routinely contains both. Left unsaid, an assistant reads the
    // long-term half as a build target and sails straight past the ceiling this section exists to
    // set. The founder wrote the sentence; which half is buildable is ours to say.
    "**Where that names both a first thing and a long-term one, the first thing is the ceiling.** A",
    "clause about where this is heading is context for the decisions you make — never a second thing",
    "to build. If the two are hard to tell apart, build the smaller one.",
    "",
    references,
    "",
    "**Build that action for real — not a placeholder screen.** A founder opening this for the first",
    "time should recognise their product and see the beginning of the real thing, not a generator's",
    "default page with the name swapped in.",
    "",
    entities,
    "",
    styling,
    "",
    "**The ceiling is `mvpFocus`, built well — a bound, not a hard line.** Build the surrounding shell a",
    "real product needs to present that one action honestly: navigation, the loading/error/empty",
    "states, a sign-in surface where the action makes no sense without one. Where `UI_ARCHITECTURE.md`",
    "was thin, finish the screen to a reasonable standard with this project's own design system — the",
    "layout, the spacing, placeholder content in the shape the real content will take. That is",
    "presentation, and polish is allowed to fill a gap in taste. It is never allowed to fill a gap in",
    "function.",
    "",
    "**Every screen, field, label and route you create must trace back to something the founder wrote**",
    "— an interview answer, `mvpFocus`, the core objects above, or `UI_ARCHITECTURE.md`. That test",
    "permits a sign-in screen when the product is plainly account-based, and forbids a settings page",
    "nobody asked for, however tasteful. Where something cannot be traced, leave a",
    "`[NEEDS CLARIFICATION]` note rather than deciding it yourself.",
    "",
    "**Auth follows the same rule as everything else: surface, never service.** Build the sign-in",
    "screens and wire them to the auth this stack already provides when the core action requires one —",
    "but provision no auth service, write no secret, and create no user table. Where the surface cannot",
    "work without a real backend, say so plainly instead of faking a session.",
    "",
    "**No schema, no persistence.** Build against local or in-memory state. The table this action needs",
    "is the founder's first spec, not this command's job — `/createspec` picks up from here.",
    "",
    "**Still a ceiling, not a starting budget.** No second feature, no capability the founder picked for",
    "later, no database beyond what a spec calls for. The founder should open the page, recognise their",
    "product doing its one real thing, and see plainly where `/createspec` picks up. Everything past",
    "this goes through the spec loop — that is what the rest of this foundation is for.",
    "",
    "### Finish it",
    "",
    "**A screen that works is half the job.** The bar is a first version the founder is glad to show",
    "someone, and the difference is almost never features — it is that the spacing is consistent, the",
    "type has a hierarchy, the empty state says something useful, and nothing shifts or flashes while",
    "it loads. `UI_ARCHITECTURE.md` has a section on each of those; they are not decoration, and they",
    "are not a second pass to do later. Build them the first time.",
    "",
    "**Before you report done, walk the screen yourself and answer these honestly:**",
    "",
    "- With no data at all, does it look designed, or does it look broken?",
    "- While it loads, does anything jump, flash, or go blank?",
    "- If the action fails, does the person reading know what failed and what to do?",
    "- Is every spacing value and every colour from the scale in `UI_ARCHITECTURE.md`, or did some",
    "  get typed in by hand?",
    "- Can the core action be completed with the keyboard alone, with focus visible the whole way?",
    "- Read the words on screen: are they this product's words, or the generator's?",
    "",
    "Fix what those find before you say it is finished. If something cannot be fixed without a",
    "decision the founder has not made, leave a `[NEEDS CLARIFICATION]` note and say so in your report",
    "rather than choosing for them."
  ].join("\n");
}

/**
 * Where this brief's design direction came from, said plainly.
 *
 * One answer to read, whether the founder wrote it from nothing or started from one of the
 * directions the question offers and edited it — the interview merged those into a single field
 * precisely so nothing downstream has to reconcile two versions of the same taste (spec 159).
 *
 * The founder should never find taste attributed to them that they did not express, which is what
 * the empty case is careful about: it says whose choice the default is.
 */
function uiDirectionSummary(model: ProjectModel): string {
  if (model.uiDirection) return `In the founder's own words: ${model.uiDirection}`;
  const defaultLook = isCustomStack(model)
    ? `the plain, idiomatic look of ${frameworkLabel(model)} — no UI library assumed`
    : "Tailwind + shadcn/ui, dark-mode first";
  return (
    "No design direction was described in the interview. Until you say otherwise, this project " +
    `follows this foundation's own default: ${defaultLook}. This section is a starting point, not a ` +
    "decision — replace it the moment you have an opinion."
  );
}

/**
 * The references the founder pointed at, and the one rule about them that is not negotiable.
 *
 * The rule is stated in the document rather than only in the prompt, because the document is what an
 * assistant reads six months from now when nobody remembers the prompt: a reference is direction to
 * interpret — density, hierarchy, tone, palette — never an asset to reproduce. Copying a named
 * product's design one-to-one is reproducing their trade dress (spec 159).
 */
function uiReferences(model: ProjectModel): string {
  const links = model.uiReferenceLinks;
  const images = model.uiReferenceImageCount;
  if (links.length === 0 && images === 0) {
    return "The founder attached no references. Everything below comes from their words and from this foundation's own design system.";
  }

  const named = links.length > 0 ? `Products the founder pointed at: ${links.join(", ")}.` : null;
  const shots =
    images > 0
      ? `${images} screenshot${images === 1 ? "" : "s"} were attached and read when this brief was written; ${images === 1 ? "it is" : "they are"} described here rather than kept, so this section is the whole of what they said.`
      : null;

  return [
    [named, shots].filter((s): s is string => s !== null).join(" "),
    "Read these as direction, never as something to copy: the layout, the density, the tone and the palette are what to learn from. Do not reproduce anyone's logo, brand name, wording or artwork — this product is not theirs and must not look like it is."
  ].join("\n\n");
}

/** The screens the answers actually imply — named where they can be, marked where they cannot. */
function uiScreens(model: ProjectModel): string {
  const focus = coreAction(model);
  const entities = model.coreEntities
    ? `The core objects are ${model.coreEntities} — each one a founder works with needs somewhere to be listed and somewhere to be seen on its own.`
    : "[NEEDS CLARIFICATION: the interview named no core objects, so the screens beyond the first cannot be derived — name them here before building past the first screen.]";
  const signIn = model.derived.needsAuth
    ? "This product has accounts, so it also has a sign-in surface: the screens, and nothing behind them until the founder's first spec builds it."
    : "This product has no accounts, so there is no sign-in surface and no account menu.";
  return [
    `**The first screen** performs the product's core action: ${focus}`,
    entities,
    signIn,
    "Navigation is whatever the shortest path to that core action needs and no more. A screen nobody has a reason to open is a screen that should not be built yet."
  ].join("\n\n");
}

/** Layout and spacing — the part a screen cannot be finished without, and the interview never asks. */
function uiLayout(model: ProjectModel): string {
  const shell = model.derived.isWeb
    ? "A persistent shell — navigation on the left or across the top, the working area filling the rest — with content width-capped so a wide display centres rather than stretches."
    : "A native shell: the platform's own navigation pattern, its own back behaviour, and its own safe areas respected.";
  return [
    shell,
    "One spacing scale, used everywhere. Related things sit closer together than unrelated ones, and the gap between sections is visibly larger than the gap inside one. Alignment is a grid, not a judgement per screen.",
    "One type scale, three or four sizes at most: a page title, a section heading, body, and a smaller size for supporting text. Weight and colour carry hierarchy before size does."
  ].join("\n\n");
}

/** Colour, in the terms a build needs rather than as a palette nobody picked. */
function uiColor(model: ProjectModel): string {
  if (isCustomStack(model)) {
    return "Neutrals carry the interface; one accent carries action. Status colours mean exactly one thing each — success, warning, danger — and are never used decoratively. Define them once, in whatever this stack's convention for design tokens is, and never write a raw colour value in a component.";
  }
  return "Neutrals carry the interface; one accent carries action. Status colours mean exactly one thing each. Every value is a Tailwind design token defined once — a hardcoded hex in a component is a bug, because it is the one thing that cannot be changed later in one place. Dark mode is not an afterthought: both themes are defined at the same time.";
}

/** The component inventory — what to build once instead of five times. */
function uiComponents(model: ProjectModel): string {
  const base = isCustomStack(model)
    ? `Build on whatever component convention ${frameworkLabel(model)} projects use. Add no UI library that is not already there.`
    : "Build on the shadcn/ui primitives this project installs — extend them rather than forking them, and never write a second button.";
  return [
    base,
    "The inventory this product needs is small and worth naming before writing any of it: the shell, one list surface, one detail surface, the form controls the core action needs, and the three state components below. Everything else is a variation on one of those until proven otherwise."
  ].join("\n\n");
}

/** Interaction and motion — the difference between finished and merely complete. */
function uiInteraction(): string {
  return [
    "Every action says what happened: a button that submits shows it is working, and the result is visible without hunting for it. Nothing silently succeeds.",
    "Motion is short and purposeful — something entering, something leaving, something changing state. No animation on load for its own sake, and nothing that delays a person who knows where they are going.",
    "Keyboard and focus are part of the design, not an audit item: every interactive element is reachable, focus is visible, and the primary action of a screen can be reached without a mouse."
  ].join("\n\n");
}

/** States — the one section that never needs an interview answer, and the one most often skipped. */
function uiStates(): string {
  return [
    "Loading, error, and empty are real components on every screen that fetches data — never a conditional buried in JSX, and never a blank flash while something loads.",
    "**Empty is a designed screen, not an absence.** It says what would be here, and offers the action that puts something here. It is the first screen most founders' first user ever sees.",
    "**Error says what failed and what to do next.** A stack trace, a spinner that never stops, and a silent no-op are all the same bug wearing different clothes."
  ].join("\n\n");
}

/**
 * What the first screen is actually built from — named, pinned, and licensed (spec 165).
 *
 * The section exists because the previous answer to "what does it look like?" was prose, and prose
 * is interpreted: two runs of the same picked direction produced two different screens. Naming the
 * theme and its version makes the document *checkable* — a founder can see what is installed, and so
 * can the assistant that opens this file six months from now.
 */
function uiDesignSystem(model: ProjectModel): string {
  const kit = model.uiKit;
  if (!kit) {
    if (shipsCleanup(model)) {
      return "This project already had a stack when the foundation was written, so nothing here installed a design system. Whatever it is styled with is what it is styled with — the direction above describes it rather than replacing it.";
    }
    if (isCustomStack(model)) {
      return `No theme is installed: ${frameworkLabel(model)} brings its own conventions, and this foundation does not put a second design system on top of them. The direction above is the whole brief — build to it using whatever this stack styles things with.`;
    }
    return `No curated direction was picked, so no theme was installed beyond the shadcn/ui defaults \`${commandName(model)}\` sets up. The direction above is the whole brief; finish the screen to it.`;
  }
  const { source } = kit;
  return [
    `**${kit.name}**, built on ${source.pkg}/ui \`${source.version}\` — installed by \`${commandName(model)}\`, pinned to that exact version so this section stays true.`,
    `It is a **visual language, not a layout**: ${kit.design.typography} ${kit.design.headline} Surfaces are separated by ${kit.design.surfaces}, spacing is ${kit.design.spacing}, corners are \`${kit.design.radius}\`, and the brand leads with a ${kit.design.logo}. ${kit.design.motion}`,
    `What is on each screen, and how someone moves between them, comes from the sections below — from what this product actually is. The theme decides how those screens look, never what they are.`,
    `Base colour \`${kit.baseColor}\`. ${kit.darkFirst ? "Dark is the default theme; light is the alternative." : "Light is the default theme; dark is the alternative."} It suits ${kit.suits.charAt(0).toLowerCase()}${kit.suits.slice(1)}`,
    `The theme's values are this project's design tokens. Build with them — a hardcoded colour or radius in a component is a bug, because it is the one thing that cannot be changed later in one place.`,
    `Licensed ${source.licence}, © ${source.holder} — see \`THIRD_PARTY_NOTICES.md\`, which ships with this repository and has to stay in it.`
  ].join("\n\n");
}

/**
 * The attribution the foundation owes for the code it installs.
 *
 * Not new debt: `{{FIRST_COMMAND}}` has installed shadcn/ui into every Tailwind foundation since
 * spec 66, and no generated repository carried the notice its licence requires. Spec 165 pins the
 * version and therefore had to look the licence up — which is how a two-year-old obligation nobody
 * had discharged turned out to be one line of work.
 */
function thirdPartyNotices(model: ProjectModel): string {
  const { source } = model.uiKit ?? { source: SHADCN_UI };
  const themed = model.uiKit
    ? `This project's **${model.uiKit.name}** theme is Airrow's own work and carries no third-party claim; what is licensed below is the component library it is built on.`
    : "This project installs the library's defaults — no curated theme was picked.";
  return [
    `\`${source.pkg}/ui\` \`${source.version}\` — ${source.homepage}`,
    "",
    themed,
    "",
    "```",
    source.licenceText,
    "```"
  ].join("\n");
}

/** Deterministic fallback for the design-language section — stack-correct either way. */
function uiDesignLanguage(model: ProjectModel): string {
  if (isCustomStack(model)) {
    return `Styled the way ${frameworkLabel(model)} projects style things — plainly, using whatever this stack's own convention is. No UI library is assumed on top of it.`;
  }
  return "Tailwind v4 design tokens for color, spacing, radii and type — never a hardcoded hex or pixel value in a component. shadcn/ui primitives, extended rather than forked. Dark mode first.";
}

/**
 * The real, step-by-step path from a generated foundation to a deployed, working product (spec 123).
 *
 * Deterministic — never authored. These are procedures a founder runs against live accounts, and the
 * constitution already treats that class of content differently (`SETUP_STEPS` is on the same list,
 * `authoring.ts:23`): it must be *correct*, not well phrased. A wrong key name here costs an
 * afternoon; a wrong *command* is worse. Every command below is one this file already derived —
 * `CMD_*` or the provider CLI named in `provider()` — nothing here invents a new one.
 */
function infrastructureSetup(model: ProjectModel): string {
  return [
    usesSupabase(model) ? supabaseSetupSection(model) : postgresSetupSection(model),
    hostingSetupSection(model),
    repoAndCiSection(model),
    verifyEndToEndSection(model)
  ].join("\n\n");
}

function envFileNoun(model: ProjectModel): string {
  return shipsCleanup(model) ? "this project's environment file" : "`.env.local` (copied from `.env.example`)";
}

function supabaseSetupSection(model: ProjectModel): string {
  const publicPrefix = { nextjs: "NEXT_PUBLIC_", vite: "VITE_", custom: "" }[model.stack.framework];
  const imported = shipsCleanup(model);
  return [
    "## 1. Supabase project",
    "",
    `1. ${imported ? "If you do not already have one, create" : "Create"} a project at [supabase.com](https://supabase.com) — the free tier is enough to start.`,
    "2. **Project Settings → API** has the three values this project needs:",
    "",
    `   - \`${publicPrefix}SUPABASE_URL\` — the project URL. Safe in the browser.`,
    `   - \`${publicPrefix}SUPABASE_ANON_KEY\` — the anon/public key. Safe in the browser; Row-Level Security is what actually protects the data behind it.`,
    "   - `SUPABASE_SERVICE_ROLE_KEY` — bypasses RLS entirely. **Never** give it the public prefix, never send it to the browser, never commit it. Server-only, always.",
    "",
    `3. Put all three in ${envFileNoun(model)}.`,
    "4. **Apply the migrations:** `supabase login`, then `supabase link --project-ref <ref>` (the ref is in the project URL), then `supabase db push`. Every schema change from here is a new file in `supabase/migrations` — never a dashboard edit; a dashboard edit is invisible to everyone who did not make it.",
    "5. **Auth** is on by default — nothing to enable for email/password. Social providers or SSO need their own setup under Authentication → Providers, matching what the interview named."
  ].join("\n");
}

function postgresSetupSection(model: ProjectModel): string {
  const imported = shipsCleanup(model);
  // A database the founder named is not assumed to be Postgres, so it is not told it has a
  // `DATABASE_URL` or a `psql` — what it is told is what is true of every database: a credential
  // that stays server-side, migrations that are committed, and the things it does not give you for
  // free (spec 159).
  const named = model.stack.database === "other";
  return [
    "## 1. Database",
    "",
    `1. ${imported ? "If you do not already have one, provision" : "Provision"} ${named ? `**${databaseLabel(model)}**` : `a **${databaseLabel(model)}** instance`} and note how this project connects to it.`,
    named
      ? `2. Put that connection detail in ${envFileNoun(model)} — server-only, never sent to the browser, whatever that database calls it.`
      : `2. Put \`DATABASE_URL\` in ${envFileNoun(model)} — server-only, never sent to the browser.`,
    `3. **Apply the migrations** with ${named ? "that database's own migration tool" : "whatever this stack's migration tool is"} — every schema change is a committed migration, never a hand-edit.`,
    "4. **Auth, storage and realtime updates are yours to build** — this database gives you none of them out of the box. Spec each one like any other capability, through `/createspec`."
  ].join("\n");
}

function hostingSetupSection(model: ProjectModel): string {
  if (model.hosting === "vercel") {
    return [
      "## 2. Vercel project",
      "",
      "1. Create a project at [vercel.com](https://vercel.com) and import this repository once it is pushed (step 3 below).",
      "2. **Environment Variables** (Project Settings → Environment Variables) — paste in every value from your environment file. Vercel needs its own copy; it never reads your local `.env.local`.",
      `3. Framework preset: ${model.stack.framework === "vite" ? "Vite" : "Next.js"} — Vercel usually detects it from \`package.json\`; confirm it if not.`,
      "4. Put `VERCEL_TOKEN` in this repository's CI secrets — the deploy workflow already generated for you uses it to deploy on every push, and every pull request gets its own preview URL."
    ].join("\n");
  }
  if (model.hosting === "azure") {
    return [
      "## 2. Azure App Service",
      "",
      "1. Create an **Azure App Service** for this project (App Service → Create).",
      "2. Download its publish profile and put it in CI secrets as `AZURE_WEBAPP_PUBLISH_PROFILE`; set `AZURE_WEBAPP_NAME` as a variable.",
      "3. Configure the app's own environment variables (Configuration → Application settings) with the same values as your environment file.",
      "4. The generated deploy workflow ships as a placeholder for Azure — finish it against your App Service before relying on it."
    ].join("\n");
  }
  if (model.hosting === "other") {
    // Named, not known. The steps say what is true of every target — an environment, the variables,
    // a workflow nobody here could wire — and name theirs rather than describing a server they may
    // not have (spec 159).
    return [
      `## 2. ${hostingName(model)}`,
      "",
      `1. Set up the ${hostingName(model)} environment this project deploys to, the way that target expects — one per environment if it works that way.`,
      "2. Set its environment variables to match your environment file. Nothing reads your local one.",
      `3. The generated deploy workflow ships as a placeholder: nothing here has seen ${hostingName(model)}, so the steps that reach it are yours to write. Finish them before relying on the workflow.`
    ].join("\n");
  }
  return [
    "## 2. Your own server",
    "",
    "1. Prepare the server this project deploys to — the runtime installed, a process manager, a reverse proxy in front of it.",
    "2. Set its environment variables to match your environment file.",
    "3. The generated deploy workflow ships as a placeholder for self-hosting — finish it against your own deploy process before relying on it."
  ].join("\n");
}

/**
 * The CLI step in every setup list, which is a different instruction depending on the origin.
 *
 * `/start` now installs the CLI itself (spec 159), so telling a founder to install it again is one
 * more step between them and a working repository. `/cleanup` installs nothing, so an imported
 * project still gets the full instruction.
 */
function cliSetupStep(model: ProjectModel): string {
  const vocab = provider(model);
  const purpose = `so the spec commands can read ${vocab.issueTerm}s and open pull requests`;
  return shipsCleanup(model)
    ? `Install ${vocab.cliName} and run \`${vocab.cliAuth}\`, ${purpose}.`
    : `**Sign in:** \`${vocab.cliAuth}\`, ${purpose}. \`/start\` installed ${vocab.cliName} for you — install it yourself only if it reported that it could not.`;
}

function repoAndCiSection(model: ProjectModel): string {
  const vocab = provider(model);
  // Hidden: the repository is the team's and this foundation never reaches it (spec 187). Naming a
  // pipeline it does not ship would be the defect spec 66 exists to prevent — a document describing
  // a check that is not happening.
  if (hiddenFolder(model) !== null) {
    return [
      "## 3. Git integration",
      "",
      `This foundation is not part of the repository. It sits in \`${hiddenFolder(model)}/\`, which git ignores, so`,
      "nothing here is committed, pushed or reviewed, and no pipeline ships with it.",
      "",
      `Your team's repository keeps its own branch rules and its own CI. Work the way they already work —`,
      "the spec loop below runs on top of that, not instead of it, and the verification bar in this guide",
      "is a set of commands you run yourself before you open a pull request."
    ].join("\n");
  }
  if (usesAzureRepos(model)) {
    return [
      "## 3. Git integration",
      "",
      `1. Push this foundation to an **Azure Repos** repository — ${commandName(model)} already created the \`develop\` branch locally.`,
      `2. **Register the pipelines.** Pipelines → New pipeline → Azure Repos Git → this repo → Existing YAML file: \`${vocab.ciFile}\`, then again for \`${vocab.deployFile}\`. Azure DevOps does not discover YAML from a directory the way Actions does — an unregistered pipeline simply never runs.`,
      "3. **Set the branch policies** under Repos → Branches → `main` / `develop` → Branch policies: require a pull request and a passing build.",
      `4. ${cliSetupStep(model)}`
    ].join("\n");
  }
  return [
    "## 3. Git integration",
    "",
    `1. Create an empty repository on GitHub and push this foundation — ${commandName(model)} already created the \`develop\` branch locally.`,
    "2. **Protect `main` and `develop`** (Settings → Branches): require a pull request and a passing CI check. The workflows in `.github/workflows/` start running the moment they land on GitHub — nothing else to register.",
    `3. ${cliSetupStep(model)}`
  ].join("\n");
}

function verifyEndToEndSection(model: ProjectModel): string {
  const run = packageManager(model) === "npm" ? "npm run" : "pnpm";
  const deployLine =
    model.hosting === "self_host"
      ? "3. Deploy to your server and confirm the app reaches it."
      : // `develop` is this foundation's branch, and a hidden delivery does not have one — the deploy
        // that matters there is whatever this project already does with a merged branch (spec 212).
        branchVocabulary(model) === null
        ? "3. Merge, or push to `develop` per your deploy workflow — a preview or DEV deployment should appear within a few minutes."
        : "3. Merge it the way this project merges — whatever deploy that triggers here is this project's own, and this foundation neither set it up nor changes it.";
  // A hidden foundation ships no pipeline, so "CI should go green" would be a step the founder
  // cannot take. Their team's own build is what runs on that pull request (spec 187).
  const ciLine =
    hiddenFolder(model) === null
      ? "2. Push to a branch and open a pull request — CI should run and go green."
      : "2. Run the verification commands above yourself, then push to a branch and open a pull request — your team's own build is what judges it.";
  return [
    "## 4. Verify end to end",
    "",
    `1. \`${run} dev\` locally — the app should start and reach the database.`,
    ciLine,
    deployLine,
    "",
    "If any of these three fails, stop there rather than guessing further down the list — the earlier",
    "step is almost always the real cause."
  ].join("\n");
}

/**
 * One line for the first-session table in `CLAUDE.md` (spec 159): what the founder gets for typing
 * the one command this foundation ships. A row in a table, so it is a sentence, not a paragraph.
 */
function firstCommandEffect(model: ProjectModel): string {
  return shipsCleanup(model)
    ? `Reads ${model.name} as it actually is and rewrites these documents to match. Changes no code, deletes nothing`
    : `Installs the tools, scaffolds the stack, builds the first screen and verifies it — then removes itself`;
}

/**
 * What the assistant says when a command finishes (spec 159).
 *
 * The workflow is eight commands long and a founder is running it for the first time. Knowing what
 * `/implement` did is not the same as knowing what to type next — and the gap nobody could guess is
 * the one outside the terminal: a pushed branch does not merge itself, and which button does that
 * lives in a web interface this foundation never sees. One line per command, the next action only.
 */
function afterEachCommand(model: ProjectModel): string {
  const vocab = provider(model);
  const host = repoLabel(model);
  const first = shipsCleanup(model)
    ? `| \`/cleanup\` | These documents now describe the code that is really here. Next: \`/createspec "<the first thing you want to change>"\`. |`
    : `| \`/start\` | ${model.name} runs. Next: step 2 of [START_HERE.md](START_HERE.md) — the ${databaseLabel(model)} and ${hostingName(model)} accounts only they can create — or \`/createspec "<your first change>"\` if they would rather build something first. |`;
  // A hidden foundation ships no pipeline, so "wait for the CI check" would name a check that is not
  // this project's. The team's own build is what gates their pull request (spec 187).
  const merge =
    hiddenFolder(model) !== null
      ? `Run the \`${vocab.cliPrCreate}\` line it printed, then on **${host} → Pull requests**: wait for your team's own checks, and merge the way this project merges.`
      : usesAzureRepos(model)
        ? `Run the \`${vocab.cliPrCreate}\` line it printed, then in **Azure DevOps → Repos → Pull requests**: wait for the build policy to go green, then **Complete** the PR (squash, and delete the source branch).`
        : `Run the \`${vocab.cliPrCreate}\` line it printed, then on **${host} → Pull requests**: wait for the CI check to go green, then **Squash and merge**, and delete the branch when it offers.`;
  return [
    "End every command with one short line: what to do next, and only that. Not a summary of what you",
    "just did — the founder watched that happen.",
    "",
    "| After | Tell them |",
    "| --- | --- |",
    first,
    `| \`/createspec\` | The spec and its branch exist. Next: \`/clarify\`, which asks about anything the spec left open. |`,
    `| \`/clarify\` | Every open question in the spec is answered. Next: \`/implement\`. |`,
    `| \`/implement\` | Built, tested, and the verification bar passed. Next: \`/analyze\`, which checks the work against the spec. |`,
    `| \`/analyze\` | The spec is checked off and closed. Next: \`/push\`. |`,
    `| \`/push\` | The branch is on ${host}. Next: \`/pr-check\`, which confirms it merges cleanly and prints the command that opens the pull request. |`,
    `| \`/pr-check\` | ${merge} |`,
    "| `/security` | The findings are in `SECURITY_AUDIT.md`, which is gitignored and stays on this machine. Next: read **Needs you, outside the code** — those are theirs to decide, and anything that changes behaviour goes through `/createspec` like everything else. |",
    "",
    // The route home is this foundation's only where this foundation's branch model applies. A hidden
    // one describes the team's, and naming `feature/<name> → develop → main` there would be an
    // instruction about branches it promised not to touch (spec 212).
    ...(branchVocabulary(model) === null
      ? [
          `After that merge the issue branch is finished. The same route takes the work the rest of the way:`,
          "`feature/<name>` → `develop` → `main`, one pull request each, never skipped — and the next change",
          "starts at `/createspec` again."
        ]
      : [
          "After that merge the spec's branch is finished, and the work carries on the way it always does",
          "here — this project's own route to production, which this foundation neither sets nor changes.",
          "The next change starts at `/createspec` again."
        ]),
    "",
    "If a command failed or stopped early, say what would unblock it instead. Never point at the next",
    "step of a step that did not finish."
  ].join("\n");
}

/**
 * Step 1 of `START_HERE.md`, which is a different step depending on what the founder already has
 * (spec 91).
 *
 * A new project's first move is to scaffold a stack; an imported project's is to make the documents
 * describe the stack it already has. Only the prose is rendered: the four commands that follow it
 * stay as `{{CMD_*}}` tokens in the template, so an unauthored one still reaches the founder as a
 * `[NEEDS CLARIFICATION]` marker and the manifest can still see which files the model's words are in.
 *
 * It opens with the one thing the founder installs by hand (spec 159). Everything else this project
 * needs is section 1 of `/start` — but nothing in this guide can run until there is an assistant to
 * type it into, and a founder who has to work that out from a `command not found` has been let down
 * by the first paragraph of the first file.
 */
function firstStep(model: ProjectModel): string {
  const run = [
    "**First, install [Claude Code](https://docs.claude.com/en/docs/claude-code)** — it is what reads",
    "and runs every `/command` in this guide, and this foundation is written for it. Follow its own",
    "install page and sign in when it asks; if you already have Node 20 or newer,",
    "`npm install -g @anthropic-ai/claude-code` does the same job.",
    "",
    ...(shipsCleanup(model)
      ? [
          "That is the only thing this guide asks you to install. `/cleanup` installs nothing — it reads",
          "the project you already have, so whatever builds it today is enough."
        ]
      : [
          "That is the only thing you install by hand. Git, this project's runtime, its package manager",
          "and the CLI for your repository host are all step 1 of the command below — you do not need",
          "any of them before you start."
        ]),
    "",
    // A hidden foundation does not own the repository root, and Claude Code finds `CLAUDE.md` and
    // `.claude/commands/` from where the session starts (spec 187). Told once, here, in the first
    // file anyone opens — a founder who starts at the root gets "unknown command" and no reason why.
    ...(hiddenFolder(model) === null
      ? ["Then open Claude Code in this repository and run:"]
      : [
          `Then open Claude Code **in \`${hiddenFolder(model)}/\`** — this foundation lives there, and`,
          "that is where its commands and rules are found. Starting at the repository root instead",
          "leaves them undiscovered, and the command below will not exist. Then run:"
        ]),
    "",
    "```",
    commandName(model),
    "```",
    ""
  ];
  if (shipsCleanup(model)) {
    return [
      ...run,
      `It reads ${model.name} as it actually is — the stack, the structure, the commands that really`,
      "work — and rewrites the documents in this foundation to describe *that* project.",
      // Only the integrated command sets branches up (spec 91). Hidden's `/cleanup` is forbidden from
      // creating one — nothing outside the folder may change — so promising it here would be the
      // first file the founder opens describing something that will not happen (spec 212).
      ...(branchVocabulary(model) === null
        ? [
            "It also creates",
            "the local branches this workflow runs on, and only the ones you do not have yet. It changes no",
            "code: not a dependency, not a config file, not a migration. It deletes nothing either, renames no",
            "file of yours, and touches no remote. It is safe to run again."
          ]
        : [
            "It creates no branches and changes",
            "nothing outside this folder — not a dependency, not a config file, not a document of your",
            "team's. It deletes nothing, renames no file of yours, and touches no remote. It is safe to run",
            "again."
          ]),
      "",
      "When it finishes, the commands these documents name are the ones that actually work here:"
    ].join("\n");
  }
  const vocab = provider(model);
  return [
    ...run,
    "It works through six steps and prints a progress bar after each one, so you can see where it is:",
    "",
    `- **1 · Tools** — checks for git, this stack's runtime and ${vocab.cliShort}, and installs only`,
    "  what is missing. It signs in to nothing.",
    "- **2 · Stack** — the framework and the toolchain, so the four commands below are real.",
    "- **3 · Git** — a local repository on `main`, plus `develop` and your first `feature/<name>`.",
    `- **4 · The first screen** — ${model.name}'s core action, built and finished.`,
    "- **5 · Verify** — every command run, with its real output shown.",
    "- **6 · Hand back** — this step rewritten, and the command removed.",
    "",
    `It leaves you the smallest version of ${model.name} that actually runs — enough to open, change`,
    "and continue from, and no more. Beyond installing those tools it touches nothing outside this",
    "directory: no accounts, no services, no secrets, and nothing you have to sign in to.",
    "",
    "Safe to run again if it stops early. Once it has finished and verified the result, it rewrites this",
    "step to say so and removes itself — there is nothing left for it to do, and everything after it goes",
    "through the loop in section 5.",
    "",
    "When it finishes, these are real commands:"
  ].join("\n");
}

/**
 * The rule in the generated constitution that says where this project's command stops and the spec
 * loop starts (spec 91).
 *
 * Both commands have a ceiling, and they are different ceilings: `/start` may build up to the
 * minimum that runs, `/cleanup` may not touch code at all. A generated repository carrying the wrong
 * one states a rule its own command breaks.
 */
function commandRule(model: ProjectModel): string {
  if (shipsCleanup(model)) {
    return [
      "- **`/cleanup` describes, the spec loop builds.** `/cleanup` reads this project and makes the",
      "  documents match what is actually here. It changes no code and deletes nothing — that is its",
      "  ceiling, not a starting budget. Everything that changes the project itself goes through a spec:",
      "  no spec, no feature."
    ].join("\n");
  }
  return [
    "- **`/start` sets up, the spec loop builds.** `/start` scaffolds the stack and builds the MVP",
    "  focus for real, to the design in `docs/architecture/UI_ARCHITECTURE.md`. That is its ceiling —",
    "  not a second feature, not schema, not real auth. Everything past it goes through a spec: no",
    "  spec, no feature."
  ].join("\n");
}

/**
 * Where `SYSTEM_OVERVIEW.md` says its contents came from (spec 212).
 *
 * This is the document with the most to lose from being confidently wrong: it describes an
 * architecture, and for an imported project its reader can open the code and check. Nobody read that
 * code — the analysis reads manifests, names and versions, never source — so every claim below the
 * heading is derived from an interview. Saying so costs two sentences and turns a document that
 * might be wrong into one that is honest about what it is.
 *
 * Only the fallback rendering passes through here; in production this file is authored whole
 * (`AUTHORED_DOCUMENTS`), and the prompt carries the same instruction. Both paths need it, because
 * the fallback is what a founder gets when authoring is unavailable.
 */
function systemOverviewProvenance(model: ProjectModel): string {
  const base = "A living, high-level map of the system. Keep it short and current.";
  if (!shipsCleanup(model)) return base;
  return [
    base,
    "",
    "> **Written from the interview, not from the code.** Nobody read this codebase to produce this",
    "> document: the import analysis reads manifest files — names and versions — and the rest is what",
    "> you confirmed in the interview. Treat everything below as a claim to check rather than a",
    "> description of what is there. `/cleanup` reads the project and rewrites this document to match it."
  ].join("\n");
}

/**
 * What `START_HERE.md` may conclude from four green commands (spec 212).
 *
 * Greenfield, `/start` just built the project and the four commands are this foundation's own, so
 * "the foundation is working" is exactly what they prove. For an import they are the *team's*
 * commands, run against a codebase with its own history: a red test there is news about their
 * project, not about this foundation, and it may well have been red before the download finished.
 * `DEVELOPER_GUIDE.md` already says "note known pre-existing failures"; this file did not.
 */
function verificationBarClaim(model: ProjectModel): string {
  if (!shipsCleanup(model)) {
    return [
      "If all four are clean, the foundation is working. This is the **verification bar** — every change you",
      "make from here has to pass it before it merges."
    ].join("\n");
  }
  return [
    "These are this project's own commands, not this foundation's — so what they tell you is where the",
    "project stands today. Note anything already failing before you change a thing: a test that was red",
    "this morning is not something you broke, and knowing which is which is worth the two minutes.",
    "",
    "That set is the **verification bar** — every change you make from here has to leave it no worse than",
    "you found it. If any of the four does not exist in this project, say so rather than inventing one;",
    "`/cleanup` rewrites these documents to name the commands that are really here."
  ].join("\n");
}

/**
 * `DEVELOPER_GUIDE.md`'s setup section (spec 212).
 *
 * Greenfield it is one line, and that is right: `/start` has just built the project, so starting it
 * is the dev server and nothing else. An imported project is not set up by running its dev server —
 * it is cloned, its dependencies installed, its environment file filled in from whatever the team
 * shares — and none of that is knowable from here. Saying so, and pointing at the two places that do
 * know, beats a one-line instruction that skips the part where it fails.
 */
function setupSection(model: ProjectModel, summary: string, commands: Commands): string {
  if (!shipsCleanup(model)) {
    return ["## Setup", "```bash", `${commands.CMD_DEV}        # start the dev server`, "```", summary].join(
      "\n"
    );
  }
  return [
    "## Setup",
    "",
    "This project was running before this foundation arrived, so its setup is whatever it already was:",
    "the clone, the dependency install, and the environment file your team shares. Where that is",
    "written down — a README, an onboarding note, a script — that is still the place; nothing here",
    "replaced it.",
    "",
    "Once it is set up, this is the command these documents name for running it:",
    "",
    "```bash",
    `${commands.CMD_DEV}        # start the dev server`,
    "```",
    "",
    `${summary}`,
    "",
    "`/cleanup` checks that line and the ones below against the repository, and rewrites them where they",
    "are wrong. Until it has run, treat every command in these documents as a claim rather than a fact.",
    "",
    "**Getting to a deployed product**, below, is still worth reading end to end: it is written for a",
    "project that has its accounts already, and names what this workflow needs from each one."
  ].join("\n");
}

/**
 * `docs/README.md`'s opening (spec 212).
 *
 * "Root keeps only `README.md`, `START_HERE.md`, and `CLAUDE.md`" is a rule about a repository this
 * foundation created. Said to an imported project it is simply false — the root has whatever years of
 * work put there — and in hidden mode the word "root" does not even mean the repository.
 *
 * The `existingDocs` answer lands here too, because this is the index: someone looking for where a
 * decision is written down reads this file to find out, and which set of documents answers that is
 * exactly what the founder was asked.
 */
function docsIndexIntro(model: ProjectModel): string {
  // Same reasoning as `readFirst`: the claim being corrected is about the repository's *layout*, and
  // a documents-only import has files at its root exactly like any other import.
  if (!isImport(model)) {
    return [
      "Root keeps only `README.md`, `START_HERE.md`, and `CLAUDE.md`; everything else is here. **Rules and",
      "workflow live in the single source of truth,",
      "[`../.claude/spec-kit/constitution.md`](../.claude/spec-kit/constitution.md).**"
    ].join("\n");
  }
  const folder = hiddenFolder(model);
  const scope =
    folder === null
      ? [
          "These are the foundation's documents. Your project's own files stay wherever your project keeps",
          "them — nothing here claims the repository's layout, and nothing here reorganised it."
        ]
      : [
          `These are the foundation's documents, and they live inside \`${folder}/\` with the rest of it. The`,
          "repository around them is untouched, and its layout is its own."
        ];
  const existing = {
    describe: [
      "Where your project already documents something, that document stays the one that covers it; these",
      "describe how the project is worked on."
    ],
    adopt: [
      "New decisions are recorded here from now on — that is what you chose. Nothing of yours was moved,",
      "rewritten or deleted to make room for it."
    ],
    leave: [
      "Your project's existing documents are deliberately out of scope here; these stand on their own and",
      "say nothing about them."
    ]
  }[model.existingDocs];
  return [
    ...scope,
    "",
    ...existing,
    "",
    "**Rules and workflow live in the single source of truth,",
    "[`../.claude/spec-kit/constitution.md`](../.claude/spec-kit/constitution.md).**"
  ].join("\n");
}

/**
 * `README.md`, which is a different document depending on whose repository it lands in (spec 212).
 *
 * Greenfield, it *is* the project's README: the repository is the foundation, and this file is its
 * front door. Neither is true of an import. Integrated, the founder already has a README and this one
 * arrives beside it as `README.airrow.md` (spec 91) — a file introducing itself as the project's
 * front door while sitting next to the real one is confusing on sight. Hidden, it is the README of an
 * ignored folder, and the project's own is a directory up.
 *
 * So an imported foundation's README says what it is: the foundation, what came with it, and where
 * to start. That reads correctly in both import layouts, and it is honest about a file the founder
 * may well end up renaming over their own — which stays their decision, exactly as spec 91 has it.
 */
function readmeTitle(model: ProjectModel): string {
  return shipsCleanup(model) ? `# ${model.name} — the engineering foundation` : `# ${model.name}`;
}

function readmeOrientation(model: ProjectModel): string {
  if (!shipsCleanup(model)) {
    return [
      "> **New here? Start with [START_HERE.md](START_HERE.md)** — setup, the first spec, and the loop you",
      "> repeat from then on."
    ].join("\n");
  }
  const where =
    hiddenFolder(model) === null
      ? "This is not the project's README — yours is the one beside it, and it stays yours."
      : `This is the README of \`${hiddenFolder(model)}/\`, not of the repository. The project's own is a directory up, untouched.`;
  return [
    `> **This describes the foundation, not the codebase.** ${where}`,
    "> What landed here is the workflow, the rules and the documents the project is worked on *through*.",
    ">",
    "> **Start with [START_HERE.md](START_HERE.md)**, then run `/cleanup` — it reads the code that is",
    "> actually here and rewrites these documents to describe it."
  ].join("\n");
}

/** Where `README.md` sends a reader for the branch rules — which are not always this foundation's. */
function readmeWorkflowPointer(model: ProjectModel): string {
  return branchVocabulary(model) === null
    ? [
        "Read [CLAUDE.md](CLAUDE.md) first. Branch direction is strict — see",
        "[docs/architecture/BRANCHING.md](docs/architecture/BRANCHING.md)."
      ].join("\n")
    : [
        "Read [CLAUDE.md](CLAUDE.md) first. Branches are this project's own, not this foundation's — see",
        "[docs/architecture/BRANCHING.md](docs/architecture/BRANCHING.md)."
      ].join("\n");
}

/**
 * `CLAUDE.md`'s opening line, and the section heading above the product description (spec 212).
 *
 * "New to this project?" is addressed to someone meeting a repository for the first time, and "What
 * we're building" is written before there is anything to build. Both are true of a founder who
 * started from nothing and false of one who arrived with a running codebase — they wrote it, and it
 * is already built.
 */
function firstSessionIntro(model: ProjectModel): string {
  return shipsCleanup(model)
    ? "**First session in this foundation? Type one of these. That is the whole of it.**"
    : "**New to this project? Type one of these. That is the whole first session.**";
}

function productHeading(model: ProjectModel): string {
  return shipsCleanup(model) ? "What this is" : "What we're building";
}

/**
 * Step 2 of that table — the accounts.
 *
 * A new project has none of them and creating them is most of its first day. An imported project is
 * deployed already: the same walkthrough is still worth reading, because the foundation's workflow
 * expects a CLI signed in and an environment file it can name, but presenting it as "the accounts
 * only you can create" describes a day the founder had years ago.
 *
 * The greenfield row is reproduced byte for byte, padding included: this table is the first thing
 * anyone reads and its columns line up in the source.
 */
function firstSessionStepTwo(model: ProjectModel): string {
  return shipsCleanup(model)
    ? `| 2    | "read START_HERE.md and walk me through it" | What this workflow still needs from your accounts        |`
    : `| 2    | "read START_HERE.md and walk me through it" | The accounts only you can create — one at a time, in order       |`;
}

/**
 * `CLAUDE.md`'s reading list, which gains an entry when the project brought documents of its own
 * (spec 212, consuming the question spec 199 added).
 *
 * `existingDocs` had no reader at all until this spec: it was asked, validated and stored, and
 * changed nothing anywhere — which §0 says makes it a question that should not be asked. What it
 * decides is what an assistant is told to do when this foundation's documents and the team's own
 * disagree, and that is a genuinely different instruction for each of the three answers.
 */
function readFirst(model: ProjectModel): string {
  const base = [
    "1. **`.claude/spec-kit/constitution.md`** — the single source of truth for all rules. When any file",
    "   disagrees with it, the constitution wins.",
    "2. The spec for your issue in `/specs` (`specs/NNN-kort.md`).",
    "3. `docs/VISION.md` — what this becomes if it wins.",
    "4. `docs/architecture/SYSTEM_OVERVIEW.md` and `docs/guides/DEVELOPER_GUIDE.md`."
  ];
  // Asked through the origin rather than `shipsCleanup`, which means "arrived with code". A
  // documents-only import brought no code and gets `/start` — but documents are precisely what it
  // *did* bring, so it is the last project whose answer to this question should be dropped.
  if (!isImport(model)) return base.join("\n");
  const existing = {
    describe: [
      "5. **The documents this project already had** — its README, decision records, contributing notes.",
      "   They stay where they are and stay authoritative about what they cover; these documents describe",
      "   the workflow around them. Where the two disagree about the code, the repository settles it."
    ],
    adopt: [
      "5. **The documents this project already had** — read them, then record new decisions *here*. The",
      "   founder chose these documents as where the project's decisions live from now on. That is a",
      "   change of habit, not of files: nothing of theirs is rewritten or deleted, by you or by any",
      "   command in this foundation."
    ],
    leave: [
      "5. **The documents this project already had are out of scope.** The founder asked this foundation",
      "   to stand on its own. Read them if they answer a question you have, and change nothing about",
      "   them — do not reconcile them with these, and do not propose that they go."
    ]
  }[model.existingDocs];
  return [...base, ...existing].join("\n");
}

/**
 * What `/cleanup` must treat as unverified (spec 91).
 *
 * These documents were written from an interview, and the interview was prefilled by a deterministic
 * import analysis that reads manifests — not by reading the code. Every stack claim in them is
 * therefore a hypothesis, and saying so is what turns `/cleanup` from a proofreader into a check.
 */
function cleanupClaim(commands: Commands, stackName: string): string {
  const { CMD_DEV, CMD_BUILD, CMD_TYPECHECK, CMD_LINT, CMD_TEST } = commands;
  return [
    "These documents were written from an interview about this project, not from reading it. They",
    `currently claim the stack is **${stackName}**, and that these are the commands:`,
    "",
    "```bash",
    [CMD_DEV, CMD_BUILD, CMD_TYPECHECK, CMD_LINT, CMD_TEST].join("\n"),
    "```",
    "",
    "Treat every line of that as a claim to check, never as a fact. Where a document and the repository",
    "disagree, **the repository is right** — change the document."
  ].join("\n");
}

/**
 * Which files `/cleanup` may rewrite (spec 91).
 *
 * Stated as a rule with examples rather than a fixed list, so it cannot drift from what the template
 * actually ships. The exclusions are the load-bearing half: the founder's own documents are theirs,
 * and a command allowed to rewrite the constitution is a command that can widen its own limits.
 */
function cleanupScope(model: ProjectModel): string {
  const folder = hiddenFolder(model);
  if (folder !== null) {
    return [
      `**Yours to rewrite** — every document this foundation shipped, all of which are under`,
      `\`${folder}/\`: \`${folder}/README.md\`, \`${folder}/START_HERE.md\`, \`${folder}/CLAUDE.md\`,`,
      `everything under \`${folder}/docs/\`, and \`${folder}/specs/README.md\`.`,
      "",
      "**Read, never rewrite:**",
      "",
      `- **Everything outside \`${folder}/\`.** The whole project. Read as much of it as you need —`,
      "  that is how you learn what to write — and change none of it. There are no `.airrow` files to",
      "  reconcile here: nothing this foundation shipped shares a path with anything the project has.",
      `- \`${folder}/.claude/spec-kit/constitution.md\` and \`${folder}/.claude/spec-kit/spec-template.md\`.`,
      "  The constitution governs every other file, including this command; a command that edits it can",
      "  widen its own limits.",
      `- \`${folder}/.claude/commands/\`. These are the workflow itself.`,
      `- Existing specs in \`${folder}/specs/\`. They are decisions that were made, not documentation to`,
      "  correct."
    ].join("\n");
  }
  return [
    "**Yours to rewrite** — every document this foundation shipped: `README.md`, `START_HERE.md`,",
    "`CLAUDE.md`, everything under `docs/`, and `specs/README.md` — including any that arrived as",
    "`<name>.airrow.md` beside a file of the founder's (section 4).",
    "",
    "**Read, never rewrite:**",
    "",
    "- The founder's own documents — anything this foundation did not ship. Read them for context, and",
    "  say in your report what you learned from them.",
    "- `.claude/spec-kit/constitution.md` and `.claude/spec-kit/spec-template.md`. The constitution",
    "  governs every other file, including this command; a command that edits it can widen its own",
    "  limits.",
    "- `.claude/commands/`. These are the workflow itself.",
    "- Existing specs in `specs/`. They are decisions that were made, not documentation to correct."
  ].join("\n");
}

/**
 * What `/cleanup` is allowed to touch, which is the whole difference between the two layouts
 * (spec 187).
 *
 * Integrated, it works across the founder's tree: documents that arrived beside theirs, the branch
 * model, the instruction files they accumulated. Hidden, the foundation lives in one folder that git
 * ignores, and the point of the mode is that nothing outside it changes — so the command's job stops
 * at the folder's edge and turns into making sure what is inside it actually works.
 */
function cleanupMode(model: ProjectModel): string {
  const folder = hiddenFolder(model);
  if (folder === null) {
    return [
      "**Where this foundation shipped a document the project already had**, both are on disk — theirs",
      "at its own path, this foundation's beside it as `.airrow` (section 4).",
      "",
      "It does create the local branches this workflow runs on (section 5) — never renaming or deleting",
      "one, never rewriting history, never pushing."
    ].join("\n");
  }
  return [
    `**This foundation is hidden.** Everything it ships lives under \`${folder}/\`, which git is told`,
    "to ignore, so none of it is ever pushed and nobody else on this project sees it.",
    "",
    `**Nothing outside \`${folder}/\` may change.** Not a document, not a branch, not a config file,`,
    "not the team's own `CLAUDE.md`, `.cursorrules` or `AGENTS.md` — those belong to everyone working",
    "here, and rewriting them is exactly the visible change this layout exists to avoid. Read them for",
    "context; leave every one of them alone.",
    "",
    "**The branch model is already theirs.** Do not create `develop`, do not create a `feature/`",
    "branch, do not touch the trunk. This project has a workflow and a team using it; the foundation",
    "adapts to that, not the other way round."
  ].join("\n");
}

/**
 * The branch model this foundation's workflow runs on — one answer, read by three documents
 * (spec 212).
 *
 * Everywhere but a hidden import that is Airrow's own hierarchy, because a greenfield repository has
 * no model of its own and an integrated foundation is being adopted into one (`/cleanup` creates the
 * missing branches locally, spec 91). Hidden is the case this exists for: it promises the team's
 * repository keeps its branch rules and is never pushed at all, so prescribing a hierarchy over a
 * team that branches differently would be this foundation contradicting its own first promise. There
 * the founder is asked, and the documents describe what they answered.
 *
 * Nothing here is an instruction to the team. A hidden foundation cannot create a branch, rename one
 * or open a pull request — what these words decide is which branches the *documents* name when they
 * describe where a spec's work goes.
 */
interface BranchVocabulary {
  /** One sentence naming where a spec's work lives. */
  shape: string;
  /** Where it goes when it is done. */
  destination: string;
}

function branchVocabulary(model: ProjectModel): BranchVocabulary | null {
  if (model.branching === null) return null;
  if (model.branching.model === "trunk") {
    return {
      shape: "Each spec gets its own short-lived branch off this project's trunk, named the way this repository names branches.",
      destination: "It goes back into the trunk the way work here always does — this project's review and merge rules, unchanged."
    };
  }
  if (model.branching.model === "integration_branch") {
    return {
      shape: "Each spec gets its own branch off this project's integration branch, named the way this repository names branches.",
      destination: "It merges back into that integration branch, and reaches the trunk on this project's own release — not on anything this foundation does."
    };
  }
  // "Something else" with nothing typed into it. The founder told us their model is not one of the
  // two named — which is worth knowing — and told us nothing more. Quoting an empty answer would
  // print a dangling colon, and filling the gap would invent the very hierarchy this branch exists to
  // avoid asserting. So the document describes what the workflow needs and leaves the model to
  // `/cleanup`, which can read the branches that actually exist.
  const described = model.branching.describedByFounder;
  if (described === "") {
    return {
      shape: "Each spec gets its own branch, cut and named the way this project already works — which is not a shape this foundation was told, so it names none.",
      destination: "It merges back however work here merges. `/cleanup` reads the branches this repository actually has and writes them into this document."
    };
  }
  return {
    shape: `Each spec gets its own branch, cut and named the way this project already works: ${sentence(described)}`,
    destination: "It merges back the way work here always merges. This foundation does not change any of that, and never could — it is not part of the repository."
  };
}

/**
 * The generated constitution's branch rule (spec 212).
 *
 * This is the one that mattered most and was missed on the first pass. The constitution opens by
 * saying it is the single source of truth and that **it wins** when any other file disagrees — so a
 * hidden foundation whose `BRANCHING.md` says "this project's branches are the ones that apply",
 * shipped beside a constitution ruling that PRs go `feature/<name>` → `develop` → `main`, does not
 * merely contradict itself: it contradicts itself with a documented winner, and the winner is the
 * wrong one. Fixing `BRANCHING.md` alone made the contradiction worse than leaving both.
 *
 * What survives in every variant is the part that is actually load-bearing for the spec loop: one
 * branch per spec, and a pull request rather than a push to a shared branch. That fits inside any
 * branch model, which is why it can be stated as a rule without prescribing a hierarchy.
 */
function constitutionBranchRule(model: ProjectModel): string {
  if (branchVocabulary(model) === null) {
    return [
      "- Branch `NNN-kort` (issue number + short name, **no** `issue/` prefix) is cut from its",
      "  `feature/<name>`. **PR direction is strict and never skipped:** issue branch → its `feature/<name>`",
      "  → `develop` → `main`. An issue branch is **never** PR'd to `main` or `develop`."
    ].join("\n");
  }
  return [
    "- **One branch per spec, and it reaches the trunk the way this project's branches always do.**",
    "  This foundation prescribes no branch model and could not enforce one — it lives in an ignored",
    "  folder and is never pushed. Which branch a spec is cut from, what it is called, and what it",
    "  merges into are this repository's rules, and they are unchanged by anything here.",
    "  See [`../../docs/architecture/BRANCHING.md`](../../docs/architecture/BRANCHING.md).",
    "- **Never commit straight to a branch this team shares.** Whatever this project treats as shared —",
    "  the trunk, a long-lived integration branch — takes changes through its own review, never through",
    "  a command in this foundation."
  ].join("\n");
}

/** The `Branch` row every spec file carries in its header. */
function specBranchRow(model: ProjectModel): string {
  return branchVocabulary(model) === null
    ? "| **Branch**     | `NNN-kort` (from `feature/<name>`)   |"
    : "| **Branch**     | `NNN-kort` (from this project's own) |";
}

/** `/implement`'s first step, which checks the branch a spec is being built on. */
function implementBranchCheck(model: ProjectModel): string {
  return branchVocabulary(model) === null
    ? "matches the spec's issue and was cut from the stated `feature/<name>`. If it\n   doesn't match, stop and ask — never branch off `main`."
    : "matches the spec's issue and was cut from the branch the spec names. If it\n   doesn't match, stop and ask. Never build a spec directly on a branch this team shares.";
}

/** `/analyze`'s PR-direction check, and the command it hands over at the end. */
function analyzePrDirection(model: ProjectModel): string {
  return branchVocabulary(model) === null
    ? "intended target is the spec's `feature/<name>`, **never** `main`/`develop`."
    : "the target is the branch this spec was cut from, and never a branch this team\n   shares without their own review. If the spec does not name one, say so rather than guessing.";
}

function analyzePrCommand(model: ProjectModel, vocab: ProviderVocabulary): string {
  return branchVocabulary(model) === null
    ? `issue branch → its \`feature/<name>\`, e.g.\n   \`${vocab.cliPrCreate}\`. Never propose a PR to \`main\`/\`develop\`.`
    : `the spec's branch → the branch it was cut from, e.g.\n   \`${vocab.cliPrCreate}\`. Follow this project's own rules about what may target what.`;
}

/** `START_HERE.md`'s first-session table row for `/pr-check`. */
function startTablePrRow(model: ProjectModel): string {
  return branchVocabulary(model) === null
    ? "| 6    | `/pr-check`                             | Merge-safety check, then open the PR into your `feature/<name>`         |"
    : "| 6    | `/pr-check`                             | Merge-safety check, then open the PR the way this project opens them    |";
}

/**
 * How `/pr-check` decides what a branch is heading for (spec 212).
 *
 * Greenfield it is derived from the hierarchy, which this foundation created and therefore knows.
 * Hidden it cannot be derived at all: the branches belong to a repository this foundation has never
 * seen, so the honest instruction is to look and to ask rather than to infer a `develop` that may not
 * exist.
 */
function prCheckTarget(model: ProjectModel): string {
  if (branchVocabulary(model) === null) {
    return [
      "**Target branch** = `$ARGUMENTS` if given, else infer from the hierarchy in",
      "@.claude/spec-kit/constitution.md:",
      "- On an issue branch `NNN-kort` → target its `feature/<name>` (never `develop`/`main`).",
      "- On a `feature/<name>` branch → target `develop`.",
      "- On `develop` → target `main`.",
      "If the parent feature is ambiguous, ask — never default to `main`."
    ].join("\n");
  }
  return [
    "**Target branch** = `$ARGUMENTS` if given, else the branch this one was cut from — this project's",
    "own, not one this foundation invented. `git merge-base` against the likely candidates, or the",
    "trunk from `git symbolic-ref refs/remotes/origin/HEAD`, will usually show it.",
    "",
    "**If it is not obvious, ask.** Do not infer a `develop` or a `feature/*` from these documents:",
    "this foundation ships no branch model and does not know how this repository is organised. Guessing",
    "a target here means checking a merge that nobody is going to make."
  ].join("\n");
}

/** `/push`'s guard, which names branches only this foundation's own model has (spec 212). */
function pushBranchGuard(model: ProjectModel): string {
  return branchVocabulary(model) === null
    ? "Get the current branch. If it is `main` or `develop`, **stop** and refuse — those\n   only receive changes via PR (see @.claude/spec-kit/constitution.md). Otherwise continue."
    : "Get the current branch. If it is a branch this team shares — the trunk, or a\n   long-lived integration branch — **stop** and refuse: those receive changes through this project's\n   own review process, whatever it is. If you cannot tell whether a branch is shared, ask before\n   pushing. Otherwise continue.";
}

function pushReportLine(model: ProjectModel): string {
  return branchVocabulary(model) === null
    ? "If it's a `feature/*` branch, note the push\n   auto-deploys to DEV; `<nr>-kort` issue branches do not deploy."
    : "Whether the push triggers anything is this project's\n   own CI — this foundation ships none and never reaches the remote.";
}

/**
 * `/createspec`'s branch step, which is where the branch model stops being a document and starts
 * running `git` (spec 212).
 *
 * The greenfield version is reproduced exactly. The hidden version had to change for a reason
 * stronger than tone: it ends in `git push` of a `feature/*` branch to the team's remote. A layout
 * whose entire promise is that the repository's diff stays empty cannot ship a command that creates
 * remote branches on the founder's first spec, and "no document instructs a change outside the
 * folder" has to hold for the commands too — they are the documents that act.
 */
function createspecBranchStep(model: ProjectModel, vocab: ProviderVocabulary): string {
  if (branchVocabulary(model) === null) {
    return [
      `Determine the parent \`feature/<name>\` — the ${vocab.boardTerm} the`,
      `   ${vocab.issueTerm} belongs to. **Always ask which \`feature/*\` branch the branch should be based on** —`,
      "   never assume, never default to `main`/`develop`. List available feature branches",
      '   (`git branch -a --list "*feature/*"`) and ask via `AskUserQuestion`.',
      `   - If already on \`NNN-<kort>\` matching this ${vocab.issueTerm}, keep it — no sync.`,
      "   - Otherwise: `git checkout feature/<name> && git pull`, then **sync the feature branch with",
      `     \`develop\` (below)**, and only then create and link the branch with \`${vocab.cliBranchLink}\`. Linking`,
      `     is what lets the tracker close the ${vocab.issueTerm} when the branch merges. If the link step is`,
      "     unavailable, fall back to `git checkout -b NNN-<kort>` and say it was not linked.",
      `   - For a description-based spec (no ${vocab.issueTerm} yet): \`git checkout -b NNN-<kort>\`; no sync.`,
      "   - Respect the constitution's PR-direction rule; issue branches never target `main`/`develop`.",
      "   - **Sync `feature/<name>` with `develop` before cutting the issue branch**, so the new branch is",
      "     born with everything already integrated instead of discovering the drift as conflicts in its PR:",
      "     1. `git status --porcelain --untracked-files=no -- . ':(exclude).claude/settings.local.json'` —",
      "        if that reports anything, **stop** and list the files. Commit or stash them yourself; never",
      "        stash, merge over, or commit on the user's behalf. The exclusions are deliberate:",
      "        `.claude/settings.local.json` is machine-local and `/push` never commits it, so a plain",
      "        `git status --porcelain` would block every run; untracked files are ignored because a merge",
      "        does not touch them (git refuses on its own if one is in the way).",
      "     2. `git fetch origin develop`, then `git log feature/<name>..origin/develop --oneline`. Empty",
      "        means in sync — skip straight to creating the branch, no empty merge commit.",
      "     3. Otherwise `git merge origin/develop` into `feature/<name>` and push it. On conflict, **stop**",
      "        and name the conflicting files; **leave the half-merged tree in place** (never `git merge",
      "        --abort`) so no resolution work is thrown away, and continue once it is committed. If the push",
      "        is rejected, `git pull` and retry it once, then stop and report.",
      "   - `develop` is merged **into the feature branch**, never straight into an issue branch — that would",
      `     drag unrelated history into the ${vocab.issueTerm}'s PR to \`feature/<name>\`.`,
      "   - **The sync is blocking, not best-effort:** any failure — conflict, dirty tree, rejected push, no",
      "     network — stops spec creation with the problem named, rather than cutting a branch from stale code."
    ].join("\n");
  }
  return [
    "**This project's branch rules apply, not this foundation's** — see",
    "   [BRANCHING.md](../../docs/architecture/BRANCHING.md). One branch per spec is all the workflow",
    "   needs; where it is cut from and what it is called are this repository's business.",
    `   - If already on a branch for this ${vocab.issueTerm}, keep it.`,
    "   - Otherwise **ask** which branch to cut from — `git branch -a`, and offer the checked-out branch",
    "     and the trunk (`git symbolic-ref refs/remotes/origin/HEAD`) via `AskUserQuestion`. Never assume,",
    "     and never create `develop` or a `feature/*` branch because these documents mention one.",
    "   - Name the branch the way this repository names branches. If that is not obvious from",
    "     `git branch -a`, ask rather than inventing a convention the team does not use.",
    "   - **Pull, never push.** Bring the base branch up to date (`git pull`) before cutting, and stop",
    "     there: this foundation is not part of the repository, so nothing here pushes a branch, creates",
    "     one on the remote, or opens a pull request without the founder doing it themselves.",
    "   - **Do not sync anything on the founder's behalf.** If the base branch is behind, say so and let",
    "     them decide — merging one shared branch into another is their call and their team's convention.",
    "   - If the working tree is dirty",
    "     (`git status --porcelain --untracked-files=no`), **stop** and list the files. Never stash, merge",
    "     over, or commit on the user's behalf."
  ].join("\n");
}

/** The one line of `/createspec`'s report that only exists where there is a `develop` to sync from. */
function createspecReportLine(model: ProjectModel): string {
  return branchVocabulary(model) === null
    ? "Say\n   whether `feature/<name>` was synced with `develop` and how many commits it brought in (or that it\n   was already in sync)."
    : "Say which branch it was cut from, and whether that branch\n   was behind — reporting it, not fixing it.";
}

/**
 * `CLAUDE.md`'s branching section (spec 212).
 *
 * The greenfield text is reproduced exactly, with the provider words interpolated here rather than
 * left as tokens: substitution is one pass, so a `{{TOKEN}}` inside a substituted value would ship
 * to the founder unresolved (the same reason `integratedRepoWork` interpolates its CI file).
 */
function branchingSummary(model: ProjectModel, vocab: ProviderVocabulary): string {
  const branches = branchVocabulary(model);
  if (branches === null) {
    return [
      `We work via ${repoLabel(model)}: a **feature** is a ${vocab.boardTerm}, **${vocab.issueTerm}s** are linked to it. Branch hierarchy:`,
      "`main` ← `develop` ← `feature/<name>` ← `<nr>-kort` (issue branch, no `issue/` prefix). PR direction",
      "is strict and never skipped: `<nr>-kort` → its `feature/<name>` → `develop` → `main`. **Never** PR an",
      "issue branch to `main`/`develop`. Full detail in `docs/architecture/BRANCHING.md`."
    ].join("\n");
  }
  return [
    `We work via ${repoLabel(model)}: a **feature** is a ${vocab.boardTerm}, and **${vocab.issueTerm}s** are linked to it.`,
    "",
    `**This project's branch rules are the ones that apply, not this foundation's.** ${branches.shape}`,
    `${branches.destination}`,
    "",
    "This foundation ships no branch model of its own and could not enforce one: it lives in an ignored",
    "folder, is never pushed, and nothing in it runs on anybody's pull request. Full detail in",
    "`docs/architecture/BRANCHING.md`."
  ].join("\n");
}

/**
 * `BRANCHING.md`'s body, above the CI section (spec 212).
 *
 * Everywhere but a hidden import this is the document as it has always read, byte for byte. Hidden
 * is where it had to change: it prescribed `main ← develop ← feature/<name> ← <nr>-<short>` and a
 * numbered workflow of `git checkout`s against a repository this foundation may not touch, one
 * section above a CI note explaining that the team's rules are the ones that apply. Two instructions
 * in one file, disagreeing.
 */
function branchModelSection(model: ProjectModel, vocab: ProviderVocabulary): string {
  const branches = branchVocabulary(model);
  if (branches === null) {
    return [
      `We work via ${repoLabel(model)}. A **feature** is a ${vocab.boardTerm}, and **${vocab.issueTerm}s** are linked`,
      `to that feature. Each ${vocab.issueTerm} gets a spec in [\`../../specs/\`](../../specs/) and its own branch.`,
      "",
      "## Branch hierarchy",
      "```",
      "main               -> production",
      "develop            -> integration; tested against the DEV environment",
      "feature/<name>     -> a feature (= one project board); branched from develop, deploys continuously to DEV",
      "<nr>-<short>       -> an issue; branched from ITS feature, PR'd back into the feature",
      "```",
      "",
      "Issue branches are named `<nr>-<short>` (issue number + short name), **without** the `issue/` prefix.",
      "",
      "## Workflow",
      "1. **Start a feature** (once per project board):",
      "   git checkout develop && git pull",
      "   git checkout -b feature/<name>",
      "   git push -u origin feature/<name>",
      "2. **Take an issue** from the feature:",
      "   git checkout feature/<name> && git pull",
      "   git merge origin/develop && git push   # only if the feature is behind — `/createspec` does this for you",
      "   git checkout -b <nr>-<short>",
      "3. **PR** `<nr>-<short>` → `feature/<name>`.",
      "4. When the feature is done: **PR** `feature/<name>` → `develop`.",
      "5. Release: **PR** `develop` → `main`.",
      "",
      "> The direction is strict and never skipped: `<nr>-<short>` → `feature/<name>` → `develop` → `main`.",
      "> An issue is **never** PR'd directly to `develop` or `main`."
    ].join("\n");
  }
  return [
    `We work via ${repoLabel(model)}. A **feature** is a ${vocab.boardTerm}, and **${vocab.issueTerm}s** are linked`,
    `to that feature. Each ${vocab.issueTerm} gets a spec in [\`../../specs/\`](../../specs/) and its own branch.`,
    "",
    "## This project's branches are the ones that apply",
    "",
    "This foundation lives in a folder git ignores. It is never pushed, no workflow in it ever runs, and",
    "nothing here can create a branch, rename one, or open a pull request. So it prescribes no branch",
    "model — **this project already has one, and it stays exactly as it is.**",
    "",
    `${branches.shape}`,
    `${branches.destination}`,
    "",
    "**What the spec loop needs is one branch per spec, and nothing else.** `/createspec` cuts it,",
    "`/pr-check` checks it merges cleanly into whatever it targets, and `/push` refuses to push a branch",
    "everyone shares. Those three fit inside any branch model; none of them requires this one.",
    "",
    "If the branches this document names are not the ones this repository uses, `/cleanup` rewrites it to",
    "match the repository — the repository is right, always."
  ].join("\n");
}

/**
 * `BRANCHING.md`'s closing section, which is `/createspec`'s `develop` sync — and therefore only
 * means anything where that hierarchy exists (spec 212).
 */
function branchSyncSection(model: ProjectModel): string {
  if (branchVocabulary(model) !== null) {
    return [
      "## Keep your branch in sync",
      "- Merge whatever this project treats as the branch you cut from, as often as this project does it.",
      "  A spec branch that sits for a week is a merge conflict either way — that is this repository's",
      "  habit to follow, not one this foundation sets."
    ].join("\n");
  }
  return [
    "## Keep branches in sync",
    "- Update your issue against the feature often: `git merge feature/<name>`.",
    "- Update the feature against develop: `git merge develop`. **`/createspec` already does this** — it",
    "  merges `origin/develop` into `feature/<name>` and pushes it before cutting the issue branch, so a new",
    "  branch is never born behind. Do it by hand for a feature branch you have had open for a while."
  ].join("\n");
}

/**
 * `BRANCHING.md`'s CI/deploy section (spec 187).
 *
 * Integrated, this foundation's own workflows deploy from the branches it describes. Hidden, none of
 * those branches is ever pushed and no workflow ships — so the honest section says what actually
 * happens to a branch here, which is whatever this project already does with one.
 */
function branchingCiSection(model: ProjectModel, vocab: ProviderVocabulary): string {
  if (hiddenFolder(model) !== null) {
    return [
      `- This foundation ships no pipeline and is never pushed, so nothing here deploys anything.`,
      `- Your branches run whatever checks this project already runs on a branch. The branch model`,
      `  above is how *your* work is organised; the build that judges it is your team's.`
    ].join("\n");
  }
  return [
    `- Every push to \`feature/<name>\` **and** \`develop\` runs a DEV deploy to ${hostingName(model)}`,
    `  (see \`${vocab.deployFile}\`).`,
    "- `<nr>-<short>` branches do not deploy — they are tested via their feature."
  ].join("\n");
}

/**
 * Section 3's command bullets — where the two layouts disagree about whether a pipeline exists.
 *
 * Integrated, `/cleanup` has to reconcile the documents *and* flag a CI file it may not edit
 * (spec 91's manual-run finding). Hidden ships no CI at all, so the same paragraph would send the
 * assistant looking for a file this foundation deliberately did not deliver — and the honest
 * instruction is the opposite one: the team's pipeline is theirs, so leave it alone.
 */
function cleanupCommandsRule(model: ProjectModel, ciFile: string, commands: Commands): string {
  const { CMD_DEV, CMD_BUILD, CMD_TYPECHECK, CMD_LINT, CMD_TEST } = commands;
  const named = `\`${CMD_DEV}\`, \`${CMD_BUILD}\`, \`${CMD_TYPECHECK}\`, \`${CMD_LINT}\` and\n  \`${CMD_TEST}\``;
  if (hiddenFolder(model) !== null) {
    return [
      `- **The commands.** ${named} appear across these documents. Replace each one with the`,
      "  command that actually works here. If a project has no typecheck or no tests at all, say so plainly",
      "  in the document rather than naming a command that does not exist — and note it in your report.",
      "- **This foundation ships no CI, and the project's own pipeline is not yours to touch.** A hidden",
      "  foundation is never pushed, so a workflow in it could never run and none was delivered. The",
      "  project almost certainly has its own — read it, so the documents describe the verification that",
      "  really happens here, and change nothing in it. The same goes for the verification bar named in",
      "  `.claude/spec-kit/constitution.md`, which you may also only read."
    ].join("\n");
  }
  return [
    `- **The commands.** ${named} appear across these documents and in \`${ciFile}\`. Replace each one with the`,
    "  command that actually works here. If a project has no typecheck or no tests at all, say so plainly",
    "  in the document rather than naming a command that does not exist — and note it in your report.",
    `- **CI names those commands too, and you may not edit it.** \`${ciFile}\` runs the same verification`,
    "  bar on every push, and it is pipeline configuration — out of bounds for this command. If the",
    "  commands there do not exist in this project, the first push will fail. Do not quietly fix it and do",
    "  not quietly ignore it: put it at the top of your report, with the two ways out — add the missing",
    "  scripts to this project, or edit the workflow — and let the founder choose. The same goes for the",
    "  verification bar named in `.claude/spec-kit/constitution.md`, which you may also only read."
  ].join("\n");
}

/**
 * Sections 4–6 as they have always read, for a foundation that takes the tree as its own (spec 91).
 *
 * `ciFile` is interpolated here rather than left as a `{{CI_FILE}}` token: substitution is one pass
 * over the template, so a token inside a substituted value is never reached and would ship to the
 * founder as an unresolved marker.
 */
function integratedRepoWork(ciFile: string): string {
  return `## 4. The \`.airrow\` files: where this project already had one

Where this foundation ships a document the project already had, the founder's file keeps its path and
this foundation's version arrives beside it as \`<name>.airrow.md\` — \`README.airrow.md\`,
\`CLAUDE.airrow.md\`, \`docs/architecture/SYSTEM_OVERVIEW.airrow.md\`. Both are on disk on purpose, and
the name says which is which: **the \`.airrow\` file is this foundation's version; the plain one is the
founder's.**

**Start by finding all of them** — \`git ls-files '*.airrow.md'\`, or a glob for \`**/*.airrow.md\` if
this is not a git repository. There may be one, there may be a dozen; the number depends on how much
of this foundation the project already had. List them in your report before you touch any, and work
through every single one. An \`.airrow\` file left untailored is a document that describes someone
else's project.

For each of them:

1. **Treat the \`.airrow\` file as one of the documents in section 3.** It is this foundation's, so
   tailor it to this project like the rest — that is what makes it worth adopting.
2. **Read the founder's version for what only they know.** Anything in it that is true and not in the
   \`.airrow\` file — how the project is deployed, why something is the way it is, what a reader needs
   to know — belongs in the tailored version. Say in your report what you carried across.
3. **Leave the founder's file alone.** Do not rewrite it, do not delete it, do not rename it. Their
   \`README.md\` is theirs.
4. **Tell them the swap is theirs to make**, in plain words: their file is untouched,
   \`README.airrow.md\` is the version the workflow reads, and when they are happy with it they rename
   it over their own — \`git mv README.airrow.md README.md\`. Nothing here does that for them.

If an \`.airrow\` file is missing for a document this project already had, the founder chose to keep
theirs during the import review. Respect it: say so once in the report and move on.

**Only documents arrive this way.** Where this foundation would have shipped a *non*-document the
project already had — a workflow file most likely — nothing was delivered, because a second live
pipeline sitting next to theirs is worse than none. If this foundation's \`${ciFile}\` is missing
while the project has its own, that is why. Say so in the report, alongside the command mismatch from
section 3, and leave the founder to decide.

## 5. The branch model

The workflow this foundation ships runs on branches — \`/createspec\` cuts one, \`/pr-check\` opens a
pull request into the one above it, and the CI and deploy rules key off their names. An imported
project usually arrives without them, so set them up. Locally, and only what is missing.

1. **No \`.git\` here at all?** Then \`git init -b main\`, stage everything and make the first commit —
   this project as it stands today, before anything else happens. Say in your report exactly what
   went into it.
2. **Find the trunk**, if there is a repository already: the branch that is checked out, or what
   \`git symbolic-ref refs/remotes/origin/HEAD\` reports. **Do not rename it.** A trunk called
   \`master\` stays \`master\`: renaming it breaks branch protection, open pull requests and every CI
   trigger pointing at the old name, and none of that is yours to break.
3. **Create what is missing**, and nothing else: \`develop\` from the trunk, then the first
   \`feature/<name>\` from \`develop\` — see [BRANCHING.md](../../docs/architecture/BRANCHING.md). A
   branch that already exists is left exactly where it is.
4. **Make the documents say the real name.** [BRANCHING.md](../../docs/architecture/BRANCHING.md)
   and \`CLAUDE.md\` are written around \`main\`. If this project's trunk is called something else,
   rewrite them to name the branch that exists — the *shape* is the rule
   (trunk ← \`develop\` ← \`feature/<name>\` ← issue branch), the trunk's name is a fact about this
   repository.

**The limits are the same as everywhere else in this command.** No remote: no \`push\`, no
\`remote add\`, no branch created anywhere but here. No history rewritten — never \`rebase\`, never
\`reset --hard\`, never \`--force\`. No branch renamed and none deleted. And do not commit the founder's
working tree beyond the one first commit in case 1: whatever is uncommitted is theirs to look at
before it goes in.

## 6. Old assistant instructions

Projects that have been worked on with AI accumulate instruction files — \`.cursorrules\`, an older
\`AGENTS.md\`, \`.github/copilot-instructions.md\`, half-finished notes to a model that are now years of
context out of date. Two of them saying different things is worse than neither, and this foundation's
\`CLAUDE.md\` is about to be a third.

**Find them, report them, delete nothing.** For each one: where it is, what it says that contradicts
this foundation or the code, and what would be lost by removing it. Where it holds something still
true and still useful, fold that into \`CLAUDE.md\` — attributed, so the founder can see what moved —
and say the original is now redundant. The founder decides what to remove.`;
}

/**
 * Sections 4–6: the work that depends on the layout (spec 187).
 *
 * One seam rather than three conditionals inside three sections: integrated and hidden do genuinely
 * different jobs here, and interleaving them would produce a command whose reader has to work out
 * which half applies to them before they can follow either.
 */
function cleanupRepoWork(model: ProjectModel, ciFile: string): string {
  const folder = hiddenFolder(model);
  if (folder === null) return integratedRepoWork(ciFile);
  return [
    `## 4. Make git ignore \`${folder}/\``,
    "",
    "This is the one thing that keeps the foundation out of everyone else's way, and it is the first",
    "thing to check on every run.",
    "",
    `1. **Is it already ignored?** \`git check-ignore -v ${folder}\`. If it prints a rule, this step is`,
    "   done — say which file the rule came from and move on.",
    "2. **Otherwise add it to `.git/info/exclude`** — append the line `" + folder + "/`. That file is",
    "   per-clone: it is never committed, never pushed, and never seen by anyone else. The repository's",
    "   diff stays empty, which is the whole point.",
    "3. **No `.git` directory here?** Then there is nothing to exclude into. Say so, and offer the",
    "   `.gitignore` line below instead. Do **not** run `git init` — this is somebody else's checkout.",
    "4. **Is anything under the folder already tracked?**",
    `   \`git ls-files --error-unmatch ${folder} 2>/dev/null\`. An ignore rule does not untrack a file`,
    "   that is already in the index, so if this finds anything, the foundation is one commit away from",
    `   being pushed. Report it with the fix — \`git rm -r --cached ${folder}\` — and **do not run it**:`,
    "   it stages a deletion, and staging anything in a shared repository is the founder's call.",
    "",
    "**The committed alternative, offered and never taken on your own.** `.git/info/exclude` protects",
    "this clone and no other — a second machine, or a teammate who ends up with the folder, is not",
    `covered. Adding \`${folder}/\` to \`.gitignore\` covers everyone, but it is a change to a file the`,
    "team owns and it *does* get pushed. Explain both, in one short paragraph, and write it only if the",
    "founder says yes.",
    "",
    "## 5. Check the foundation can actually be used from here",
    "",
    "A foundation in a subfolder is one an assistant may not find. `CLAUDE.md`, `.claude/` and the",
    "commands are discovered from wherever a session starts, and that is now the folder, not the",
    "repository root. Verify it rather than assuming:",
    "",
    `1. **Confirm the layout.** \`${folder}/CLAUDE.md\`, \`${folder}/START_HERE.md\`,`,
    `   \`${folder}/.claude/commands/\` and \`${folder}/docs/\` all exist and sit together.`,
    "2. **Confirm the documents point inside the folder.** Every relative link between them still",
    "   resolves — they all moved together, so they should. Fix any that does not.",
    "3. **Confirm `START_HERE.md` says where to start a session**, and that what it says is true for",
    `   this folder's actual name. If it names a different folder, the founder renamed it — rewrite the`,
    "   document to match the repository, never the other way round.",
    "4. **Report what a session against the repository root would miss**, in one line, so the founder",
    "   knows why the instruction exists rather than just being told to follow it.",
    "5. **Check the branch model these documents describe is the one this repository uses** (spec 212).",
    "   The founder was asked how the team branches, and `BRANCHING.md` was written from the answer —",
    "   an answer, not an observation. Look: `git branch -a`, and what",
    "   `git symbolic-ref refs/remotes/origin/HEAD` reports. Where the document and the repository",
    "   disagree, **the repository is right** — rewrite the document to name the branches that exist,",
    "   here and in `CLAUDE.md`, and say in your report what you changed and what it used to say.",
    "   **Create nothing, rename nothing, delete nothing.** Not a branch, not a remote, not a config.",
    "   This foundation is not part of the repository and does not get to reorganise it.",
    "",
    "## 6. What this layout does not ship",
    "",
    "No CI file was delivered, deliberately: a workflow inside an ignored folder is never pushed and",
    "never runs, so it could only ever look like a check that was happening. This project's own",
    "pipeline is the one that matters.",
    "",
    "Say this once in the report, and make sure no document you rewrote in section 3 claims otherwise.",
    "Where a document describes the verification bar, it describes commands the founder runs by hand —",
    "not a pipeline this foundation set up."
  ].join("\n");
}

/** Report items 3–5, which name the work `cleanupRepoWork` actually did (spec 187). */
function cleanupReportItems(model: ProjectModel): string {
  if (hiddenFolder(model) === null) {
    return [
      "3. Which `.airrow` files you tailored, what you carried across from the founder's version, and that",
      "   renaming one over their own is theirs to do.",
      "4. Which branches existed already and which you created, and — if the trunk is not `main` — that the",
      "   documents now name the branch this repository actually has.",
      "5. Which old instruction files you found, and what you recommend for each."
    ].join("\n");
  }
  const folder = hiddenFolder(model);
  return [
    `3. Whether \`${folder}/\` is ignored, which file the rule is in, and whether you added it or found`,
    "   it already there. If anything under it is tracked, say so first — that is the one state where",
    "   this foundation is about to become visible.",
    "4. That nothing outside the folder was changed, and that you checked rather than assumed.",
    "5. Where the founder should start an assistant session for the commands to be found, and what a",
    "   session at the repository root would miss."
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
  // Read once and threaded through: the commands, the CI setup, the CI gate and `/start` all have
  // to describe the same stack, and re-deriving it per caller is how they would stop agreeing.
  const inferred = isCustomStack(model) ? inferStack(model.stack.customFramework) : null;
  const { commands: command, fromModel: authoredCommands } = cmds(model, inferred, authoredToolchain);
  const vocab = provider(model);
  // "dotnet efcore c# js" is what a founder types; it is not what their documentation should say.
  // For a custom stack the model turns that into a name a reader recognises, and everything that
  // renders the stack uses it. Falls back to the raw answer when nothing was authored — still
  // theirs, still honest, just untidy.
  const stackName = stackNameFor(model, authored);
  const hosting = hostingName(model);
  // TypeScript, Tailwind and shadcn/ui are the golden path's fixed choices — asserting them over a
  // founder who told us they are on Django would make the first line of their docs a falsehood.
  const frontend = isCustomStack(model) ? "" : "TypeScript · Tailwind + shadcn/ui · ";
  const summary = `${stackName} · ${frontend}${databaseLabel(model)} (Postgres) · ${hosting} · ${repoLabel(model)}`;
  const roles = rolesText(model);

  const values: Record<string, string> = {
    PROJECT_NAME: model.name,
    PROJECT_SLUG: model.slug,
    PROJECT_TAGLINE: coreAction(model),
    PROJECT_DESCRIPTION: model.description,
    DOMAIN_OVERVIEW: `${model.name} is ${aOrAn(productTypeName(model))} for ${audienceLabel[model.audience]}. ${model.description}`,
    VISION: model.vision,
    MVP_FOCUS: coreAction(model),
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
    START_TOOLS: startTools(model, inferred),
    START_BOOTSTRAP: startBootstrap(model, stackName, inferred),
    START_MINIMUM: startMinimum(model),
    UI_DIRECTION_SUMMARY: uiDirectionSummary(model),
    UI_DESIGN_SYSTEM: uiDesignSystem(model),
    THIRD_PARTY_NOTICES: thirdPartyNotices(model),
    UI_REFERENCES: uiReferences(model),
    UI_SCREENS: uiScreens(model),
    UI_LAYOUT: uiLayout(model),
    UI_COLOR: uiColor(model),
    UI_COMPONENTS: uiComponents(model),
    UI_INTERACTION: uiInteraction(),
    UI_STATES: uiStates(),
    UI_DESIGN_LANGUAGE: uiDesignLanguage(model),
    INFRASTRUCTURE_SETUP: infrastructureSetup(model),
    FIRST_COMMAND: commandName(model),
    FIRST_COMMAND_PATH: commandPath(model),
    FIRST_COMMAND_EFFECT: firstCommandEffect(model),
    AFTER_EACH_COMMAND: afterEachCommand(model),
    FIRST_STEP: firstStep(model),
    COMMAND_RULE: commandRule(model),
    CLEANUP_CLAIM: cleanupClaim(command, stackName),
    CLEANUP_SCOPE: cleanupScope(model),
    // `/security` reviews the whole repository, so it still has a pipeline to look at in hidden
    // mode — the project's own. What it must not do is name a path this foundation never shipped.
    CI_TARGET:
      hiddenFolder(model) === null
        ? `\`${vocab.ciFile}\``
        : "this project's own CI configuration, wherever it is defined",
    BRANCHING_CI_SECTION: branchingCiSection(model, vocab),
    BRANCH_MODEL: branchModelSection(model, vocab),
    BRANCH_SYNC: branchSyncSection(model),
    BRANCHING_SUMMARY: branchingSummary(model, vocab),
    FIRST_SESSION_INTRO: firstSessionIntro(model),
    FIRST_SESSION_STEP_2: firstSessionStepTwo(model),
    PRODUCT_HEADING: productHeading(model),
    READ_FIRST: readFirst(model),
    README_TITLE: readmeTitle(model),
    README_ORIENTATION: readmeOrientation(model),
    README_WORKFLOW_POINTER: readmeWorkflowPointer(model),
    DOCS_INDEX_INTRO: docsIndexIntro(model),
    // The index's one-line description of `BRANCHING.md`, which named a hierarchy that a hidden
    // foundation deliberately no longer ships (spec 212).
    BRANCHING_DOC_SUMMARY:
      branchVocabulary(model) === null
        ? "Branch + PR workflow (issue → feature → develop → main)"
        : "How the spec loop runs on this project's own branches",
    CAPABILITY_SPECS_INTRO: capabilitySpecsIntro(model),
    SETUP_SECTION: setupSection(model, summary, command),
    VERIFICATION_BAR_CLAIM: verificationBarClaim(model),
    SYSTEM_OVERVIEW_PROVENANCE: systemOverviewProvenance(model),
    CREATESPEC_BRANCH_STEP: createspecBranchStep(model, vocab),
    CREATESPEC_REPORT_LINE: createspecReportLine(model),
    PR_CHECK_TARGET: prCheckTarget(model),
    PUSH_BRANCH_GUARD: pushBranchGuard(model),
    PUSH_REPORT_LINE: pushReportLine(model),
    CONSTITUTION_BRANCH_RULE: constitutionBranchRule(model),
    SPEC_BRANCH_ROW: specBranchRow(model),
    IMPLEMENT_BRANCH_CHECK: implementBranchCheck(model),
    ANALYZE_PR_DIRECTION: analyzePrDirection(model),
    ANALYZE_PR_COMMAND: analyzePrCommand(model, vocab),
    START_TABLE_PR_ROW: startTablePrRow(model),
    // A hidden foundation ships no pipeline, so listing CI among the parts it brought would be the
    // README's very first sentence claiming something the repository does not have (spec 187).
    FOUNDATION_PARTS:
      hiddenFolder(model) === null
        ? "spec workflow, constitution, branch model, CI"
        : "spec workflow, constitution, branch model",
    CLEANUP_MODE: cleanupMode(model),
    CLEANUP_COMMANDS_RULE: cleanupCommandsRule(model, vocab.ciFile, command),
    CLEANUP_REPO_WORK: cleanupRepoWork(model, vocab.ciFile),
    CLEANUP_REPORT_ITEMS: cleanupReportItems(model),
    FIRST_SPEC_HINT: firstSpecHint(model),
    DEPLOY_TARGET: hosting,
    CI_SETUP_STEPS: ciSetupSteps(model, stackName, inferred),
    CI_READY_CHECK: ciReadyCheck(model, inferred),
    CI_SETUP_STEPS_AZ: ciSetupStepsAzure(model, stackName, inferred),
    CI_READY_CHECK_AZ: ciReadyCheckAzure(model, inferred),
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
    dec(
      "CMD_TEST",
      command.CMD_TEST,
      isCustomStack(model) ? "interview" : "default",
      commandRationale(model, inferred, stackName, authoredCommands.has("CMD_TEST"))
    ),
    dec("DEPLOY_TARGET", hosting, model.hosting === "vercel" ? "default" : "interview",
      model.hosting === "vercel"
        ? "Golden-path hosting."
        : `Chosen in the interview — the DEV deploy workflow ships as a placeholder for ${hosting}.`),
    dec("TENANCY_MODEL", tenancyName(model), "interview", "Data isolation model chosen in the interview — drives the access-control invariant."),
    dec("AUTH_MODEL", model.authModel.map((a) => authMethodLabel[a]).join(", "), "interview", "Sign-in methods chosen in the interview."),
    dec("ROLES", roles, model.roles === "none" ? "default" : "interview", "Derived from the tenancy and roles answers."),
    dec("CAPABILITY_SCOPE", model.features.join(", ") || "(none)", "interview", "Capabilities selected for year one, plus the identity features implied by tenancy/auth."),
    dec("SECURITY_POSTURE", model.dataSensitivity, "interview", "Data-sensitivity answer — drives the encryption/audit posture."),
    dec("SCALE_POSTURE", model.scale, "interview", "Scale target for v1 — drives the caching/database posture.")
  ];
  if (!coreAction(model)) {
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
 * Where this project's commands came from, in the founder's terms.
 *
 * The preview is the one place a founder can catch a wrong command before it is in every document,
 * and "we read your sentence and concluded Expo" is exactly the decision worth showing them.
 */
function commandRationale(
  model: ProjectModel,
  inferred: InferredStack | null,
  stackName: string,
  authored: boolean
): string {
  if (!isCustomStack(model)) {
    return `${packageManager(model)} — the package manager the ${stackName} toolchain defaults to.`;
  }
  if (authored) return `Written for the stack you described: ${stackName}.`;
  if (inferred) return `Read from the stack you described as ${inferred.label} — its own documented commands.`;
  return "Your stack was not recognised, so the commands are left for you to fill in rather than guessed.";
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
/**
 * The heading and lead-in above the capability briefs (spec 212).
 *
 * The same answer means opposite things depending on where the project came from, and until this
 * spec the document said the greenfield one either way. Greenfield, `capabilities` is *"Which
 * capabilities will your product need?"* — a to-do list, and "what to spec first" is exactly right.
 * Imported, spec 199 changed the question to *"What does it already do? — The capabilities that
 * exist"*, and presenting a founder's shipped features back to them as work to be done is the kind of
 * generic-but-plausible output §0 calls a top-severity bug.
 */
function capabilitySpecsIntro(model: ProjectModel): string {
  if (!shipsCleanup(model)) {
    return [
      "## What to spec first",
      "These are the capabilities chosen in the interview. Each one is a spec waiting to be written — run",
      "`/createspec` for the one you need next and the command scaffolds `specs/NNN-kort.md` for you."
    ].join("\n");
  }
  return [
    "## What this project already does",
    "These are the capabilities you confirmed exist. They are **not** a to-do list — they are what your",
    "first spec will change. Each brief below says what the spec touching that area has to cover, which",
    "is as useful for a change as it was for the build. Run `/createspec \"<the first thing you want to",
    "change>\"` and the command scaffolds `specs/NNN-kort.md` for you."
  ].join("\n");
}

function capabilitySpecs(model: ProjectModel): string {
  if (model.features.length === 0) {
    return shipsCleanup(model)
      ? "No capabilities were confirmed in the interview, so there is nothing listed here — which says\nnothing about what the project does. `/cleanup` reads the code and can fill this in."
      : "No platform capabilities were selected. Spec the core product flow first — see `docs/VISION.md`.";
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
    case "other":
      // The founder's own words, and never anything beyond them: nothing here knows what they
      // described, so the brief says what any first spec must and leaves the substance to them.
      return model.capabilitiesOther
        ? `${model.capabilitiesOther} Spec it the way you would any capability: what it does, who may reach it, what happens when it fails, and the denial test that proves the boundary holds.`
        : "[NEEDS CLARIFICATION: you selected a capability of your own but did not describe it — say what it does before speccing it.]";
  }
}

function tenancyModel(model: ProjectModel): string {
  const base = `Data is organized as ${tenancyName(model)}.`;
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
  // Asked alongside the core objects since spec 165 — the two questions were circling the same
  // ground, so they became one. A founder who named Stripe there named it here, and pointing at
  // that answer is more use than a section that claims nothing was named.
  if (model.coreEntities) {
    return `Named alongside the core objects, if at all: ${model.coreEntities}\n\nRecord each external system here as you integrate it.`;
  }
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
  // A project that already runs has an environment file of its own, and `.env.example` is written by
  // `/start` — which an imported project never runs. Naming a file that will not be there is the
  // defect spec 66 was written to fix, so the instruction is about values, not about a file.
  const imported = shipsCleanup(model);
  if (usesSupabase(model)) {
    steps.push(
      imported
        ? "1. If you do not already have one, create a **Supabase** project, then copy the project URL and anon key from Project Settings → API."
        : "1. Create a **Supabase** project, then copy the project URL and anon key from Project Settings → API.",
      imported
        ? "2. Put those two values in this project's environment file (plus the service-role key, server-side only — never expose it to the browser)."
        : "2. Copy `.env.example` to `.env.local` and fill in those two values (plus the service-role key, server-side only — never expose it to the browser).",
      "3. Apply the database migrations to your Supabase project; every schema change from here is a committed migration, never a dashboard edit."
    );
  } else {
    steps.push(
      `1. ${imported ? "If you do not already have one, provision" : "Provision"} a **${databaseLabel(model)}** instance and note its connection string.`,
      imported
        ? "2. Put the connection string in this project's environment file (server-side only — never expose it to the browser)."
        : "2. Copy `.env.example` to `.env.local` and fill in the connection string (server-side only — never expose it to the browser).",
      "3. Apply the database migrations; every schema change from here is a committed migration, never a hand-edit."
    );
  }
  steps.push(...repoSetupSteps(model, 4));
  // A project that already runs has its runtime installed — that is how it runs. The step only
  // exists because `/start` cannot install a toolchain it was never told the name of.
  if (isCustomStack(model) && !shipsCleanup(model)) {
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

  // A hidden foundation is never pushed and ships no pipeline, so every step below it would be a
  // lie: there is no repository to create, nothing to register, and the branch rules belong to the
  // team that already works here (spec 187). What is left is the one thing that *is* true — the
  // founder still needs a CLI and a deploy target of their own if they are going to use them.
  if (hiddenFolder(model) !== null) {
    return [
      `${n(0)}. **Nothing to push, and nothing to protect.** This foundation lives in \`${hiddenFolder(model)}/\` on this machine only — git is told to ignore it, so it never reaches ${repoLabel(model)}. The repository, its branch rules and its pipeline are your team's and stay exactly as they are.`,
      `${n(1)}. **Verification is yours to run.** No CI ships with a hidden foundation — a workflow inside an ignored folder could never run. The commands below are the bar; run them before you open a pull request, and let your team's own pipeline judge the result.`,
      `${n(2)}. ${cliSetupStep(model)}`
    ];
  }
  // An imported project already has its code somewhere, and `/cleanup` initialises nothing — so the
  // instruction is to make the branch model true where the code already lives, not to push a
  // `develop` branch a command created.
  const imported = shipsCleanup(model);
  const hostStep = usesAzureRepos(model)
    ? imported
      ? "In **Azure DevOps**, create a project for the repository your code already lives in, then push this foundation alongside the code — including the `develop` branch `/cleanup` created."
      : "In **Azure DevOps**, create a project and an empty **Azure Repos** repository, then push this foundation — including the `develop` branch `/start` created."
    : imported
      ? `Push this foundation to your existing ${repoLabel(model)} repository, alongside the code, including the \`develop\` branch \`/cleanup\` created.`
      : `Create an empty repository on ${repoLabel(model)} and push this foundation, including the \`develop\` branch \`/start\` created.`;
  if (usesAzureRepos(model)) {
    return [
      `${n(0)}. ${hostStep}`,
      `${n(1)}. **Register the pipelines.** Pipelines → New pipeline → Azure Repos Git → this repo → Existing YAML file: \`${vocab.ciFile}\` for CI, then again for \`${vocab.deployFile}\`. Azure DevOps does not pick up YAML from a directory the way Actions does — an unregistered pipeline simply never runs.`,
      `${n(2)}. **Set the branch policies** the branch model depends on, under Repos → Branches → \`main\` / \`develop\` → Branch policies: require a pull request, require the CI build to pass, and block direct pushes. In this workflow these are the rules — there is no committed file enforcing them.`,
      `${n(3)}. **Create the Boards structure:** one area path (or team) per \`feature/<name>\`, so a ${vocab.issueTerm} always belongs to exactly one feature. That mapping is what \`/createspec\` asks you about.`,
      `${n(4)}. ${cliSetupStep(model)}`,
      `${n(5)}. ${deployTargetSetup(model)}, and put the credentials in ${vocab.secretsHome}.`
    ];
  }
  return [
    `${n(0)}. ${hostStep}`,
    `${n(1)}. **Protect \`main\` and \`develop\`** (Settings → Branches): require a pull request and a passing CI check. The workflows in \`.github/workflows/\` run on their own once pushed.`,
    `${n(2)}. ${cliSetupStep(model)}`,
    `${n(3)}. ${deployTargetSetup(model)}, and put the credentials in ${vocab.secretsHome}.`
  ];
}

/** How the founder prepares the deploy target — a hosted project, or their own server. */
function deployTargetSetup(model: ProjectModel): string {
  if (model.hosting === "self_host") return "Prepare the server you will deploy to";
  // "Create the Azure project" would sit two steps below "create an Azure DevOps project" and mean
  // something entirely different. Name the service.
  if (model.hosting === "azure") return "Create the **Azure App Service** you will deploy to";
  // A named target is set up in whatever way it is set up — nothing here knows, and "create the
  // Fly.io project" would be a guess at a verb (spec 159).
  if (model.hosting === "other") return `Set up the ${hostingName(model)} target you will deploy to`;
  return `Create the ${hostingName(model)} project you will deploy to`;
}

function firstSpecHint(model: ProjectModel): string {
  if (!coreAction(model)) {
    return "Start with the single flow the product is useless without. [NEEDS CLARIFICATION: the MVP focus was left blank — decide it before writing the first spec.]";
  }
  return `Start with the flow the MVP is useless without: **${coreAction(model)}** Spec that one flow end to end — not the whole product.`;
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
