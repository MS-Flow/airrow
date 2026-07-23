"use server";

// Retry a failed generation (F-401 FR-4): new job, same (latest) model version.
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createJob, getProject, latestModelVersion, setProjectStatus } from "@/lib/data/store";
import { runGenerationJob } from "./runner";

export async function retryGenerationAction(projectId: string): Promise<{ error?: string }> {
  const { org } = await requireSession();
  const project = getProject(org.id, projectId);
  if (!project) return { error: "Project not found." };
  const mv = latestModelVersion(projectId);
  if (!mv) return { error: "No interview submission found — complete the interview first." };
  const job = createJob(projectId, mv.id);
  setProjectStatus(projectId, "generating");
  void runGenerationJob(job.id, mv.model);
  redirect(`/app/projects/${projectId}/generating`);
}
