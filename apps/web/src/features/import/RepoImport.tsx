"use client";

// Picking a repository, then naming the project (spec 67).
//
// Two steps in one component because the second is built entirely from the first: the repository the
// founder clicked already carries its name and description, so the form is prefilled without a
// second GitHub call. Nothing here talks to GitHub — the list arrives as props from the server.
//
// Name and description are controlled for the same reason as the ZIP form: React resets an
// uncontrolled form when the action returns, which would wipe both fields after a rejected import.
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { GitHubRepo } from "@/lib/github";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineError } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { importRepoAction, type ImportFormState } from "./actions";
import { ProPreview } from "./ProPreview";

export function RepoImport({ repos }: { repos: GitHubRepo[] }) {
  const [selected, setSelected] = useState<GitHubRepo | null>(null);

  return selected === null ? (
    <RepoList repos={repos} onSelect={setSelected} />
  ) : (
    <RepoDetails repo={selected} onBack={() => setSelected(null)} />
  );
}

function RepoList({
  repos,
  onSelect
}: {
  repos: GitHubRepo[];
  onSelect: (repo: GitHubRepo) => void;
}) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {repos.map((repo) => (
        <li key={repo.fullName}>
          <button
            type="button"
            onClick={() => onSelect(repo)}
            className="flex w-full cursor-pointer items-baseline justify-between gap-4 px-5 py-3.5 text-left transition-colors duration-150 hover:bg-surface-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
          >
            <span className="min-w-0">
              <span className="block truncate text-base font-medium text-fg">{repo.fullName}</span>
              {repo.description ? (
                <span className="mt-0.5 block truncate text-sm text-fg-muted">
                  {repo.description}
                </span>
              ) : null}
            </span>
            {/* The ISO date as GitHub sent it: a locale-formatted one would read differently for
                every founder and every CI machine (§V, deterministic). */}
            <span className="shrink-0 font-mono text-2xs text-fg-faint">
              {repo.updatedAt.slice(0, 10)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function RepoDetails({ repo, onBack }: { repo: GitHubRepo; onBack: () => void }) {
  const [state, action] = useActionState<ImportFormState, FormData>(importRepoAction, {});
  const [name, setName] = useState(repo.name);
  const [description, setDescription] = useState(repo.description ?? "");
  const router = useRouter();

  useEffect(() => {
    if (state.projectId !== undefined) router.push(`/app/projects/${state.projectId}/interview`);
  }, [state.projectId, router]);

  // The analysis ran and produced a real result; only keeping it needs Pro (spec 74). The back
  // button stays, because "look at another repository" is still a reasonable next move.
  const back = (
    <Button variant="ghost" size="sm" className="-ml-2 mb-4" onClick={onBack}>
      <ArrowLeft className="size-4" />
      All repositories
    </Button>
  );

  if (state.requiresPro && state.preview) {
    return (
      <Card>
        <CardBody className="p-6">
          {back}
          <ProPreview preview={state.preview} />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="p-6">
        {back}

        <form action={action} className="space-y-5">
          {state.error ? <InlineError>{state.error}</InlineError> : null}

          <p className="text-sm text-fg-muted">
            Importing <span className="font-mono text-fg">{repo.fullName}</span> — Airrow reads its
            default branch once, keeps only the structure, and never writes anything back.
          </p>

          <div>
            <Label htmlFor="repo-name">Project name</Label>
            <Input
              id="repo-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={80}
            />
          </div>

          <div>
            <Label htmlFor="repo-description">What does it do, and for whom?</Label>
            <Textarea
              id="repo-description"
              name="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              maxLength={2000}
              placeholder="e.g. A file compression platform that makes storage cheaper for anyone moving large amounts of data."
            />
            <p className="mt-1.5 text-sm text-fg-faint">
              Prefilled from the repository description when it has one. At least 10 characters.
            </p>
          </div>

          <input type="hidden" name="owner" value={repo.owner} />
          <input type="hidden" name="repo" value={repo.name} />
          <input type="hidden" name="source" value="repo" />

          <div className="flex justify-end">
            <SubmitButton size="lg" pendingLabel="Reading repository…">
              Analyse and continue
            </SubmitButton>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
