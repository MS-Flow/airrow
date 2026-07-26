"use server";

// Interview persistence + submission (F-301 FR-4/FR-6).
import { redirect } from "next/navigation";
import {
  interviewAnswersSchema,
  pruneHiddenAnswers,
  validateCompleteAnswers,
  type InterviewAnswers
} from "@airrow/schemas";
import { resolveProjectModel } from "@airrow/engine";
import { requireSession } from "@/lib/auth";
import {
  completeInterview,
  createJob,
  createModelVersion,
  getProject,
  latestJob,
  saveInterviewAnswers,
  setProjectStatus
} from "@/lib/data/store";
import { runGenerationJob } from "@/features/generation/runner";

export async function saveAnswersAction(projectId: string, raw: unknown): Promise<{ ok: boolean }> {
  const { org } = await requireSession();
  const project = await getProject(org.id, projectId);
  if (!project) return { ok: false };
  const parsed = interviewAnswersSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  await saveInterviewAnswers(projectId, pruneHiddenAnswers(parsed.data as InterviewAnswers));
  return { ok: true };
}

export async function submitInterviewAction(projectId: string, raw: unknown): Promise<{ error?: string }> {
  const { org } = await requireSession();
  const project = await getProject(org.id, projectId);
  if (!project) return { error: "Project not found." };

  const pruned = pruneHiddenAnswers((raw ?? {}) as InterviewAnswers);
  const validated = validateCompleteAnswers(pruned);
  if (!validated.ok) return { error: validated.error };

  await saveInterviewAnswers(projectId, validated.answers as InterviewAnswers);
  await completeInterview(projectId);

  const model = resolveProjectModel({
    name: project.name,
    description: project.description,
    answers: validated.answers as InterviewAnswers
  });
  const modelVersion = await createModelVersion(projectId, model);

  // Idempotency (F-401 edge case): reuse a live job for this model version.
  const existing = await latestJob(projectId);
  if (existing && existing.modelVersionId === modelVersion.id && existing.status === "running") {
    redirect(`/app/projects/${projectId}/generating`);
  }

  const job = await createJob(projectId, modelVersion.id);
  await setProjectStatus(projectId, "generating");
  // Awaited, not detached: a serverless invocation is frozen once it responds, so a
  // fire-and-forget job never finishes. It records its own failure, so this never throws.
  await runGenerationJob(job.id, model);
  redirect(`/app/projects/${projectId}/generating`);
}
