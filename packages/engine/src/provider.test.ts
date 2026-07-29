// Tests for the repository provider the founder chose.
//
// The interview has always asked GitHub or Azure DevOps, and until now the answer only changed a
// label: an Azure DevOps team got GitHub Actions workflows, `gh` commands in every slash command, and
// a constitution telling them a feature is a GitHub Project. These tests hold the line that the
// answer reaches the workflow, not just the prose.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProjectModel } from "./model.ts";
import { renderScaffold, type TemplateFile } from "./scaffold.ts";
import type { InterviewAnswers } from "../../schemas/src/types.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const TEMPLATE_DIR = path.join(REPO_ROOT, "template");

function loadTemplate(): TemplateFile[] {
  const files: TemplateFile[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else {
        const rel = path.relative(TEMPLATE_DIR, abs).split(path.sep).join("/");
        if (rel === ".airrow-template.json") continue;
        files.push({ path: rel, content: fs.readFileSync(abs, "utf8") });
      }
    }
  };
  walk(TEMPLATE_DIR);
  return files;
}

const TEMPLATE = loadTemplate();

const BASE: InterviewAnswers = {
  productType: "saas",
  vision: "The system of record every agency runs on.",
  mvpFocus: "Log a client and never miss a follow-up.",
  coreEntities: "Agencies own Clients.",
  tenancy: "organizations",
  authModel: ["email_password"],
  capabilities: [],
  dataSensitivity: "standard",
  scale: "validate",
  framework: "nextjs",
  database: "postgres",
  hosting: "azure",
  team: "solo"
};

function render(answers: InterviewAnswers) {
  const model = resolveProjectModel({
    name: "Loop CRM",
    description: "A lightweight CRM for small agencies.",
    answers
  });
  const { files } = renderScaffold(TEMPLATE, model);
  return {
    files,
    paths: new Set(files.map((f) => f.path)),
    byPath: (p: string) => files.find((f) => f.path === p)?.content ?? "",
    all: files.map((f) => f.content).join("\n")
  };
}

const azure = render({ ...BASE, repoProvider: "azure_devops" });
const github = render({ ...BASE, repoProvider: "github" });

describe("a project ships one CI system, not both", () => {
  it("gives Azure DevOps pipelines and no GitHub Actions", () => {
    expect(azure.paths.has("azure-pipelines.yml")).toBe(true);
    expect(azure.paths.has("azure-pipelines-deploy-dev.yml")).toBe(true);
    expect([...azure.paths].some((p) => p.startsWith(".github/"))).toBe(false);
  });

  it("gives GitHub Actions and no pipelines", () => {
    expect(github.paths.has(".github/workflows/ci.yml")).toBe(true);
    expect([...github.paths].some((p) => p.startsWith("azure-pipelines"))).toBe(false);
  });

  it("leaves no unresolved token in either", () => {
    for (const p of [azure, github]) {
      for (const f of p.files) expect(f.content, f.path).not.toMatch(/\{\{[A-Z0-9_]+\}\}/);
    }
  });
});

describe("the pipeline is Azure Pipelines, not translated Actions", () => {
  it("uses Pipelines' own syntax for the /start gate and the toolchain", () => {
    const ci = azure.byPath("azure-pipelines.yml");
    expect(ci).toContain("##vso[task.setvariable variable=ready;isOutput=true]");
    expect(ci).toContain("NodeTool@0");
    expect(ci).not.toContain("GITHUB_OUTPUT");
    expect(ci).not.toContain("actions/checkout");
  });

  it("still gates the verification stage on /start having run", () => {
    const ci = azure.byPath("azure-pipelines.yml");
    expect(ci).toContain("if [ -f package.json ]; then");
    expect(ci).toContain("dependencies.detect.outputs");
  });

  it("deploys with an Azure task rather than a shell guard", () => {
    expect(azure.byPath("azure-pipelines-deploy-dev.yml")).toContain("AzureWebApp@1");
  });
});

describe("the workflow is described in the provider's own vocabulary", () => {
  it("says work item and Azure Boards, never issue and GitHub Project", () => {
    const docs = [
      azure.byPath(".claude/spec-kit/constitution.md"),
      azure.byPath("CLAUDE.md"),
      azure.byPath("docs/architecture/BRANCHING.md")
    ].join("\n");
    expect(docs).toContain("work item");
    expect(docs).toContain("Azure Boards");
    expect(docs).not.toContain("GitHub Project");
  });

  it("names no GitHub anywhere in an Azure DevOps foundation", () => {
    expect(azure.all).not.toContain("GitHub");
    expect(azure.all).not.toContain("gh pr create");
    expect(azure.all).not.toContain("gh issue");
  });

  it("gives the slash commands the CLI that actually exists there", () => {
    expect(azure.byPath(".claude/commands/createspec.md")).toContain("az boards work-item show");
    expect(azure.byPath(".claude/commands/pr-check.md")).toContain("az repos pr create");
    expect(azure.byPath(".claude/commands/analyze.md")).toContain("az repos pr create");
    expect(github.byPath(".claude/commands/pr-check.md")).toContain("gh pr create");
  });

  it("points /start at the CI file this project actually has", () => {
    expect(azure.byPath(".claude/commands/start.md")).toContain("azure-pipelines.yml");
    expect(github.byPath(".claude/commands/start.md")).toContain(".github/workflows/ci.yml");
  });
});

describe("setup tells an Azure DevOps founder what is actually different", () => {
  const here = azure.byPath("START_HERE.md");

  it("says pipelines must be registered by hand — YAML in a directory does nothing there", () => {
    expect(here).toContain("Register the pipelines");
    expect(here).toContain("Existing YAML file");
  });

  it("sends them to branch policies, since no committed file enforces the rules", () => {
    expect(here).toContain("Branch policies");
    expect(here).toContain("require the CI build to pass");
  });

  it("explains the area-path-per-feature mapping /createspec depends on", () => {
    expect(here).toContain("area path");
  });

  it("names a variable group for credentials, not GitHub secrets", () => {
    expect(here).toContain("variable group");
    expect(github.byPath("START_HERE.md")).toContain("Secrets and variables");
  });

  it("numbers the steps continuously despite the providers differing in count", () => {
    for (const p of [azure, github]) {
      const steps = (p.byPath("START_HERE.md").match(/^\d+\. /gm) ?? []).map((s) => parseInt(s, 10));
      expect(steps).toEqual(steps.map((_, i) => i + 1));
    }
  });
});
