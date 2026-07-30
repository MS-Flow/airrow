// Continue Locally handoff (F-405): from ZIP to first AI-implemented feature.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageContainer } from "@/components/shell/page-container";
import { DownloadProject } from "@/features/import/DownloadProject";
import { Card, CardBody } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { REFERRAL_GRANT_DAYS, referralSummary } from "@/lib/data/referrals";
import { getProject, latestModelVersion } from "@/lib/data/store";
import { requestOrigin } from "@/lib/site-url";
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
  // The one moment a founder has just seen what Airrow made them, which is when recommending it is a
  // natural thing to do rather than an ask (spec 122). Read-only: nothing here starts a week.
  // Null while the database is behind the referrals migration — the handoff below is the point of this
  // screen and must not depend on an aside being available.
  const referral = await referralSummary(org.id);
  const inviteLink = referral ? `${await requestOrigin()}/invite/${referral.code}` : null;
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
    <PageContainer className="max-w-2xl animate-slide-up py-12">
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

      {/* One line, and only while there is something in it for them. A founder who has used all
          three places has already done more than enough recommending. */}
      {referral && inviteLink && referral.remaining > 0 ? (
        <div className="mt-10 border-t border-border pt-6">
          <p className="text-sm leading-relaxed text-fg-muted">
            Know another founder starting something? Send them this — when they generate their first
            foundation you get {REFERRAL_GRANT_DAYS} days of Pro.
          </p>
          <CopyBlock text={inviteLink} mono={false} />
        </div>
      ) : null}

      <div className="mt-8 flex items-center justify-between">
        <Link href={`/app/projects/${id}/preview`} className="text-sm text-fg-muted hover:text-fg">
          ← Back to preview
        </Link>
        <DownloadProject projectId={id} slug={slug} />
      </div>
    </PageContainer>
  );
}
