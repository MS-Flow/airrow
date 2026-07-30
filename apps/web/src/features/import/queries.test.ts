// Regression test for a crash on the deployed import screen (spec 67).
//
// The reader reports its failures as values, so those were handled — but the token lookup goes
// through Supabase, and a *thrown* error there escaped into the render and took the whole route
// down, ZIP form included. A founder without a GitHub account could not import at all because of a
// service they never touched. GitHub being unreachable must never cost more than the GitHub half.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitHubReader } from "@/lib/github";

const githubToken = vi.fn();
vi.mock("@/lib/auth", () => ({ githubToken: () => githubToken() }));

const { listRepos } = await import("./queries");

/** A reader that must never be reached when the token lookup fails. */
const unusedReader: GitHubReader = {
  listPublicRepos: vi.fn(),
  downloadZipball: vi.fn()
};

const reader = (repos: GitHubReader["listPublicRepos"]): GitHubReader => ({
  listPublicRepos: repos,
  downloadZipball: vi.fn()
});

beforeEach(() => {
  githubToken.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("listRepos", () => {
  it("degrades to an error state when the session lookup throws", async () => {
    githubToken.mockRejectedValue(new Error("supabase unreachable"));

    const state = await listRepos(1, unusedReader);

    expect(state.kind).toBe("error");
    expect(state.kind === "error" && state.message).toMatch(/upload a ZIP instead/i);
    expect(unusedReader.listPublicRepos).not.toHaveBeenCalled();
  });

  it("degrades to an error state when the reader itself throws", async () => {
    githubToken.mockResolvedValue("gho_token");

    const state = await listRepos(
      1,
      reader(vi.fn().mockRejectedValue(new Error("socket hang up")))
    );

    expect(state.kind).toBe("error");
  });

  it("is disconnected, not broken, when there is no GitHub token", async () => {
    githubToken.mockResolvedValue(null);

    await expect(listRepos(1, unusedReader)).resolves.toEqual({ kind: "disconnected" });
  });

  it("passes a reported failure through in the founder's words", async () => {
    githubToken.mockResolvedValue("gho_token");

    const state = await listRepos(
      2,
      reader(
        vi.fn().mockResolvedValue({
          ok: false,
          error: { kind: "rate_limited", message: "GitHub is rate-limiting Airrow right now." }
        })
      )
    );

    expect(state).toEqual({ kind: "error", message: "GitHub is rate-limiting Airrow right now." });
  });

  it("returns the page it was asked for", async () => {
    githubToken.mockResolvedValue("gho_token");

    const state = await listRepos(
      3,
      reader(vi.fn().mockResolvedValue({ ok: true, value: { repos: [], hasMore: true } }))
    );

    expect(state).toEqual({ kind: "ready", repos: [], page: 3, hasMore: true });
  });
});
