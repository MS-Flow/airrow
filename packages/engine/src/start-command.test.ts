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

  // A founder's first real /start ended with their assistant reporting that CLAUDE.md named
  // Tailwind and shadcn/ui while the screen it had just built was plain CSS. Neither document was
  // wrong — the install step was missing.
  it("installs the design system its own documents name as the stack", () => {
    for (const answers of [nextjs, vite]) {
      const { start, byPath } = render(answers);
      expect(byPath("CLAUDE.md")).toContain("Tailwind + shadcn/ui");
      expect(start).toContain("shadcn@latest init");
      expect(start).toContain("Tailwind");
    }
    // create-vite ships neither; create-next-app ships Tailwind and stops there.
    expect(render(vite).start).toContain("npm install tailwindcss @tailwindcss/vite");
    expect(render(nextjs).start).toContain("--tailwind");
  });

  it("initialises the design system without installing components ahead of a spec", () => {
    const { start } = render(nextjs);
    expect(start).toContain("installs **no components**");
    expect(start).toContain("when a spec calls for one");
  });

  it("runs the one-off tools with the package manager the stack actually uses", () => {
    expect(render(nextjs).start).toContain("pnpm dlx shadcn@latest");
    expect(render(vite).start).toContain("npx shadcn@latest");
  });

  it("admits it cannot bootstrap a stack the founder described, rather than guessing", () => {
    const { start } = render(custom);
    expect(start).toContain("Django 5 with Postgres, managed by uv");
    expect(start).not.toContain("create next-app@latest");
    expect(start).not.toContain("create vite@latest");
  });

  // A founder's stack description may or may not end in a period, and the prefilled standard ones
  // are fragments. Appending one blindly put "for tests.." in the first instruction they follow.
  it("closes the stack it names as one sentence, whichever way the founder wrote it", () => {
    const scaffoldStep = (answers: InterviewAnswers) =>
      render(answers).start.split("\n").find((line) => line.includes("**Scaffold ")) ?? "";
    expect(scaffoldStep(custom)).toContain("managed by uv.**");
    const ended = { ...custom, frameworkOther: "Django 5 with Postgres, managed by uv." };
    expect(scaffoldStep(ended)).toContain("managed by uv.**");
    expect(scaffoldStep(ended)).not.toContain("..");
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

  // Without this the ceiling reads as forbidding the design system section 1 just installed, and
  // the founder gets a plain-CSS screen plus a question about which document to believe.
  it("puts styling inside the ceiling rather than leaving it to be guessed at", () => {
    expect(render(nextjs).start).toContain("design system and using it is not a feature");
    expect(render(custom).start).toMatch(/Style it the way this stack styles things/);
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

describe("a product type the golden path does not cover", () => {
  // The stack question is now asked of everyone; this covers the answer set that predates it, which
  // used to resolve to Vite and hand a mobile founder a web SPA.
  const mobile = { ...BASE, productType: "mobile_app", framework: undefined } satisfies InterviewAnswers;

  it("writes the foundation for the standard stack of that product type", () => {
    const { start, byPath } = render(mobile);
    expect(start).toContain("Expo");
    expect(byPath("CLAUDE.md")).toContain("Expo");
  });

  it("scaffolds nothing it cannot scaffold, and claims no design system it did not install", () => {
    const { start, byPath } = render(mobile);
    expect(start).not.toContain("create vite@latest");
    expect(start).not.toContain("create next-app@latest");
    expect(start).not.toContain("shadcn@latest init");
    expect(byPath("CLAUDE.md")).not.toContain("Tailwind + shadcn/ui");
  });

  // The reported case, verbatim: a founder chose "Something else" and typed one line. Every command
  // in every generated file came out as a clarification marker.
  it("runs on a one-line stack description rather than filling the files with markers", () => {
    const { start, byPath } = render({
      ...BASE,
      productType: "mobile_app",
      framework: "custom",
      frameworkOther: "stack for mobileapp ios"
    });
    for (const file of [start, byPath("START_HERE.md"), byPath("CLAUDE.md")]) {
      expect(file).not.toContain("[NEEDS CLARIFICATION: CMD_");
    }
    expect(byPath("START_HERE.md")).toContain("npx expo start");
    expect(start).toContain("npx create-expo-app@latest");
  });

  it("names the ecosystem's own generator once it recognises one", () => {
    const django = render({
      ...BASE,
      framework: "custom",
      frameworkOther: "Django 5 with Python 3.12 and uv"
    });
    expect(django.start).toContain("django-admin startproject");
    // And still refuses to invent one for a stack it does not know.
    const unknown = render({
      ...BASE,
      framework: "custom",
      frameworkOther: "something entirely of my own devising"
    });
    expect(unknown.start).toContain("foundation cannot name the command for you");
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

  // The prefix is what decides whether a variable reaches the browser, and each bundler spells it
  // differently. A Vite app handed `NEXT_PUBLIC_` reads `undefined` at runtime with no error.
  it("uses the public-variable prefix the chosen stack actually reads", () => {
    expect(render(vite).start).toContain("VITE_SUPABASE_URL=");
    expect(render(vite).start).not.toContain("NEXT_PUBLIC_");
    const described = render(custom).start;
    expect(described).toContain("SUPABASE_URL=");
    expect(described).not.toMatch(/NEXT_PUBLIC_SUPABASE_URL|VITE_SUPABASE_URL/);
  });

  it("keeps the service-role key off the browser whatever the stack", () => {
    for (const answers of [nextjs, vite, custom]) {
      expect(render(answers).start).toMatch(/SUPABASE_SERVICE_ROLE_KEY=\s+# server-only/);
    }
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

  // No file marks a described stack the way `package.json` marks a Node one, so the gate asks
  // whether this job can do the whole thing — install included. Real commands run on a runner where
  // nothing was installed is the same red first push, arriving from the other side.
  it("runs a described stack it can set up, and stands down on one it cannot", () => {
    const known = render(custom).byPath(".github/workflows/ci.yml");
    expect(known).not.toContain("if [ -f package.json ]; then");
    expect(known).toContain('echo "ready=true"');
    expect(known).toContain("actions/setup-python");

    const unknown = render({ ...custom, frameworkOther: "something entirely of my own devising" });
    const ci = unknown.byPath(".github/workflows/ci.yml");
    expect(ci).toContain('echo "ready=false"');
    expect(ci).toContain("::warning::");
  });
});
