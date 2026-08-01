// Support tickets — the state of the conversation, not the conversation (spec 150).
//
// Spec 144 shipped `support_tickets.status` with a check constraint and nothing in the app able to
// change it. This is the screen that changes it. The reply is still written in Gmail: this page owns
// whether a ticket is open, and the shortcuts to the three things you want after reading one.
import Link from "next/link";
import { SUPPORT_CATEGORIES } from "@airrow/schemas";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { Pager } from "@/features/admin/Pager";
import { setTicketStatusAction } from "@/features/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { adminTickets } from "@/lib/data/admin";
import { cn, timeAgo } from "@/lib/utils";

type TicketStatus = "open" | "closed";
type TicketCategory = (typeof SUPPORT_CATEGORIES)[number];

// Predicates rather than inline comparisons, so an untrusted search param is narrowed once and the
// filter object cannot widen back to `string`.
function isTicketStatus(value: string | undefined): value is TicketStatus {
  return value === "open" || value === "closed";
}

function isCategory(value: string | undefined): value is TicketCategory {
  // `as` justified: `includes` needs the wider value narrowed to ask the question at all.
  return SUPPORT_CATEGORIES.includes(value as TicketCategory);
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md border px-2.5 py-1 text-sm transition-colors",
        active ? "border-border-strong bg-surface-raised text-fg" : "border-border text-fg-muted hover:text-fg"
      )}
    >
      {children}
    </Link>
  );
}

export default async function AdminTicketsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; category?: string; page?: string }>;
}) {
  const { status, category, page: pageParam } = await searchParams;
  const { user: actor } = await requireAdmin();
  const page = Math.max(0, Number(pageParam ?? 0) || 0);

  const filters = {
    status: isTicketStatus(status) ? status : undefined,
    category: isCategory(category) ? category : undefined
  };
  const tickets = await adminTickets(actor.id, { ...filters, page });

  const query = (over: Record<string, string | undefined>): string => {
    const search = new URLSearchParams();
    const merged = { status: filters.status, category: filters.category, ...over };
    for (const [key, value] of Object.entries(merged)) if (value) search.set(key, value);
    const text = search.toString();
    return text ? `/app/admin/tickets?${text}` : "/app/admin/tickets";
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterLink href={query({ status: undefined })} active={!filters.status}>
          All
        </FilterLink>
        <FilterLink href={query({ status: "open" })} active={filters.status === "open"}>
          Open
        </FilterLink>
        <FilterLink href={query({ status: "closed" })} active={filters.status === "closed"}>
          Closed
        </FilterLink>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <FilterLink href={query({ category: undefined })} active={!filters.category}>
          Any category
        </FilterLink>
        {SUPPORT_CATEGORIES.map((c) => (
          <FilterLink key={c} href={query({ category: c })} active={filters.category === c}>
            {c}
          </FilterLink>
        ))}
      </div>

      {tickets.items.length === 0 ? (
        <EmptyState title="No tickets here" description="Nothing matches these filters." />
      ) : (
        <div className="space-y-3">
          {tickets.items.map((ticket) => (
            <Card key={ticket.id}>
              <CardHeader className="flex flex-wrap items-center gap-3">
                <Badge tone={ticket.status === "open" ? "accent" : "neutral"}>{ticket.status}</Badge>
                <Badge tone="neutral">{ticket.category}</Badge>
                <CardTitle className="min-w-0 flex-1">{ticket.subject}</CardTitle>
                <span className="font-mono text-xs text-fg-faint">{timeAgo(ticket.createdAt)}</span>
              </CardHeader>
              <CardBody>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{ticket.body}</p>

                <p className="mt-4 text-sm text-fg-faint">
                  {ticket.userName ?? "Someone"}{" "}
                  {ticket.userEmail ? (
                    <a
                      href={`mailto:${ticket.userEmail}`}
                      className="text-fg-muted underline underline-offset-4 hover:text-fg"
                    >
                      &lt;{ticket.userEmail}&gt;
                    </a>
                  ) : null}{" "}
                  · {ticket.orgName ?? "no workspace"}
                  {ticket.projectName ? ` · ${ticket.projectName}` : ""}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
                  <form action={setTicketStatusAction}>
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <input type="hidden" name="close" value={ticket.status === "open" ? "true" : "false"} />
                    <SubmitButton
                      variant="secondary"
                      pendingLabel={ticket.status === "open" ? "Closing…" : "Reopening…"}
                    >
                      {ticket.status === "open" ? "Close ticket" : "Reopen"}
                    </SubmitButton>
                  </form>

                  {/* The three things you want after reading a ticket. */}
                  <Link
                    href={`/app/admin?q=${encodeURIComponent(ticket.userEmail ?? "")}`}
                    className="text-sm text-fg-muted underline underline-offset-4 hover:text-fg"
                  >
                    Their account
                  </Link>
                  {ticket.projectId ? (
                    <Link
                      href={`/app/admin/projects?open=${ticket.projectId}`}
                      className="text-sm text-fg-muted underline underline-offset-4 hover:text-fg"
                    >
                      The project
                    </Link>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Pager
        base="/app/admin/tickets"
        params={{ status: filters.status, category: filters.category }}
        page={page}
        hasMore={tickets.hasMore}
      />
    </>
  );
}
