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

const UNAVAILABLE =
  "The repository list could not be loaded. Try again in a moment — you can always upload a ZIP instead.";

/**
 * The signed-in founder's public repositories. `reader` is injected so the screen's behaviour can be
 * tested against a deterministic double instead of the network (§V).
 *
 * Nothing in here is allowed to throw. The reader reports its own failures as values, but the token
 * lookup goes through Supabase and a *thrown* error would take down the whole import route — ZIP form
 * and all — for a founder who may not even have a GitHub account. That is the one outcome spec 67
 * rules out: GitHub being unreachable must never be the reason a project cannot be imported. So the
 * boundary is closed here, and the reason is logged rather than swallowed (§II — the message only,
 * never a token or a founder's content).
 */
export async function listRepos(page: number, reader: GitHubReader = githubReader()): Promise<RepoListState> {
  try {
    const token = await githubToken();
    if (token === null) return { kind: "disconnected" };

    const result = await reader.listPublicRepos(token, page);
    if (!result.ok) return { kind: "error", message: result.error.message };

    return { kind: "ready", repos: result.value.repos, page, hasMore: result.value.hasMore };
  } catch (error) {
    console.error("[import] listing GitHub repositories failed:", error);
    return { kind: "error", message: UNAVAILABLE };
  }
}
