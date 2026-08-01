// What the support page needs to render itself (spec 144).
//
// Server-side only. The page asks one question and gets one answer, so the two reads it needs — the
// history and how much of the day's allowance is left — cannot fall out of step across a render.
import { TICKET_DAILY_LIMIT, countRecentTickets, listTickets, type TicketRecord } from "@/lib/data/support";

export interface SupportOverview {
  tickets: TicketRecord[];
  /** Tickets this workspace may still open today. Zero is a real state the form respects. */
  remainingToday: number;
}

/**
 * **Null** while the database is behind this spec's migration: the page then says the form is
 * temporarily unavailable rather than returning a 500 to a founder who came here *because* something
 * was already broken.
 */
export async function supportOverview(orgId: string): Promise<SupportOverview | null> {
  const tickets = await listTickets(orgId);
  if (tickets === null) return null;
  return {
    tickets,
    remainingToday: Math.max(0, TICKET_DAILY_LIMIT - (await countRecentTickets(orgId)))
  };
}
