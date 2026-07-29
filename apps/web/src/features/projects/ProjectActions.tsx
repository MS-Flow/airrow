// The two ways into the wizard, as one pair. Rendered in the top bar and at the head of both the
// dashboard and the project list — extracted so the two entry points can never drift apart.
import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

export function ProjectActions({
  size = "md",
  /**
   * Drop the labels on narrow viewports, where the top bar also carries breadcrumbs. Import loses
   * its label first — it is the rarer way in — and on a phone "New project" goes too, which leaves
   * both actions one tap away and gives the trail its width back.
   *
   * The two hide differently on purpose. Import keeps its text as `sr-only`, so the name comes from
   * the text itself; New project is `hidden` below `sm` and carries an `aria-label` instead. Either
   * way the action keeps its name — what must never happen is an icon a screen reader cannot name.
   */
  compact = false
}: {
  size?: ButtonProps["size"];
  compact?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button variant="secondary" size={size} className={compact ? "max-sm:px-2.5" : undefined} asChild>
        <Link href="/app/projects/import" title="Import an existing project">
          <Upload className="size-4" />
          <span className={compact ? "max-lg:sr-only" : undefined}>Import</span>
        </Link>
      </Button>
      <Button size={size} className={compact ? "max-sm:px-2.5" : undefined} asChild>
        <Link href="/app/projects/new" aria-label={compact ? "New project" : undefined}>
          <Plus className="size-4" />
          <span className={compact ? "max-sm:hidden" : undefined}>New project</span>
        </Link>
      </Button>
    </div>
  );
}
