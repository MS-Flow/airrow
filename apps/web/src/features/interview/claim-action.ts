"use server";

// The one server entry point for claiming a signed-out interview. Runs as the
// authenticated user — there is no unauthenticated write path into this flow.
import { slugify } from "@airrow/engine";
import { requireSession } from "@/lib/auth";
import { completeInterview, createProject, saveInterviewAnswers } from "@/lib/data/store";
import { claimGuestDraft, type ClaimResult } from "./claim";

export async function claimGuestDraftAction(raw: unknown): Promise<ClaimResult> {
  const { org } = await requireSession();

  return claimGuestDraft(raw, {
    // The org comes from the session and is closed over here, so nothing in the
    // client-supplied draft can redirect the write to another tenant.
    createProject: (name, description) => createProject(org.id, name, description, slugify),
    saveAnswers: saveInterviewAnswers,
    completeInterview
  });
}
