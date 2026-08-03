import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getInterview, getProject, latestJob } from "@/lib/data/store";
import { AllowanceNotice } from "@/features/generation/AllowanceNotice";
import { checkAllowance } from "@/features/generation/allowance";
import { AuthedInterview } from "@/features/interview/AuthedInterview";
import { projectOrigin } from "@/features/import/origin";

export const metadata = { title: "Interview" };

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, org } = await requireSession();
  const project = await getProject(org.id, id);
  if (!project) notFound();
  if (project.status === "generating") redirect(`/app/projects/${id}/generating`);

  // A generated project may come back to change its answers; submitting regenerates from scratch.
  const interview = await getInterview(id);
  // Why the founder is back here, when they were sent back rather than arriving on their own: the
  // last run refused these answers (spec 128). Read from the job, so it survives a refresh and cannot
  // be conjured by a link.
  const lastJob = await latestJob(id);
  // Which questions this project is asked (spec 199). Resolved here, on the server, from the one
  // record of where a project came from — the interview never guesses at its own origin.
  const origin = await projectOrigin(id);
  // Said here so the founder knows before answering thirty questions, not after (spec 100). The
  // interview itself is never blocked — the wall is at generate, and only there.
  const allowance = await checkAllowance({
    orgId: org.id,
    plan: org.plan,
    userId: user.id,
    projectId: id
  });

  return (
    <>
      <AllowanceNotice allowance={allowance} className="px-6 pt-6 text-sm sm:px-8" />
      <AuthedInterview
        projectId={project.id}
        projectName={project.name}
        initialAnswers={interview?.answers ?? {}}
        origin={origin}
        regenerating={project.status === "ready"}
        rejectedAnswers={lastJob?.rejectedAnswers ?? null}
      />
    </>
  );
}
