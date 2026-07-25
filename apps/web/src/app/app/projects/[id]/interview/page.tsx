import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getInterview, getProject } from "@/lib/data/store";
import { InterviewRuntime } from "@/features/interview/InterviewRuntime";

export const metadata = { title: "Interview" };

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org } = await requireSession();
  const project = await getProject(org.id, id);
  if (!project) notFound();
  if (project.status === "generating") redirect(`/app/projects/${id}/generating`);
  if (project.status === "ready") redirect(`/app/projects/${id}`);

  const interview = await getInterview(id);
  return (
    <InterviewRuntime
      projectId={project.id}
      projectName={project.name}
      initialAnswers={interview?.answers ?? {}}
    />
  );
}
