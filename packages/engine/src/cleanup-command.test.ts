// Tests for which first-run commands a foundation ships, and for the rebuilt `/cleanup` (spec 214).
//
// Spec 91 shipped exactly one first-run command per foundation. Spec 214 split the imported case in
// two — `/sync` reads and writes documents, `/cleanup` reorganises the code — so the rule is now a
// set: `/start` alone, `/sync` + `/cleanup` integrated, `/sync` alone hidden. `/sync`'s own content
// is covered in `sync-command.test.ts`; this file owns the set, the new `/cleanup`, and the documents
// that have to agree with whichever commands actually shipped.
//
// Like `/start`, `/cleanup` is instruction text an assistant executes, so what is testable here is
// what the renderer puts in the repository. Whether the assistant then behaves is the manual check
// recorded in the spec.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GenerationError, generate } from "./index.ts";
import { commandPaths, resolveProjectModel } from "./model.ts";
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
const SYNC = ".claude/commands/sync.md";
const CLEANUP = ".claude/commands/cleanup.md";
const FIRST_RUN = [START, SYNC, CLEANUP];

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
const IMPORTED_EMPTY: ProjectOrigin = {
  kind: "imported",
  stackDetected: false,
  delivery: { kind: "integrated" }
};

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

describe("which first-run commands a foundation ships", () => {
  it("gives a project started from nothing /start, and neither import command", () => {
    const { paths } = render(NEW);
    expect(paths).toContain(START);
    expect(paths).not.toContain(SYNC);
    expect(paths).not.toContain(CLEANUP);
  });

  it("gives an integrated import both halves of the first session", () => {
    const { paths } = render(IMPORTED);
    expect(paths).toContain(SYNC);
    expect(paths).toContain(CLEANUP);
    expect(paths).not.toContain(START);
  });

  it("gives a hidden import /sync alone — the mutating half is what it exists to avoid", () => {
    const { paths } = render(HIDDEN);
    expect(paths).toContain(SYNC);
    expect(paths).not.toContain(CLEANUP);
    expect(paths).not.toContain(START);
  });

  it("gives an import that held no code /start — there is nothing to read", () => {
    const { paths } = render(IMPORTED_EMPTY);
    expect(paths).toContain(START);
    expect(paths).not.toContain(SYNC);
    expect(paths).not.toContain(CLEANUP);
  });

  // Spec 217: the most invasive thing a foundation does arrived unasked until now — an integrated
  // import got the command that moves files because it had code. Declining is not a smaller
  // foundation: every document is still written, the map is still built, nothing of theirs moves.
  it("gives an integrated import that declined the restructure /sync alone", () => {
    const { paths } = render(IMPORTED, { ...BASE, restructure: "documents_only" });
    expect(paths).toContain(SYNC);
    expect(paths).not.toContain(CLEANUP);
    expect(paths).not.toContain(START);
  });

  it("names no command it did not ship, anywhere in a foundation that declined", () => {
    const { files } = render(IMPORTED, { ...BASE, restructure: "documents_only" });
    for (const file of files.filter((f) => f.path.endsWith(".md"))) {
      expect(file.content, file.path).not.toContain("/cleanup");
    }
  });

  // Caught by generating a declined foundation and reading it: `START_HERE.md` chose its first-session
  // prose on `shipsCleanup`, whose false arm was written for hidden and talks about "this folder".
  // A declined *integrated* import has no folder, so it rendered `read \`null/.claude/commands/…\``.
  // The two questions came apart in spec 217 and every branch that means "hidden" has to ask for it.
  it("never describes a folder to a foundation that does not live in one", () => {
    for (const answers of [BASE, { ...BASE, restructure: "documents_only" } satisfies InterviewAnswers]) {
      for (const file of render(IMPORTED, answers).files) {
        expect(file.content, file.path).not.toContain("null/");
        expect(file.content, file.path).not.toContain("undefined/");
      }
      const startHere = render(IMPORTED, answers).byPath("START_HERE.md");
      expect(prose(startHere)).not.toContain("a session only finds commands where it started");
    }
  });

  it("ignores the answer where it could not change anything", () => {
    // Hidden ships no `/cleanup` whatever anyone answers, and a documents-only import ships
    // `/start` — neither is asked the question, and a stray answer must not reach either one.
    const declined = { ...BASE, restructure: "documents_only" } satisfies InterviewAnswers;
    expect(render(HIDDEN, declined).paths).toEqual(render(HIDDEN).paths);
    expect(render(IMPORTED_EMPTY, declined).paths).toEqual(render(IMPORTED_EMPTY).paths);
  });

  it("ships exactly the set its origin calls for, and never /start beside an import command", () => {
    for (const origin of [NEW, IMPORTED, HIDDEN, IMPORTED_EMPTY]) {
      for (const answers of [BASE, { ...BASE, restructure: "documents_only" } satisfies InterviewAnswers]) {
        const { paths } = render(origin, answers);
        const shipped = paths.filter((p) => FIRST_RUN.includes(p));
        expect(shipped.sort()).toEqual([...commandPaths(model(origin, answers))].sort());
        expect(shipped.length).toBeGreaterThan(0);
        if (shipped.includes(START)) expect(shipped).toEqual([START]);
      }
    }
  });

  it("rejects a foundation missing any command its origin calls for", () => {
    const issuesFrom = (template: TemplateFile[], origin: ProjectOrigin): string[] => {
      try {
        generate(template, model(origin));
      } catch (err) {
        return err instanceof GenerationError ? err.issues : [String(err)];
      }
      return [];
    };
    // Both halves are required, so dropping either one fails validation — a foundation that names
    // `/cleanup` in three documents and does not ship it is the defect this catches.
    expect(issuesFrom(TEMPLATE.filter((f) => f.path !== CLEANUP), IMPORTED)).toContain(
      `missing required file: ${CLEANUP}`
    );
    expect(issuesFrom(TEMPLATE.filter((f) => f.path !== SYNC), IMPORTED)).toContain(
      `missing required file: ${SYNC}`
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

  it("refuses to run before /sync, because it has no map to work from", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    expect(cleanup).toContain(".claude/project-map.md");
    expect(prose(cleanup)).toContain("offer to run `/sync` first, and stop there");
  });

  it("moves with git mv and updates what pointed at the old path", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    expect(cleanup).toContain("**`git mv`, always.**");
    expect(prose(cleanup)).toContain("Update every reference in the same pass");
    expect(prose(cleanup)).toContain("A move that leaves a broken import is worse than no move at all");
  });

  // Spec 217: the layout used to be a directory list chosen from the interview's framework answer,
  // which on an import is a coarse confirmation of what the analysis found — "Vite + React" covers
  // TanStack Start, Remix and a dozen others whose conventions differ. Naming directories from it
  // misfiles things with confidence, so the map's proven stack is the source and only the three
  // stack-independent rules are stated here.
  it("takes the layout from the project map's stack, naming no framework's directories", () => {
    for (const answers of [BASE, { ...BASE, framework: "vite" } satisfies InterviewAnswers]) {
      const cleanup = prose(render(IMPORTED, answers).byPath(CLEANUP));
      expect(cleanup).toContain("the project map is where you read it from");
      expect(cleanup).not.toContain("The conventions below are");
      expect(cleanup).not.toContain("`src/features/<name>/`");
      expect(cleanup).not.toContain("`src/lib/`");
    }
  });

  it("states the three rules that hold whatever the stack is", () => {
    const cleanup = prose(render(IMPORTED).byPath(CLEANUP));
    expect(cleanup).toContain("The router's directory holds routes, and nothing that is not one");
    expect(cleanup).toContain("Code with no UI lives apart from code with one");
    expect(cleanup).toContain("Tests sit beside what they cover");
    expect(cleanup).toContain("Everything past those three comes from the ecosystem, not from this file");
  });

  it("moves nothing at all when there is no convention to apply", () => {
    const custom = { ...BASE, framework: "custom", frameworkOther: "Rails 8 with Postgres" } satisfies InterviewAnswers;
    const cleanup = render(IMPORTED, custom).byPath(CLEANUP);
    expect(prose(cleanup)).toContain("**move nothing**");
    expect(prose(cleanup)).toContain("worse than the one that is already here");
  });

  it("keeps its hands off the paths the tooling finds by location", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    expect(cleanup).toContain("**Framework-mandated paths.**");
    for (const fixed of ["`app/`", "`public/`", "`supabase/`", "`migrations/`", "`.github/`"]) {
      expect(cleanup).toContain(fixed);
    }
    expect(prose(cleanup)).toContain("Moving one of these is not tidying, it is breaking the build");
  });

  it("applies the root rule per package in a monorepo", () => {
    expect(prose(render(IMPORTED).byPath(CLEANUP))).toContain(
      "In a monorepo, every package is its own root"
    );
  });

  it("records the verification bar before it moves anything, and reverts what it breaks", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    for (const command of ["pnpm build", "pnpm typecheck", "pnpm lint", "pnpm test"]) {
      expect(cleanup).toContain(command);
    }
    expect(prose(cleanup)).toContain("Whatever is already failing was failing before you arrived");
    expect(prose(cleanup)).toContain("**revert that move**");
  });

  it("proposes what nothing uses per category, and deletes only on a yes", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    expect(prose(cleanup)).toContain("**Then wait.**");
    expect(prose(cleanup)).toContain("a yes to one category is not a yes to the next");
    for (const category of ["Duplicates and abandoned drafts", "Dead code", "Generator leftovers"]) {
      expect(cleanup).toContain(category);
    }
  });

  it("reports an oversized file rather than splitting it", () => {
    expect(prose(render(IMPORTED).byPath(CLEANUP))).toContain(
      "Splitting them changes behaviour, so it goes through `/createspec`"
    );
  });

  it("stages the whole change and commits none of it", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    expect(cleanup).toContain("**It stages, and never commits.**");
    expect(cleanup).toContain("git diff --staged");
    expect(cleanup).toContain("git restore --staged .");
  });

  it("forbids the git operations that cannot be undone", () => {
    const cleanup = prose(render(IMPORTED).byPath(CLEANUP));
    for (const forbidden of ["rebase", "reset --hard", "--force", "No branch renamed and none deleted"]) {
      expect(cleanup).toContain(forbidden);
    }
  });

  it("stops at this machine, like every other command here", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    expect(cleanup).toContain("No remote");
    expect(cleanup).toContain("no secrets written");
  });
});

// Spec 217. An app-builder export arrives structurally correct, so every section above finds nothing
// and the report reads as an all-clear on a project that cannot build without the vendor's package.
// This section is the answer, and it is reporting only — removing any of it changes behaviour, which
// is the one thing this command may never do.
describe("what /cleanup reports but may not touch", () => {
  const cleanup = () => prose(render(IMPORTED).byPath(CLEANUP));

  it("asks all four provenance questions, and removes nothing", () => {
    const text = cleanup();
    expect(text).toContain("**This section removes nothing.**");
    expect(text).toContain("Does the build depend on a vendor?");
    expect(text).toContain("Does anything phone home?");
    expect(text).toContain("Is this project named after itself?");
    expect(text).toContain("What arrived through the vendor but is good on its own merit?");
  });

  it("unpacks a wrapper before costing it, and says what it did silently", () => {
    const text = cleanup();
    expect(text).toContain("**unpack that package**");
    expect(text).toContain("The difference between those two lists is the real cost of leaving");
    expect(text).toContain("including whatever it was doing silently");
  });

  it("separates telemetry that is inert in production from telemetry that is watched", () => {
    const text = cleanup();
    expect(text).toContain("whether its key or endpoint is even set in production");
    expect(text).toContain("two different findings and must never be reported as one");
  });

  it("keeps what arrived through the vendor and is good on merit, security middleware first", () => {
    const text = cleanup();
    expect(text).toContain("**These are keeps.**");
    expect(text).toContain("Judge them on what they do, never on where they came from");
    expect(text).toContain("**Security middleware stays**");
    expect(text).toContain("Say them out loud in the report as kept");
  });

  it("never judges a file by its name or its comments", () => {
    expect(cleanup()).toContain("**Never judge a file by its name or its comments.**");
  });

  it("hands the de-vendoring off with a line the founder can paste, and the cost of running it", () => {
    const text = cleanup();
    expect(text).toContain("/createspec \"Remove the <vendor> build coupling");
    expect(text).toContain("The founder cannot decide to keep something they were never told they had");
  });

  it("reports what it cannot attribute rather than acting on it", () => {
    expect(cleanup()).toContain(
      "**Anything you could not attribute with confidence is reported, never acted on.**"
    );
  });

  it("carries the findings in the plan, so an interrupted run still reports them", () => {
    const text = cleanup();
    expect(text).toContain("Write the findings into `.claude/cleanup-plan.json` as you go");
    expect(text).toContain("the findings from section 2");
  });

  it("proves a dependency is unused outside the source before proposing its removal", () => {
    const text = cleanup();
    expect(text).toContain("A package is not unused because the source does not import it");
    expect(text).toContain(
      "**Never propose removing a package without showing where you established it is unused, including outside the source directory.**"
    );
    expect(text).toContain("it is conditional on that removal, not independently dead");
  });

  it("stops for a missing package manager instead of substituting one", () => {
    const text = cleanup();
    expect(text).toContain("If it is not, **stop and ask**");
    expect(text).toContain("two lockfiles that resolve differently is a defect");
    expect(text).toContain("record the bar as unrunnable");
    expect(text).toContain("but **move nothing**");
  });

  it("stages per planned path and restores a generated file the baseline run refreshed", () => {
    const text = cleanup();
    expect(text).toContain("**Stage per planned path, never `git add -A`.**");
    expect(text).toContain("Anything staged that the plan does not account for comes back out");
    expect(text).toContain("report that the committed copy is stale");
  });

  it("reports the state of the verification bar as a finding, not only as a measurement", () => {
    const text = cleanup();
    expect(text).toContain("**The bar itself is a finding.**");
    expect(text).toContain("how many failures were already there");
  });

  it("leaves an orientation in the map for whoever has never seen the project", () => {
    const text = cleanup();
    for (const heading of [
      "**Entry points**",
      "**The critical path**",
      "**Load-bearing and easy to break**",
      "**Safe to change first**",
      "**Read in this order**"
    ]) {
      expect(text).toContain(heading);
    }
    expect(text).toContain("Derive all five from the code");
  });

  it("says what it checked when there was nothing to move", () => {
    const text = cleanup();
    expect(text).toContain("Then say what you checked, one line each");
    expect(text).toContain("That is a verdict. Silence is not.");
  });
});

describe("/cleanup on a tree it did not leave clean", () => {
  it("writes the whole plan before applying any of it", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    expect(cleanup).toContain(".claude/cleanup-plan.json");
    expect(prose(cleanup)).toContain("**before applying any of it**");
  });

  it("resumes from a half-finished run instead of refusing the dirty tree it made", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    expect(prose(cleanup)).toContain("**Resume from where it stopped.**");
    expect(prose(cleanup)).toContain("they are work already done");
  });

  it("stops when the dirty tree is the founder's, not its own", () => {
    expect(prose(render(IMPORTED).byPath(CLEANUP))).toContain(
      "Dirty, with no plan** — the changes are the founder's"
    );
  });

  it("leaves anything it cannot attribute to its own plan alone", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    expect(prose(cleanup)).toContain("**Leave it untouched and report it.**");
    expect(prose(cleanup)).toContain("Never assume an unattributed change is yours");
  });

  it("offers git init where there is no repository, rather than restructuring what cannot be undone", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    expect(prose(cleanup)).toContain("a restructure with\nno way back".replace(/\s+/g, " "));
    expect(cleanup).toContain("`git init`");
  });
});

describe("/cleanup, unlike /sync, does finish", () => {
  it("creates the branch model the workflow runs on, and renames no trunk", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    expect(cleanup).toContain("## 6. The branch model");
    expect(prose(cleanup)).toContain("`develop` from the trunk");
    expect(cleanup).toContain("**Do not rename it.**");
    expect(cleanup).toContain("BRANCHING.md");
  });

  it("re-points the documents from its own move plan rather than analysing again", () => {
    expect(prose(render(IMPORTED).byPath(CLEANUP))).toContain(
      "this is a rename map, not a second analysis"
    );
  });

  it("rewrites START_HERE.md before it deletes itself, and only after the bar passes", () => {
    const cleanup = render(IMPORTED).byPath(CLEANUP);
    expect(cleanup).toContain("Rewrite step 1 of [START_HERE.md](../../START_HERE.md)");
    expect(cleanup).toContain("Delete this command file.");
    expect(prose(cleanup)).toContain("In that order");
    expect(prose(cleanup)).toContain("A failed or partial run leaves all three alone");
  });

  it("comes back with the moves when the founder discards the changeset", () => {
    expect(prose(render(IMPORTED).byPath(CLEANUP))).toContain(
      "a founder who discards the changeset gets this command back"
    );
  });

  // Spec 217 replaced "say so and hand back" with an enumeration: on a generated project the
  // structure was always going to be fine, so a bare "nothing to move" reads as an oversight.
  it("enumerates what it checked on a project that is already tidy", () => {
    const cleanup = prose(render(IMPORTED).byPath(CLEANUP));
    expect(cleanup).toContain("Then say what you checked, one line each");
    expect(cleanup).toContain("Move nothing and hand back anyway");
  });
});

describe("the documents match the commands the founder actually has", () => {
  it("never names /start anywhere in an imported foundation", () => {
    for (const origin of [IMPORTED, HIDDEN]) {
      expect(render(origin).text).not.toContain("/start");
    }
  });

  it("never names an import command anywhere in a new project's foundation", () => {
    const { text } = render(NEW);
    expect(text).not.toContain("/cleanup");
    expect(text).not.toContain("/sync");
  });

  it("never names /cleanup anywhere in a hidden foundation, which does not ship it", () => {
    expect(render(HIDDEN).text).not.toContain("/cleanup");
  });

  it("opens START_HERE.md with the command this project ships, and names the second", () => {
    const here = render(IMPORTED).byPath("START_HERE.md");
    expect(here).toContain("/sync");
    expect(here).toContain("**Then run `/cleanup`.**");
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

  it("carries a ceiling for each command it ships into the generated constitution", () => {
    const integrated = render(IMPORTED).byPath(".claude/spec-kit/constitution.md");
    expect(integrated).toContain("`/sync` describes, the spec loop builds");
    expect(integrated).toContain("`/cleanup` moves, it does not rewrite");
    // Hidden ships one command, so it states one ceiling — and not the one for a file it never got.
    const hidden = render(HIDDEN).byPath(".claude/spec-kit/constitution.md");
    expect(hidden).toContain("`/sync` describes, the spec loop builds");
    expect(hidden).not.toContain("`/cleanup` moves");
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

/* ── what CLAUDE.md tells a founder about a two-command first session ────────── */

describe("CLAUDE.md introduces both commands, and neither one it lacks", () => {
  it("names /cleanup in the first-session row, which has no room to grow one", () => {
    const claude = render(IMPORTED).byPath("CLAUDE.md");
    expect(claude).toContain("## Starting a chat here");
    expect(claude).toContain("`/cleanup` is what reorganises the project itself");
    expect(claude).not.toContain("then removes itself");
  });

  it("gives a hidden import the row for the one command it has", () => {
    const claude = render(HIDDEN).byPath("CLAUDE.md");
    expect(claude).toContain("rewrites these documents to match. Changes no code, deletes nothing");
    expect(claude).not.toContain("/cleanup");
  });

  it("hands /sync to /cleanup and /cleanup to the loop, in the what-next table", () => {
    const claude = render(IMPORTED).byPath("CLAUDE.md");
    expect(claude).toContain("## After a command finishes");
    expect(claude).toContain("| `/sync` | These documents now describe the code that is really here. Next: `/cleanup`");
    expect(claude).toContain("| `/cleanup` | The structure is readable and the moves are staged for review");
    expect(claude).not.toContain("| `/start` |");
  });

  it("sends a hidden import straight from /sync to the loop, having no second command", () => {
    const claude = render(HIDDEN).byPath("CLAUDE.md");
    expect(claude).toContain("| `/sync` | These documents now describe the code that is really here. Next: `/createspec");
  });

  it("says which command expires and which does not", () => {
    // `/sync` is permanent and `/cleanup` is the one that disappears, so the file a session should
    // look for is `/cleanup`'s — the greenfield sentence would be answering about the wrong command.
    const integrated = render(IMPORTED).byPath("CLAUDE.md");
    expect(integrated).toContain("`/sync` does not expire");
    expect(integrated).toContain(".claude/commands/cleanup.md` is gone");
    expect(render(HIDDEN).byPath("CLAUDE.md")).toContain("`/sync` does not expire");
    expect(render(NEW).byPath("CLAUDE.md")).toContain(".claude/commands/start.md` still exists");
  });

  it("asks an imported project for Claude Code and nothing else", () => {
    const here = render(IMPORTED).byPath("START_HERE.md");
    expect(here).toMatch(/\*\*First, install \[Claude Code\]/);
    expect(prose(here)).toContain("Nothing here installs anything else");
    expect(here).not.toContain("are all step 1 of the command below");
  });

  // A theme is something a command installs, and neither import command installs anything (spec 165).
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
