"use server";

// Importing an existing project (spec 63). Upload → analyse → prefilled interview.
//
// A public GitHub repository is the second source (spec 67), never a second import: it produces the
// same file list and joins at `completeImport`, so the limits, the analysis, the prefill and the
// digests are one implementation with one behaviour.
//
// The analysis runs in this request and nothing but paths, sizes and digests is persisted, so the
// founder's source never lands in Airrow's database (§II, customer IP).
//
// Import is a Pro capability (spec 74), and the plan is checked in `completeImport` — after the
// analysis, before the first write. On the free plan the founder still sees what Airrow made of
// their code; they just cannot keep it as a project.
import { revalidatePath } from "next/cache";
import { analyzeImport, digestImported, slugify } from "@airrow/engine";
import {
  conflictDecisionSchema,
  importCreateSchema,
  interviewAnswersSchema,
  pruneHiddenAnswers,
  repoSelectionSchema,
  type ImportEvidence,
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
  saveInterviewAnswers,
  type OrgRecord
} from "@/lib/data/store";
import { readArchive, type ArchiveRead } from "./archive";
import { currentDigestVersion, digestFor } from "./digest";
import { readRepository } from "./repo";

/**
 * The analysis, minus the prefill (spec 74).
 *
 * This is what a free organization is shown: the evidence and the counts, which prove Airrow read
 * the project. The prefilled interview — `analysis.answers` — is deliberately not here. That is the
 * part Pro buys, and handing it back would give away the thing behind the wall.
 */
export interface ImportPreview {
  originalName: string;
  filesAnalyzed: number;
  filesIgnored: number;
  evidence: ImportEvidence[];
  notes: string[];
}

export interface ImportFormState {
  error?: string;
  /**
   * Set once the import succeeded. The action returns instead of redirecting so the browser can
   * cache the founder's archive against this id first — it is the only copy that will exist, since
   * Airrow stores no content (spec 68).
   */
  projectId?: string;
  /**
   * Set when the analysis ran but the plan does not reach far enough to keep it (spec 74). Distinct
   * from `error`: nothing failed, and what the founder is looking at is the real result for their
   * code — which is the point of running it for free.
   */
  requiresPro?: boolean;
  /** Present exactly when `requiresPro` is — the result they are being shown instead of a project. */
  preview?: ImportPreview;
}

const DETAILS_REQUIRED = "A name (min 2 chars) and a description (min 10 chars) are required.";

/**
 * Two failures the founder did not cause and cannot fix by retrying. Both used to escape as thrown
 * errors, which Next.js turns into a bare "a server-side exception has occurred" page — so the
 * founder lost the form they had filled in and learned nothing. Said plainly instead, and kept
 * distinct: one is a deployment that is missing configuration, the other is a write that failed.
 */
const MISCONFIGURED =
  "Importing is not available on this deployment — it is missing configuration Airrow needs to " +
  "store your project safely. Nothing was saved. This is on us, not your project: a ZIP would fail " +
  "the same way, so please report it rather than retrying.";

const NOT_SAVED =
  "Your project was read, but saving it failed. Nothing was kept. Try again in a moment — if it " +
  "keeps failing, report it: the reason is in our logs, not in your project.";

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
  org: OrgRecord,
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

  // The plan is checked here and not in either entry point: this is where the two sources already
  // meet, so the gate cannot be added to one and forgotten on the other. It sits *after* the
  // analysis on purpose — that runs locally, makes no Claude call and costs Airrow nothing, and it
  // is the moment a founder with an existing repo sees that Airrow read their code. Asking them to
  // pay before it would be asking them to buy blind. Everything below this line is a durable write.
  if (org.plan !== "pro") {
    return {
      requiresPro: true,
      preview: {
        originalName,
        filesAnalyzed: analysis.filesAnalyzed,
        filesIgnored: analysis.filesIgnored,
        evidence: analysis.evidence,
        notes: analysis.notes
      }
    };
  }

  // A deployment that cannot hash imports safely must refuse to import — but as a state the founder
  // can read, not as a thrown error. Unhandled, this reached the browser as "a server-side exception
  // has occurred" plus a digest, which tells the founder nothing and tells us nothing either without
  // the server log. The reason is logged; the message names the environment, because a founder
  // cannot fix this one and should not be left retrying a ZIP that will fail the same way.
  //
  // Below the plan gate, not above it: a free founder meets the paywall, and the deployment's own
  // misconfiguration is not something to charge them for discovering.
  let digestVersion: number;
  try {
    digestVersion = currentDigestVersion();
  } catch (error) {
    console.error("[import] refusing to import without a digest pepper:", error);
    return { error: MISCONFIGURED };
  }

  // The writes are the other way this used to 500: a migration that is committed but not applied to
  // the deployed database fails here as a PostgREST error about a column that does not exist, which
  // is a real thing that happened (issue #77). Same treatment — say that it failed, log why.
  try {
    const project = await createProject(org.id, details.name, details.description, slugify);
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
  } catch (error) {
    console.error("[import] persisting the import failed:", error);
    return { error: NOT_SAVED };
  }
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

  return completeImport(org, parsed.data, upload.name, await readArchive(await upload.arrayBuffer()));
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
  return completeImport(org, parsed.data, `${owner}/${repo}`, read);
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
