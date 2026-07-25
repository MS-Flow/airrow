import { z } from "zod";
import { interviewAnswersSchema, projectCreateSchema } from "@airrow/schemas";

/**
 * Bump when the question set changes shape. `z.literal` then rejects older drafts
 * outright, so a visitor starts clean instead of resuming a half-restored interview.
 */
export const GUEST_DRAFT_VERSION = 1;

/**
 * The signed-out interview, as it sits in the browser. Reused on both sides of the
 * trust boundary: the client parses what it reads back from storage, and the claim
 * action re-parses the same shape server-side before anything is written. The field
 * schemas are the existing ones, so the guest path can never accept a project name
 * or answer set the signed-in path would reject.
 */
export const guestDraftSchema = z.object({
  version: z.literal(GUEST_DRAFT_VERSION),
  name: projectCreateSchema.shape.name,
  description: projectCreateSchema.shape.description,
  answers: interviewAnswersSchema
});

export type GuestDraft = z.infer<typeof guestDraftSchema>;
