// Users — the screen support actually lives on (spec 150).
//
// Everything about an account in one row, and the two things worth doing to it underneath: hand a
// generation back, or take the account offline. Both are reversible, both leave an audit row, and
// neither touches `organizations.plan` — that column is Stripe's alone (specs 74, 99, 100, 122).
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, Notice } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { Pager } from "@/features/admin/Pager";
import { grantCreditsAction, suspendUserAction } from "@/features/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { adminAudit, adminUsers, type AdminUser, type UserSort } from "@/lib/data/admin";
import { MAX_CREDITS_PER_GRANT } from "@/lib/data/credits";
import { cn, timeAgo } from "@/lib/utils";

const DONE_MESSAGES: Record<string, string> = {
  suspended: "Account suspended. Their open session stops at its next request.",
  reactivated: "Account reactivated.",
  granted: "Generations granted."
};

/** How the audit log's action ids read to a person. */
const ACTION_LABELS: Record<string, string> = {
  "user.suspend": "Suspended",
  "user.reactivate": "Reactivated",
  "credits.grant": "Granted",
  "ticket.close": "Closed ticket",
  "ticket.reopen": "Reopened ticket",
  "review.publish": "Published review",
  "review.unpublish": "Unpublished review"
};

function PlanBadge({ user }: { user: AdminUser }) {
  if (user.plan === "pro") return <Badge tone="accent">Pro</Badge>;
  if (user.grantActive) return <Badge tone="info">Pro · earned week</Badge>;
  return <Badge tone="neutral">Free</Badge>;
}

function isSort(value: string | undefined): value is UserSort {
  return value === "signup" || value === "activity";
}

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; page?: string; done?: string; sort?: string; dir?: string }>;
}) {
  const { q, page: pageParam, done, sort: sortParam, dir } = await searchParams;
  const { user: actor } = await requireAdmin();
  const page = Math.max(0, Number(pageParam ?? 0) || 0);
  const sort: UserSort = isSort(sortParam) ? sortParam : "signup";
  const ascending = dir === "asc";

  const users = await adminUsers(actor.id, { search: q, page, sort, ascending });
  const audit = await adminAudit(actor.id, { type: "user", ids: users.items.map((u) => u.id) });

  // Sorting is navigation, so it lives in the URL: a sorted view can be linked and reloaded, and the
  // ordering is applied by Postgres across the whole list rather than to the page that came back.
  const sortHref = (next: UserSort): string => {
    const search = new URLSearchParams();
    if (q) search.set("q", q);
    search.set("sort", next);
    // Clicking the column you are already on flips the direction; a different column starts newest-first.
    if (sort === next && !ascending) search.set("dir", "asc");
    return `/app/admin?${search.toString()}`;
  };

  const arrow = (column: UserSort): string => (sort === column ? (ascending ? " ↑" : " ↓") : "");

  return (
    <>
      {done && DONE_MESSAGES[done] ? (
        <p className="mb-4 text-sm text-success" role="status">
          {DONE_MESSAGES[done]}
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <form method="get" className="flex max-w-md flex-1 items-center gap-2">
          <Input name="q" defaultValue={q ?? ""} placeholder="Search by name or email" aria-label="Search users" />
          {/* The sort survives a search, because losing your ordering when you type is a small betrayal. */}
          <input type="hidden" name="sort" value={sort} />
          {ascending ? <input type="hidden" name="dir" value="asc" /> : null}
          <SubmitButton pendingLabel="Searching…">Search</SubmitButton>
        </form>

        <div className="flex items-center gap-2">
          <span className="text-sm text-fg-faint">Sort by</span>
          {(["signup", "activity"] as const).map((column) => (
            <Link
              key={column}
              href={sortHref(column)}
              aria-current={sort === column ? "true" : undefined}
              className={cn(
                "rounded-md border px-2.5 py-1 text-sm transition-colors",
                sort === column
                  ? "border-border-strong bg-surface-raised text-fg"
                  : "border-border text-fg-muted hover:text-fg"
              )}
            >
              {column === "signup" ? "Signed up" : "Last seen"}
              {arrow(column)}
            </Link>
          ))}
        </div>
      </div>

      {users.items.length === 0 ? (
        <EmptyState
          title={q ? "Nobody matches that" : "No accounts yet"}
          description={q ? "Try a different name or address." : "The first signup will appear here."}
        />
      ) : (
        <div className="space-y-3">
          {users.items.map((user) => (
            <Card key={user.id}>
              <CardHeader className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <CardTitle>{user.name}</CardTitle>
                <PlanBadge user={user} />
                {user.suspendedAt ? <Badge tone="danger">Suspended</Badge> : null}
                {user.isAdmin ? <Badge tone="warn">Admin</Badge> : null}
                {user.verified ? null : <Badge tone="neutral">Unverified</Badge>}
                {user.subscriptionStatus ? (
                  <Badge tone="info">Stripe: {user.subscriptionStatus}</Badge>
                ) : null}
              </CardHeader>
              <CardBody>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>Email</TableHeaderCell>
                      <TableHeaderCell>Workspace</TableHeaderCell>
                      <TableHeaderCell>Signed up</TableHeaderCell>
                      <TableHeaderCell>Last seen</TableHeaderCell>
                      <TableHeaderCell>Projects</TableHeaderCell>
                      <TableHeaderCell>Generations</TableHeaderCell>
                      <TableHeaderCell>Credits</TableHeaderCell>
                      <TableHeaderCell>Invited by</TableHeaderCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-mono text-xs">{user.email}</TableCell>
                      <TableCell>{user.orgName ?? "—"}</TableCell>
                      <TableCell>{timeAgo(user.createdAt)}</TableCell>
                      <TableCell>{user.lastSignInAt ? timeAgo(user.lastSignInAt) : "never"}</TableCell>
                      <TableCell>{user.projects}</TableCell>
                      <TableCell>
                        {user.generations}
                        {user.lastGenerationAt ? (
                          <span className="text-fg-faint"> · {timeAgo(user.lastGenerationAt)}</span>
                        ) : null}
                      </TableCell>
                      <TableCell>{user.creditsAvailable}</TableCell>
                      <TableCell>{user.invitedBy ?? "direct"}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <div className="mt-4 flex flex-wrap items-end gap-6 border-t border-border pt-4">
                  <form action={grantCreditsAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="orgId" value={user.orgId ?? ""} />
                    <div>
                      <label htmlFor={`count-${user.id}`} className="text-xs text-fg-faint">
                        Generations
                      </label>
                      <Input
                        id={`count-${user.id}`}
                        name="count"
                        type="number"
                        min={1}
                        max={MAX_CREDITS_PER_GRANT}
                        defaultValue={1}
                        className="w-20"
                      />
                    </div>
                    <div>
                      <label htmlFor={`reason-${user.id}`} className="text-xs text-fg-faint">
                        Why
                      </label>
                      <Input
                        id={`reason-${user.id}`}
                        name="reason"
                        maxLength={500}
                        placeholder="e.g. generated with the wrong answers"
                        className="w-72"
                      />
                    </div>
                    <SubmitButton pendingLabel="Granting…" disabled={!user.orgId}>
                      Give generations
                    </SubmitButton>
                  </form>

                  <form action={suspendUserAction} className="flex items-end gap-2">
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="suspend" value={user.suspendedAt ? "false" : "true"} />
                    <SubmitButton
                      variant={user.suspendedAt ? "secondary" : "danger"}
                      pendingLabel={user.suspendedAt ? "Reactivating…" : "Suspending…"}
                    >
                      {user.suspendedAt ? "Reactivate" : "Suspend"}
                    </SubmitButton>
                  </form>
                </div>

                {audit.get(user.id)?.length ? (
                  <ul className="mt-4 space-y-1 border-t border-border pt-4">
                    {audit.get(user.id)?.map((entry) => (
                      <li key={entry.id} className="text-xs text-fg-faint">
                        <span className="text-fg-muted">
                          {ACTION_LABELS[entry.action] ?? entry.action}
                        </span>{" "}
                        by {entry.actorName ?? "someone"} · {timeAgo(entry.createdAt)}
                        {entry.reason ? ` — ${entry.reason}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {users.items.some((u) => !u.orgId) ? (
        <Notice title="One of these accounts has no workspace" className="mt-4">
          Generations are granted to a workspace, so there is nothing to grant them to. This normally
          means a signup that did not finish.
        </Notice>
      ) : null}

      <Pager
        base="/app/admin"
        // The sort travels with the page, or turning to page two silently reorders the list.
        params={{ q, sort, dir: ascending ? "asc" : undefined }}
        page={page}
        hasMore={users.hasMore}
      />
    </>
  );
}
