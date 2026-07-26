import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getProject } from "@/lib/data/store";
import { GenerationProgress } from "@/features/generation/GenerationProgress";

export const metadata = { title: "Generating" };

export default async function GeneratingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { org } = await requireSession();
  const project = await getProject(org.id, id);
  if (!project) notFound();
  if (project.status === "ready") redirect(`/app/projects/${id}`);
  if (project.status === "interviewing") redirect(`/app/projects/${id}/interview`);
  return <GenerationProgress projectId={project.id} projectName={project.name} />;
}
