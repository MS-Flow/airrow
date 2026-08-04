// What the documents say depends on where the project came from (spec 212).
//
// Three variants exist — new, imported-integrated, imported-hidden — and until this spec only four
// places knew: the first-run command, `START_HERE.md`'s first step, the CI sections and the
// infrastructure walkthrough. Everything else shipped the same bytes to a running codebase as to an
// empty folder.
//
// The claims below are the ones a founder would catch us on. Greenfield's own bytes are guarded
// separately and more strictly, by `greenfield-golden.test.ts`.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "./index.ts";
import { resolveProjectModel } from "./model.ts";
import type { TemplateFile } from "./scaffold.ts";
import type { BranchingModel, InterviewAnswers, ProjectOrigin } from "../../schemas/src/types.ts";

const TEMPLATE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..", "template");
const FOLDER = "notes";

function loadTemplate(): TemplateFile[] {
  const files: TemplateFile[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else {
        const rel = path.relative(TEMPLATE_DIR, abs).split(path.sep).join("/");
        if (rel === ".airrow-template.json") continue;
        files.push({ path: rel, content: fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n") });
      }
    }
  };
  walk(TEMPLATE_DIR);
  return files;
}

const TEMPLATE = loadTemplate();

const BASE: InterviewAnswers = {
  productType: "saas",
  problem: "Agencies lose follow-ups in three different inboxes.",
  vision: "The system of record every agency runs on.",
  mvpFocus: "Log a client and never miss a follow-up.",
  coreEntities: "Agencies own Clients; a Client has many Follow-ups.",
  tenancy: "organizations",
  authModel: ["email_password"],
  capabilities: ["auth", "payments"],
  dataSensitivity: "standard",
  scale: "validate",
  framework: "nextjs",
  database: "supabase",
  hosting: "vercel",
  repoProvider: "github",
  team: "solo"
};

const NEW: ProjectOrigin = { kind: "new" };
const INTEGRATED: ProjectOrigin = {
  kind: "imported",
  stackDetected: true,
  delivery: { kind: "integrated" }
};
const HIDDEN: ProjectOrigin = {
  kind: "imported",
  stackDetected: true,
  delivery: { kind: "hidden", folder: FOLDER }
};

function foundation(origin: ProjectOrigin, answers: Partial<InterviewAnswers> = {}): Map<string, string> {
  const files = generate(
    TEMPLATE,
    resolveProjectModel({
      name: "Loop CRM",
      description: "A lightweight CRM for small agencies.",
      answers: { ...BASE, ...answers },
      origin
    })
  ).files;
  // Keyed on the template-relative path so a hidden foundation is asked for the same names as any
  // other — where the files landed is `hidden-layout.test.ts`'s question, not this file's.
  return new Map(files.map((f) => [f.path.startsWith(`${FOLDER}/`) ? f.path.slice(FOLDER.length + 1) : f.path, f.content]));
}

const read = (files: Map<string, string>, p: string): string => {
  const content = files.get(p);
  if (content === undefined) throw new Error(`not delivered: ${p}`);
  return content;
};

const NEW_FILES = foundation(NEW);
const INTEGRATED_FILES = foundation(INTEGRATED);
const HIDDEN_FILES = foundation(HIDDEN, { branchingModel: "trunk" });

describe("CLAUDE.md, read by someone who wrote the codebase", () => {
  it("does not greet the founder as new to their own project", () => {
    expect(read(NEW_FILES, "CLAUDE.md")).toContain("New to this project?");
    expect(read(INTEGRATED_FILES, "CLAUDE.md")).not.toContain("New to this project?");
    expect(read(HIDDEN_FILES, "CLAUDE.md")).not.toContain("New to this project?");
  });

  it("does not promise accounts that were created years ago", () => {
    expect(read(NEW_FILES, "CLAUDE.md")).toContain("The accounts only you can create");
    expect(read(INTEGRATED_FILES, "CLAUDE.md")).not.toContain("The accounts only you can create");
  });

  it("heads the product section in the tense the product is in", () => {
    expect(read(NEW_FILES, "CLAUDE.md")).toContain("## What we're building");
    expect(read(INTEGRATED_FILES, "CLAUDE.md")).toContain("## What this is");
    expect(read(INTEGRATED_FILES, "CLAUDE.md")).not.toContain("## What we're building");
  });
});

describe("the answer about the team's own documents, which nothing used to read", () => {
  // Spec 199 asked it, validated it and stored it; nothing consumed it. §0 says a question whose
  // answer changes nothing should not be asked, so the proof it is a real question is that the three
  // answers produce three different foundations.
  const variants = (["describe", "adopt", "leave"] as const).map((existingDocs) =>
    read(foundation(INTEGRATED, { existingDocs }), "CLAUDE.md")
  );

  it("produces a different CLAUDE.md for each of the three answers", () => {
    expect(new Set(variants).size).toBe(3);
  });

  it("says what each answer actually means for the team's files", () => {
    const [describe_, adopt, leave] = variants;
    expect(describe_).toMatch(/stay where they are/);
    expect(adopt).toMatch(/record new decisions \*here\*/);
    expect(leave).toMatch(/out of scope/);
    // None of the three may imply this foundation touches anything of theirs.
    for (const v of variants) expect(v).toMatch(/nothing of theirs is rewritten|change nothing about|stay where they are/i);
  });

  it("reaches the documentation index too", () => {
    const adopt = read(foundation(INTEGRATED, { existingDocs: "adopt" }), "docs/README.md");
    const leave = read(foundation(INTEGRATED, { existingDocs: "leave" }), "docs/README.md");
    expect(adopt).not.toBe(leave);
  });

  it("is answered by a documents-only import too, whose whole import was documents", () => {
    // The trap: most wording keys off whether code was found (`shipsCleanup`), and a documents-only
    // import ships `/start` and reads like a new project. But it is the one import made *entirely*
    // of the founder's documents, so dropping this answer there would be exactly backwards.
    const docsOnly: ProjectOrigin = {
      kind: "imported",
      stackDetected: false,
      delivery: { kind: "integrated" }
    };
    const adopt = read(foundation(docsOnly, { existingDocs: "adopt" }), "CLAUDE.md");
    const leave = read(foundation(docsOnly, { existingDocs: "leave" }), "CLAUDE.md");
    expect(adopt).not.toBe(leave);
    expect(adopt).toMatch(/record new decisions \*here\*/);
    // It still gets `/start`, and still reads as a project that has yet to be built (spec 187).
    expect(adopt).toContain("## What we're building");
  });
});

describe("docs/README.md's claim about the repository root", () => {
  it("only claims a layout it created", () => {
    expect(read(NEW_FILES, "docs/README.md")).toContain("Root keeps only");
    expect(read(INTEGRATED_FILES, "docs/README.md")).not.toContain("Root keeps only");
    expect(read(HIDDEN_FILES, "docs/README.md")).not.toContain("Root keeps only");
  });

  it("says which root it means when it is not the repository's", () => {
    expect(read(HIDDEN_FILES, "docs/README.md")).toContain(`\`${FOLDER}/\``);
  });
});

describe("README.md, which is not always the project's front door", () => {
  it("is the project's README only where the project is this foundation", () => {
    expect(read(NEW_FILES, "README.md")).toMatch(/^# Loop CRM\n/);
    expect(read(INTEGRATED_FILES, "README.md")).toMatch(/^# Loop CRM — the engineering foundation\n/);
  });

  it("says whose README it is not", () => {
    expect(read(INTEGRATED_FILES, "README.md")).toMatch(/not the project's README/);
    expect(read(HIDDEN_FILES, "README.md")).toContain(`README of \`${FOLDER}/\``);
  });
});

describe("specs/README.md, which used to call a founder's shipped features a to-do list", () => {
  it("turns the section around for a project that already runs", () => {
    // The imported interview asks `capabilities` as "What does it already do?" — rendering that under
    // "What to spec first" told a founder to build what they had already built.
    expect(read(NEW_FILES, "specs/README.md")).toContain("## What to spec first");
    expect(read(INTEGRATED_FILES, "specs/README.md")).toContain("## What this project already does");
    expect(read(INTEGRATED_FILES, "specs/README.md")).not.toContain("## What to spec first");
    expect(read(INTEGRATED_FILES, "specs/README.md")).toMatch(/\*\*not\*\* a to-do list/);
  });

  it("says nothing about a project that confirmed no capabilities, rather than the wrong thing", () => {
    const none = foundation({ ...INTEGRATED }, { capabilities: [], tenancy: "single_user", authModel: ["public"] });
    const specs = read(none, "specs/README.md");
    expect(specs).not.toContain("Spec the core product flow first");
    expect(specs).toMatch(/says\nnothing about what the project does/);
  });
});

describe("SYSTEM_OVERVIEW.md, the document whose reader can check it against the code", () => {
  it("says it was written from the interview, not from the codebase", () => {
    // The fallback rendering asserted an architecture for a project nobody read. Confidently wrong
    // about code the reader can open is the §0 case this spec exists for.
    expect(read(INTEGRATED_FILES, "docs/architecture/SYSTEM_OVERVIEW.md")).toMatch(
      /Nobody read this codebase/
    );
    expect(read(NEW_FILES, "docs/architecture/SYSTEM_OVERVIEW.md")).not.toMatch(/Nobody read/);
  });
});

describe("START_HERE.md's verification bar", () => {
  it("only claims four green commands prove the foundation works when they are its own", () => {
    expect(read(NEW_FILES, "START_HERE.md")).toContain("the foundation is working");
    expect(read(INTEGRATED_FILES, "START_HERE.md")).not.toContain("the foundation is working");
  });

  it("warns an imported project that red may predate the download", () => {
    expect(read(INTEGRATED_FILES, "START_HERE.md")).toMatch(/already failing before you change a thing/);
  });
});

describe("DEVELOPER_GUIDE.md's setup", () => {
  it("does not reduce an existing project's setup to its dev server", () => {
    expect(read(INTEGRATED_FILES, "docs/guides/DEVELOPER_GUIDE.md")).toMatch(
      /the clone, the dependency install, and the environment file/
    );
  });
});

describe("the branch model, where the team already has one", () => {
  const cases: ReadonlyArray<[BranchingModel, RegExp]> = [
    ["trunk", /short-lived branch off this project's trunk/],
    ["integration_branch", /off this project's integration branch/]
  ];

  for (const [branchingModel, expected] of cases) {
    it(`describes a ${branchingModel} project's own branches`, () => {
      const files = foundation(HIDDEN, { branchingModel });
      expect(read(files, "docs/architecture/BRANCHING.md")).toMatch(expected);
    });
  }

  it("prescribes no hierarchy over a team that branches differently", () => {
    const branching = read(HIDDEN_FILES, "docs/architecture/BRANCHING.md");
    expect(branching).not.toContain("## Branch hierarchy");
    expect(branching).not.toMatch(/PR\*\* `feature\/<name>` → `develop`/);
    expect(branching).toMatch(/this project already has one, and it stays exactly as it is/);
  });

  it("leaves an integrated foundation's branch documents exactly as they were", () => {
    // Integrated adopts this foundation's model; `/cleanup` establishes it locally (spec 91).
    expect(read(INTEGRATED_FILES, "docs/architecture/BRANCHING.md")).toBe(
      read(NEW_FILES, "docs/architecture/BRANCHING.md")
    );
    expect(read(INTEGRATED_FILES, "CLAUDE.md")).toContain("`main` ← `develop` ← `feature/<name>`");
  });

  it("invents no hierarchy when the founder said 'something else' and typed nothing", () => {
    const branching = read(
      foundation(HIDDEN, { branchingModel: "other" }),
      "docs/architecture/BRANCHING.md"
    );
    expect(branching).not.toMatch(/works: \./);
    expect(branching).toMatch(/not a shape this foundation was told, so it names none/);
  });

  it("carries the founder's own words when they typed them", () => {
    const branching = read(
      foundation(HIDDEN, { branchingModel: "other", branchingModelOther: "everything ships to main behind a flag" }),
      "docs/architecture/BRANCHING.md"
    );
    expect(branching).toContain("everything ships to main behind a flag.");
  });
});

describe("the commands, which are the documents that act", () => {
  it("never has a hidden foundation push a branch to the team's remote", () => {
    // The whole promise of the layout is that the repository's diff stays empty. A `/createspec` that
    // creates `feature/*` on the remote breaks it on the founder's first spec.
    const createspec = read(HIDDEN_FILES, ".claude/commands/createspec.md");
    expect(createspec).not.toContain("git push -u origin feature/<name>");
    expect(createspec).toMatch(/\*\*Pull, never push\.\*\*/);
    expect(createspec).not.toMatch(/sync the feature branch with/);
  });

  it("does not have /pr-check infer a develop that may not exist", () => {
    const prCheck = read(HIDDEN_FILES, ".claude/commands/pr-check.md");
    expect(prCheck).not.toMatch(/On a `feature\/<name>` branch → target `develop`/);
    expect(prCheck).toMatch(/If it is not obvious, ask/);
  });

  it("still refuses to push a shared branch, named the way this project names them", () => {
    const push = read(HIDDEN_FILES, ".claude/commands/push.md");
    expect(push).toMatch(/a branch this team shares/);
    expect(push).toMatch(/stop\*\* and refuse/);
  });

  it("leaves all three exactly as they were for an integrated foundation", () => {
    for (const command of ["createspec", "pr-check", "push"]) {
      expect(read(INTEGRATED_FILES, `.claude/commands/${command}.md`)).toBe(
        read(NEW_FILES, `.claude/commands/${command}.md`)
      );
    }
  });

  it("does not promise a hidden /cleanup will create branches it is forbidden to create", () => {
    // The first file a founder opens said `/cleanup` "creates the local branches this workflow runs
    // on". Hidden's `/cleanup` may change nothing outside its folder, so it never could.
    expect(read(HIDDEN_FILES, "START_HERE.md")).not.toMatch(/creates\nthe local branches/);
    expect(read(HIDDEN_FILES, "START_HERE.md")).toMatch(/creates no branches/);
    expect(read(INTEGRATED_FILES, "START_HERE.md")).toMatch(/the local branches this workflow runs on/);
  });

  it("has /cleanup check the branch model against the repository rather than trust the answer", () => {
    const cleanup = read(HIDDEN_FILES, ".claude/commands/cleanup.md");
    expect(cleanup).toMatch(/the repository is right/i);
    expect(cleanup).toMatch(/\*\*Create nothing, rename nothing, delete nothing\.\*\*/);
  });
});

describe("what no imported document may say, in either layout", () => {
  const imported = [
    ["integrated", INTEGRATED_FILES],
    ["hidden", HIDDEN_FILES]
  ] as const;

  for (const [layout, files] of imported) {
    it(`never claims Airrow read or kept the code (${layout})`, () => {
      for (const [p, content] of files) {
        expect(content, p).not.toMatch(/\bwe (?:read|analysed|analyzed|scanned) your (?:code|codebase|source)\b/i);
        expect(content, p).not.toMatch(/\b(?:migrated|converted|restructured) your (?:code|codebase|project)\b/i);
      }
    });
  }

  it("never instructs a hidden foundation to change anything outside its folder", () => {
    for (const [p, content] of HIDDEN_FILES) {
      // The remote verbs reach the team's server, and neither is available to a layout that promises
      // an empty diff.
      expect(content, p).not.toMatch(/git (?:remote add|push -u origin)/);
      // `git init` would create a repository around the folder. It may still be *named* — `/cleanup`
      // forbids it explicitly, which is worth more than silence — so what is asserted is that every
      // mention is a prohibition.
      for (const line of content.split("\n").filter((l) => l.includes("git init"))) {
        expect(line, `${p}: ${line}`).toMatch(/Do \*\*not\*\* run|never/i);
      }
    }
  });
});
