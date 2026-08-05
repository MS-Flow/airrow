// Tests for `/sync`, the command an imported project runs first (specs 91, 214).
//
// `/sync` is what spec 91 shipped as `/cleanup`: it reads the project and rewrites this foundation's
// documents to describe it. Spec 214 split the mutating half out into a rebuilt `/cleanup`, so what
// is asserted here is the reading half — including the promises that make it safe to run on somebody
// else's repository, which are now stricter than they were (it creates no branches at all).
//
// Like every command, this is instruction text an assistant executes: what is testable is what the
// renderer puts in the repository, not whether the assistant then behaves.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveProjectModel } from "./model.ts";
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
const SYNC = ".claude/commands/sync.md";

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

const IMPORTED: ProjectOrigin = {
  kind: "imported",
  stackDetected: true,
  delivery: { kind: "integrated" }
};
const HIDDEN: ProjectOrigin = {
  kind: "imported",
  stackDetected: true,
  delivery: { kind: "hidden", folder: "airrow" }
};

function render(origin: ProjectOrigin, answers: InterviewAnswers = BASE) {
  const model = resolveProjectModel({
    name: "Loop CRM",
    description: "A lightweight CRM for small agencies.",
    answers,
    origin
  });
  const { files } = renderScaffold(TEMPLATE, model);
  const byPath = (p: string) => files.find((f) => f.path === p)?.content ?? "";
  return { files, byPath, paths: files.map((f) => f.path) };
}

/** Collapse wrapping, so an assertion about a sentence survives the file being re-wrapped. */
const prose = (text: string): string => text.replace(/\s+/g, " ");

describe("/sync ships to every project that arrived with code", () => {
  it("ships in both layouts — it is the half a hidden foundation still gets", () => {
    for (const origin of [IMPORTED, HIDDEN]) {
      expect(render(origin).paths).toContain(SYNC);
    }
  });

  it("renders with no unresolved token, for every stack and both layouts", () => {
    const custom = { ...BASE, framework: "custom", frameworkOther: "Rails 8 with Postgres" } satisfies InterviewAnswers;
    for (const origin of [IMPORTED, HIDDEN]) {
      for (const answers of [BASE, { ...BASE, framework: "vite" } satisfies InterviewAnswers, custom]) {
        const sync = render(origin, answers).byPath(SYNC);
        expect(sync).not.toBe("");
        expect(sync).not.toMatch(/\{\{[A-Z0-9_]+\}\}/);
      }
    }
  });

  it("names the project rather than reading like a template", () => {
    expect(render(IMPORTED).byPath(SYNC)).toContain("Loop CRM");
  });
});

describe("what /sync writes down before it writes anything else", () => {
  it("produces the project map, and says every claim carries the file it came from", () => {
    const sync = render(IMPORTED).byPath(SYNC);
    expect(sync).toContain(".claude/project-map.md");
    expect(prose(sync)).toContain("A claim with no file behind it is a guess");
  });

  it("keeps the map out of the documents rather than duplicating the architecture", () => {
    const sync = render(IMPORTED).byPath(SYNC);
    expect(prose(sync)).toContain("points at the map for the inventory");
    expect(prose(sync)).toContain("A fact belongs in one file");
  });

  it("states the claims it must check against the repository", () => {
    const sync = render(IMPORTED).byPath(SYNC);
    // The stack in these documents came from an interview, not from reading the code — saying so is
    // what makes /sync a check rather than a proofread.
    expect(sync).toContain("not from reading it");
    expect(sync).toContain("the repository is right");
    for (const command of ["pnpm dev", "pnpm build", "pnpm typecheck", "pnpm lint", "pnpm test"]) {
      expect(sync).toContain(command);
    }
  });

  it("leaves what it cannot establish as a marker rather than a guess", () => {
    expect(render(IMPORTED).byPath(SYNC)).toContain("[NEEDS CLARIFICATION:");
  });
});

describe("what /sync promises not to do", () => {
  it("forbids changing code, and says so about each kind of file", () => {
    const sync = render(IMPORTED).byPath(SYNC);
    expect(sync).toContain("It changes no code.");
    for (const kind of ["dependency", "config file", "migration"]) {
      expect(sync).toContain(kind);
    }
  });

  it("deletes nothing and renames nothing", () => {
    expect(render(IMPORTED).byPath(SYNC)).toContain("It deletes nothing, and it renames nothing.");
  });

  it("creates no branch and never initialises a repository", () => {
    // Spec 214 moved branch creation to `/cleanup`. A command that only reads is one a founder can
    // run on a repository they share without thinking about it, and that is worth keeping absolute.
    const sync = render(IMPORTED).byPath(SYNC);
    expect(sync).toContain("**It creates no branches**");
    expect(sync).toContain("git init");
    expect(prose(sync)).toContain("Reading is the whole of what this command does to the repository");
  });

  it("stops at this machine, like every other command here", () => {
    const sync = render(IMPORTED).byPath(SYNC);
    expect(sync).toContain("No remote");
    expect(sync).toContain("no secrets written");
  });

  it("never removes itself — the documents drift again, and this is the answer", () => {
    const sync = render(IMPORTED).byPath(SYNC);
    expect(sync).not.toMatch(/delete .*sync\.md/i);
    expect(sync).not.toMatch(/remove this command/i);
    expect(prose(sync)).toContain("Re-runnable by design, forever");
  });
});

describe("the document work /sync inherited from spec 91", () => {
  it("tells the assistant which of the two files is Airrow's, and leaves the founder's alone", () => {
    const sync = render(IMPORTED).byPath(SYNC);
    expect(sync).toContain("README.airrow.md");
    expect(prose(sync)).toContain("the `.airrow` file is this foundation's version");
    expect(sync).toContain("Leave the founder's file alone");
  });

  it("goes looking for every .airrow document rather than waiting to be handed one", () => {
    const sync = render(IMPORTED).byPath(SYNC);
    expect(sync).toContain("git ls-files '*.airrow.md'");
    expect(prose(sync)).toContain("work through every single one");
  });

  it("explains why a non-document conflict has no .airrow file", () => {
    const sync = render(IMPORTED).byPath(SYNC);
    expect(sync).toContain("Only documents arrive this way");
    expect(sync).toContain(".github/workflows/ci.yml");
  });

  it("leaves the swap to the founder rather than doing it for them", () => {
    const sync = render(IMPORTED).byPath(SYNC);
    expect(sync).toContain("git mv README.airrow.md README.md");
    expect(sync).toContain("Nothing here does that for them");
  });

  it("reports old assistant instructions instead of removing them", () => {
    const sync = render(IMPORTED).byPath(SYNC);
    expect(sync).toContain(".cursorrules");
    expect(sync).toContain("report them, delete nothing");
  });

  it("keeps the founder's own documents and the constitution out of its scope", () => {
    const sync = render(IMPORTED).byPath(SYNC);
    expect(sync).toContain("Read, never rewrite");
    expect(sync).toContain(".claude/spec-kit/constitution.md");
  });
});

describe("the branch model /sync describes but does not build", () => {
  it("reads the trunk and writes its real name into the documents", () => {
    const sync = render(IMPORTED).byPath(SYNC);
    expect(sync).toContain("## 5. The branch model, as it actually is");
    expect(sync).toContain("git symbolic-ref refs/remotes/origin/HEAD");
    expect(prose(sync)).toContain("the trunk's name is a fact about this repository");
  });

  it("hands branch creation to /cleanup rather than doing it", () => {
    const sync = render(IMPORTED).byPath(SYNC);
    expect(prose(sync)).toContain("`/cleanup` creates the branches");
    expect(prose(sync)).toContain("this command only describes them");
    // The line spec 91 had here, which would now be a mutation.
    expect(sync).not.toContain("git init -b main");
  });

  it("leaves an existing trunk's name alone and adapts the documents to it instead", () => {
    // Renaming `master` breaks branch protection, open pull requests and every CI trigger pointing
    // at it — none of which this command can put back.
    expect(prose(render(IMPORTED).byPath(SYNC))).toContain("the documents say `master`");
  });

  it("says nothing about branches at all in a hidden delivery", () => {
    const sync = render(HIDDEN).byPath(SYNC);
    expect(sync).toContain("The branch model is already theirs");
    expect(sync).not.toContain("## 5. The branch model, as it actually is");
  });
});

describe("where /sync sends the founder next", () => {
  it("hands an integrated import to /cleanup", () => {
    const sync = render(IMPORTED).byPath(SYNC);
    expect(prose(sync)).toContain("Then tell them what comes next: `/cleanup`");
    expect(prose(sync)).toContain("stages everything and commits nothing");
  });

  it("hands a hidden import to the accounts instead, having no /cleanup to offer", () => {
    const sync = render(HIDDEN).byPath(SYNC);
    expect(sync).toContain("step 2 of [START_HERE.md](../../START_HERE.md)");
    expect(sync).not.toContain("/cleanup");
  });
});
