// Tests for the `/security` command every foundation ships (spec 157).
//
// Like the first-run commands, `/security` is instruction text an assistant executes, so what is
// testable here is what the renderer puts in the repository: that it ships whatever the project was
// generated from, that a foundation without it is rejected, and that the limits which make the
// command safe to run — nothing visible changed without a yes, nothing installed, nothing sent
// anywhere — are actually written down. Whether the assistant then finds a vulnerability is the
// manual run recorded in the spec.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GenerationError, generate } from "./index.ts";
import { commandPath, resolveProjectModel } from "./model.ts";
import { renderScaffold, type TemplateFile } from "./scaffold.ts";
import type { InterviewAnswers, ProjectOrigin } from "../../schemas/src/types.ts";

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
const SECURITY = ".claude/commands/security.md";

const BASE: InterviewAnswers = {
  productType: "saas",
  vision: "The system of record every agency runs on.",
  mvpFocus: "Log a client and never miss a follow-up.",
  coreEntities: "Agencies own Clients; a Client has many Follow-ups.",
  tenancy: "organizations",
  authModel: ["email_password"],
  capabilities: [],
  dataSensitivity: "standard",
  scale: "validate",
  framework: "nextjs",
  database: "supabase",
  hosting: "vercel",
  repoProvider: "github",
  team: "solo"
};

const NEW: ProjectOrigin = { kind: "new" };
const IMPORTED: ProjectOrigin = { kind: "imported", stackDetected: true };
const IMPORTED_EMPTY: ProjectOrigin = { kind: "imported", stackDetected: false };
const ORIGINS = [NEW, IMPORTED, IMPORTED_EMPTY];

function model(origin: ProjectOrigin, answers: InterviewAnswers = BASE) {
  return resolveProjectModel({
    name: "Loop CRM",
    description: "A lightweight CRM for small agencies.",
    answers,
    origin
  });
}

/** Collapse wrapping, so an assertion about a sentence survives the file being re-wrapped. */
const prose = (text: string): string => text.replace(/\s+/g, " ");

function render(origin: ProjectOrigin, answers: InterviewAnswers = BASE) {
  const { files } = renderScaffold(TEMPLATE, model(origin, answers));
  const byPath = (p: string) => files.find((f) => f.path === p)?.content ?? "";
  return { files, byPath, paths: files.map((f) => f.path), security: byPath(SECURITY) };
}

describe("every foundation ships /security", () => {
  it("ships it whatever the project was generated from", () => {
    for (const origin of ORIGINS) {
      expect(render(origin).paths, `origin: ${origin.kind}`).toContain(SECURITY);
    }
  });

  it("ships it alongside the first-run command rather than instead of one", () => {
    // /start and /cleanup are alternatives (spec 91); /security has no counterpart to displace.
    for (const origin of ORIGINS) {
      const { paths } = render(origin);
      expect(paths).toContain(commandPath(model(origin)));
      expect(paths).toContain(SECURITY);
    }
  });

  it("rejects a foundation that is missing it", () => {
    const without = TEMPLATE.filter((f) => f.path !== SECURITY);
    for (const origin of ORIGINS) {
      let issues: string[] = [];
      try {
        generate(without, model(origin));
      } catch (err) {
        issues = err instanceof GenerationError ? err.issues : [String(err)];
      }
      expect(issues, `origin: ${origin.kind}`).toContain(`missing required file: ${SECURITY}`);
    }
  });

  it("renders with no unresolved token, for every stack", () => {
    const custom = { ...BASE, framework: "custom", frameworkOther: "Rails 8 with Postgres" } satisfies InterviewAnswers;
    for (const answers of [BASE, { ...BASE, framework: "vite" } satisfies InterviewAnswers, custom]) {
      const security = render(NEW, answers).security;
      expect(security).not.toBe("");
      expect(security).not.toMatch(/\{\{[A-Z0-9_]+\}\}/);
    }
  });

  it("names the project rather than reading like a template", () => {
    expect(render(NEW).security).toContain("Loop CRM");
  });

  it("names the verification bar this project actually uses", () => {
    const security = render(NEW).security;
    for (const command of ["pnpm typecheck", "pnpm lint", "pnpm test", "pnpm build"]) {
      expect(security).toContain(command);
    }
    // A Vite project runs its scripts through npm, and the command has to say so.
    expect(render(NEW, { ...BASE, framework: "vite" }).security).toContain("npm run typecheck");
  });
});

describe("the limits that make /security safe to run", () => {
  const security = render(NEW).security;

  it("covers the whole repository and refuses to be narrowed", () => {
    expect(security).toContain("takes no arguments");
    expect(prose(security)).toContain("it is a false all-clear");
  });

  it("changes nothing a user can see without being told yes", () => {
    expect(security).toContain("It changes nothing a user can see.");
    expect(prose(security)).toContain("*proposed*, never applied");
    expect(prose(security)).toContain("Silence is not consent.");
  });

  it("installs nothing and sends nothing anywhere", () => {
    expect(security).toContain("It installs nothing and downloads nothing.");
    expect(security).toContain("It sends nothing anywhere.");
    expect(prose(security)).toContain("this command reads code, it does not attack anything");
  });

  it("reverts a fix that breaks the build instead of leaving it in", () => {
    expect(security).toContain("revert that fix");
    expect(prose(security)).toContain("is a worse outcome than the vulnerability");
  });

  it("forbids the changes that cannot be undone", () => {
    for (const forbidden of ["Delete code", "Rewrite git history", "Touch remotes"]) {
      expect(security).toContain(forbidden);
    }
  });
});

describe("what /security looks for and how it reports it", () => {
  const security = render(NEW).security;

  it("names every category rather than trusting the assistant to remember them", () => {
    for (const category of [
      "Secrets and credentials.",
      "Authentication and authorization.",
      "Injection.",
      "Output and rendering.",
      "Requests and sessions.",
      "Validation.",
      "Abuse and cost.",
      "Cryptography and verification.",
      "Leakage.",
      "Dependencies and pipeline."
    ]) {
      expect(security).toContain(category);
    }
    // The ones an assistant left to itself skips: text a model wrote is input too.
    expect(prose(security)).toContain("prompt injection");
  });

  it("searches the history for secrets, and asks for rotation rather than deletion", () => {
    expect(prose(security)).toContain("search the commit history for secrets");
    expect(prose(security)).toContain("reported as *rotate this*, not *delete that line*");
  });

  it("requires severity, an exploitation path and evidence, or the finding is a suspicion", () => {
    for (const level of ["`Critical`", "`High`", "`Medium`", "`Low`"]) {
      expect(security).toContain(level);
    }
    expect(security).toContain("**suspicion**");
    expect(security).toContain("`file:line`");
  });

  it("writes a report with every section, including what it could not fix", () => {
    for (const section of [
      "**Header**",
      "**Summary**",
      "**Fixed**",
      "**Found, not fixed**",
      "**Needs you, outside the code**",
      "**Checked and clean**",
      "**Next**"
    ]) {
      expect(security).toContain(section);
    }
  });

  it("keeps the report out of version control, and says why", () => {
    expect(security).toContain("SECURITY_AUDIT.md` is in\n`.gitignore`");
    expect(prose(security)).toContain("a map handed to whoever finds the repository");
  });

  it("re-verifies the last report before it looks for anything new", () => {
    expect(security).toContain("## 1. Start from the last report");
    expect(prose(security)).toContain("re-check every line of it before looking for anything new");
    // The five verdicts a previous entry can get. "Regressed" is the one that earns the section: a
    // guard everyone believes in is the one nobody re-checks.
    for (const verdict of ["**Still fixed.**", "**Regressed.**", "**Still open.**", "**Resolved another way.**", "**Vanished.**"]) {
      expect(security).toContain(verdict);
    }
    expect(prose(security)).toContain("run it again");
  });

  it("keeps a run log with the clock time, not just the date", () => {
    expect(security).toContain("**Run log**");
    expect(security).toContain("| Run | Date and time | Commit | Found | Fixed | Left open |");
    expect(prose(security)).toContain("the clock time, with the offset");
    expect(prose(security)).toContain("no row is ever removed");
  });

  it("rewrites the report each run without losing what came before", () => {
    expect(security).toContain("rewritten from scratch every run");
    expect(security).toContain("**What a rewrite must never lose.**");
    expect(prose(security)).toContain("marked resolved with the date and time it was fixed");
    expect(prose(security)).toContain("**Everything a human wrote**, word for word");
  });

  it("never lets the assistant declare the project secure", () => {
    expect(security).toContain("Never report that the project is secure");
  });
});
