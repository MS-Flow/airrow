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
  const project = getProject(org.id, projectId);
  if (!project) return { ok: false };
  const parsed = interviewAnswersSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  saveInterviewAnswers(projectId, pruneHiddenAnswers(parsed.data as InterviewAnswers));
  return { ok: true };
}

export async function submitInterviewAction(projectId: string, raw: unknown): Promise<{ error?: string }> {
  const { org } = await requireSession();
  const project = getProject(org.id, projectId);
  if (!project) return { error: "Project not found." };

  const pruned = pruneHiddenAnswers((raw ?? {}) as InterviewAnswers);
  const validated = validateCompleteAnswers(pruned);
  if (!validated.ok) return { error: validated.error };

  saveInterviewAnswers(projectId, validated.answers as InterviewAnswers);
  completeInterview(projectId);

  const model = resolveProjectModel({
    name: project.name,
    description: project.description,
    answers: validated.answers as InterviewAnswers
  });
  const modelVersion = createModelVersion(projectId, model);

  // Idempotency (F-401 edge case): reuse a live job for this model version.
  const existing = latestJob(projectId);
  if (existing && existing.modelVersionId === modelVersion.id && existing.status === "running") {
    redirect(`/app/projects/${projectId}/generating`);
  }

  const job = createJob(projectId, modelVersion.id);
  setProjectStatus(projectId, "generating");
  void runGenerationJob(job.id, model); // fire-and-forget; progress via polling (ADR-0005)
  redirect(`/app/projects/${projectId}/generating`);
}
