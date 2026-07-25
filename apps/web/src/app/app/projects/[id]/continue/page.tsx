// Continue Locally handoff (F-405): from ZIP to first AI-implemented feature.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { getProject, latestModelVersion } from "@/lib/data/store";
import { CopyBlock } from "@/features/delivery/CopyBlock";

export const metadata = { title: "Continue locally" };

export default async function ContinuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org } = await requireSession();
  const project = await getProject(org.id, id);
  if (!project) notFound();
  if (project.status !== "ready") redirect(`/app/projects/${id}`);

  const model = (await latestModelVersion(id))?.model;
  const slug = project.slug;
  const isGh = model?.stack.repoProvider !== "azure_devops";

  const remote = isGh
    ? `git remote add origin git@github.com:<your-username>/${slug}.git\ngit push -u origin main`
    : `git remote add origin https://dev.azure.com/<your-org>/${slug}/_git/${slug}\ngit push -u origin main`;

  const firstPrompt = `Read CLAUDE.md, context/PROGRESS.md and docs/ROADMAP.md. Summarize this project's plan in three sentences, then walk me through Milestone 0 setup step by step, starting with the spec as required by the workflow.`;

  const steps: Array<{ title: string; body: string; block?: string }> = [
    {
      title: "Download and extract",
      body: `Download the ZIP and extract it. Your foundation lives in a folder named ${slug}/.`
    },
    {
      title: "Initialize git",
      body: "Turn the folder into a repository with an initial commit:",
      block: `cd ${slug}\ngit init\ngit add -A\ngit commit -m "chore: engineering foundation from Airrow"`
    },
    {
      title: isGh ? "Create the GitHub repository" : "Create the Azure DevOps repository",
      body: isGh
        ? `Create a new private repository named ${slug} on GitHub, then connect and push:`
        : `Create a project and repo named ${slug} in Azure DevOps, then connect and push:`,
      block: remote
    },
    {
      title: "Open in VS Code and install Claude Code",
      body: "If you don't have Claude Code yet:",
      block: `npm install -g @anthropic-ai/claude-code\ncode ${slug}\nclaude`
    },
    {
      title: "Start your first session",
      body: "Paste this as your first prompt — it points Claude at the foundation and starts Milestone 0 the right way:",
      block: firstPrompt
    }
  ];

  return (
    <div className="mx-auto max-w-2xl animate-slide-up px-6 py-12 md:px-8">
      <p className="font-mono text-xs text-fg-faint">Continue locally</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">
        From foundation to first feature
      </h1>
      <p className="mt-2 text-base leading-relaxed text-fg-muted">
        Five steps. After this, your repository — and its README, START_HERE, and roadmap — takes
        over as the guide.
      </p>

      <div className="mt-8 space-y-4">
        {steps.map((s, i) => (
          <Card key={s.title}>
            <CardBody className="flex items-start gap-4 p-5">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border font-mono text-xs text-fg-muted">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-fg">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-fg-muted">{s.body}</p>
                {s.block ? <CopyBlock text={s.block} /> : null}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <Link href={`/app/projects/${id}/preview`} className="text-sm text-fg-muted hover:text-fg">
          ← Back to preview
        </Link>
        <Button asChild>
          <a href={`/api/projects/${id}/zip`}>
            <Download className="size-4" />
            Download ZIP
          </a>
        </Button>
      </div>
    </div>
  );
}
