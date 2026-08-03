// Reviews — the queue of things we may be allowed to quote (spec 150).
//
// This is the only screen in the product that ever *sets* `published_at`, exactly as spec 144
// promised. Two permissions are required and they are not interchangeable: the founder's tick box,
// and ours. A review without consent cannot be published from here, and the button is not merely
// hidden — `setReviewPublished` refuses it at the data layer, so posting straight to the action fails
// too.
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, InlineError } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { Pager } from "@/features/admin/Pager";
import { setReviewPublishedAction } from "@/features/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { adminAudit, adminReviews } from "@/lib/data/admin";
import { cn, timeAgo } from "@/lib/utils";

const RATINGS = [5, 4, 3, 2, 1];

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

export default async function AdminReviewsPage({
  searchParams
}: {
  searchParams: Promise<{ rating?: string; pending?: string; page?: string; error?: string }>;
}) {
  const { rating, pending, page: pageParam, error } = await searchParams;
  const { user: actor } = await requireAdmin();
  const page = Math.max(0, Number(pageParam ?? 0) || 0);

  const filters = {
    rating: RATINGS.includes(Number(rating)) ? Number(rating) : undefined,
    pending: pending === "1"
  };
  const reviews = await adminReviews(actor.id, { ...filters, page });
  const audit = await adminAudit(actor.id, { type: "review", ids: reviews.items.map((r) => r.id) });

  const query = (over: Record<string, string | undefined>): string => {
    const search = new URLSearchParams();
    const merged = {
      rating: filters.rating ? String(filters.rating) : undefined,
      pending: filters.pending ? "1" : undefined,
      ...over
    };
    for (const [key, value] of Object.entries(merged)) if (value) search.set(key, value);
    const text = search.toString();
    return text ? `/app/admin/reviews?${text}` : "/app/admin/reviews";
  };

  return (
    <>
      {error === "no-consent" ? (
        <InlineError className="mb-4">
          That review cannot be published: its author has not agreed to be quoted. Their tick box is
          their permission and this page is ours — both are required.
        </InlineError>
      ) : null}
      {error === "missing" ? (
        <InlineError className="mb-4">That review no longer exists.</InlineError>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterLink href={query({ pending: undefined })} active={!filters.pending}>
          All
        </FilterLink>
        <FilterLink href={query({ pending: "1" })} active={filters.pending}>
          Awaiting decision
        </FilterLink>
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <FilterLink href={query({ rating: undefined })} active={!filters.rating}>
          Any rating
        </FilterLink>
        {RATINGS.map((r) => (
          <FilterLink key={r} href={query({ rating: String(r) })} active={filters.rating === r}>
            {r}★
          </FilterLink>
        ))}
      </div>

      {reviews.items.length === 0 ? (
        <EmptyState
          title={filters.pending ? "Nothing waiting" : "No reviews yet"}
          description={
            filters.pending
              ? "Every consented review has been decided on."
              : "They appear here as founders leave them."
          }
        />
      ) : (
        <div className="space-y-3">
          {reviews.items.map((review) => (
            <Card key={review.id}>
              <CardHeader className="flex flex-wrap items-center gap-3">
                <CardTitle>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</CardTitle>
                {review.publishedAt ? (
                  <Badge tone="success">Published</Badge>
                ) : review.consentPublic ? (
                  <Badge tone="warn">Awaiting decision</Badge>
                ) : (
                  <Badge tone="neutral">No consent</Badge>
                )}
                <span className="ml-auto font-mono text-xs text-fg-faint">{timeAgo(review.createdAt)}</span>
              </CardHeader>
              <CardBody>
                {review.body ? (
                  <blockquote className="whitespace-pre-wrap border-l-2 border-border pl-4 text-sm leading-relaxed text-fg">
                    {review.body}
                  </blockquote>
                ) : (
                  <p className="text-sm text-fg-faint">Stars only — no words.</p>
                )}

                <p className="mt-4 text-sm text-fg-faint">
                  {/* The name as it would appear publicly, so the decision is made on what readers see. */}
                  Would appear as <span className="font-medium text-fg">{review.displayName || "—"}</span> ·{" "}
                  {review.projectName ?? "deleted project"} · {review.orgName ?? "—"}
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
                  {review.consentPublic || review.publishedAt ? (
                    <form action={setReviewPublishedAction}>
                      <input type="hidden" name="reviewId" value={review.id} />
                      <input type="hidden" name="publish" value={review.publishedAt ? "false" : "true"} />
                      <SubmitButton
                        variant={review.publishedAt ? "secondary" : "primary"}
                        pendingLabel={review.publishedAt ? "Unpublishing…" : "Publishing…"}
                      >
                        {review.publishedAt ? "Unpublish" : "Publish"}
                      </SubmitButton>
                    </form>
                  ) : (
                    <p className="text-sm text-fg-faint">
                      Cannot be published — the author has not agreed to be quoted.
                    </p>
                  )}
                </div>

                {audit.get(review.id)?.length ? (
                  <ul className="mt-4 space-y-1 border-t border-border pt-4">
                    {audit.get(review.id)?.map((entry) => (
                      <li key={entry.id} className="text-xs text-fg-faint">
                        {entry.action === "review.publish" ? "Published" : "Unpublished"} by{" "}
                        {entry.actorName ?? "someone"} · {timeAgo(entry.createdAt)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Pager
        base="/app/admin/reviews"
        params={{
          rating: filters.rating ? String(filters.rating) : undefined,
          pending: filters.pending ? "1" : undefined
        }}
        page={page}
        hasMore={reviews.hasMore}
      />
    </>
  );
}
