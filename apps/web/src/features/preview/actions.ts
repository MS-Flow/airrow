"use server";

// Founder edits to a generated file, saved back into the stored artifact so the ZIP and the
// preview stay in sync. Authorization is decided server-side from the session, never from the
// client-supplied project id alone (constitution §II).
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { getProject, latestJob, loadArtifact, updateArtifactFile } from "@/lib/data/store";
import { highlight } from "./highlight";

export async function saveGeneratedFileAction(
  projectId: string,
  filePath: string,
  content: string
): Promise<{ error?: string }> {
  const { org } = await requireSession();
  const project = await getProject(org.id, projectId);
  if (!project) return { error: "Project not found." };

  const job = await latestJob(projectId);
  if (!job || job.status !== "completed") return { error: "No generated foundation to edit." };

  // The path must name a file the engine actually produced — never trust it as a filesystem path.
  const artifact = await loadArtifact(job.id);
  if (!artifact?.files.some((f) => f.path === filePath)) {
    return { error: "That file is not part of this foundation." };
  }
  if (content.trim().length === 0) return { error: "A generated file cannot be emptied." };

  if (!(await updateArtifactFile(job.id, filePath, content))) {
    return { error: "Could not save the change." };
  }

  revalidatePath(`/app/projects/${projectId}/preview`);
  return {};
}

/**
 * Syntax highlighting for one code file, on demand.
 *
 * Switching files used to be a full page navigation so the server could highlight the new one, which
 * meant re-running auth, two queries and an artifact load before anything appeared — for a markdown
 * file that needs no highlighting at all. The reader now switches instantly from the files it already
 * has, and calls this only for code, showing plain text until it answers. Nothing waits on it.
 *
 * The path is re-checked against the stored artifact rather than trusted, and the content comes from
 * there rather than from the caller: the same rule as `saveGeneratedFileAction`.
 */
export async function highlightFileAction(
  projectId: string,
  filePath: string
): Promise<{ html?: string }> {
  const { org } = await requireSession();
  if (!(await getProject(org.id, projectId))) return {};

  const job = await latestJob(projectId);
  if (!job || job.status !== "completed") return {};

  const file = (await loadArtifact(job.id))?.files.find((f) => f.path === filePath);
  if (!file) return {};

  return { html: (await highlight(file.content, filePath)) ?? undefined };
}
