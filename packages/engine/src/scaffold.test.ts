// Tests for the scaffold renderer — the only source of generated output. The invariant skeleton
// always appears, every interview answer visibly reaches a file, and unknown values surface as
// NEEDS CLARIFICATION rather than being guessed.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProjectModel } from "./model.ts";
import { renderScaffold, type TemplateFile } from "./scaffold.ts";
import type { ResolveInput } from "./model.ts";
import type { InterviewAnswers } from "../../schemas/src/types.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const TEMPLATE_DIR = path.join(REPO_ROOT, "template");

/** Read template/** the way the app would, excluding the meta file. */
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

const INVARIANT_SKELETON = [
  "START_HERE.md",
  "README.md",
  "CLAUDE.md",
  ".claude/commands/createspec.md",
  ".claude/commands/clarify.md",
  ".claude/commands/implement.md",
  ".claude/commands/analyze.md",
  ".claude/commands/push.md",
  ".claude/commands/pr-check.md",
  ".claude/spec-kit/constitution.md",
  ".claude/spec-kit/spec-template.md",
  "docs/VISION.md",
  "docs/architecture/SYSTEM_OVERVIEW.md",
  "docs/architecture/BRANCHING.md",
  "docs/guides/DEVELOPER_GUIDE.md",
  "specs/README.md",
  ".github/workflows/branch-policy.yml",
  ".github/workflows/close-issue-on-merge.yml",
  ".github/workflows/ci.yml"
];

const input: ResolveInput = {
  name: "Loop CRM",
  description: "A lightweight CRM for small agencies.",
  answers: {
    productType: "saas",
    vision: "The system of record every independent agency runs on.",
    mvpFocus: "Log clients and never miss a follow-up.",
    audience: "b2b",
    tenancy: "organizations",
    authModel: ["email_password"],
    roles: "simple",
    capabilities: ["payments"],
    dataSensitivity: "pii",
    framework: "nextjs",
    database: "supabase",
    hosting: "vercel",
    team: "small_team"
  }
};

/** Render the scaffold for a variation of the baseline interview. */
function render(answers: Partial<InterviewAnswers> = {}, name = "Loop CRM") {
  const model = resolveProjectModel({
    ...input,
    name,
    answers: { ...input.answers, ...answers }
  });
  const { files, plan } = renderScaffold(TEMPLATE, model);
  return { files, plan, byPath: new Map(files.map((f) => [f.path, f.content])) };
}

/** Every generated file's content joined — for "does this appear anywhere" assertions. */
function allText(files: { content: string }[]): string {
  return files.map((f) => f.content).join("\n");
}

describe("renderScaffold", () => {
  const { files, plan, byPath } = render();

  it("always emits the invariant skeleton regardless of the interview", () => {
    for (const p of INVARIANT_SKELETON) {
      expect(byPath.has(p), `missing invariant file: ${p}`).toBe(true);
    }
  });

  it("substitutes the project name everywhere, leaving no {{PROJECT_NAME}} tokens", () => {
    for (const f of files) {
      expect(f.content, `unresolved token in ${f.path}`).not.toContain("{{PROJECT_NAME}}");
    }
    expect(byPath.get("README.md")).toContain("Loop CRM");
  });

  it("leaves no unresolved token in any file", () => {
    for (const f of files) {
      expect(f.content, `unresolved token in ${f.path}`).not.toMatch(/\{\{[A-Z0-9_]+\}\}/);
    }
  });

  it("keeps the Process and Testing invariants verbatim (portable, never weakened)", () => {
    const c = byPath.get(".claude/spec-kit/constitution.md") ?? "";
    expect(c).toContain("PR direction is strict and never skipped");
    expect(c).toContain("co-located");
  });

  it("returns a preview plan for founder approval before anything is written", () => {
    expect(plan.projectName).toBe("Loop CRM");
    expect(plan.fileCount).toBe(files.length);
    expect(plan.tree).toEqual(files.map((f) => f.path));
    expect(plan.decisions.some((d) => d.token === "PROJECT_NAME" && d.source === "interview")).toBe(true);
  });

  it("produces no duplicate paths and no empty files", () => {
    const seen = new Set<string>();
    for (const f of files) {
      expect(seen.has(f.path)).toBe(false);
      seen.add(f.path);
      expect(f.content.trim().length).toBeGreaterThan(0);
    }
  });

  it("carries no Architecture Decision Record leftovers", () => {
    const text = allText(files);
    expect(text).not.toContain("ADR");
    expect(text).not.toContain("Architecture Decision Record");
    expect(files.some((f) => f.path.startsWith("adr/"))).toBe(false);
  });
});

// Each interview answer must visibly change generated output — the point of issue #10.
describe("every interview answer reaches the output", () => {
  it("vision appears in VISION.md and CLAUDE.md", () => {
    const { byPath } = render({ vision: "Every agency's system of record." });
    expect(byPath.get("docs/VISION.md")).toContain("Every agency's system of record.");
    expect(byPath.get("CLAUDE.md")).toContain("Every agency's system of record.");
  });

  it("mvpFocus drives the tagline and the first spec to write", () => {
    const { byPath } = render({ mvpFocus: "Log a client in under ten seconds." });
    expect(byPath.get("README.md")).toContain("Log a client in under ten seconds.");
    expect(byPath.get("START_HERE.md")).toContain("Log a client in under ten seconds.");
  });

  it("tenancy drives the data-isolation model and the access-control invariant", () => {
    const multi = render({ tenancy: "organizations" });
    expect(multi.byPath.get("docs/architecture/SYSTEM_OVERVIEW.md")).toContain("organization_id");
    expect(multi.byPath.get(".claude/spec-kit/constitution.md")).toContain("organization_id");

    const single = render({ tenancy: "single_user", roles: undefined });
    expect(single.byPath.get("docs/architecture/SYSTEM_OVERVIEW.md")).toContain("scoped to their owning user");
    expect(single.byPath.get(".claude/spec-kit/constitution.md")).not.toContain("organization_id");
  });

  it("authModel names the chosen sign-in methods", () => {
    const { byPath } = render({ authModel: ["magic_link", "sso"] });
    const overview = byPath.get("docs/architecture/SYSTEM_OVERVIEW.md") ?? "";
    expect(overview).toContain("magic link");
    expect(overview).toContain("enterprise SSO");
    expect(overview).not.toContain("email & password");
  });

  it("roles drives the permission model", () => {
    const granular = render({ roles: "granular" });
    expect(granular.byPath.get("docs/architecture/SYSTEM_OVERVIEW.md")).toContain("Granular roles");
    const simple = render({ roles: "simple" });
    expect(simple.byPath.get("docs/architecture/SYSTEM_OVERVIEW.md")).toContain("owner / admin / member");
  });

  it("capabilities produce one spec brief each — and nothing for what wasn't selected", () => {
    const { byPath, files } = render({ capabilities: ["payments", "search"] });
    const specs = byPath.get("specs/README.md") ?? "";
    expect(specs).toContain("### Payments & billing");
    expect(specs).toContain("### Search");
    expect(specs).not.toContain("### Realtime");
    expect(specs).not.toContain("### Audit logs");
    expect(byPath.get("docs/VISION.md")).toContain("Payments & billing");
    // nothing anywhere references an unselected capability
    expect(allText(files)).not.toContain("Realtime channels");
  });

  it("aiUsage shapes the AI brief and the LLM-output convention", () => {
    const { byPath } = render({ capabilities: ["ai"], aiUsage: "rag" });
    expect(byPath.get("specs/README.md")).toContain("retrieval-augmented generation");
    expect(byPath.get("CLAUDE.md")).toContain("validated against a schema");
  });

  it("flags AI whose kind was never chosen instead of guessing", () => {
    const { byPath } = render({ capabilities: ["ai"], aiUsage: undefined });
    expect(byPath.get("specs/README.md")).toContain("[NEEDS CLARIFICATION:");
  });

  it("drops AI entirely when the founder answers \"no AI after all\"", () => {
    const { byPath, files } = render({ capabilities: ["ai", "search"], aiUsage: "none" });
    const specs = byPath.get("specs/README.md") ?? "";
    expect(specs).toContain("### Search");
    expect(specs).not.toContain("### AI features");
    expect(byPath.get("docs/VISION.md")).not.toContain("AI features");
    expect(allText(files)).not.toContain("[NEEDS CLARIFICATION: what kind of AI");
  });

  it("integrations names the external systems", () => {
    const { byPath } = render({ integrations: "Stripe for billing, Resend for email." });
    expect(byPath.get("docs/architecture/SYSTEM_OVERVIEW.md")).toContain("Stripe for billing");
  });

  it("dataSensitivity drives the security posture at the right level", () => {
    const regulated = render({ dataSensitivity: "regulated" });
    expect(regulated.byPath.get("docs/architecture/SYSTEM_OVERVIEW.md")).toContain("Regulated data");
    expect(regulated.byPath.get(".claude/spec-kit/constitution.md")).toContain("audit every access");

    const standard = render({ dataSensitivity: "standard" });
    expect(standard.byPath.get("docs/architecture/SYSTEM_OVERVIEW.md")).toContain("Standard business data");
    expect(standard.byPath.get(".claude/spec-kit/constitution.md")).not.toContain("audit every access");
  });

  it("scale drives the performance posture", () => {
    const validate = render({ scale: "validate" });
    expect(validate.byPath.get("docs/VISION.md")).toContain("speed of learning");
    const high = render({ scale: "high_scale" });
    expect(high.byPath.get("docs/VISION.md")).toContain("Expect rapid adoption");
  });

  it("hosting names the deploy target instead of assuming Vercel", () => {
    const { byPath, files } = render({ hosting: "azure" });
    expect(byPath.get("README.md")).toContain("Azure");
    expect(byPath.get(".github/workflows/deploy-dev.yml")).toContain("Deploy to Azure (DEV)");
    expect(allText(files)).not.toContain("Vercel");
  });

  it("database drives the setup steps", () => {
    const supabase = render({ database: "supabase" });
    expect(supabase.byPath.get("START_HERE.md")).toContain("Create a **Supabase** project");
    const postgres = render({ database: "postgres" });
    expect(postgres.byPath.get("START_HERE.md")).not.toContain("Supabase");
    expect(postgres.byPath.get("START_HERE.md")).toContain("PostgreSQL (self-hosted)");
  });

  it("repoProvider is named consistently, never hardcoded to GitHub", () => {
    const { byPath } = render({ repoProvider: "azure_devops" });
    expect(byPath.get("docs/architecture/BRANCHING.md")).toContain("Azure DevOps");
    expect(byPath.get("START_HERE.md")).toContain("Azure DevOps");
  });
});

describe("the founder is never handed invented content", () => {
  it("flags CORE_ENTITIES and VISION when the founder skips them", () => {
    const { byPath, plan } = render({ coreEntities: undefined, vision: undefined });
    expect(byPath.get("docs/architecture/SYSTEM_OVERVIEW.md")).toContain("[NEEDS CLARIFICATION: CORE_ENTITIES]");
    expect(byPath.get("docs/VISION.md")).toContain("[NEEDS CLARIFICATION: VISION]");
    expect(plan.clarifications).toContain("[NEEDS CLARIFICATION: CORE_ENTITIES]");
    expect(plan.clarifications).toContain("[NEEDS CLARIFICATION: VISION]");
  });

  it("fills CORE_ENTITIES from the interview answer, leaving no marker", () => {
    const { byPath, plan } = render({ coreEntities: "Agencies own Clients; a Client has many Deals." });
    const overview = byPath.get("docs/architecture/SYSTEM_OVERVIEW.md") ?? "";
    expect(overview).toContain("Agencies own Clients; a Client has many Deals.");
    expect(overview).not.toContain("[NEEDS CLARIFICATION: CORE_ENTITIES]");
    expect(plan.clarifications).not.toContain("[NEEDS CLARIFICATION: CORE_ENTITIES]");
    expect(plan.decisions.some((d) => d.token === "CORE_ENTITIES" && d.source === "interview")).toBe(true);
  });

  it("flags a missing payment provider rather than naming one", () => {
    const { byPath } = render({ capabilities: ["payments"], integrations: undefined });
    expect(byPath.get("docs/architecture/SYSTEM_OVERVIEW.md")).toContain("[NEEDS CLARIFICATION:");
    expect(byPath.get("docs/architecture/SYSTEM_OVERVIEW.md")).not.toContain("Stripe");
  });

  it("says so plainly when no capabilities were selected", () => {
    const { byPath } = render({ capabilities: [], authModel: ["public"], tenancy: "single_user" });
    expect(byPath.get("specs/README.md")).toContain("No platform capabilities were selected");
    expect(byPath.get("docs/architecture/SYSTEM_OVERVIEW.md")).toContain("No accounts");
  });
});

describe("the generated stack is stated consistently", () => {
  it("never contradicts itself across documents", () => {
    const { files } = render({ database: "postgres", hosting: "self_host", framework: "vite" });
    const text = allText(files);
    expect(text).not.toContain("Supabase");
    expect(text).not.toContain("Vercel");
    expect(text).not.toContain("Next.js");
  });

  it("uses the package manager the chosen framework actually ships with", () => {
    const next = render({ framework: "nextjs" });
    expect(next.byPath.get("README.md")).toContain("pnpm dev");
    expect(next.byPath.get("START_HERE.md")).toContain("pnpm install");
    expect(next.byPath.get(".github/workflows/ci.yml")).toContain("pnpm/action-setup");

    const vite = render({ framework: "vite" });
    const start = vite.byPath.get("START_HERE.md") ?? "";
    expect(vite.byPath.get("README.md")).toContain("npm run dev");
    expect(start).toContain("npm install");
    expect(start).not.toContain("pnpm");
    // CI, the deploy workflow and every command must agree — no pnpm left anywhere.
    expect(allText(vite.files)).not.toContain("pnpm");
    expect(vite.byPath.get(".github/workflows/ci.yml")).toContain("npm ci");
    expect(vite.byPath.get(".github/workflows/deploy-dev.yml")).toContain("npx vercel@latest");
  });

  it("gives ordered next steps from setup to the implement loop", () => {
    const { byPath } = render();
    const start = byPath.get("START_HERE.md") ?? "";
    for (const step of ["Install dependencies", "/createspec", "/clarify", "/implement", "/analyze", "/pr-check"]) {
      expect(start, `START_HERE.md is missing "${step}"`).toContain(step);
    }
  });
});
