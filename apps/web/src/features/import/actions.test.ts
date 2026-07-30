// Import is a Pro capability (spec 74), and the two things worth proving are where the gate sits
// and that both entry points pass through it.
//
// Where: after the analysis, before the first durable write. A free founder must get the real result
// for their code — that is the whole reason the wall stands here rather than in front of the upload
// — and must get no project, no import source and no prefilled answers.
//
// Both: a ZIP and a GitHub repository are separate actions that converge on `completeImport`. A gate
// added to one and forgotten on the other is exactly the bug this file exists to catch, so every
// assertion runs against both.
import { describe, it, expect, vi, beforeEach } from "vitest";

const requireSession = vi.hoisted(() => vi.fn());
const githubToken = vi.hoisted(() => vi.fn(async (): Promise<string | null> => "gh-token"));
const createProject = vi.hoisted(() => vi.fn());
const createImportSource = vi.hoisted(() => vi.fn());
const saveInterviewAnswers = vi.hoisted(() => vi.fn());
const readArchive = vi.hoisted(() => vi.fn());
const readRepository = vi.hoisted(() => vi.fn());
const analyzeImport = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireSession, githubToken }));
vi.mock("@/lib/github", () => ({ githubReader: () => ({}) }));
vi.mock("@/lib/data/store", () => ({
  createProject,
  createImportSource,
  saveInterviewAnswers,
  clearConflictResolution: vi.fn(),
  getImportSource: vi.fn(),
  getProject: vi.fn(),
  latestJob: vi.fn(),
  saveConflictResolution: vi.fn()
}));
vi.mock("@airrow/engine", () => ({
  analyzeImport,
  digestImported: () => [],
  slugify: (s: string) => s.toLowerCase()
}));
vi.mock("./archive", () => ({ readArchive }));
vi.mock("./repo", () => ({ readRepository }));
// The digest keyring reads a required secret from the environment and is not what this file is
// about; the free path never reaches it, and the Pro path only has to get past it.
vi.mock("./digest", () => ({ currentDigestVersion: () => 1, digestFor: () => () => "digest" }));

import { importProjectAction, importRepoAction, type ImportFormState } from "./actions";

const EVIDENCE = [{ field: "framework" as const, value: "Next.js", source: "package.json" }];

/** The analysis a founder would see: real evidence, derived locally, costing Airrow nothing. */
const ANALYSIS = {
  answers: {},
  stackDetected: true,
  evidence: EVIDENCE,
  notes: ["A workspace was detected but is not modelled yet."],
  filesAnalyzed: 42,
  filesIgnored: 7
};

function signedInOn(plan: "free" | "pro"): void {
  requireSession.mockResolvedValue({
    user: { id: "u1", email: "f@example.com", name: "F", createdAt: "2026-01-01T00:00:00.000Z" },
    org: { id: "o1", name: "Workspace", kind: "personal", createdBy: "u1", plan }
  });
}

function zipForm(): FormData {
  const form = new FormData();
  form.set("name", "Loop CRM");
  form.set("description", "A lightweight CRM for small agencies.");
  form.set("source", "zip");
  form.set("archive", new File([new Uint8Array([1, 2, 3])], "loop.zip", { type: "application/zip" }));
  return form;
}

function repoForm(): FormData {
  const form = new FormData();
  form.set("name", "Loop CRM");
  form.set("description", "A lightweight CRM for small agencies.");
  form.set("source", "repo");
  form.set("owner", "acme");
  form.set("repo", "loop");
  return form;
}

/** The two entry points, run identically — that is the point. */
const entries: [string, () => Promise<ImportFormState>][] = [
  ["a ZIP upload", () => importProjectAction({}, zipForm())],
  ["a GitHub repository", () => importRepoAction({}, repoForm())]
];

describe("import behind Pro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    githubToken.mockResolvedValue("gh-token");
    analyzeImport.mockReturnValue(ANALYSIS);
    readArchive.mockResolvedValue({ ok: true, files: [], ignored: [] });
    readRepository.mockResolvedValue({ ok: true, files: [], ignored: [] });
    createProject.mockResolvedValue({ id: "p1", name: "Loop CRM" });
  });

  describe.each(entries)("from %s", (_label, run) => {
    it("gives a free organization the analysis it just ran", async () => {
      signedInOn("free");

      const state = await run();

      expect(state.requiresPro).toBe(true);
      expect(state.preview).toMatchObject({
        evidence: EVIDENCE,
        notes: ANALYSIS.notes,
        filesAnalyzed: 42,
        filesIgnored: 7
      });
    });

    it("persists nothing at all for a free organization", async () => {
      signedInOn("free");

      const state = await run();

      expect(createProject).not.toHaveBeenCalled();
      expect(createImportSource).not.toHaveBeenCalled();
      expect(saveInterviewAnswers).not.toHaveBeenCalled();
      expect(state.projectId).toBeUndefined();
    });

    it("withholds the prefilled interview, which is the part Pro buys", async () => {
      signedInOn("free");

      const state = await run();

      expect(state.preview).not.toHaveProperty("answers");
    });

    it("still runs the analysis, rather than refusing before reading the files", async () => {
      // The wall stands after the aha moment on purpose. If this ever starts short-circuiting
      // earlier, a founder with an existing repo is being asked to buy blind.
      signedInOn("free");

      await run();

      expect(analyzeImport).toHaveBeenCalled();
    });

    it("completes the import for a Pro organization", async () => {
      signedInOn("pro");

      const state = await run();

      expect(state.projectId).toBe("p1");
      expect(state.requiresPro).toBeUndefined();
      expect(createProject).toHaveBeenCalledWith(
        "o1",
        "Loop CRM",
        "A lightweight CRM for small agencies.",
        expect.any(Function)
      );
      expect(saveInterviewAnswers).toHaveBeenCalled();
    });
  });

  it("blames the unreadable file, not the plan, when the archive cannot be read", async () => {
    // A plan refusal for a file we could never have imported would be a lie, and would send the
    // founder to a checkout to fix a broken ZIP.
    signedInOn("free");
    readArchive.mockResolvedValue({ ok: false, error: "That archive could not be opened." });

    const state = await importProjectAction({}, zipForm());

    expect(state.error).toMatch(/could not be opened/);
    expect(state.requiresPro).toBeUndefined();
    expect(analyzeImport).not.toHaveBeenCalled();
  });

  it("asks GitHub for the repository before deciding on the plan", async () => {
    // Same shape as the ZIP case: an expired GitHub sign-in is its own problem and is said plainly.
    signedInOn("free");
    githubToken.mockResolvedValue(null);

    const state = await importRepoAction({}, repoForm());

    expect(state.error).toMatch(/GitHub sign-in has expired/);
    expect(state.requiresPro).toBeUndefined();
  });
});
