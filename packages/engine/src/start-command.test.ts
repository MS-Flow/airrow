// Tests for the `/start` command the foundation ships (spec 66).
//
// `/start` is instruction text an assistant executes, so what is testable here is what the renderer
// puts in the file: that the bootstrap matches the framework the founder chose, that the commands it
// names are the same ones every other generated file names, and that the ceiling on how much it
// builds is actually written down. Whether the stack then goes green is a manual check, recorded in
// the spec — running `create-next-app` in CI would break the "no network" testing invariant.
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
const START = ".claude/commands/start.md";

function render(answers: InterviewAnswers) {
  const model = resolveProjectModel({
    name: "Loop CRM",
    description: "A lightweight CRM for small agencies.",
    answers
  });
  const { files } = renderScaffold(TEMPLATE, model);
  const byPath = (p: string) => files.find((f) => f.path === p)?.content ?? "";
  return { files, byPath, start: byPath(START) };
}

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
  database: "supabase",
  hosting: "vercel",
  repoProvider: "github",
  team: "solo"
};

const nextjs = { ...BASE, framework: "nextjs" } satisfies InterviewAnswers;
const vite = { ...BASE, framework: "vite" } satisfies InterviewAnswers;
const custom = {
  ...BASE,
  framework: "custom",
  frameworkOther: "Django 5 with Postgres, managed by uv"
} satisfies InterviewAnswers;

describe("the foundation ships a /start command", () => {
  it("emits it for every framework, with no unresolved token", () => {
    for (const answers of [nextjs, vite, custom]) {
      const { start } = render(answers);
      expect(start).not.toBe("");
      expect(start).not.toMatch(/\{\{[A-Z0-9_]+\}\}/);
    }
  });

  it("names the project rather than reading like a template", () => {
    expect(render(nextjs).start).toContain("Loop CRM");
  });
});

describe("the bootstrap matches the framework the founder chose", () => {
  it("scaffolds Next.js with pnpm", () => {
    const { start } = render(nextjs);
    expect(start).toContain("create next-app@latest");
    expect(start).toContain("pnpm install");
    expect(start).not.toContain("create vite@latest");
  });

  it("scaffolds Vite with npm — the package manager that stack defaults to", () => {
    const { start } = render(vite);
    expect(start).toContain("create vite@latest");
    expect(start).toContain("npm install");
    expect(start).not.toContain("create next-app@latest");
  });

  it("passes every flag, so the scaffolder never stops to ask a question", () => {
    const { start } = render(nextjs);
    for (const flag of ["--ts", "--tailwind", "--eslint", "--app", "--src-dir", "--use-pnpm", "--yes"]) {
      expect(start).toContain(flag);
    }
    expect(render(vite).start).toContain("--no-interactive");
  });

  // Both generators refuse a directory that already has a README.md, and this one does. Scaffolding
  // in place was the first thing tried and it failed against the real tool — see spec 66.
  it("scaffolds into a throwaway directory rather than on top of the foundation", () => {
    for (const answers of [nextjs, vite]) {
      const { start } = render(answers);
      expect(start).toContain("loop-crm-scaffold");
      expect(start).toMatch(/skipping any\s+path that already exists/);
    }
  });

  // create-next-app rejects a directory name starting with a period, and derives the package name
  // from it — both learned by running the real tool (spec 66).
  it("uses a scaffold directory npm will accept, and repairs the package name after the move", () => {
    const { start } = render(nextjs);
    expect(start).not.toMatch(/\.airrow-scaffold|\s\.[a-z-]+-scaffold/);
    expect(start).toContain("set `name` in");
  });

  it("never offers create-vite's --overwrite, which deletes the foundation", () => {
    expect(render(vite).start).not.toContain("--overwrite");
  });

  // Unpinned, this installed a vitest that would not start — found on the first real run (spec 66).
  it("pins the test runner's major, unlike the one-shot scaffolders", () => {
    for (const answers of [nextjs, vite]) {
      expect(render(answers).start).toContain("vitest@^3");
    }
  });

  it("admits it cannot bootstrap a stack the founder described, rather than guessing", () => {
    const { start } = render(custom);
    expect(start).toContain("Django 5 with Postgres, managed by uv");
    expect(start).not.toContain("create next-app@latest");
    expect(start).not.toContain("create vite@latest");
  });
});

describe("the commands /start makes real are the ones every other file names", () => {
  it("agrees with START_HERE.md, CLAUDE.md and the CI workflow", () => {
    for (const answers of [nextjs, vite]) {
      const { start, byPath } = render(answers);
      const run = answers.framework === "vite" ? "npm run" : "pnpm";
      for (const script of ["dev", "typecheck", "lint", "test"]) {
        const command = `${run} ${script}`;
        expect(start).toContain(command);
        expect(byPath("START_HERE.md")).toContain(command);
        expect(byPath("CLAUDE.md")).toContain(command);
      }
      // build is in the verification bar /start runs, and in CLAUDE.md — but not in START_HERE.md.
      expect(start).toContain(`${run} build`);
      const ci = byPath(".github/workflows/ci.yml");
      for (const script of ["typecheck", "lint", "test"]) {
        expect(ci).toContain(`${run} ${script}`);
      }
    }
  });
});

describe("bare minimum is stated as a ceiling, not a starting budget", () => {
  it("says what to build and, as plainly, what not to", () => {
    const { start } = render(nextjs);
    expect(start).toContain("ceiling");
    expect(start).toMatch(/No features/i);
    expect(start).toContain("/createspec");
  });

  it("draws the minimum from the founder's own answers", () => {
    const { start } = render(nextjs);
    expect(start).toContain("Log a client and never miss a follow-up.");
    expect(start).toContain("Agencies own Clients");
  });

  it("invents no core objects when the founder named none", () => {
    const { start } = render({ ...nextjs, coreEntities: "" });
    expect(start).toContain("do not invent any");
  });
});

describe(".env.example is created, not assumed", () => {
  // Four generated documents told the founder to copy a file the template never shipped.
  it("writes the file the rest of the foundation already references", () => {
    for (const answers of [nextjs, vite, custom]) {
      expect(render(answers).start).toContain("Create `.env.example`");
    }
  });

  it("names the variables the chosen database actually needs, and no values", () => {
    expect(render(nextjs).start).toContain("NEXT_PUBLIC_SUPABASE_URL=");
    const postgres = render({ ...nextjs, database: "postgres" }).start;
    expect(postgres).toContain("DATABASE_URL=");
    expect(postgres).not.toContain("SUPABASE");
  });
});

describe("/start stops at the machine boundary", () => {
  it("initialises git locally on the trunk the branch model expects, not git's default", () => {
    const { start } = render(nextjs);
    expect(start).toContain("git init -b main");
    expect(start).toContain("develop");
    expect(start).toMatch(/No remote/i);
  });

  it("names no provisioning, deployment or secret writing as something it does", () => {
    const { start } = render(nextjs);
    // Whitespace-tolerant: the prose is hard-wrapped, so a phrase can straddle a line break.
    expect(start).toMatch(/no\s+provisioning\s+a\s+database/i);
    expect(start).toMatch(/no\s+deploying/i);
    expect(start).toMatch(/no\s+writing\s+secrets/i);
  });
});

describe("START_HERE.md describes the real order", () => {
  it("puts /start first and the accounts after it", () => {
    const here = render(nextjs).byPath("START_HERE.md");
    expect(here.indexOf("/start")).toBeLessThan(here.indexOf("Supabase"));
    expect(here.indexOf("/start")).toBeLessThan(here.indexOf("/createspec"));
  });

  it("no longer asks the founder to install what /start installs", () => {
    const here = render(nextjs).byPath("START_HERE.md");
    expect(here).not.toContain("corepack enable");
  });
});

describe("CI does not go red on a repo that has not run /start", () => {
  it("gates the verification job on the stack existing", () => {
    const ci = render(nextjs).byPath(".github/workflows/ci.yml");
    expect(ci).toContain("if [ -f package.json ]; then");
    expect(ci).toContain("needs.detect.outputs.ready == 'true'");
  });

  it("gates a custom stack on its commands being real, since no file marks it", () => {
    const ci = render(custom).byPath(".github/workflows/ci.yml");
    expect(ci).not.toContain("if [ -f package.json ]; then");
    expect(ci).toContain('echo "ready=false"');
  });
});
