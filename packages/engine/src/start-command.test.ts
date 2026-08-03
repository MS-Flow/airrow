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
import { SHADCN_UI, uiKitFor } from "../../schemas/src/ui-kits.ts";
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

/** Collapse wrapping, so an assertion about a sentence survives the file being re-wrapped. */
const prose = (text: string): string => text.replace(/\s+/g, " ");

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
      // Pinned as of spec 165 — this tool writes the theme every later `add` resolves against.
      expect(start).toContain(`${SHADCN_UI.pkg}@${SHADCN_UI.version} init`);
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
    const cli = `${SHADCN_UI.pkg}@${SHADCN_UI.version}`;
    expect(render(nextjs).start).toContain(`pnpm dlx ${cli}`);
    expect(render(vite).start).toContain(`npx ${cli}`);
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

describe("the MVP focus is stated as a ceiling, not a starting budget (spec 123)", () => {
  it("says what to build and, as plainly, what not to", () => {
    const { start } = render(nextjs);
    expect(start).toContain("ceiling");
    expect(start).toMatch(/No second feature/i);
    expect(start).toContain("/createspec");
  });

  // Without this the ceiling reads as forbidding the design system section 1 just installed, and
  // the founder gets a plain-CSS screen plus a question about which document to believe.
  it("puts styling inside the ceiling rather than leaving it to be guessed at", () => {
    expect(render(nextjs).start).toContain("design system, and using it is not a feature");
    expect(render(custom).start).toMatch(/Style it the way this stack styles things/);
  });

  it("reads UI_ARCHITECTURE.md before writing anything, and traces every element back to an answer", () => {
    const { start } = render(nextjs);
    expect(start).toContain("docs/architecture/UI_ARCHITECTURE.md");
    expect(start).toContain("must trace back to something the founder wrote");
  });

  it("allows a sign-in surface but never an auth service, secret, or user table", () => {
    const { start } = render(nextjs);
    expect(start).toContain("provision no auth service, write no secret, and create no user table");
  });

  it("builds against local state — no schema, no persistence", () => {
    const { start } = render(nextjs);
    expect(start).toContain("No schema, no persistence");
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

  // Step 1 promises what section 5 of /start then does, so a founder who finds the command gone
  // recognises it as the plan rather than as something having disappeared (spec 159).
  it("says step 1 rewrites itself and the command stands down when it is done", () => {
    const here = render(nextjs).byPath("START_HERE.md");
    expect(here).toMatch(/Safe to run again if it stops early/);
    expect(here).toMatch(/rewrites this\s+step to say so and removes itself/);
  });

  // /start installs everything this project needs — but it cannot install the thing that runs it.
  // A founder who has to work that out from a `command not found` was let down by paragraph one.
  it("names the one thing the founder installs before anything here can run", () => {
    const here = render(nextjs).byPath("START_HERE.md");
    expect(here).toMatch(/\*\*First, install \[Claude Code\]/);
    expect(here).toContain("npm install -g @anthropic-ai/claude-code");
    expect(here).toMatch(/That is the only thing you install by hand/);
    // And it must not send them off to install what section 1 handles.
    expect(here).toMatch(/are all step 1 of the command below/);
    // Inside step 1, the install comes before the command it makes runnable.
    const step1 = here.split("## 1. Get it running")[1]?.split("## 2.")[0] ?? "";
    expect(step1.indexOf("Claude Code")).toBeLessThan(step1.indexOf("/start"));
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

/* ── Finishing the job, and standing down (spec 159) ───────────────────────── */

describe("/start finishes what it builds", () => {
  it("states a visual bar and a self-check, not just what to build", () => {
    const start = render(nextjs).start;
    expect(start).toContain("Finish it");
    // The six questions are the whole point of the section: an assistant that answers them honestly
    // ships a screen a founder can show someone.
    expect(start).toMatch(/With no data at all/);
    expect(start).toMatch(/does anything jump, flash, or go blank/);
    expect(start).toMatch(/keyboard alone/);
  });

  it("keeps the spec 123 ceiling exactly where it was", () => {
    const start = render(nextjs).start;
    expect(start).toContain("The ceiling is `mvpFocus`, built well");
    expect(start).toContain("must trace back to something the founder wrote");
    expect(start).toContain("**No schema, no persistence.**");
    expect(start).toContain("surface, never service");
  });

  it("names the references when there are any, and says what they are not for", () => {
    const withRefs = render({ ...nextjs, uiReferenceLinks: "linear.app stripe.com" }).start;
    expect(withRefs).toContain("references section");
    expect(withRefs).toMatch(/never as something to copy/);
    expect(withRefs).toMatch(/no logo, no brand name/);

    const without = render(nextjs).start;
    expect(without).toContain("attached no visual references");
  });

  it("removes itself only after the verification bar has actually passed", () => {
    const start = render(nextjs).start;
    expect(start).toContain("## 6. Hand back, and remove this command");
    expect(start).toContain(".claude/commands/start.md");
    // The failure mode this must never have: a half-finished project with no way to finish it.
    expect(start).toMatch(/Only if all five commands above actually ran and passed/);
    expect(start).toMatch(/leave this\s+file and \[START_HERE\.md\]\([^)]+\) exactly as they are/);
    expect(start).toContain("Re-runnable until it succeeds");
  });

  // The command going quiet is only half the job: the file that told the founder to run it has to
  // stop saying so, or step 1 of the first document anyone opens describes work that is already done.
  it("rewrites START_HERE.md before it deletes itself, and names both places", () => {
    const start = render(nextjs).start;
    expect(start).toMatch(/Update \[START_HERE\.md\]\([^)]+\) so it no longer tells anyone to run this\s+command/);
    expect(start).toContain('Step 1, "Get it running"');
    expect(start).toContain('"How the commands work"');
    // Order matters: an interruption must leave a runnable command, not orphaned instructions.
    expect(start.indexOf("**6a.")).toBeLessThan(start.indexOf("**6b."));
    expect(start).toMatch(/the guide first, the deletion second/);
    // What must survive the rewrite: the block the founder comes back to, and the one paragraph in
    // step 1 that is about every other command rather than about this one.
    expect(start).toMatch(/the four commands with the \*\*verification bar\*\*/);
    expect(start).toMatch(/the \*\*Claude Code\*\* paragraph that opens it/);
  });

  it("says the same things whichever stack it was rendered for", () => {
    for (const answers of [nextjs, vite, custom]) {
      const start = render(answers).start;
      expect(start).toContain("## 6. Hand back, and remove this command");
      expect(start).toContain("Finish it");
    }
  });
});

/* ── Six sections, the tools they need, and a bar that says where you are (spec 159) ─────────── */

describe("/start is followable step by step", () => {
  it("names its six sections once, in order, and numbers the headings to match", () => {
    const start = render(nextjs).start;
    const headings = (start.match(/^## \d\. .*/gm) ?? []).map((h) => h.replace(/^## /, ""));
    expect(headings).toEqual([
      "1. Tools",
      "2. Stack and toolchain",
      "3. Git, locally",
      "4. The first screen",
      "5. Verify, and report honestly",
      "6. Hand back, and remove this command"
    ]);
  });

  // A section that points at the wrong neighbour is how a founder ends up scaffolding twice.
  it("has no cross-reference pointing at a section that moved", () => {
    const start = render(nextjs).start;
    expect(start).toContain("Skip to section 3.");
    expect(start).toContain("shadcn/ui primitives section 2 installed");
    expect(start).toMatch(/Once section 5 has passed in\s+full/);
    expect(start).toMatch(/anything in section 4 was left as a `\[NEEDS CLARIFICATION\]`/);
  });

  it("tells the assistant to report progress, in a shape that cannot run ahead of the work", () => {
    const start = render(nextjs).start;
    expect(start).toContain("[██░░░░░░░░░░] 1/6 · Tools ✓");
    expect(start).toContain("[░░░░░░░░░░░░] 0/6 · starting");
    expect(start).toContain("[████████████] 6/6 · done");
    expect(start).toMatch(/If a section fails, print the bar as far as you actually got/);
    // An already-done section still counts — otherwise a second run reports 2/6 and looks stuck.
    expect(start).toMatch(/\(already done\)/);
  });

  it("closes every section with what done looks like", () => {
    const start = render(nextjs).start;
    expect((start.match(/\*\*Done when:\*\*/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
});

describe("section 1 installs what the founder's machine is missing", () => {
  it("checks for git, the runtime and the repo host's CLI before installing anything", () => {
    const start = render(nextjs).start;
    expect(start).toContain("**Check first, install only what is missing.**");
    expect(start).toContain("`git --version`");
    expect(start).toContain("`node --version`");
    expect(start).toContain("`gh --version`");
    expect(start).toContain("brew install git node gh");
    expect(start).toContain("winget install --id GitHub.cli -e");
  });

  // pnpm ships with Node. A global install shadows the version the project pins, and the founder
  // then debugs a lockfile mismatch that nothing in the repository explains.
  it("enables pnpm through corepack rather than installing a second copy", () => {
    expect(render(nextjs).start).toContain("corepack enable");
    expect(render(nextjs).start).toContain("never `npm install -g pnpm`");
    // Vite's toolchain here is npm, which comes with Node — nothing to enable.
    expect(render(vite).start).not.toContain("corepack enable");
  });

  it("installs the CLI for the host the code will actually live on", () => {
    const azure = render({ ...nextjs, repoProvider: "azure_devops" }).start;
    expect(azure).toContain("`az --version`");
    expect(azure).toContain("Microsoft.AzureCLI");
    expect(azure).not.toContain("GitHub.cli");
    // The Azure CLI cannot read a work item until its extension is added — an install that stops at
    // the binary leaves `/createspec` broken in a way nothing else explains.
    expect(azure).toContain("az extension add --name azure-devops");
    expect(render(nextjs).start).not.toContain("Microsoft.AzureCLI");
    // …and the table cell stays a name, not the extension instruction glued onto one.
    expect(azure).toContain("| **the Azure CLI (`az`)** |");
  });

  it("names the runtime the described stack needs, not Node by default", () => {
    const django = render({ ...BASE, framework: "custom", frameworkOther: "Django 5 with Python 3.12 and uv" }).start;
    expect(django).toContain("`python3 --version`");
    expect(django).not.toContain("`node --version`");

    // Nothing recognised the stack, so no runtime is claimed — git and the CLI still are.
    const unknown = render({ ...BASE, framework: "custom", frameworkOther: "something entirely of my own devising" }).start;
    expect(unknown).toContain("`git --version`");
    expect(unknown).toContain("`gh --version`");
    expect(unknown).not.toMatch(/\| \*\*Node\.js|\| \*\*Python/);
  });

  // The machine boundary, at the one place this command now reaches past this directory.
  it("installs tools but signs in to nothing, and never upgrades what is already there", () => {
    const start = render(nextjs).start;
    expect(start).toContain("**Sign in to nothing.**");
    expect(start).toContain("`gh auth login` is the founder's own");
    expect(start).toContain("**Never upgrade what is already there.**");
    expect(start).toMatch(/do not\s+build from source/);
    expect(start).toMatch(/pipe a script into a shell/);
  });

  it("stops rather than improvising when it cannot install something", () => {
    const start = render(nextjs).start;
    expect(start).toContain("**If an install fails, stop trying and say so.**");
    expect(start).toContain("https://github.com/cli/cli#installation");
    expect(start).toMatch(/a missing runtime stops section 2, a\s+missing `git` stops section 3/);
  });

  // The one failure that looks like a failed install and is not: a successful install the running
  // shell cannot see yet. Reinstalling never fixes it, and editing a shell profile is not ours to do.
  it("reads a stale PATH as a restart, not as a reason to install again", () => {
    const start = render(nextjs).start;
    expect(start).toMatch(/may not be on this shell's `PATH` yet/);
    expect(start).toMatch(/restart their terminal/);
    expect(start).toMatch(/do not edit their shell profile/);
  });

  // START_HERE.md's step 2 used to say "install the CLI and sign in". Section 1 does the install now.
  it("leaves START_HERE.md asking only for the sign-in it cannot do", () => {
    const here = render(nextjs).byPath("START_HERE.md");
    expect(here).toContain("**Sign in:** `gh auth login`");
    expect(here).not.toMatch(/Install the GitHub CLI \(`gh`\) and run/);
  });
});

/* ── The picked direction installs, at the version the documents name (spec 165) ────────────── */

describe("/start installs the theme the founder picked", () => {
  const picked = { ...nextjs, uiKit: "bold_contrast" } satisfies InterviewAnswers;
  const kit = uiKitFor("bold_contrast")!;

  it("pins the CLI exactly, and never reaches for @latest", () => {
    const start = render(picked).start;
    expect(start).toContain(`${SHADCN_UI.pkg}@${SHADCN_UI.version} init`);
    // The defect this replaces: an unpinned tool writing a theme that UI_ARCHITECTURE.md then names.
    expect(start).not.toContain("shadcn@latest");
  });

  it("runs an init that cannot stop and ask a question", () => {
    // Found by running it. `--yes` alone is not non-interactive — `init` still asks which component
    // library and which preset, and an assistant cannot answer an arrow-key prompt; it just waits.
    // There is also no `--base-color` flag in this version, which failed outright.
    const start = render(picked).start;
    expect(start).toContain("init --yes -b radix -p nova");
    expect(start).not.toContain("--base-color");
  });

  it("names the theme's neutral family where it actually lives now", () => {
    const start = render(picked).start;
    expect(start).toContain(`\`tailwind.baseColor\` to \`${kit.baseColor}\``);
  });

  it("writes the theme's tokens into the stylesheet", () => {
    const start = render(picked).start;
    expect(start).toContain(kit.name);
    expect(start).toContain(`--radius: ${kit.design.radius};`);
    // Both themes, from the same record the interview drew its preview from.
    expect(start).toContain(`--background: ${kit.light.bg};`);
    expect(start).toContain(`--background: ${kit.dark.bg};`);
  });

  it("installs a theme and no layout at all", () => {
    // The whole change: a direction is a visual language. Installing a shell would make a picked
    // picture outrank what the founder wrote about their product — and it is what made this command
    // slow, since every block drags its own component tree in behind it.
    const start = render(picked).start;
    expect(start).not.toMatch(/\badd sidebar-\d|\badd login-\d|\badd dashboard-\d/);
    expect(start).toContain("That is the whole install");
    expect(prose(start)).toContain("no component library beyond the primitives above, and no screens");
  });

  it("tells the build step the theme decides the look and the answers decide the screens", () => {
    const start = render(picked).start;
    expect(start).toContain(`**${kit.name}** theme section 2 installed`);
    expect(prose(start)).toMatch(/What is on the screen is still theirs to have decided/);
    expect(prose(start)).toMatch(/Never copy a layout from a swatch/);
    expect(start).toMatch(/overriding the theme with hand-written colours is a bug/i);
  });

  it("carries the direction's design language, not a set of counts", () => {
    const start = render(picked).start;
    expect(start).toContain(kit.design.logo);
    expect(start).toContain(kit.design.surfaces);
    expect(start).toContain(kit.design.spacing);
  });

  it("installs no theme when the founder wrote their own words", () => {
    const start = render(nextjs).start;
    // Still pinned, and still non-interactive — neither is conditional on a pick.
    expect(start).toContain(`${SHADCN_UI.pkg}@${SHADCN_UI.version} init --yes -b radix -p nova`);
    // No theme means nothing to write into the stylesheet and no base colour to name.
    expect(start).not.toContain("--radius:");
    expect(start).not.toContain("`tailwind.baseColor`");
  });

  it("says nothing about a theme on a stack that cannot take one", () => {
    // A described stack brings its own conventions; a second design system on top is not ours to add.
    const start = render({ ...custom, uiKit: "bold_contrast" }).start;
    expect(start).not.toContain(kit.name);
    expect(start).not.toContain("--radius:");
  });

  it("names which half of a two-part answer is the ceiling", () => {
    // The vision question asks what it must do first *and* where it is heading (spec 165), so the
    // answer `/start` receives routinely contains both. Handing that over as "the core action to
    // perform" without saying which half is buildable invites the assistant past the ceiling.
    const start = render({
      ...picked,
      mvpFocus: undefined,
      vision: "Let someone drop in a folder and get it back smaller. Long-term, the compression layer everything runs on."
    }).start;

    expect(start).toContain("Long-term, the compression layer everything runs on.");
    expect(prose(start)).toMatch(/the first thing is the ceiling/);
    expect(prose(start)).toMatch(/never a second thing to build/);
    expect(prose(start)).toMatch(/build the smaller one/);
  });

  it("keeps the mvpFocus ceiling exactly where spec 123 put it", () => {
    // A theme is presentation. It must not have quietly become permission to build a second feature.
    const start = render(picked).start;
    expect(start).toContain("Loop CRM");
    expect(start).toMatch(/no second feature|not a second feature/i);
    expect(start).toMatch(/\[NEEDS CLARIFICATION/);
  });
});

describe("the repository carries the notice for the code it installs", () => {
  const NOTICES = "THIRD_PARTY_NOTICES.md";

  it("ships it with the licence in full, for a Tailwind stack", () => {
    const notices = render({ ...nextjs, uiKit: "soft_minimal" }).byPath(NOTICES);
    expect(notices).toContain(`${SHADCN_UI.pkg}/ui`);
    expect(notices).toContain(SHADCN_UI.version);
    expect(notices).toContain(`Copyright (c) 2023 ${SHADCN_UI.holder}`);
    expect(notices).toContain("WITHOUT WARRANTY OF ANY KIND");
    expect(notices).not.toMatch(/\{\{[A-Z0-9_]+\}\}/);
  });

  it("ships it even when no direction was picked — the install happens either way", () => {
    // The obligation predates the picker: /start has installed shadcn/ui since spec 66.
    expect(render(nextjs).byPath(NOTICES)).toContain("WITHOUT WARRANTY OF ANY KIND");
  });

  it("says the theme itself is not what is licensed", () => {
    const notices = render({ ...nextjs, uiKit: "soft_minimal" }).byPath(NOTICES);
    expect(notices).toContain("Airrow's own work and carries no third-party claim");
  });

  it("does not ship it to a stack that installs none of it", () => {
    // A notice for code that was never installed is a file the founder cannot explain.
    expect(render(custom).files.some((f) => f.path === NOTICES)).toBe(false);
  });
});
