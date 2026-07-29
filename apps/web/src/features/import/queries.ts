// Reading what the import screen needs from GitHub (spec 67). Server-side only.
//
// The screen renders one of these states and nothing else — no branching on nulls at the call site,
// no half-loaded list (§III, explicit states). "Not signed in with GitHub" is a state, not a failure:
// an email account is a perfectly good account, it just has no repositories to offer.
import { githubToken } from "@/lib/auth";
import { githubReader, type GitHubReader, type GitHubRepo } from "@/lib/github";

export type RepoListState =
  | { kind: "disconnected" }
  | { kind: "ready"; repos: GitHubRepo[]; page: number; hasMore: boolean }
  | { kind: "error"; message: string };

/**
 * The signed-in founder's public repositories. `reader` is injected so the screen's behaviour can be
 * tested against a deterministic double instead of the network (§V).
 */
export async function listRepos(page: number, reader: GitHubReader = githubReader()): Promise<RepoListState> {
  const token = await githubToken();
  if (token === null) return { kind: "disconnected" };

  const result = await reader.listPublicRepos(token, page);
  if (!result.ok) return { kind: "error", message: result.error.message };

  return { kind: "ready", repos: result.value.repos, page, hasMore: result.value.hasMore };
}
