// Tests for the scaffold renderer — the only source of generated output. The invariant skeleton
// always appears, every interview answer visibly reaches a file, and unknown values surface as
// NEEDS CLARIFICATION rather than being guessed.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProjectModel } from "./model.ts";
import { renderScaffold, type TemplateFile } from "./scaffold.ts";
import { uiKitFor } from "../../schemas/src/ui-kits.ts";
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

  it("makes /createspec sync develop into the feature branch before cutting the issue branch", () => {
    // Spec 104: an issue branch cut from a feature branch that is behind `develop` is born stale, and
    // the drift only surfaces as conflicts in its PR. The sync belongs to the generated command, not
    // to a habit the founder has to remember.
    const cmd = byPath.get(".claude/commands/createspec.md") ?? "";
    expect(cmd).toContain("git fetch origin develop");
    expect(cmd).toContain("git merge origin/develop");
    expect(cmd).toContain("git log feature/<name>..origin/develop --oneline");
    // Direction is the constitution's, and a failed sync must never fall through to branch creation.
    expect(cmd).toContain("never straight into an issue branch");
    expect(cmd).toContain("blocking, not best-effort");
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
    // Azure is wired, not warned about: real deploy steps, guarded on the credential the way the
    // Vercel path is. Only self-hosting is genuinely unknowable.
    const deploy = byPath.get(".github/workflows/deploy-dev.yml") ?? "";
    expect(deploy).toContain("Deploy to Azure App Service (DEV)");
    expect(deploy).toContain("azure/webapps-deploy");
    expect(deploy).not.toContain("No deploy steps wired");
    expect(allText(files)).not.toContain("Vercel");
  });

  it("still admits it cannot wire a deploy to the founder's own server", () => {
    const deploy = render({ hosting: "self_host" }).byPath.get(".github/workflows/deploy-dev.yml") ?? "";
    expect(deploy).toContain("No deploy steps wired");
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
    // Installing is `/start`'s job since spec 66 — START_HERE.md points at it rather than repeating it.
    expect(next.byPath.get(".claude/commands/start.md")).toContain("pnpm install");
    expect(next.byPath.get(".github/workflows/ci.yml")).toContain("pnpm/action-setup");

    const vite = render({ framework: "vite" });
    expect(vite.byPath.get("README.md")).toContain("npm run dev");
    expect(vite.byPath.get(".claude/commands/start.md")).toContain("npm install");
    // CI, the deploy workflow and every command must agree — no pnpm left anywhere.
    expect(allText(vite.files)).not.toContain("pnpm");
    expect(vite.byPath.get(".github/workflows/ci.yml")).toContain("npm ci");
    expect(vite.byPath.get(".github/workflows/deploy-dev.yml")).toContain("npx vercel@latest");
  });

  // A founder's first message in a generated repository used to be "what do I do now?" — CLAUDE.md
  // is what the assistant reads before answering it, so the answer belongs there (spec 159).
  it("opens CLAUDE.md with the six things to type, in order", () => {
    const claude = render().byPath.get("CLAUDE.md") ?? "";
    expect(claude).toContain("## Starting a chat here");
    const order = ["/start", "START_HERE.md", "/createspec", "/clarify", "/implement", "/analyze"];
    let at = claude.indexOf("## Starting a chat here");
    for (const step of order) {
      const next = claude.indexOf(step, at);
      expect(next, `CLAUDE.md's first-session table is missing "${step}" in order`).toBeGreaterThan(at);
      at = next;
    }
    // The command deletes itself, so the row has to be conditional rather than a standing promise.
    expect(claude).toContain(".claude/commands/start.md` still exists");
    expect(claude).toContain("Installs the tools, scaffolds the stack");
  });

  // Knowing what /implement did is not knowing what to type next, and the one step nobody can guess
  // is the one outside the terminal: a pushed branch does not merge itself (spec 159).
  it("tells the assistant what to say after each command, merge included", () => {
    const claude = render().byPath.get("CLAUDE.md") ?? "";
    expect(claude).toContain("## After a command finishes");
    // Every command the foundation ships, `/security` included — a command with no next step is the
    // one a founder stops at.
    for (const command of ["/createspec", "/clarify", "/implement", "/analyze", "/push", "/pr-check", "/security"]) {
      expect(claude, `no next step after ${command}`).toContain(`| \`${command}\` |`);
    }
    expect(claude).toContain("**Squash and merge**");
    expect(claude).toContain("`feature/<name>` → `develop` → `main`");
    // After /start the next move is the founder's accounts, named — or the first spec.
    expect(claude).toContain("the Supabase and Vercel accounts only they can create");
    // And a command that failed gets no cheerful pointer at the step after it.
    expect(claude).toMatch(/Never point at the next\s+step of a step that did not finish/);
  });

  it("names the merge in the vocabulary of the host the code is actually on", () => {
    const azure = render({ repoProvider: "azure_devops" }).byPath.get("CLAUDE.md") ?? "";
    expect(azure).toContain("Azure DevOps → Repos → Pull requests");
    expect(azure).toContain("**Complete** the PR");
    expect(azure).toContain("az repos pr create");
    expect(azure).not.toContain("Squash and merge");
    expect(render().byPath.get("CLAUDE.md")).toContain("gh pr create");
  });

  it("gives ordered next steps from /start to the implement loop", () => {
    const { byPath } = render();
    const start = byPath.get("START_HERE.md") ?? "";
    for (const step of ["/start", "/createspec", "/clarify", "/implement", "/analyze", "/pr-check"]) {
      expect(start, `START_HERE.md is missing "${step}"`).toContain(step);
    }
    // The first step has to be the one that makes the others runnable.
    expect(start.indexOf("/start")).toBeLessThan(start.indexOf("/createspec"));
  });
});

/* ── The UI brief, and the answers that had no box (spec 159) ──────────────── */

const UI_DOC = "docs/architecture/UI_ARCHITECTURE.md";

describe("UI_ARCHITECTURE.md is a brief a screen can be built from", () => {
  it("renders every section, with nothing left unresolved", () => {
    const brief = render().byPath.get(UI_DOC) ?? "";
    for (const heading of [
      "## Design direction",
      "## Design system",
      "## References",
      "## Screens & navigation",
      "## Layout, spacing & type",
      "## Colour",
      "## Components",
      "## Interaction & motion",
      "## States",
      "## Design language"
    ]) {
      expect(brief, `the brief is missing "${heading}"`).toContain(heading);
    }
    expect(brief).not.toMatch(/\{\{[A-Z_]+\}\}/);
    // Prose and headings only — the same rule the authoring contract enforces on the model.
    expect(brief).not.toContain("```");
  });

  it("is useful with no design answer at all — that is the common case, not the edge", () => {
    const brief = render().byPath.get(UI_DOC) ?? "";
    expect(brief).toContain("No design direction was described");
    expect(brief).toContain("attached no references");
    // The sections that never needed an answer must still say something worth reading.
    expect(brief).toMatch(/Empty is a designed screen/);
    expect(brief).toMatch(/spacing scale/);
  });

  it("carries one design direction — the founder's, however they arrived at it", () => {
    // The interview merged the picker into the field, so there is exactly one answer to render and
    // nothing downstream has to reconcile a pick with the words beside it (spec 159).
    const brief =
      render({
        uiDirection: "Dense and operational: tables over cards. The inbox is where someone lives."
      }).byPath.get(UI_DOC) ?? "";
    expect(brief).toContain(
      "In the founder's own words: Dense and operational: tables over cards."
    );
    expect(brief).not.toContain("Closest of the starting directions");
  });

  it("names what the founder pointed at, and the one rule about it", () => {
    const brief =
      render({ uiReferenceLinks: "linear.app stripe.com" }).byPath.get(UI_DOC) ?? "";
    expect(brief).toContain("linear.app, stripe.com");
    expect(brief).toMatch(/never as something to copy/);
    expect(brief).toMatch(/Do not reproduce anyone's logo/);
  });

  it("says how many screenshots it read, since nothing else can", () => {
    const model = resolveProjectModel({ ...input, referenceImageCount: 2 });
    const { files } = renderScaffold(TEMPLATE, model);
    const brief = files.find((f) => f.path === UI_DOC)?.content ?? "";
    expect(brief).toContain("2 screenshots were attached");
  });

  /* ── The theme the brief is allowed to name (spec 165) ─────────────────── */

  it("names the theme, the pinned version and the licence when one was picked", () => {
    const kit = uiKitFor("bold_contrast")!;
    const brief = render({ uiKit: "bold_contrast" }).byPath.get(UI_DOC) ?? "";
    expect(brief).toContain(kit.name);
    expect(brief).toContain(kit.source.version);
    expect(brief).toContain(`Licensed ${kit.source.licence}, © ${kit.source.holder}`);
    expect(brief).toContain("THIRD_PARTY_NOTICES.md");
    // The claim the pin exists to make true.
    expect(brief).toMatch(/pinned to that exact version so this section stays true/);
    // And the boundary that keeps a picked look from becoming a picked layout.
    expect(brief).toContain("visual language, not a layout");
    expect(brief).toMatch(/The theme decides how those screens look, never what they are/);
  });

  it("says plainly that nothing was installed when nothing was picked", () => {
    const brief = render().byPath.get(UI_DOC) ?? "";
    expect(brief).toContain("No curated direction was picked");
    // The command by name, not an unrendered token — this value is substituted, never re-expanded.
    expect(brief).toContain("`/start`");
    expect(brief).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it("installs no theme on a stack that brings its own conventions", () => {
    const brief =
      render({
        uiKit: "bold_contrast",
        framework: "custom",
        frameworkOther: "Django 5 with Postgres, managed by uv"
      }).byPath.get(UI_DOC) ?? "";
    expect(brief).toContain("No theme is installed");
    expect(brief).not.toContain("Bold contrast");
    expect(brief).not.toContain("Licensed MIT");
  });

  it("keeps the founder's own reference above the theme they picked", () => {
    // Spec 159's rule, unchanged by a pick becoming installable: our theme is a starting point,
    // their screenshot is theirs and wins where the two disagree.
    const brief =
      render({ uiKit: "soft_minimal", uiReferenceLinks: "linear.app" }).byPath.get(UI_DOC) ?? "";
    expect(brief).toContain("Soft minimal");
    expect(brief).toMatch(/never as something to copy/);
  });
});

describe("an answer that fitted no box still reaches the output", () => {
  it("describes the product the founder described, not the nearest option", () => {
    const text = allText(
      render({ productType: "other", productTypeOther: "A turn-based strategy game for two players." })
        .files
    );
    expect(text).toContain("A turn-based strategy game for two players.");
    // The generic label must not be what a document ends up calling it.
    expect(text).not.toContain("is a software product for");
  });

  it("carries a described isolation model into the data documents", () => {
    const text = allText(
      render({
        tenancy: "other",
        tenancyOther: "Each clinic is a tenant, but a record can be shared for a referral."
      }).files
    );
    expect(text).toContain("Each clinic is a tenant");
  });

  it("gives a described capability its own spec brief, like every other one", () => {
    const text = allText(
      render({
        capabilities: ["other"],
        capabilitiesOther: "Offline sync — the field app keeps working with no signal."
      }).files
    );
    expect(text).toContain("Offline sync");
    expect(text).toContain("The capability you described");
  });

  it("asks for the description rather than inventing one when it is missing", () => {
    const text = allText(render({ capabilities: ["other"] }).files);
    expect(text).toContain("[NEEDS CLARIFICATION: you selected a capability of your own");
  });
});

describe("a database and a deploy target the founder named", () => {
  it("writes the setup guide for their database rather than assuming Postgres of it", () => {
    const text = allText(
      render({ database: "other", databaseOther: "MongoDB Atlas with migrate-mongo" }).files
    );
    expect(text).toContain("MongoDB Atlas with migrate-mongo");
    // The two things that would be wrong to assume of a database nobody here has seen.
    expect(text).not.toContain("`DATABASE_URL`");
    expect(text).toContain("that database's own migration tool");
  });

  it("names their deploy target, and says plainly that the workflow is a placeholder", () => {
    const text = allText(render({ hosting: "other", hostingOther: "Fly.io" }).files);
    expect(text).toContain("Fly.io");
    expect(text).toContain("nothing here has seen Fly.io");
    // The self-hosting section would be a different, wrong story about their infrastructure.
    expect(text).not.toContain("## 2. Your own server");
  });

  it("still says something sensible when the field was left empty", () => {
    const text = allText(render({ hosting: "other", database: "other" }).files);
    expect(text).toContain("your own deploy target");
    expect(text).toContain("the database you described");
  });
});

describe("what the product is not doing", () => {
  it("is no longer asked for, and the document says so rather than inventing one", () => {
    const claude = render().byPath.get("CLAUDE.md") ?? "";
    expect(claude).toContain("Not yet decided");
  });

  it("is still carried when something else derived it — an import, or an older answer", () => {
    const claude =
      render({ nonGoals: "No accounting. No native app in year one." }).byPath.get("CLAUDE.md") ?? "";
    expect(claude).toContain("No accounting. No native app in year one.");
  });
});
