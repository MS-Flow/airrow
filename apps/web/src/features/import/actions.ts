"use server";

// Importing an existing project (spec 63). Upload → analyse → prefilled interview.
//
// The analysis runs in this request and nothing but paths, sizes and digests is persisted, so the
// founder's source never lands in Airrow's database (§II, customer IP).
import { analyzeImport, digestImported, slugify } from "@airrow/engine";
import {
  conflictDecisionSchema,
  importCreateSchema,
  interviewAnswersSchema,
  pruneHiddenAnswers,
  type InterviewAnswers
} from "@airrow/schemas";
import { requireSession } from "@/lib/auth";
import {
  createImportSource,
  createProject,
  getImportSource,
  getProject,
  latestJob,
  saveConflictResolution,
  saveInterviewAnswers
} from "@/lib/data/store";
import { readArchive } from "./archive";
import { currentDigestVersion, digestFor } from "./digest";

export interface ImportFormState {
  error?: string;
  /**
   * Set once the import succeeded. The action returns instead of redirecting so the browser can
   * cache the founder's archive against this id first — it is the only copy that will exist, since
   * Airrow stores no content (spec 68).
   */
  projectId?: string;
}

export async function importProjectAction(
  _previous: ImportFormState,
  formData: FormData
): Promise<ImportFormState> {
  const { org } = await requireSession();

  const parsed = importCreateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    source: formData.get("source")
  });
  if (!parsed.success) {
    return { error: "A name (min 2 chars) and a description (min 10 chars) are required." };
  }

  const upload = formData.get("archive");
  if (!(upload instanceof File) || upload.size === 0) {
    return { error: "Choose a .zip of your project to import." };
  }

  const archive = await readArchive(await upload.arrayBuffer());
  if (!archive.ok) return { error: archive.error };

  const analysis = analyzeImport(archive.files, archive.ignored);

  // Engine output crossing into persistence is a boundary like any other, so it is validated
  // rather than trusted, then pruned to the questions actually visible given what was derived.
  const validated = interviewAnswersSchema.safeParse(analysis.answers);
  if (!validated.success) return { error: "The project could not be analysed." };
  const prefill = pruneHiddenAnswers(validated.data as InterviewAnswers);

  const digestVersion = currentDigestVersion();
  const project = await createProject(org.id, parsed.data.name, parsed.data.description, slugify);
  await createImportSource(
    project.id,
    parsed.data.source,
    upload.name,
    analysis,
    digestImported(archive.files, digestFor(digestVersion)),
    digestVersion
  );
  await saveInterviewAnswers(project.id, prefill);

  return { projectId: project.id };
}

/**
 * Record one conflict decision. Only ever writes the founder's explicit choice — a file with no
 * decision keeps whatever the imported project already had.
 */
export async function resolveConflictAction(formData: FormData): Promise<void> {
  const { org } = await requireSession();
  const projectId = String(formData.get("projectId") ?? "");
  const project = await getProject(org.id, projectId);
  if (!project) return;

  const decision = conflictDecisionSchema.safeParse({
    path: formData.get("path"),
    resolution: formData.get("resolution")
  });
  if (!decision.success) return;

  const [source, job] = await Promise.all([getImportSource(projectId), latestJob(projectId)]);
  if (!source || !job) return;

  await saveConflictResolution(source.id, job.id, decision.data.path, decision.data.resolution);
}
