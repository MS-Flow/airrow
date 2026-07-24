// Tests for the scaffold renderer: the invariant skeleton always appears, interview values fill the
// tailored slots, and unknown values surface as NEEDS CLARIFICATION rather than being guessed.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProjectModel } from "./model.ts";
import { renderScaffold, type TemplateFile } from "./scaffold.ts";
import type { ResolveInput } from "./model.ts";

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

const INVARIANT_SKELETON = [
  ".claude/commands/createspec.md",
  ".claude/commands/clarify.md",
  ".claude/commands/implement.md",
  ".claude/commands/analyze.md",
  ".claude/commands/push.md",
  ".claude/commands/pr-check.md",
  ".claude/spec-kit/constitution.md",
  ".claude/spec-kit/spec-template.md",
  "docs/architecture/BRANCHING.md",
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

describe("renderScaffold", () => {
  const template = loadTemplate();
  const model = resolveProjectModel(input);
  const { files, plan } = renderScaffold(template, model);
  const byPath = new Map(files.map((f) => [f.path, f]));

  it("always emits the invariant skeleton regardless of the interview", () => {
    for (const p of INVARIANT_SKELETON) {
      expect(byPath.has(p), `missing invariant file: ${p}`).toBe(true);
    }
  });

  it("substitutes the project name everywhere, leaving no {{PROJECT_NAME}} tokens", () => {
    for (const f of files) {
      expect(f.content, `unresolved token in ${f.path}`).not.toContain("{{PROJECT_NAME}}");
    }
    expect(byPath.get("README.md")?.content).toContain("Loop CRM");
  });

  it("fills tailored slots from interview answers", () => {
    const constitution = byPath.get(".claude/spec-kit/constitution.md")?.content ?? "";
    // multi-tenant selected -> RLS + organization_id invariant appears
    expect(constitution).toContain("organization_id");
    expect(constitution).toContain("`pnpm test`");
    const ci = byPath.get(".github/workflows/ci.yml")?.content ?? "";
    expect(ci).toContain("pnpm/action-setup@v4");
    expect(ci).not.toContain("{{CI_SETUP_STEPS}}");
  });

  it("keeps the Process and Testing invariants verbatim (portable, never weakened)", () => {
    const c = byPath.get(".claude/spec-kit/constitution.md")?.content ?? "";
    expect(c).toContain("PR direction is strict and never skipped");
    expect(c).toContain("co-located");
  });

  it("flags CORE_ENTITIES when the founder skips it (never guesses)", () => {
    // coreEntities is optional; when unanswered the token must be flagged, not invented.
    const overview = byPath.get("docs/architecture/SYSTEM_OVERVIEW.md")?.content ?? "";
    expect(overview).toContain("[NEEDS CLARIFICATION: CORE_ENTITIES]");
    expect(plan.clarifications).toContain("[NEEDS CLARIFICATION: CORE_ENTITIES]");
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
});

describe("core entities from the interview", () => {
  it("fills CORE_ENTITIES from the interview answer, leaving no marker", () => {
    const model = resolveProjectModel({
      ...input,
      answers: { ...input.answers, coreEntities: "Agencies own Clients; a Client has many Deals." }
    });
    const { files, plan } = renderScaffold(loadTemplate(), model);
    const overview = files.find((f) => f.path === "docs/architecture/SYSTEM_OVERVIEW.md")?.content ?? "";
    expect(overview).toContain("Agencies own Clients; a Client has many Deals.");
    expect(overview).not.toContain("[NEEDS CLARIFICATION: CORE_ENTITIES]");
    expect(plan.clarifications).not.toContain("[NEEDS CLARIFICATION: CORE_ENTITIES]");
    expect(plan.decisions.some((d) => d.token === "CORE_ENTITIES" && d.source === "interview")).toBe(true);
  });
});

describe("single-tenant projects", () => {
  it("scopes data to the owning user instead of an organization", () => {
    const model = resolveProjectModel({
      name: "Notes",
      description: "Personal notes app.",
      answers: { productType: "saas", audience: "b2c", tenancy: "single_user", authModel: ["email_password"], framework: "nextjs" }
    });
    const { files } = renderScaffold(loadTemplate(), model);
    const c = files.find((f) => f.path === ".claude/spec-kit/constitution.md")?.content ?? "";
    expect(c).toContain("scoped to their owning user");
    expect(c).not.toContain("organization_id");
  });
});
