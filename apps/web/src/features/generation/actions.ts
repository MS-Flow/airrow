"use server";

// Retry a failed generation (F-401 FR-4): new job, same (latest) model version.
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createJob, getProject, latestModelVersion, setProjectStatus } from "@/lib/data/store";

export async function retryGenerationAction(projectId: string): Promise<{ error?: string }> {
  const { org } = await requireSession();
  const project = await getProject(org.id, projectId);
  if (!project) return { error: "Project not found." };
  const mv = await latestModelVersion(projectId);
  if (!mv) return { error: "No interview submission found — complete the interview first." };
  await createJob(projectId, mv.id);
  await setProjectStatus(projectId, "generating");
  // Left queued for the progress screen to start, exactly as a first run is.
  redirect(`/app/projects/${projectId}/generating`);
}
