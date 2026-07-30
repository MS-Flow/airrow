// The two ways an import used to fail as an opaque 500 instead of a readable state.
//
// Both were real: a deployment without IMPORT_DIGEST_PEPPERS, and a migration that was committed but
// never applied to the deployed database (issue #77). Either one threw out of the server action, and
// Next.js turned that into "a server-side exception has occurred" with only a digest — the founder
// lost the form they had filled in and learned nothing about why.
//
// GitHub, Supabase and the session are mocked: none of them exists outside a request, and none of
// them is what this is about (§V — no network, deterministic). The digest module is deliberately
// *not* mocked, because its throw is the behaviour under test.
//
// A file of its own, and not by preference: `actions.test.ts` mocks `./digest` away, since the Pro
// gate it covers never reaches it. Both facts cannot hold in one module, and the alternative — one
// file that mocks the module under test for half its cases — is worse than two files with one
// subject each. The session here is on Pro for the same reason: these paths live *behind* that gate,
// so a free organization would be turned back before reaching either failure.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// `vi.mock` factories are hoisted above the module body, so the doubles they close over have to be
// created in a hoisted block too — otherwise they are still uninitialised when the factory runs.
const { requireSession, githubToken, createProject, createImportSource, saveInterviewAnswers } =
  vi.hoisted(() => ({
    requireSession: vi.fn(async () => ({
      org: { id: "org-1", name: "Workspace", kind: "personal", createdBy: "u-1", plan: "pro" },
      user: { id: "u-1" }
    })),
    githubToken: vi.fn(async (): Promise<string | null> => "gh-token"),
    createProject: vi.fn(async () => ({ id: "project-1" })),
    // Variadic on purpose: one assertion reads the digest version out of the recorded arguments, and
    // a zero-arity double gives `mock.calls` an empty tuple type with nothing to read.
    createImportSource: vi.fn(async (..._args: unknown[]) => ({ id: "import-1" })),
    saveInterviewAnswers: vi.fn(async () => undefined)
  }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
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
vi.mock("./repo", () => ({
  readRepository: vi.fn(async () => ({
    ok: true,
    files: [{ path: "package.json", content: '{"name":"loop","dependencies":{"next":"15.0.0"}}' }],
    ignored: 0
  }))
}));

import { importRepoAction } from "./actions";

const ENV_KEY = "IMPORT_DIGEST_PEPPERS";
const original = process.env[ENV_KEY];

/** The form the repository picker submits, already validated shapes. */
function form(): FormData {
  const data = new FormData();
  data.set("name", "Loop CRM");
  data.set("description", "A lightweight CRM for small agencies.");
  data.set("source", "repo");
  data.set("owner", "acme");
  data.set("repo", "loop");
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  createProject.mockResolvedValue({ id: "project-1" });
  process.env[ENV_KEY] = "1:pepper-one";
});

afterEach(() => {
  if (original === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = original;
  vi.restoreAllMocks();
});

describe("importing when the deployment is misconfigured", () => {
  it("says so instead of throwing, and writes nothing", async () => {
    delete process.env[ENV_KEY];
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const state = await importRepoAction({}, form());

    expect(state.error).toMatch(/not available on this deployment/i);
    expect(state.projectId).toBeUndefined();
    // The guard has to come *before* the project row, or a failed import leaves one behind.
    expect(createProject).not.toHaveBeenCalled();
  });

  it("does not tell the founder to retry a ZIP that would fail the same way", async () => {
    delete process.env[ENV_KEY];
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const state = await importRepoAction({}, form());

    expect(state.error).toMatch(/a ZIP would fail the same way/i);
  });

  it("logs the reason, since the founder's message deliberately does not carry it", async () => {
    delete process.env[ENV_KEY];
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await importRepoAction({}, form());

    expect(logged).toHaveBeenCalled();
    expect(String(logged.mock.calls[0]?.[0])).toMatch(/digest pepper/i);
  });
});

describe("importing when the write fails", () => {
  it("reports a failed save rather than a server exception", async () => {
    // What a migration that never reached the deployed database actually looks like from here.
    createProject.mockRejectedValue(
      new Error("Supabase: column import_sources.digest_version does not exist")
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const state = await importRepoAction({}, form());

    expect(state.error).toMatch(/saving it failed/i);
    expect(state.projectId).toBeUndefined();
  });

  it("never puts the database's own error in front of the founder", async () => {
    createProject.mockRejectedValue(new Error("Supabase: relation does not exist"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const state = await importRepoAction({}, form());

    expect(state.error).not.toMatch(/supabase|relation|column/i);
  });
});

describe("importing when everything is configured", () => {
  it("still returns the project id — the guards are not in the way", async () => {
    const state = await importRepoAction({}, form());

    expect(state.error).toBeUndefined();
    expect(state.projectId).toBe("project-1");
    expect(createImportSource).toHaveBeenCalledOnce();
    expect(saveInterviewAnswers).toHaveBeenCalledOnce();
  });

  it("hashes with the configured pepper version, not the legacy raw SHA-256", async () => {
    process.env[ENV_KEY] = "1:pepper-one,2:pepper-two";

    await importRepoAction({}, form());

    const digestVersion = createImportSource.mock.calls[0]?.[5];
    expect(digestVersion).toBe(2);
  });
});
