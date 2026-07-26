// One conflicting path and the two ways out of it. A conflict with no decision keeps the founder's
// file — the buttons only ever record an explicit choice (spec 63).
import { FileWarning } from "lucide-react";
import type { ConflictResolution, ImportDiffEntry } from "@airrow/schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { resolveConflictAction } from "./actions";

function Choice({
  projectId,
  path,
  resolution,
  label,
  active
}: {
  projectId: string;
  path: string;
  resolution: ConflictResolution;
  label: string;
  active: boolean;
}) {
  return (
    <form action={resolveConflictAction}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="resolution" value={resolution} />
      <Button type="submit" size="sm" variant={active ? "primary" : "secondary"} aria-pressed={active}>
        {label}
      </Button>
    </form>
  );
}

export function ConflictRow({
  projectId,
  entry,
  decision
}: {
  projectId: string;
  entry: ImportDiffEntry;
  decision: ConflictResolution | undefined;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="flex items-center gap-2 truncate font-mono text-xs text-fg">
          <FileWarning className="size-3.5 shrink-0 text-info" />
          {entry.path}
        </p>
        <p className="mt-1 text-2xs text-fg-faint">
          yours {entry.existingBytes ?? 0} B · Airrow&rsquo;s {entry.generatedBytes} B
        </p>
      </div>

      <div className="flex items-center gap-2">
        {decision === undefined ? (
          <Badge tone="info">Undecided — yours is kept</Badge>
        ) : null}
        <Choice
          projectId={projectId}
          path={entry.path}
          resolution="keep_existing"
          label="Keep mine"
          active={decision === "keep_existing"}
        />
        <Choice
          projectId={projectId}
          path={entry.path}
          resolution="use_generated"
          label="Use Airrow's"
          active={decision === "use_generated"}
        />
      </div>
    </li>
  );
}
