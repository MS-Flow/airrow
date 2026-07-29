// The GitHub half of the import screen (spec 67). A server component: the listing is a GitHub call,
// and those only ever happen server-side (§I).
//
// Every outcome is a real state — signed in with email, no public repositories, GitHub unreachable —
// and each of them says the same thing in its own words: the ZIP path above is still right there.
import Link from "next/link";
import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Notice } from "@/components/ui/states";
import { signInWithGitHubAction } from "@/features/auth/actions";
import { RepoImport } from "./RepoImport";
import { listRepos } from "./queries";

/**
 * Said once, above every state, and deliberately not only in the empty one: a founder whose private
 * repository is missing from a list of twenty must not have to work out why it isn't there.
 */
function PublicOnly() {
  return (
    <p className="mt-2 text-sm leading-relaxed text-fg-muted">
      Only your <strong className="font-medium text-fg">public</strong> repositories are listed.
      Airrow signs you in without asking GitHub for any repository permissions, so a private project
      is invisible to it — import that one as a ZIP above.
    </p>
  );
}

export async function RepoPicker({ page }: { page: number }) {
  const state = await listRepos(page);

  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-md font-semibold tracking-tight text-fg">
        <Github className="size-4 text-fg-muted" aria-hidden />
        Import from GitHub
      </h2>
      <PublicOnly />

      <div className="mt-4">
        {state.kind === "disconnected" ? (
          <Notice title="Sign in with GitHub to see your repositories">
            <p>
              This account signed in with an email address, so Airrow has no GitHub identity to list
              repositories with. Signing in with GitHub uses the same workspace when the addresses
              match.
            </p>
            <form action={signInWithGitHubAction} className="mt-3">
              <Button type="submit" variant="secondary" size="sm">
                <Github className="size-4" />
                Sign in with GitHub
              </Button>
            </form>
          </Notice>
        ) : state.kind === "error" ? (
          <ErrorState title="GitHub could not be read" description={state.message} />
        ) : state.repos.length === 0 ? (
          <EmptyState
            title="No public repositories"
            description="This GitHub account has no public repositories to import. Upload a ZIP above instead — it is the complete way in, and the only one for a private project."
          />
        ) : (
          <RepoImport repos={state.repos} />
        )}
      </div>

      {state.kind === "ready" && (page > 1 || state.hasMore) ? (
        <nav className="mt-4 flex items-center justify-between" aria-label="Repository pages">
          {page > 1 ? (
            <Link
              href={`/app/projects/import?repoPage=${page - 1}`}
              className="text-sm text-fg-muted underline underline-offset-4 hover:text-fg"
            >
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          {state.hasMore ? (
            <Link
              href={`/app/projects/import?repoPage=${page + 1}`}
              className="text-sm text-fg-muted underline underline-offset-4 hover:text-fg"
            >
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </section>
  );
}
