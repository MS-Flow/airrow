"use server";

// Interview persistence + submission (F-301 FR-4/FR-6).
import { redirect } from "next/navigation";
import {
  TRANSIENT_ANSWERS,
  deliveryLayoutSchema,
  interviewAnswersSchema,
  pruneHiddenAnswers,
  questionsFor,
  validateCompleteAnswers,
  type InterviewAnswers
} from "@airrow/schemas";
import { hiddenFolderFrom, resolveProjectModel } from "@airrow/engine";
import { requireSession } from "@/lib/auth";
import {
  completeInterview,
  createJob,
  createModelVersion,
  getImportSource,
  getProject,
  latestJob,
  saveInterviewAnswers,
  setDeliveryLayout,
  setProjectStatus
} from "@/lib/data/store";
import { listUiReferences } from "@/lib/data/ui-references";
import { allowanceMessage, claimAllowance } from "@/features/generation/allowance";
import { projectOrigin } from "@/features/import/origin";

/**
 * Take how the foundation should land out of the answers, and put it where it belongs (spec 199).
 *
 * The interview asks it, so it arrives as an answer — but `import_sources.delivery` is the one
 * durable record and the one thing the engine reads, so this writes it there and hands back the
 * answers without it. Two copies of a decision this consequential would eventually disagree, and
 * generation would read the wrong one.
 *
 * Spec 187's rules are enforced here rather than restated: the folder is normalised the way the
 * founder typed it and then validated as a single path segment, and hidden is refused outright for
 * an import with no code in it, because a foundation cannot hide inside a codebase that is not there.
 */
async function writeDeliveryThrough(
  projectId: string,
  answers: InterviewAnswers
): Promise<InterviewAnswers> {
  const rest = { ...answers };
  for (const id of TRANSIENT_ANSWERS) delete rest[id];
  if (answers.deliveryLayout === undefined) return rest;

  const source = await getImportSource(projectId);
  if (!source) return rest;

  const parsed = deliveryLayoutSchema.safeParse(
    answers.deliveryLayout === "hidden"
      ? { kind: "hidden", folder: hiddenFolderFrom(answers.hiddenFolder ?? "") }
      : { kind: "integrated" }
  );
  // An unusable folder name leaves the stored choice exactly as it was. The founder is still typing
  // it — a save every 350ms must not be able to write a half-typed name, and must not throw at
  // someone mid-word either.
  if (!parsed.success) return rest;
  if (parsed.data.kind === "hidden" && !source.analysis.stackDetected) return rest;

  await setDeliveryLayout(source.id, parsed.data);
  return rest;
}

export async function saveAnswersAction(projectId: string, raw: unknown): Promise<{ ok: boolean }> {
  const { org } = await requireSession();
  const project = await getProject(org.id, projectId);
  if (!project) return { ok: false };
  const parsed = interviewAnswersSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  const answers = await writeDeliveryThrough(projectId, parsed.data as InterviewAnswers);
  // Pruned against the set this project was actually asked, so an answer to an import-only question
  // is not dropped for belonging to no question the greenfield set has.
  await saveInterviewAnswers(
    projectId,
    pruneHiddenAnswers(answers, questionsFor(await projectOrigin(projectId)))
  );
  return { ok: true };
}

export async function submitInterviewAction(
  projectId: string,
  raw: unknown
): Promise<{ error?: string; upgrade?: boolean }> {
  const { org, user } = await requireSession();
  const project = await getProject(org.id, projectId);
  if (!project) return { error: "Project not found." };

  // The layout is written through before the answers are validated, so the origin the model is
  // stamped with below already carries the founder's final choice (spec 199).
  const answers = await writeDeliveryThrough(projectId, (raw ?? {}) as InterviewAnswers);
  const pruned = pruneHiddenAnswers(answers, questionsFor(await projectOrigin(projectId)));
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
    origin: await projectOrigin(projectId),
    // The count, never the images: the engine renders a brief that says honestly where its design
    // direction came from, and the bytes stay with the app (spec 159).
    referenceImageCount: (await listUiReferences(org.id, projectId)).length
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
  const allowance = await claimAllowance({
    orgId: org.id,
    plan: org.plan,
    userId: user.id,
    projectId
  });
  // Flagged rather than merely worded, so the screen can offer a way on instead of showing a red
  // box at the end of thirty questions (spec 100). The answers are already saved above — the
  // founder loses nothing by leaving for the upgrade screen and coming back.
  if (!allowance.allowed) return { error: allowanceMessage(allowance.denial), upgrade: true };

  await createJob(projectId, modelVersion.id);
  await setProjectStatus(projectId, "generating");
  // The job is created queued and left that way: the progress screen starts it (POST
  // .../generate) once it is on screen, so the stages are written while they are being
  // watched. Running it here instead would mean the founder waits on a blank submit and
  // then lands on a screen with nothing left to show.
  redirect(`/app/projects/${projectId}/generating`);
}
