// Support tickets and project reviews (spec 144).
//
// Part of the data layer beside `store.ts`, like `referrals.ts`: two tables that are only ever
// touched together and only ever by this file. Server-side only — the Supabase client here uses the
// service-role key, so every query is additionally scoped by organization_id (§II).
//
// Nothing in this module ever *sets* `published_at` — publishing is the admin console's alone (spec
// 150). It does clear it, in exactly one case: a founder who withdraws consent on a review we already
// published takes it down by doing so (see `saveReview`). Consent is theirs; publication is ours.
import { db, rowsOrAbsent, single } from "./supabase";
import type { SupportTicketInput } from "@airrow/schemas";

/** How many tickets one workspace may open in a day. */
export const TICKET_DAILY_LIMIT = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TicketRecord {
  id: string;
  category: SupportTicketInput["category"];
  subject: string;
  body: string;
  status: "open" | "closed";
  projectId: string | null;
  createdAt: string;
}

export interface ReviewRecord {
  id: string;
  projectId: string;
  rating: number;
  body: string;
  consentPublic: boolean;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

interface TicketRow {
  id: string;
  category: TicketRecord["category"];
  subject: string;
  body: string;
  status: TicketRecord["status"];
  project_id: string | null;
  created_at: string;
}

interface ReviewRow {
  id: string;
  project_id: string;
  rating: number;
  body: string;
  consent_public: boolean;
  display_name: string;
  created_at: string;
  updated_at: string;
}

const toTicket = (r: TicketRow): TicketRecord => ({
  id: r.id,
  category: r.category,
  subject: r.subject,
  body: r.body,
  status: r.status,
  projectId: r.project_id,
  createdAt: r.created_at
});

const toReview = (r: ReviewRow): ReviewRecord => ({
  id: r.id,
  projectId: r.project_id,
  rating: r.rating,
  body: r.body,
  consentPublic: r.consent_public,
  displayName: r.display_name,
  createdAt: r.created_at,
  updatedAt: r.updated_at
});

const TICKET_COLUMNS = "id, category, subject, body, status, project_id, created_at";
const REVIEW_COLUMNS =
  "id, project_id, rating, body, consent_public, display_name, created_at, updated_at";

/**
 * A workspace's tickets, newest first. **Null** while the database is behind this spec's migration —
 * the page then says so instead of failing, for the same reason the referral card can be absent.
 */
export async function listTickets(orgId: string): Promise<TicketRecord[] | null> {
  const found = rowsOrAbsent<TicketRow>(
    await db()
      .from("support_tickets")
      .select(TICKET_COLUMNS)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
  );
  return found?.map(toTicket) ?? null;
}

/**
 * Tickets opened by this workspace in the last 24 hours.
 *
 * Counted from the rows themselves rather than kept as a counter somewhere: the ledger and the limit
 * cannot drift apart if they are the same thing, and a deleted ticket is not a refilled quota.
 */
export async function countRecentTickets(orgId: string, now: Date = new Date()): Promise<number> {
  const since = new Date(now.getTime() - DAY_MS).toISOString();
  const found = rowsOrAbsent<{ id: string }>(
    await db()
      .from("support_tickets")
      .select("id")
      .eq("organization_id", orgId)
      .gte("created_at", since)
  );
  return found?.length ?? 0;
}

export async function createTicket(input: {
  orgId: string;
  userId: string;
  projectId: string | null;
  category: SupportTicketInput["category"];
  subject: string;
  body: string;
}): Promise<TicketRecord> {
  return toTicket(
    single<TicketRow>(
      await db()
        .from("support_tickets")
        .insert({
          organization_id: input.orgId,
          user_id: input.userId,
          project_id: input.projectId,
          category: input.category,
          subject: input.subject,
          body: input.body
        })
        .select(TICKET_COLUMNS)
        .single()
    )
  );
}

/**
 * The review on a project, if the founder has left one. Null both when there is none and when the
 * table does not exist yet — the card renders empty either way, which is the truth in both cases.
 */
export async function getReview(orgId: string, projectId: string): Promise<ReviewRecord | null> {
  const found = rowsOrAbsent<ReviewRow>(
    await db()
      .from("project_reviews")
      .select(REVIEW_COLUMNS)
      .eq("organization_id", orgId)
      .eq("project_id", projectId)
  );
  const review = found?.[0];
  return review ? toReview(review) : null;
}

/**
 * Write the founder's verdict, replacing the one they gave before.
 *
 * An upsert on `project_id` rather than a read-then-branch: the unique constraint is what makes "one
 * review per project" true, and asking first would race with a double-submitted form. `created_at`
 * survives the conflict; `updated_at` is what moves.
 *
 * **Withdrawing consent unpublishes** (spec 150). `published_at` is written here only ever to null,
 * and only when the founder says we may no longer quote them — a public testimonial standing after its
 * author took permission back is the failure that actually matters, and making them wait for an
 * operator to notice would put our convenience ahead of their word. Setting it stays the admin
 * console's alone, so the two permissions remain separate: consent is the founder's, publication ours.
 *
 * Returns whether this replaced an existing review — the only thing the caller needs it for is
 * saying so in the notification.
 */
export async function saveReview(input: {
  orgId: string;
  projectId: string;
  userId: string;
  rating: number;
  body: string;
  consentPublic: boolean;
  displayName: string;
}): Promise<{ review: ReviewRecord; replaced: boolean }> {
  const existing = await getReview(input.orgId, input.projectId);
  const saved = single<ReviewRow>(
    await db()
      .from("project_reviews")
      .upsert(
        {
          organization_id: input.orgId,
          project_id: input.projectId,
          user_id: input.userId,
          rating: input.rating,
          body: input.body,
          consent_public: input.consentPublic,
          display_name: input.displayName,
          updated_at: new Date().toISOString(),
          // Only ever null, and only on withdrawal. Leaving the column out of the upsert entirely
          // would keep a published review public after its author revoked permission.
          ...(input.consentPublic ? {} : { published_at: null })
        },
        { onConflict: "project_id" }
      )
      .select(REVIEW_COLUMNS)
      .single()
  );
  return { review: toReview(saved), replaced: existing !== null };
}
