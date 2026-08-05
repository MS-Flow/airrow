// Hidden delivery for an imported project (spec 187).
//
// Three claims are worth proving here, and they are the ones a founder's team would notice if they
// broke: every generated file lands under the folder and none escapes it; a hidden delivery collides
// with nothing, so the conflict machinery has nothing to do; and no pipeline ships, because one
// inside an ignored folder can never run.
//
// Whether `/cleanup` then behaves is the manual check recorded in the spec — this file covers what
// the engine puts on disk, which is the half a test can hold.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generate } from "./index.ts";
import { applyResolutions, diffAgainstExisting, nestUnder } from "./import.ts";
import { deliveredPath, hiddenFolder, hiddenFolderFrom, resolveProjectModel } from "./model.ts";
import { renderScaffold, shipsPath, type TemplateFile } from "./scaffold.ts";
import { deliveryLayoutSchema } from "../../schemas/src/index.ts";
import type { DeliveryLayout, InterviewAnswers, ProjectOrigin } from "../../schemas/src/types.ts";

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
const FOLDER = "notes";

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

const origin = (delivery: DeliveryLayout): ProjectOrigin => ({
  kind: "imported",
  stackDetected: true,
  delivery
});

const INTEGRATED = origin({ kind: "integrated" });
const HIDDEN = origin({ kind: "hidden", folder: FOLDER });

function model(o: ProjectOrigin) {
  return resolveProjectModel({
    name: "Loop CRM",
    description: "A lightweight CRM for small agencies.",
    answers: BASE,
    origin: o
  });
}

const generated = (o: ProjectOrigin) => generate(TEMPLATE, model(o)).files;

describe("the folder name", () => {
  it("takes what the founder typed and makes a path segment of it", () => {
    expect(hiddenFolderFrom("My Notes")).toBe("my-notes");
    expect(hiddenFolderFrom("Sebastian Breuker")).toBe("sebastian-breuker");
    expect(hiddenFolderFrom("  spaced  ")).toBe("spaced");
  });

  it("answers null when there is nothing usable, rather than inventing a name", () => {
    // The distinction from `slugify`, which would answer "project" here — a folder the founder
    // never chose and would not recognise in their own repository.
    expect(hiddenFolderFrom("!!!")).toBeNull();
    expect(hiddenFolderFrom("")).toBeNull();
    expect(hiddenFolderFrom("   ")).toBeNull();
  });

  it("rejects every shape that would address a directory the founder did not name", () => {
    for (const folder of ["a/b", "..", "../escape", "/absolute", ".hidden", "", "Notes", "a b"]) {
      expect(deliveryLayoutSchema.safeParse({ kind: "hidden", folder }).success).toBe(false);
    }
  });

  it("accepts the shapes a founder would reasonably pick", () => {
    for (const folder of ["notes", "scratch", "sb", "my-notes", "docs2"]) {
      expect(deliveryLayoutSchema.safeParse({ kind: "hidden", folder }).success).toBe(true);
    }
  });

  it("defaults an origin with no layout to integrated — what every import before this did", () => {
    const parsed = deliveryLayoutSchema.safeParse({ kind: "integrated" });
    expect(parsed.success && parsed.data).toEqual({ kind: "integrated" });
  });
});

describe("nesting", () => {
  it("moves every file under the folder, exactly once", () => {
    const files = [{ path: "CLAUDE.md" }, { path: "docs/architecture/SYSTEM_OVERVIEW.md" }];
    expect(nestUnder(files, model(HIDDEN))).toEqual([
      { path: `${FOLDER}/CLAUDE.md` },
      { path: `${FOLDER}/docs/architecture/SYSTEM_OVERVIEW.md` }
    ]);
  });

  it("moves nothing when the layout is integrated", () => {
    const files = [{ path: "CLAUDE.md" }];
    expect(nestUnder(files, model(INTEGRATED))).toEqual(files);
  });

  it("does not depend on the order the files arrive in", () => {
    const paths = ["b.md", "a/c.md", "a/b.md"];
    const forward = nestUnder(paths.map((p) => ({ path: p })), model(HIDDEN)).map((f) => f.path);
    const backward = nestUnder(
      [...paths].reverse().map((p) => ({ path: p })),
      model(HIDDEN)
    ).map((f) => f.path);
    expect(forward).toEqual([...backward].reverse());
  });

  it("reads the folder off the model in one place", () => {
    expect(hiddenFolder(model(HIDDEN))).toBe(FOLDER);
    expect(hiddenFolder(model(INTEGRATED))).toBeNull();
    expect(hiddenFolder(model({ kind: "new" }))).toBeNull();
    expect(deliveredPath(model(HIDDEN), "CLAUDE.md")).toBe(`${FOLDER}/CLAUDE.md`);
    expect(deliveredPath(model(INTEGRATED), "CLAUDE.md")).toBe("CLAUDE.md");
  });
});

describe("a hidden foundation", () => {
  it("puts every single generated file under the folder, and none beside it", () => {
    const files = generated(HIDDEN);
    expect(files.length).toBeGreaterThan(10);
    const escaped = files.filter((f) => !f.path.startsWith(`${FOLDER}/`));
    expect(escaped.map((f) => f.path)).toEqual([]);
  });

  // Two files differ by design, and only two: the pipeline (spec 187) and `/cleanup` (spec 214).
  // Both are excluded because they would act on the repository around the folder, which is the one
  // thing this layout exists to never do. Everything else is the integrated foundation, moved.
  it("is the same foundation as the integrated one, moved — minus what would reach outside", () => {
    const withoutExcluded = (paths: string[]): string[] =>
      paths.filter((p) => !p.startsWith(".github/") && p !== ".claude/commands/cleanup.md").sort();
    const hidden = withoutExcluded(generated(HIDDEN).map((f) => f.path.slice(FOLDER.length + 1)));
    const integrated = withoutExcluded(generated(INTEGRATED).map((f) => f.path));
    expect(hidden).toEqual(integrated);
    // The exclusion is real, not an artefact of the filter above.
    expect(generated(INTEGRATED).map((f) => f.path)).toContain(".claude/commands/cleanup.md");
  });

  it("still passes validation, so the mode changes where it lands and not whether it is complete", () => {
    // `generate` throws GenerationError when a required document is missing; reaching this line at
    // all is the assertion, and the required list is asked for through `deliveredPath`.
    expect(() => generated(HIDDEN)).not.toThrow();
    expect(generated(HIDDEN).some((f) => f.path === `${FOLDER}/CLAUDE.md`)).toBe(true);
    expect(
      generated(HIDDEN).some((f) => f.path === `${FOLDER}/.claude/commands/sync.md`)
    ).toBe(true);
  });

  it("ships no pipeline, because one inside an ignored folder could never run", () => {
    const ci = generated(HIDDEN).filter(
      (f) => f.path.includes(".github/") || f.path.includes("azure-pipelines")
    );
    expect(ci.map((f) => f.path)).toEqual([]);
  });

  it("still ships the pipeline when integrated, so the exclusion is the layout's and not a regression", () => {
    const ci = generated(INTEGRATED).filter((f) => f.path.startsWith(".github/workflows/"));
    expect(ci.length).toBeGreaterThan(0);
  });

  it("excludes CI at the shipping decision, for both providers", () => {
    for (const p of [".github/workflows/ci.yml", "azure-pipelines.yml"]) {
      expect(shipsPath(model(HIDDEN), p)).toBe(false);
    }
    expect(shipsPath(model(INTEGRATED), ".github/workflows/ci.yml")).toBe(true);
  });

  // The gap that let a whole class of defect through: asserting the CI *files* are gone says
  // nothing about the documents that describe them. `/analyze` found five documents promising the
  // founder a pipeline this layout deliberately does not deliver.
  it("names no CI file in any document, having shipped none", () => {
    const offenders = generated(HIDDEN)
      .filter((f) => /\.github\/workflows|azure-pipelines/.test(f.content))
      .map((f) => f.path);
    expect(offenders).toEqual([]);
  });

  it("promises no pipeline in the documents a founder reads first", () => {
    const claims = [/CI should run and go green/, /workflows in .* run on their own/, /start running the moment/];
    for (const file of generated(HIDDEN)) {
      for (const claim of claims) expect(file.content).not.toMatch(claim);
    }
  });

  it("still says all of that when the foundation owns the repository", () => {
    const text = generated(INTEGRATED)
      .map((f) => f.content)
      .join("\n");
    expect(text).toContain(".github/workflows/");
    expect(text).toMatch(/CI should run and go green/);
  });

  it("leaves no unrendered token in the command it ships", () => {
    const sync = generated(HIDDEN).find((f) => f.path === `${FOLDER}/.claude/commands/sync.md`);
    expect(sync?.content).not.toMatch(/\{\{[A-Z_]+\}\}/);
    // The marker for a token with no value. Not a bare "[NEEDS CLARIFICATION:" — the command's own
    // text tells the assistant to write one of those for a question the repository cannot answer.
    expect(sync?.content).not.toMatch(/\[NEEDS CLARIFICATION: [A-Z_]+\]/);
  });
});

describe("what the hidden documents tell the founder", () => {
  const prose = (text: string): string => text.replace(/\s+/g, " ");
  const doc = (o: ProjectOrigin, p: string): string =>
    prose(generated(o).find((f) => f.path === deliveredPath(model(o), p))?.content ?? "");

  // Spec 215 replaced "open Claude Code in `<folder>/`" with a route that carries the project too.
  // The first session is the one that cannot take the shortcut: `/sync` is what links these commands
  // to the repository root, so until it has run there is nothing there to find. Started in the folder
  // alone, `/sync` would have this foundation and not the project it exists to describe.
  it("bootstraps the first session with the folder and the project both, naming the folder it got", () => {
    const startHere = doc(HIDDEN, "START_HERE.md");
    expect(startHere).toContain(`cd ${FOLDER} && claude --add-dir ..`);
    expect(startHere).toContain(`\`cd ${FOLDER}\` starts the session **inside this folder**`);
    expect(startHere).toContain("`--add-dir ..` hands it the directory above");
    // And that it is a bootstrap, not the permanent arrangement.
    expect(startHere).toContain("after one run a plain `claude` there has them");
  });

  // Named only where it is load-bearing. An older CLI fails *silently* on the linking route, which
  // is the failure worth a line; the layouts that do not use it are left exactly as they were, and
  // the greenfield golden fixture is what proves that.
  // A founder who has never used Claude Code does not know that the command opens something they
  // then type into. Saying "run this" and stopping is an instruction that only reads as complete to
  // someone who already knew the answer.
  it("says the command opens a session, and that the /commands are typed into it", () => {
    const startHere = doc(HIDDEN, "START_HERE.md");
    expect(startHere).toContain("takes over your terminal and waits for you");
    expect(startHere).toContain("Everything in this guide that starts with a `/` is typed there");
  });

  // The escape hatch for the founder who is already in a session at the root and does not want to
  // restart it. These are plain Markdown files, so naming one works where the slash form does not —
  // and saying so is also the no-lock-in promise (§0) made concrete rather than asserted.
  it("offers the plain-words route for a session already open at the repository root", () => {
    const startHere = doc(HIDDEN, "START_HERE.md");
    expect(startHere).toContain("Already have Claude Code open at the top of the repository?");
    expect(startHere).toContain(`read \`${FOLDER}/.claude/commands/sync.md\` and do what it says`);
    expect(startHere).toContain("What you give up by asking this way is the autocomplete");
  });

  // Spec 215 gave `/sync` three entries it may create outside the folder, which made the old
  // "changes nothing outside this folder" promise false. A foundation that overpromises about what
  // it will touch in a shared repository is the one defect this whole mode cannot afford.
  it("no longer promises /sync changes nothing outside the folder, because it may now offer to", () => {
    const startHere = doc(HIDDEN, "START_HERE.md");
    expect(startHere).not.toContain("changes nothing outside this folder");
    expect(startHere).toContain("The only thing it ever puts outside this folder is a shortcut");
    expect(startHere).toContain("it asks first");
  });

  it("names a minimum Claude Code version, because the route fails silently on an older one", () => {
    expect(doc(HIDDEN, "START_HERE.md")).toContain("Claude Code 2.1.123 or newer");
    expect(doc(INTEGRATED, "START_HERE.md")).not.toContain("Claude Code 2.1.123");
  });

  it("does not say that to a founder whose foundation owns the repository", () => {
    expect(doc(INTEGRATED, "START_HERE.md")).toContain("in this repository");
  });

  it("tells /sync to leave everything outside the folder alone", () => {
    const sync = doc(HIDDEN, ".claude/commands/sync.md");
    expect(sync).toContain(`Nothing outside \`${FOLDER}/\` may change`);
    expect(sync).toContain(".git/info/exclude");
    expect(sync).toContain("git check-ignore");
  });

  // The ignore rule is the one thing `/sync` writes outside its own documents, and it is what keeps
  // the layout's promise rather than breaking it. Naming it as the single exception is what stops
  // the command's "changes nothing" framing from being quietly untrue (spec 214).
  it("names the ignore rule as the one exception to changing nothing", () => {
    expect(prose(doc(HIDDEN, ".claude/commands/sync.md"))).toContain(
      "One exception, and only this one:"
    );
  });

  it("tells /sync not to build the branch model a team already has", () => {
    const sync = doc(HIDDEN, ".claude/commands/sync.md");
    expect(sync).toContain("The branch model is already theirs");
    expect(sync).not.toContain("git init -b main");
  });

  // Spec 214: the mutating half does not ship here at all, which is a stronger guarantee than an
  // instruction telling it to hold back.
  it("ships no /cleanup to reorganise a repository the team shares", () => {
    expect(
      generated(HIDDEN).some((f) => f.path === `${FOLDER}/.claude/commands/cleanup.md`)
    ).toBe(false);
    expect(doc(HIDDEN, "CLAUDE.md")).not.toContain("/cleanup");
    expect(doc(HIDDEN, "START_HERE.md")).not.toContain("/cleanup");
  });

  it("still ships it to an integrated foundation, so the exclusion is the layout's", () => {
    expect(doc(INTEGRATED, ".claude/commands/cleanup.md")).toContain("## 5. The branch model");
  });

  it("never offers to write the committed ignore rule without asking", () => {
    const sync = doc(HIDDEN, ".claude/commands/sync.md");
    expect(sync).toContain("write it only if the founder says yes");
  });

  it("does not send a hidden /sync hunting the team's own instruction files", () => {
    const sync = doc(HIDDEN, ".claude/commands/sync.md");
    expect(sync).not.toContain("Old assistant instructions");
    // They are named, but as things to leave alone rather than to report for removal.
    expect(sync).toContain("leave every one of them alone");
  });
});

describe("a hidden delivery collides with nothing", () => {
  const digest = (content: string): string => `d:${content.length}`;

  /** The founder's project, as the digests stored from it — including paths Airrow also generates. */
  const existing = generated(INTEGRATED).map((f) => ({
    path: f.path,
    bytes: f.content.length,
    digest: digest(`${f.content} theirs`)
  }));

  it("finds no conflicts even against a project holding every path it would have used", () => {
    const diff = diffAgainstExisting(generated(HIDDEN), existing, digest);
    expect(diff.conflicts).toEqual([]);
    expect(diff.identical).toEqual([]);
    expect(diff.added.length).toBe(generated(HIDDEN).length);
  });

  it("finds those same collisions when integrated — so the difference is the layout", () => {
    const diff = diffAgainstExisting(generated(INTEGRATED), existing, digest);
    expect(diff.conflicts.length).toBeGreaterThan(0);
  });

  it("delivers every file with no decision to make, because nothing is contested", () => {
    const files = generated(HIDDEN);
    expect(applyResolutions(files, existing, new Map())).toEqual(files);
  });
});

describe("the layout does not leak into a project that began from nothing", () => {
  it("ships /start, the pipeline, and no folder", () => {
    const files = renderScaffold(TEMPLATE, model({ kind: "new" })).files;
    expect(files.every((f) => !f.path.startsWith(`${FOLDER}/`))).toBe(true);
    expect(files.some((f) => f.path === ".claude/commands/start.md")).toBe(true);
    expect(files.some((f) => f.path.startsWith(".github/workflows/"))).toBe(true);
  });
});
