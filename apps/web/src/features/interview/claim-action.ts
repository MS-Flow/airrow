"use server";

// The one server entry point for claiming a signed-out interview. Runs as the
// authenticated user — there is no unauthenticated write path into this flow.
import { slugify } from "@airrow/engine";
import { notifyProjectCreated } from "@/features/notifications/notify";
import { requireSession } from "@/lib/auth";
import { completeInterview, createProject, saveInterviewAnswers } from "@/lib/data/store";
import { claimGuestDraft, type ClaimResult } from "./claim";

export async function claimGuestDraftAction(raw: unknown): Promise<ClaimResult> {
  const { org } = await requireSession();

  return claimGuestDraft(raw, {
    // The org comes from the session and is closed over here, so nothing in the
    // client-supplied draft can redirect the write to another tenant.
    createProject: async (name, description) => {
      const project = await createProject(org.id, name, description, slugify);
      // Inside the injected dependency rather than after `claimGuestDraft` returns: the claim can
      // fail *after* the project exists — saving answers, completing the interview — and a project
      // that was created is a project that was created (spec 203).
      notifyProjectCreated(org.name, project.name, "claimed");
      return project;
    },
    saveAnswers: saveInterviewAnswers,
    completeInterview
  });
}
