// Reading public GitHub repositories on behalf of the signed-in founder (spec 67). Server-side only
// — imported from server actions, queries and route handlers, never from a client component.
//
// The token is the founder's OAuth identity with **no scopes**, so everything reachable here is
// something an anonymous visitor could already fetch from github.com (constitution §II, amended by
// spec 67). Nothing beyond that: no writes, no private content, no App installation.
//
// `GitHubReader` is an interface rather than a set of functions so tests can hand the import path a
// deterministic double — §V forbids tests that depend on the network, and the whole point of this
// module is the network.
import { z } from "zod";
import { IMPORT_LIMITS } from "@airrow/engine";

const API = "https://api.github.com";

/** One repository, reduced to what the picker shows and the import needs. */
export interface GitHubRepo {
  owner: string;
  name: string;
  /** `owner/name`, the form GitHub itself uses and the founder recognises. */
  fullName: string;
  description: string | null;
  /** GitHub's own size figure, in kilobytes — a cheap guard before downloading anything. */
  sizeKb: number;
  updatedAt: string;
}

/**
 * Why a read failed, as a value. Every kind maps to something the founder can act on, which is why
 * `unauthorized` and `rate_limited` are separate: one means sign in again, the other means wait.
 */
export type GitHubFailureKind =
  | "unauthorized"
  | "not_found"
  | "rate_limited"
  | "too_large"
  | "unavailable";

export interface GitHubFailure {
  kind: GitHubFailureKind;
  message: string;
}

export type GitHubResult<T> = { ok: true; value: T } | { ok: false; error: GitHubFailure };

export interface RepoPage {
  repos: GitHubRepo[];
  /** Whether a further page exists — GitHub pages by link header; a full page is the same answer. */
  hasMore: boolean;
}

export interface GitHubReader {
  /** The signed-in user's own public repositories, newest activity first. */
  listPublicRepos(token: string, page: number): Promise<GitHubResult<RepoPage>>;
  /** The default branch as a ZIP, read exactly like an uploaded archive. */
  downloadZipball(token: string, owner: string, repo: string): Promise<GitHubResult<ArrayBuffer>>;
}

export const REPOS_PER_PAGE = 30;

/**
 * The shape we rely on. GitHub sends far more; anything unexpected is a failed read rather than a
 * value that quietly becomes `undefined` downstream (§I, Zod at every boundary).
 */
const repoSchema = z.object({
  name: z.string(),
  full_name: z.string(),
  owner: z.object({ login: z.string() }),
  description: z.string().nullable(),
  size: z.number(),
  updated_at: z.string(),
  private: z.boolean()
});

const failure = (kind: GitHubFailureKind, message: string): GitHubResult<never> => ({
  ok: false,
  error: { kind, message }
});

const UNAVAILABLE = "GitHub could not be reached. Try again, or upload a ZIP instead.";

/** HTTP status → the founder's situation. A 403 is only a rate limit when GitHub says the budget is spent. */
function statusFailure(response: Response): GitHubFailure {
  if (response.status === 401) {
    return {
      kind: "unauthorized",
      message: "Your GitHub sign-in has expired. Sign in with GitHub again to browse your repositories."
    };
  }
  if (response.status === 404) {
    return {
      kind: "not_found",
      message: "That repository is no longer public, or no longer exists."
    };
  }
  const spent = response.headers.get("x-ratelimit-remaining") === "0";
  if (response.status === 429 || (response.status === 403 && spent)) {
    return {
      kind: "rate_limited",
      message: "GitHub is rate-limiting Airrow right now. Wait a few minutes and try again."
    };
  }
  if (response.status === 403) {
    return { kind: "unauthorized", message: "GitHub refused that request." };
  }
  return { kind: "unavailable", message: UNAVAILABLE };
}

const headers = (token: string): HeadersInit => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "airrow"
});

/**
 * Read a response body with a hard ceiling.
 *
 * `content-length` is checked first when GitHub sends one, but it is a claim, not a fact — the same
 * reasoning as the archive reader, which re-checks the running total while decompressing. A repo big
 * enough to matter is rejected before it can fill this process's memory.
 */
async function boundedBody(response: Response, maxBytes: number): Promise<ArrayBuffer | null> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return null;

  const body = response.body;
  if (body === null) return null;

  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged.buffer;
}

const TOO_LARGE = `That repository is over the ${Math.round(IMPORT_LIMITS.maxBytes / (1024 * 1024))} MB import limit.`;

/** The real reader. `fetchImpl` is injected so tests never touch the network (§V). */
export function githubReader(fetchImpl: typeof fetch = fetch): GitHubReader {
  async function request(url: string, token: string): Promise<Response | GitHubResult<never>> {
    try {
      return await fetchImpl(url, { headers: headers(token), cache: "no-store" });
    } catch {
      return failure("unavailable", UNAVAILABLE);
    }
  }

  return {
    async listPublicRepos(token, page) {
      const query = new URLSearchParams({
        visibility: "public",
        affiliation: "owner",
        sort: "updated",
        per_page: String(REPOS_PER_PAGE),
        page: String(Math.max(1, page))
      });
      const response = await request(`${API}/user/repos?${query}`, token);
      if (!(response instanceof Response)) return response;
      if (!response.ok) return { ok: false, error: statusFailure(response) };

      const parsed = z.array(repoSchema).safeParse(await response.json().catch(() => null));
      if (!parsed.success) return failure("unavailable", UNAVAILABLE);

      // `visibility=public` is GitHub's filter, and the private flag is ours: the promise made in the
      // UI is that nothing private is listed, so it is enforced here rather than assumed there.
      const repos = parsed.data
        .filter((r) => !r.private)
        .map((r) => ({
          owner: r.owner.login,
          name: r.name,
          fullName: r.full_name,
          description: r.description,
          sizeKb: r.size,
          updatedAt: r.updated_at
        }));
      return { ok: true, value: { repos, hasMore: parsed.data.length === REPOS_PER_PAGE } };
    },

    async downloadZipball(token, owner, repo) {
      const response = await request(`${API}/repos/${owner}/${repo}/zipball`, token);
      if (!(response instanceof Response)) return response;
      if (!response.ok) return { ok: false, error: statusFailure(response) };

      const body = await boundedBody(response, IMPORT_LIMITS.maxBytes);
      if (body === null) return failure("too_large", TOO_LARGE);
      return { ok: true, value: body };
    }
  };
}
