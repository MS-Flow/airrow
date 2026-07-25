// Turning a signed-out draft into a real project. Pure and dependency-injected so the
// trust boundary can be tested without a database — see claim.test.ts.
import { pruneHiddenAnswers, validateCompleteAnswers, type InterviewAnswers } from "@airrow/schemas";
import { guestDraftSchema } from "./draft-schema";

export type ClaimResult = { ok: true; projectId: string } | { ok: false; error: string };

export interface ClaimDeps {
  /** Creates the project under the caller's own org. */
  createProject: (name: string, description: string) => Promise<{ id: string }>;
  saveAnswers: (projectId: string, answers: InterviewAnswers) => Promise<void>;
  completeInterview: (projectId: string) => Promise<void>;
}

/**
 * Validate an untrusted draft and materialise it.
 *
 * The draft arrives from `localStorage`, so it is client-supplied input and is treated
 * as such: parsed against `guestDraftSchema`, pruned of answers whose questions aren't
 * visible, then checked for completeness — all before a single write. The owning org is
 * never read from the payload; it is closed over by `deps.createProject`, which the
 * caller builds from the session (constitution §II).
 */
export async function claimGuestDraft(raw: unknown, deps: ClaimDeps): Promise<ClaimResult> {
  const parsed = guestDraftSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "That saved interview is no longer readable — start a new project." };
  }

  const pruned = pruneHiddenAnswers(parsed.data.answers);
  const validated = validateCompleteAnswers(pruned);
  if (!validated.ok) return { ok: false, error: validated.error };

  const project = await deps.createProject(parsed.data.name, parsed.data.description);
  await deps.saveAnswers(project.id, validated.answers as InterviewAnswers);
  await deps.completeInterview(project.id);
  return { ok: true, projectId: project.id };
}
