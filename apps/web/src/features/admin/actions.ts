"use server";

// What an operator can actually do (spec 150).
//
// Every one of these gates itself with `requireAdmin()` before it looks at its arguments. That is not
// redundant with the layout's gate: a server action is a POST endpoint, reachable by anyone who can
// name it, without ever rendering the page that normally posts to it. A page that is protected while
// its actions are not is not protected. `lib/data/admin.ts` then refuses a third time, at the layer
// that crosses the tenancy boundary.
//
// Every one of them also writes an `admin_audit_log` row. Suspending an account, handing back a
// generation and publishing someone's words are the kind of thing that should leave a trace — for our
// own sake as much as anyone's. That is what makes this an operator console rather than a back door.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  grantSupportPro,
  isSupportGrantDays,
  recordAdminAction,
  revokeActiveGrant,
  setReviewPublished,
  setTicketStatus,
  setUserSuspended
} from "@/lib/data/admin";
import { clampCreditCount, grantCredits } from "@/lib/data/credits";

/** Read a required id from a form, or refuse the whole action. */
function requireId(formData: FormData, field: string): string {
  const value = String(formData.get(field) ?? "").trim();
  if (!value) throw new Error(`admin: ${field} is required.`);
  return value;
}

/** Free text an operator typed, bounded so a note cannot become a payload. */
function reasonOf(formData: FormData): string {
  return String(formData.get("reason") ?? "").trim().slice(0, 500);
}

export async function suspendUserAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const userId = requireId(formData, "userId");
  const suspend = formData.get("suspend") === "true";

  const result = await setUserSuspended(user.id, userId, suspend);
  // Refused, so there is nothing to record — the audit log says what happened, and nothing did.
  if (!result.ok) redirect(`/app/admin?error=${result.reason}`);

  await recordAdminAction({
    actorId: user.id,
    action: suspend ? "user.suspend" : "user.reactivate",
    subjectType: "user",
    subjectId: userId,
    reason: reasonOf(formData)
  });

  revalidatePath("/app/admin");
  redirect(`/app/admin?done=${suspend ? "suspended" : "reactivated"}`);
}

export async function grantCreditsAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const orgId = requireId(formData, "orgId");
  const userId = requireId(formData, "userId");
  const count = clampCreditCount(Number(formData.get("count") ?? 1));

  await grantCredits({ orgId, count, reason: reasonOf(formData), grantedBy: user.id });
  await recordAdminAction({
    actorId: user.id,
    action: "credits.grant",
    // The credit lands on the workspace, but the operator is looking at a person — so the audit row
    // names the person, and the screens that read it back are keyed on users.
    subjectType: "user",
    subjectId: userId,
    reason: `${count} generation${count === 1 ? "" : "s"}${reasonOf(formData) ? ` — ${reasonOf(formData)}` : ""}`
  });

  revalidatePath("/app/admin");
  redirect("/app/admin?done=granted");
}

/**
 * Give a workspace Pro for a fixed stretch (spec 164).
 *
 * The org id arrives from a hidden field, which is safe here for the one reason it is never safe
 * elsewhere: this action is admin-only by definition, so there is no tenancy boundary for a forged id
 * to cross — an operator may act on any workspace. `grantSupportPro` still refuses anything that would
 * be a no-op, and the audit row names the workspace either way.
 */
export async function grantProAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const orgId = requireId(formData, "orgId");
  const userId = requireId(formData, "userId");
  const days = Number(formData.get("days"));
  if (!isSupportGrantDays(days)) redirect("/app/admin?error=days");

  const result = await grantSupportPro(user.id, orgId, days);
  if (!result.ok) redirect(`/app/admin?error=${result.reason}`);

  await recordAdminAction({
    actorId: user.id,
    action: "pro.grant",
    // Keyed on the person, like every other row here — the operator is looking at an account, and the
    // audit lists that read this back are keyed on users (spec 150).
    subjectType: "user",
    subjectId: userId,
    reason: `${days} days${reasonOf(formData) ? ` — ${reasonOf(formData)}` : ""}`
  });

  revalidatePath("/app/admin");
  redirect("/app/admin?done=pro-granted");
}

/** End whatever grant is covering a workspace. The row survives; only its window closes. */
export async function revokeProAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const orgId = requireId(formData, "orgId");
  const userId = requireId(formData, "userId");

  const result = await revokeActiveGrant(user.id, orgId);
  if (!result.ok) redirect(`/app/admin?error=${result.reason}`);

  await recordAdminAction({
    actorId: user.id,
    action: "pro.revoke",
    subjectType: "user",
    subjectId: userId,
    reason: reasonOf(formData)
  });

  revalidatePath("/app/admin");
  redirect("/app/admin?done=pro-revoked");
}

export async function setTicketStatusAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const ticketId = requireId(formData, "ticketId");
  const close = formData.get("close") === "true";

  await setTicketStatus(user.id, ticketId, close ? "closed" : "open");
  await recordAdminAction({
    actorId: user.id,
    action: close ? "ticket.close" : "ticket.reopen",
    subjectType: "ticket",
    subjectId: ticketId
  });

  revalidatePath("/app/admin/tickets");
  redirect("/app/admin/tickets");
}

/**
 * Publish or unpublish a review.
 *
 * The consent check is not here — it is in `setReviewPublished`, at the layer that does the writing,
 * so it cannot be skipped by a caller that posts straight to the server. This action's job is to turn
 * the refusal into something the screen can say.
 */
export async function setReviewPublishedAction(formData: FormData): Promise<void> {
  const { user } = await requireAdmin();
  const reviewId = requireId(formData, "reviewId");
  const publish = formData.get("publish") === "true";

  const result = await setReviewPublished(user.id, reviewId, publish);
  if (!result.ok) redirect(`/app/admin/reviews?error=${result.reason}`);

  await recordAdminAction({
    actorId: user.id,
    action: publish ? "review.publish" : "review.unpublish",
    subjectType: "review",
    subjectId: reviewId
  });

  revalidatePath("/app/admin/reviews");
  redirect("/app/admin/reviews");
}
