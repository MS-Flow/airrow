"use server";

// Writing to Airrow: a support ticket, and the verdict on a finished foundation (spec 144).
//
// Both do the same three things in the same order — validate, **write the row**, then try to send the
// notification — and the order is the whole design. The row is what we owe the founder; the email is
// how we notice. A failed send is logged and nothing more, which is why neither of these ever tells
// the founder that something went wrong with mail they did not know we were sending.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { projectReviewSchema, supportTicketSchema } from "@airrow/schemas";
import { requireSession } from "@/lib/auth";
import { getProject } from "@/lib/data/store";
import {
  TICKET_DAILY_LIMIT,
  countRecentTickets,
  createTicket,
  saveReview
} from "@/lib/data/support";
import { sendMail, type MailResult } from "@/lib/email";

/** One line per message, carrying ids and a delivery status — never a word of what was written (§II). */
function logDelivery(kind: string, id: string, result: MailResult): void {
  if (result.status === "sent" || result.status === "skipped") return;
  console.error(`[support] notifying about ${kind} ${id} failed: ${result.reason}`);
}

export async function submitTicketAction(formData: FormData): Promise<void> {
  const { user, org } = await requireSession();
  const parsed = supportTicketSchema.safeParse({
    category: formData.get("category"),
    subject: formData.get("subject"),
    body: formData.get("body"),
    projectId: formData.get("projectId") ?? ""
  });
  if (!parsed.success) redirect("/app/support?error=invalid");

  if ((await countRecentTickets(org.id)) >= TICKET_DAILY_LIMIT) redirect("/app/support?error=limit");

  // A project id is only accepted once it is shown to be this workspace's own. It arrives from a form
  // and is the one field a founder could point anywhere (§II: never trust a client-supplied id).
  const projectId = parsed.data.projectId;
  const project = projectId ? await getProject(org.id, projectId) : null;

  const ticket = await createTicket({
    orgId: org.id,
    userId: user.id,
    projectId: project?.id ?? null,
    category: parsed.data.category,
    subject: parsed.data.subject,
    body: parsed.data.body
  });

  logDelivery(
    "ticket",
    ticket.id,
    await sendMail({
      subject: `[${ticket.category}] ${ticket.subject}`,
      replyTo: user.email,
      text: [
        `From: ${user.name} <${user.email}>`,
        `Workspace: ${org.name} (${org.id})`,
        project ? `Project: ${project.name} (${project.id})` : "Project: —",
        `Ticket: ${ticket.id}`,
        "",
        ticket.body
      ].join("\n")
    })
  );

  redirect(`/app/support?sent=${ticket.id}`);
}

export async function submitReviewAction(formData: FormData): Promise<void> {
  const { user, org } = await requireSession();
  const projectId = String(formData.get("projectId") ?? "");
  const project = await getProject(org.id, projectId);
  // Nothing to review before there is a foundation — and the card is only rendered when there is, so
  // reaching this means the form was replayed rather than filled in.
  if (!project || project.status !== "ready") redirect("/app");

  const parsed = projectReviewSchema.safeParse({
    rating: formData.get("rating"),
    body: formData.get("body") ?? "",
    consentPublic: formData.get("consentPublic") === "on",
    displayName: formData.get("displayName") ?? ""
  });
  if (!parsed.success) redirect(`/app/projects/${project.id}?review=invalid`);

  const { review, replaced } = await saveReview({
    orgId: org.id,
    projectId: project.id,
    userId: user.id,
    rating: parsed.data.rating,
    body: parsed.data.body,
    consentPublic: parsed.data.consentPublic,
    displayName: parsed.data.displayName || user.name
  });

  logDelivery(
    "review",
    review.id,
    await sendMail({
      subject: `${replaced ? "Updated review" : "New review"}: ${review.rating}/5 — ${project.name}`,
      replyTo: user.email,
      text: [
        `From: ${user.name} <${user.email}>`,
        `Workspace: ${org.name} (${org.id})`,
        `Project: ${project.name} (${project.id})`,
        `Rating: ${review.rating}/5`,
        `May we quote it: ${review.consentPublic ? `yes, as "${review.displayName}"` : "no"}`,
        "",
        review.body || "(no words, stars only)"
      ].join("\n")
    })
  );

  revalidatePath(`/app/projects/${project.id}`);
  redirect(`/app/projects/${project.id}?review=saved`);
}
