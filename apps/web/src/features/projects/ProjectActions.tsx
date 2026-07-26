// The two ways into the wizard, as one pair. Rendered in the top bar and at the head of both the
// dashboard and the project list — extracted so the two entry points can never drift apart.
import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

export function ProjectActions({
  size = "md",
  /** Hide the import label on narrow viewports, where the top bar also carries breadcrumbs. */
  compact = false
}: {
  size?: ButtonProps["size"];
  compact?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Button variant="secondary" size={size} asChild>
        <Link href="/app/projects/import" title="Import an existing project">
          <Upload className="size-4" />
          <span className={compact ? "max-lg:sr-only" : undefined}>Import</span>
        </Link>
      </Button>
      <Button size={size} asChild>
        <Link href="/app/projects/new">
          <Plus className="size-4" />
          New project
        </Link>
      </Button>
    </div>
  );
}
