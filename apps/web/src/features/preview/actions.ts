"use server";

// Founder edits to a generated file, saved back into the stored artifact so the ZIP and the
// preview stay in sync. Authorization is decided server-side from the session, never from the
// client-supplied project id alone (constitution §II).
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { getProject, latestJob, loadArtifact, updateArtifactFile } from "@/lib/data/store";

export async function saveGeneratedFileAction(
  projectId: string,
  filePath: string,
  content: string
): Promise<{ error?: string }> {
  const { org } = await requireSession();
  const project = getProject(org.id, projectId);
  if (!project) return { error: "Project not found." };

  const job = latestJob(projectId);
  if (!job || job.status !== "completed") return { error: "No generated foundation to edit." };

  // The path must name a file the engine actually produced — never trust it as a filesystem path.
  const artifact = loadArtifact(job.id);
  if (!artifact?.files.some((f) => f.path === filePath)) {
    return { error: "That file is not part of this foundation." };
  }
  if (content.trim().length === 0) return { error: "A generated file cannot be emptied." };

  if (!updateArtifactFile(job.id, filePath, content)) return { error: "Could not save the change." };

  revalidatePath(`/app/projects/${projectId}/preview`);
  return {};
}
