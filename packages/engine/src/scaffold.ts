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
  hostingName,
  isCustomStack,
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
 */
export function shipsPath(model: ProjectModel, path: string): boolean {
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
      : "3. Merge, or push to `develop` per your deploy workflow — a preview or DEV deployment should appear within a few minutes.";
  return [
    "## 4. Verify end to end",
    "",
    `1. \`${run} dev\` locally — the app should start and reach the database.`,
    "2. Push to a branch and open a pull request — CI should run and go green.",
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
  const merge = usesAzureRepos(model)
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
    `After that merge the issue branch is finished. The same route takes the work the rest of the way:`,
    "`feature/<name>` → `develop` → `main`, one pull request each, never skipped — and the next change",
    "starts at `/createspec` again.",
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
    "Then open Claude Code in this repository and run:",
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
      "work — and rewrites the documents in this foundation to describe *that* project. It also creates",
      "the local branches this workflow runs on, and only the ones you do not have yet. It changes no",
      "code: not a dependency, not a config file, not a migration. It deletes nothing either, renames no",
      "file of yours, and touches no remote. It is safe to run again.",
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
function cleanupScope(): string {
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
    CLEANUP_SCOPE: cleanupScope(),
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
