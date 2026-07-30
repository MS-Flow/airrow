// The GitHub reader, driven by a fake `fetch`. No network: §V forbids it, and every behaviour worth
// asserting here is a decision this module makes about a response, not something GitHub does.
import { describe, expect, it } from "vitest";
import { githubReader, REPOS_PER_PAGE } from "./github";

const TOKEN = "gho_test";

const repoJson = (name: string, isPrivate = false) => ({
  name,
  full_name: `ada/${name}`,
  owner: { login: "ada" },
  description: `The ${name} project`,
  size: 120,
  updated_at: "2026-07-01T10:00:00Z",
  private: isPrivate
});

/** A fetch that always answers the same way, and records the URL it was asked for. */
function fakeFetch(response: Response | (() => never)): typeof fetch & { url: string } {
  let url = "";
  const impl = (async (input: RequestInfo | URL) => {
    url = String(input);
    if (typeof response === "function") response();
    return response;
  }) as typeof fetch & { url: string };
  Object.defineProperty(impl, "url", { get: () => url });
  return impl;
}

const json = (body: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });

describe("listPublicRepos", () => {
  it("maps a repository to what the picker needs", async () => {
    const result = await githubReader(fakeFetch(json([repoJson("loop-crm")]))).listPublicRepos(TOKEN, 1);

    expect(result).toEqual({
      ok: true,
      value: {
        repos: [
          {
            owner: "ada",
            name: "loop-crm",
            fullName: "ada/loop-crm",
            description: "The loop-crm project",
            sizeKb: 120,
            updatedAt: "2026-07-01T10:00:00Z"
          }
        ],
        hasMore: false
      }
    });
  });

  it("never lists a private repository, whatever the query asked for", async () => {
    const body = [repoJson("public-one"), repoJson("secret", true)];
    const result = await githubReader(fakeFetch(json(body))).listPublicRepos(TOKEN, 1);

    expect(result.ok && result.value.repos.map((r) => r.name)).toEqual(["public-one"]);
  });

  it("reports a further page when the page came back full", async () => {
    const body = Array.from({ length: REPOS_PER_PAGE }, (_, i) => repoJson(`repo-${i}`));
    const result = await githubReader(fakeFetch(json(body))).listPublicRepos(TOKEN, 2);

    expect(result.ok && result.value.hasMore).toBe(true);
  });

  it("asks for the page it was given, and only for public repositories", async () => {
    const fetcher = fakeFetch(json([]));
    await githubReader(fetcher).listPublicRepos(TOKEN, 3);

    expect(fetcher.url).toContain("visibility=public");
    expect(fetcher.url).toContain("page=3");
  });

  it("tells an expired sign-in apart from a spent rate limit", async () => {
    const expired = await githubReader(fakeFetch(json({}, { status: 401 }))).listPublicRepos(TOKEN, 1);
    expect(!expired.ok && expired.error.kind).toBe("unauthorized");

    const limited = await githubReader(
      fakeFetch(json({}, { status: 403, headers: { "x-ratelimit-remaining": "0" } }))
    ).listPublicRepos(TOKEN, 1);
    expect(!limited.ok && limited.error.kind).toBe("rate_limited");
    expect(!limited.ok && limited.error.message).toMatch(/try again/i);
  });

  it("treats an unrecognisable body as GitHub being unavailable, not as an empty list", async () => {
    const result = await githubReader(
      fakeFetch(new Response("not json", { status: 200 }))
    ).listPublicRepos(TOKEN, 1);

    expect(!result.ok && result.error.kind).toBe("unavailable");
  });

  it("survives the request throwing", async () => {
    const result = await githubReader(
      fakeFetch(() => {
        throw new Error("ECONNRESET");
      })
    ).listPublicRepos(TOKEN, 1);

    expect(!result.ok && result.error.kind).toBe("unavailable");
  });
});

describe("downloadZipball", () => {
  it("returns the bytes GitHub served", async () => {
    const result = await githubReader(fakeFetch(new Response("zip-bytes"))).downloadZipball(
      TOKEN,
      "ada",
      "loop-crm"
    );

    expect(result.ok && new TextDecoder().decode(result.value)).toBe("zip-bytes");
  });

  it("reports a repository that is gone or no longer public", async () => {
    const result = await githubReader(fakeFetch(json({}, { status: 404 }))).downloadZipball(
      TOKEN,
      "ada",
      "vanished"
    );

    expect(!result.ok && result.error.kind).toBe("not_found");
  });

  it("refuses a download that claims to be over the import limit", async () => {
    const oversized = new Response("x", {
      headers: { "content-length": String(200 * 1024 * 1024) }
    });
    const result = await githubReader(fakeFetch(oversized)).downloadZipball(TOKEN, "ada", "huge");

    expect(!result.ok && result.error.kind).toBe("too_large");
  });
});
