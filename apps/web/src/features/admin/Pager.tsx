// Paging for the admin lists (spec 150).
//
// A Server Component of plain links, because paging is navigation: it belongs in the URL, so a page
// of results can be linked to, reloaded and opened in a tab. The lists it serves are read and
// paginated in Postgres — this only renders where you are.
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Rebuild the current query string with a different page, dropping page=0 so the first URL is clean. */
function href(base: string, params: Record<string, string | undefined>, page: number): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  if (page > 0) search.set("page", String(page));
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

export function Pager({
  base,
  params,
  page,
  hasMore
}: {
  base: string;
  /** The filters in force, carried across so paging never silently drops them. */
  params: Record<string, string | undefined>;
  page: number;
  /**
   * Whether another page exists, as reported by the data layer — which fetched one row more than it
   * showed and therefore knows.
   *
   * Deliberately *not* re-derived here from `items.length === pageSize`. That inference was wrong
   * whenever anything removed a row from a page after the database sized it, and wrong in the
   * direction that hides the rest of the list: the operator saw a partial answer presented as
   * complete. Asking the layer that knows is the only version that cannot drift.
   */
  hasMore: boolean;
}) {
  const hasPrevious = page > 0;
  if (!hasPrevious && !hasMore) return null;

  const linkClass = "rounded-md border border-border px-3 py-1.5 text-sm transition-colors";

  return (
    <div className="mt-4 flex items-center justify-between gap-4">
      <span className="text-sm text-fg-faint">Page {page + 1}</span>
      <div className="flex items-center gap-2">
        {hasPrevious ? (
          <Link href={href(base, params, page - 1)} className={cn(linkClass, "text-fg-muted hover:text-fg")}>
            Previous
          </Link>
        ) : (
          <span className={cn(linkClass, "text-fg-faint opacity-50")}>Previous</span>
        )}
        {hasMore ? (
          <Link href={href(base, params, page + 1)} className={cn(linkClass, "text-fg-muted hover:text-fg")}>
            Next
          </Link>
        ) : (
          <span className={cn(linkClass, "text-fg-faint opacity-50")}>Next</span>
        )}
      </div>
    </div>
  );
}
