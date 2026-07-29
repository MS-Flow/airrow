"use server";

// Importing an existing project (spec 63). Upload → analyse → prefilled interview.
//
// A public GitHub repository is the second source (spec 67), never a second import: it produces the
// same file list and joins at `completeImport`, so the limits, the analysis, the prefill and the
// digests are one implementation with one behaviour.
//
// The analysis runs in this request and nothing but paths, sizes and digests is persisted, so the
// founder's source never lands in Airrow's database (§II, customer IP).
import { revalidatePath } from "next/cache";
import { analyzeImport, digestImported, slugify } from "@airrow/engine";
import {
  conflictDecisionSchema,
  importCreateSchema,
  interviewAnswersSchema,
  pruneHiddenAnswers,
  repoSelectionSchema,
  type ImportSourceKind,
  type InterviewAnswers
} from "@airrow/schemas";
import { githubToken, requireSession } from "@/lib/auth";
import { githubReader } from "@/lib/github";
import {
  clearConflictResolution,
  createImportSource,
  createProject,
  getImportSource,
  getProject,
  latestJob,
  saveConflictResolution,
  saveInterviewAnswers
} from "@/lib/data/store";
import { readArchive, type ArchiveRead } from "./archive";
import { currentDigestVersion, digestFor } from "./digest";
import { readRepository } from "./repo";

export interface ImportFormState {
  error?: string;
  /**
   * Set once the import succeeded. The action returns instead of redirecting so the browser can
   * cache the founder's archive against this id first — it is the only copy that will exist, since
   * Airrow stores no content (spec 68).
   */
  projectId?: string;
}

const DETAILS_REQUIRED = "A name (min 2 chars) and a description (min 10 chars) are required.";

interface ImportDetails {
  name: string;
  description: string;
  source: ImportSourceKind;
}

/**
 * Everything after the files have been read, whatever read them. Analyse, validate, prefill, and
 * persist paths and digests — never content.
 */
async function completeImport(
  orgId: string,
  details: ImportDetails,
  originalName: string,
  read: ArchiveRead
): Promise<ImportFormState> {
  if (!read.ok) return { error: read.error };

  const analysis = analyzeImport(read.files, read.ignored);

  // Engine output crossing into persistence is a boundary like any other, so it is validated
  // rather than trusted, then pruned to the questions actually visible given what was derived.
  const validated = interviewAnswersSchema.safeParse(analysis.answers);
  if (!validated.success) return { error: "The project could not be analysed." };
  const prefill = pruneHiddenAnswers(validated.data as InterviewAnswers);

  const digestVersion = currentDigestVersion();
  const project = await createProject(orgId, details.name, details.description, slugify);
  await createImportSource(
    project.id,
    details.source,
    originalName,
    analysis,
    digestImported(read.files, digestFor(digestVersion)),
    digestVersion
  );
  await saveInterviewAnswers(project.id, prefill);

  return { projectId: project.id };
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
  if (!parsed.success) return { error: DETAILS_REQUIRED };

  const upload = formData.get("archive");
  if (!(upload instanceof File) || upload.size === 0) {
    return { error: "Choose a .zip of your project to import." };
  }

  return completeImport(org.id, parsed.data, upload.name, await readArchive(await upload.arrayBuffer()));
}

/**
 * Import a public repository the founder picked from the list (spec 67).
 *
 * The repository is read with their own scope-less GitHub identity, server-side, and nothing of it
 * outlives this request. A token that has aged out of the session is an ordinary state — the founder
 * signs in with GitHub again, and the ZIP path was never blocked by it.
 */
export async function importRepoAction(
  _previous: ImportFormState,
  formData: FormData
): Promise<ImportFormState> {
  const { org } = await requireSession();

  const parsed = importCreateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    source: formData.get("source")
  });
  if (!parsed.success) return { error: DETAILS_REQUIRED };

  const selection = repoSelectionSchema.safeParse({
    owner: formData.get("owner"),
    repo: formData.get("repo")
  });
  if (!selection.success) return { error: "Choose a repository from the list." };

  const token = await githubToken();
  if (token === null) {
    return {
      error: "Your GitHub sign-in has expired. Sign in with GitHub again, or upload a ZIP instead."
    };
  }

  const { owner, repo } = selection.data;
  const read = await readRepository(githubReader(), token, owner, repo);
  return completeImport(org.id, parsed.data, `${owner}/${repo}`, read);
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

  const { path, resolution } = decision.data;
  if (resolution === "") await clearConflictResolution(job.id, path);
  else await saveConflictResolution(source.id, job.id, path, resolution);

  // Without this the decision is written and nothing on screen changes — the button reads as broken
  // and the founder clicks it again. Both pages are downstream of the answer: the review shows which
  // version wins, and the preview tree is built through `applyResolutions`.
  revalidatePath(`/app/projects/${projectId}/import`);
  revalidatePath(`/app/projects/${projectId}/preview`);
}
