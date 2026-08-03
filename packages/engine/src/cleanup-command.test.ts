// Tests for which first-run command a foundation ships, and for the `/cleanup` it ships to an
// imported project (spec 91).
//
// Like `/start`, `/cleanup` is instruction text an assistant executes, so what is testable here is
// what the renderer puts in the repository: that exactly one of the two commands is present, that it
// is the one this project's origin calls for, and that no document names the command the founder
// does not have. Whether the assistant then behaves is the manual check recorded in the spec.
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
const START = ".claude/commands/start.md";
const CLEANUP = ".claude/commands/cleanup.md";

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
  return { files, byPath, paths: files.map((f) => f.path), text: files.map((f) => f.content).join("\n") };
}

describe("a foundation ships exactly one first-run command", () => {
  it("gives a project started from nothing /start, and not /cleanup", () => {
    const { paths } = render(NEW);
    expect(paths).toContain(START);
    expect(paths).not.toContain(CLEANUP);
  });

  it("gives an imported project with code /cleanup, and not /start", () => {
    const { paths } = render(IMPORTED);
    expect(paths).toContain(CLEANUP);
    expect(paths).not.toContain(START);
  });

  it("gives an import that held no code /start — there is nothing to read", () => {
    const { paths } = render(IMPORTED_EMPTY);
    expect(paths).toContain(START);
    expect(paths).not.toContain(CLEANUP);
  });

  it("never ships both and never ships neither, whatever the origin", () => {
    for (const origin of [NEW, IMPORTED, IMPORTED_EMPTY]) {
      const { paths } = render(origin);
      const shipped = paths.filter((p) => p === START || p === CLEANUP);
      expect(shipped).toEqual([commandPath(model(origin))]);
    }
  });

  it("rejects a foundation missing the command its origin calls for", () => {
    const issuesFrom = (template: TemplateFile[], origin: ProjectOrigin): string[] => {
      try {
        generate(template, model(origin));
      } catch (err) {
        return err instanceof GenerationError ? err.issues : [String(err)];
      }
      return [];
    };
    expect(issuesFrom(TEMPLATE.filter((f) => f.path !== CLEANUP), IMPORTED)).toContain(
      `missing required file: ${CLEANUP}`
    );
    expect(issuesFrom(TEMPLATE.filter((f) => f.path !== START), NEW)).toContain(
      `missing required file: ${START}`
    );
  });
});

describe("the /cleanup command", () => {
  it("renders with no unresolved token, for every stack", () => {
    const custom = { ...BASE, framework: "custom", frameworkOther: "Rails 8 with Postgres" } satisfies InterviewAnswers;
    for (const answers of [BASE, { ...BASE, framework: "vite" } satisfies InterviewAnswers, custom]) {
      const cleanup = render(IMPORTED, answers).byPath(CLEANUP);
      expect(cleanup).not.toBe("");
      expect(cleanup).not.toMatch(/\{\{[A-Z0-9_]+\}\}/);
    }
  });

  it("names the project rather than reading like a template", () => {
    expect(render(IMPORTED).byPath(CLEANUP)).toContain("Loop CRM");
  });

  it("states the claims it must check against the repository", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    // The stack in these documents came from an interview, not from reading the code — saying so is
    // what makes /cleanup a check rather than a proofread.
    expect(cleanup).toContain("not from reading it");
    expect(cleanup).toContain("the repository is right");
    for (const command of ["pnpm dev", "pnpm build", "pnpm typecheck", "pnpm lint", "pnpm test"]) {
      expect(cleanup).toContain(command);
    }
  });

  it("forbids changing code, and says so about each kind of file", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    expect(cleanup).toContain("It changes no code.");
    for (const kind of ["dependency", "config file", "migration"]) {
      expect(cleanup).toContain(kind);
    }
  });

  it("tells the assistant which of the two files is Airrow's, and leaves the founder's alone", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    expect(cleanup).toContain("README.airrow.md");
    expect(prose(cleanup)).toContain("the `.airrow` file is this foundation's version");
    expect(cleanup).toContain("Leave the founder's file alone");
    expect(cleanup).toContain("It deletes nothing, and it renames nothing.");
  });

  it("goes looking for every .airrow document rather than waiting to be handed one", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    expect(cleanup).toContain("git ls-files '*.airrow.md'");
    expect(prose(cleanup)).toContain("work through every single one");
  });

  it("explains why a non-document conflict has no .airrow file", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    expect(cleanup).toContain("Only documents arrive this way");
    expect(cleanup).toContain(".github/workflows/ci.yml");
  });

  it("leaves the swap to the founder rather than doing it for them", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    expect(cleanup).toContain("git mv README.airrow.md README.md");
    expect(cleanup).toContain("Nothing here does that for them");
  });

  it("reports old assistant instructions instead of removing them", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    expect(cleanup).toContain(".cursorrules");
    expect(cleanup).toContain("report them, delete nothing");
  });

  it("keeps the founder's own documents and the constitution out of its scope", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    expect(cleanup).toContain("Read, never rewrite");
    expect(cleanup).toContain(".claude/spec-kit/constitution.md");
  });

  it("leaves what it cannot establish as a marker rather than a guess", () => {
    expect(render(IMPORTED).byPath(CLEANUP)).toContain("[NEEDS CLARIFICATION:");
  });

  it("stops at this machine, like /start does", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    expect(cleanup).toContain("No remote");
    expect(cleanup).toContain("no secrets written");
  });

  it("sets up the branch model the workflow runs on", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    expect(cleanup).toContain("## 5. The branch model");
    expect(cleanup).toContain("git init -b main");
    expect(prose(cleanup)).toContain("`develop` from the trunk");
    expect(cleanup).toContain("BRANCHING.md");
  });

  it("leaves an existing trunk's name alone and adapts the documents to it instead", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    // Renaming `master` breaks branch protection, open pull requests and every CI trigger pointing
    // at it — none of which this command can put back.
    expect(cleanup).toContain("**Do not rename it.**");
    expect(prose(cleanup)).toContain("the trunk's name is a fact about this repository");
  });

  it("forbids the git operations that cannot be undone", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    for (const forbidden of ["rebase", "reset --hard", "--force", "No branch renamed and none deleted"]) {
      expect(cleanup).toContain(forbidden);
    }
  });
});

describe("the documents match the command the founder actually has", () => {
  it("never names /start anywhere in an imported foundation", () => {
    const { text } = render(IMPORTED);
    expect(text).not.toContain("/start");
  });

  it("never names /cleanup anywhere in a new project's foundation", () => {
    const { text } = render(NEW);
    expect(text).not.toContain("/cleanup");
  });

  it("opens START_HERE.md with the command this project ships", () => {
    expect(render(IMPORTED).byPath("START_HERE.md")).toContain("/cleanup");
    expect(render(NEW).byPath("START_HERE.md")).toContain("/start");
  });

  it("keeps the verification bar in START_HERE.md for both origins", () => {
    for (const origin of [NEW, IMPORTED]) {
      const here = render(origin).byPath("START_HERE.md");
      for (const command of ["pnpm dev", "pnpm typecheck", "pnpm lint", "pnpm test"]) {
        expect(here).toContain(command);
      }
    }
  });

  it("carries the ceiling for its own command into the generated constitution", () => {
    expect(render(IMPORTED).byPath(".claude/spec-kit/constitution.md")).toContain(
      "`/cleanup` describes, the spec loop builds"
    );
    expect(render(NEW).byPath(".claude/spec-kit/constitution.md")).toContain(
      "`/start` sets up, the spec loop builds"
    );
  });

  it("does not tell an imported project to push a develop branch a command never created", () => {
    const here = render(IMPORTED).byPath("START_HERE.md");
    expect(here).toContain("existing GitHub repository");
    expect(here).not.toContain("Create an empty repository");
  });

  it("does not tell CI to run a command this repository does not have", () => {
    const ci = render(IMPORTED).byPath(".github/workflows/ci.yml");
    expect(ci).toContain("push that project's code alongside these documents");
    expect(ci).not.toContain("run /start");
  });
});

/* ── /cleanup does not learn /start's new trick (spec 159) ─────────────────── */

describe("/cleanup still deletes nothing", () => {
  // CLAUDE.md's first-session table is the same six rows for both origins, but row 1 is not the same
  // promise: `/cleanup` installs nothing, builds nothing and stays put.
  it("describes its own command in CLAUDE.md, and promises no self-removal", () => {
    const claude = render(IMPORTED).byPath("CLAUDE.md");
    expect(claude).toContain("## Starting a chat here");
    expect(claude).toContain("rewrites these documents to match. Changes no code, deletes nothing");
    expect(claude).not.toContain("then removes itself");
    expect(claude).toContain(".claude/commands/cleanup.md` still exists");
  });

  // Both origins need Claude Code before anything in the guide runs; only one of them then has a
  // command that installs things, and START_HERE must not promise the founder otherwise.
  // The "what next" table has a row for the command this project has, and only that one — the
  // imported foundation must not mention a /start it does not ship.
  it("points an imported project at its own first command and then the spec loop", () => {
    const claude = render(IMPORTED).byPath("CLAUDE.md");
    expect(claude).toContain("## After a command finishes");
    expect(claude).toContain("| `/cleanup` | These documents now describe the code that is really here.");
    expect(claude).not.toContain("| `/start` |");
  });

  it("asks an imported project for Claude Code and nothing else", () => {
    const here = render(IMPORTED).byPath("START_HERE.md");
    expect(here).toMatch(/\*\*First, install \[Claude Code\]/);
    expect(here).toContain("`/cleanup` installs nothing");
    expect(here).not.toContain("are all step 1 of the command below");
  });

  it("does not remove itself, whatever /start now does", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    expect(cleanup).not.toMatch(/delete .*cleanup\.md/i);
    expect(cleanup).not.toMatch(/remove this command/i);
    // Its own ceiling, restated: the command that changes no code cannot start by changing a file.
    expect(prose(cleanup)).toMatch(/deletes nothing|delete nothing|never deletes/i);
  });

  // A theme is something a command installs, and this command installs nothing (spec 165).
  it("installs no theme and claims no licence, however the founder answered", () => {
    const picked = { ...BASE, uiKit: "stark_terminal" } satisfies InterviewAnswers;
    const { files, byPath } = render(IMPORTED, picked);

    expect(byPath("docs/architecture/UI_ARCHITECTURE.md")).toContain(
      "already had a stack when the foundation was written"
    );
    expect(byPath("docs/architecture/UI_ARCHITECTURE.md")).not.toContain("Stark & technical");
    // No install means nothing to attribute — a notice here would name code nobody added.
    expect(files.some((f) => f.path === "THIRD_PARTY_NOTICES.md")).toBe(false);
  });

  it("still ships the notice to a new project on the same stack", () => {
    // The gate is what the foundation installs, not which stack it is — the contrast that proves it.
    expect(render(NEW).files.some((f) => f.path === "THIRD_PARTY_NOTICES.md")).toBe(true);
  });
});
