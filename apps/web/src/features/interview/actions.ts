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
import { allowanceMessage, checkAllowance } from "@/features/generation/allowance";
import { projectOrigin } from "@/features/import/origin";

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
  const { org, user } = await requireSession();
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
    answers: validated.answers as InterviewAnswers,
    // The only place a ProjectModel is built, so the only place the origin can be stamped on it —
    // and it decides whether the foundation ships `/start` or `/cleanup` (spec 91).
    origin: await projectOrigin(projectId)
  });
  const modelVersion = await createModelVersion(projectId, model);

  // Idempotency (F-401 edge case): reuse a live job for this model version.
  const existing = await latestJob(projectId);
  if (existing && existing.modelVersionId === modelVersion.id && existing.status === "running") {
    redirect(`/app/projects/${projectId}/generating`);
  }

  // Checked here rather than at the point of generation: a founder who is out of allowance should
  // hear it now, not after landing on a progress screen that will never move. The idempotent
  // re-entry above is deliberately allowed through — resuming a running job costs nothing new.
  const allowance = await checkAllowance({
    orgId: org.id,
    plan: org.plan,
    userId: user.id,
    projectId
  });
  if (!allowance.allowed) return { error: allowanceMessage(allowance.denial) };

  await createJob(projectId, modelVersion.id);
  await setProjectStatus(projectId, "generating");
  // The job is created queued and left that way: the progress screen starts it (POST
  // .../generate) once it is on screen, so the stages are written while they are being
  // watched. Running it here instead would mean the founder waits on a blank submit and
  // then lands on a screen with nothing left to show.
  redirect(`/app/projects/${projectId}/generating`);
}
