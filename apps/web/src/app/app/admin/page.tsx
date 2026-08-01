// Users — the screen support actually lives on (spec 150).
//
// Everything about an account in one row, and the things worth doing to it underneath: hand a
// generation back, give or take Pro, or take the account offline. All of them are reversible, all of
// them leave an audit row, and none of them touches `organizations.plan` — that column is Stripe's
// alone (specs 74, 99, 100, 122, 164).
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, InlineError, Notice } from "@/components/ui/states";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { Pager } from "@/features/admin/Pager";
import {
  grantCreditsAction,
  grantProAction,
  revokeProAction,
  suspendUserAction
} from "@/features/admin/actions";
import { grantWouldApply, planLabel, planSourceLabel, planStanding } from "@/features/admin/plan";
import { requireAdmin } from "@/lib/auth";
import {
  adminAudit,
  adminUsers,
  SUPPORT_GRANT_DAYS,
  type AdminUser,
  type UserSort
} from "@/lib/data/admin";
import { MAX_CREDITS_PER_GRANT } from "@/lib/data/credits";
import { cn, onDate, timeAgo } from "@/lib/utils";

const DONE_MESSAGES: Record<string, string> = {
  suspended: "Account suspended. Their open session stops at its next request.",
  reactivated: "Account reactivated.",
  granted: "Generations granted.",
  "pro-granted": "Pro granted.",
  "pro-revoked": "Pro removed. The grant is closed, not deleted."
};

/** Why something an operator asked for did not happen. */
const ERROR_MESSAGES: Record<string, string> = {
  admin: "That account operates Airrow, so it cannot be suspended. Remove the admin flag first.",
  "already-pro": "That workspace pays Stripe for Pro. A grant sits behind the plan and would change nothing.",
  "already-granted": "A grant is already running on that workspace. Remove it before starting another.",
  "none-active": "There is no grant to remove — this workspace's Pro is not coming from one.",
  days: "Pick one of the offered lengths."
};

/** How the audit log's action ids read to a person. */
const ACTION_LABELS: Record<string, string> = {
  "user.suspend": "Suspended",
  "user.reactivate": "Reactivated",
  "credits.grant": "Granted",
  "pro.grant": "Gave Pro",
  "pro.revoke": "Removed Pro",
  "ticket.close": "Closed ticket",
  "ticket.reopen": "Reopened ticket",
  "review.publish": "Published review",
  "review.unpublish": "Unpublished review"
};

/**
 * The plan, in a sentence rather than a status word.
 *
 * Three things on one line, because support reads them together: what they have, until when, and who
 * gave it to them — the last being the difference between "cancel their subscription" and "click
 * remove" (spec 164).
 */
function PlanLine({ user }: { user: AdminUser }) {
  const standing = planStanding(user);
  const tone =
    standing.kind === "pro"
      ? "accent"
      : standing.kind === "pro-cancelling" || standing.kind === "pro-paused"
        ? "warn"
        : standing.kind === "lapsed"
          ? "danger"
          : "neutral";
  const source = planSourceLabel(standing);
  const until =
    standing.kind === "lapsed"
      ? standing.since
      : standing.kind === "free" || standing.kind === "free-attempted"
        ? null
        : standing.until;

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Badge tone={tone}>{planLabel(standing)}</Badge>
      {until ? (
        <span className="text-sm text-fg-muted">
          {standing.kind === "pro" ? "renews" : standing.kind === "lapsed" ? "ended" : "until"}{" "}
          {onDate(until)}
        </span>
      ) : null}
      {source ? <span className="text-sm text-fg-faint">· {source}</span> : null}
    </span>
  );
}

function isSort(value: string | undefined): value is UserSort {
  return value === "signup" || value === "activity";
}

export default async function AdminUsersPage({
  searchParams
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    done?: string;
    error?: string;
    sort?: string;
    dir?: string;
  }>;
}) {
  const { q, page: pageParam, done, error, sort: sortParam, dir } = await searchParams;
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
      {error && ERROR_MESSAGES[error] ? (
        <InlineError className="mb-4">{ERROR_MESSAGES[error]}</InlineError>
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
                <PlanLine user={user} />
                {user.suspendedAt ? <Badge tone="danger">Suspended</Badge> : null}
                {user.isAdmin ? <Badge tone="warn">Admin</Badge> : null}
                {user.verified ? null : <Badge tone="neutral">Unverified</Badge>}
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

                  {/* Pro, given and taken. Never `organizations.plan` — this writes a `plan_grants`
                      row, which is the entitlement Stripe's reconciliation cannot overwrite (spec 164). */}
                  {user.grant ? (
                    <form action={revokeProAction} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="orgId" value={user.orgId ?? ""} />
                      <div>
                        <label htmlFor={`revoke-why-${user.id}`} className="text-xs text-fg-faint">
                          Why
                        </label>
                        <Input
                          id={`revoke-why-${user.id}`}
                          name="reason"
                          maxLength={500}
                          placeholder="e.g. the trial we agreed has ended"
                          className="w-72"
                        />
                      </div>
                      <SubmitButton variant="secondary" pendingLabel="Removing…">
                        Remove Pro
                      </SubmitButton>
                    </form>
                  ) : (
                    <form action={grantProAction} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="orgId" value={user.orgId ?? ""} />
                      <div>
                        <label htmlFor={`days-${user.id}`} className="text-xs text-fg-faint">
                          Pro for
                        </label>
                        <Select name="days" defaultValue={String(SUPPORT_GRANT_DAYS[0])}>
                          <SelectTrigger id={`days-${user.id}`} className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SUPPORT_GRANT_DAYS.map((days) => (
                              <SelectItem key={days} value={String(days)}>
                                {days} days
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label htmlFor={`pro-why-${user.id}`} className="text-xs text-fg-faint">
                          Why
                        </label>
                        <Input
                          id={`pro-why-${user.id}`}
                          name="reason"
                          maxLength={500}
                          placeholder="e.g. agreed on a call"
                          className="w-72"
                        />
                      </div>
                      <SubmitButton
                        pendingLabel="Giving…"
                        disabled={!user.orgId || !grantWouldApply(planStanding(user))}
                      >
                        Give Pro
                      </SubmitButton>
                    </form>
                  )}

                  {/* An operator's own kind cannot be taken offline from here — suspending either of
                      the two admin accounts locks the console, and the way back is SQL. The action
                      refuses as well; this only stops the click. */}
                  {user.isAdmin ? null : (
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
                  )}
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
