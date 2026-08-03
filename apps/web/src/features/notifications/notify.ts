// The three calls the rest of the app makes (spec 203).
//
// Every one returns `void` and swallows its own failures, so no caller can await one into the
// critical path of a signup, a project or a payment. That is a property of the *signature*, not of
// each caller remembering — which is the same reason `features/analytics/server.ts` is shaped this
// way, and the same reason it survived a Stripe webhook.
import type { PaidTier } from "@/features/analytics/events";
import { getOrganization, getProject } from "@/lib/data/store";
import { notifySlack } from "@/lib/slack";
import { foundationGeneratedMessage, paidMessage, userCreatedMessage } from "./messages";

export function notifyUserCreated(workspace: string | null, method: string): void {
  notifySlack(userCreatedMessage(workspace, method));
}

/**
 * Announce a finished foundation, looking both names up on the way.
 *
 * Takes ids and reads the names itself, like `notifyPaid` and for the same reason: the generation
 * runner holds an organization id and a project id and nothing else, and threading names into it
 * would put two database reads inside a job a founder is watching, to buy a nicer chat message.
 * Here the reads are already past the point where anything can go wrong — the foundation is saved
 * and the job is complete, so a failure costs the message rather than the generation.
 */
export function notifyFoundationGenerated(orgId: string, projectId: string, reused: boolean): void {
  void (async () => {
    try {
      const [org, project] = await Promise.all([
        getOrganization(orgId),
        // Org-scoped like every other read (§II), even though the runner already established the
        // organization — the scope is the authorization, not a formality.
        getProject(orgId, projectId)
      ]);
      notifySlack(foundationGeneratedMessage(org?.name ?? null, project?.name ?? null, reused));
    } catch {
      // Deliberately silent, per the contract above.
    }
  })();
}

/**
 * Announce a new Pro customer, looking the workspace name up on the way.
 *
 * **Takes an id and reads the name itself**, unlike the other two. Its callers — the Stripe webhook
 * and the reconciliation path — hold only an organization id, and threading a name down to them
 * would put a database read on the critical path of a payment to buy a nicer chat message. Inside
 * here the read is already past the point where anything can go wrong: it runs after the plan is
 * written, and a failure costs the message rather than the payment.
 */
export function notifyPaid(orgId: string, tier: PaidTier): void {
  void (async () => {
    try {
      // A workspace that vanished between the payment and this read still gets a message, naming the
      // plan without the name. A missing name must not cost the notification.
      const org = await getOrganization(orgId);
      notifySlack(paidMessage(org?.name ?? null, tier));
    } catch {
      // Deliberately silent, per the contract above.
    }
  })();
}
