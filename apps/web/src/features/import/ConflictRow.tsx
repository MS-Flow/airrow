// One conflicting path and the two ways out of it. The row always states which version ends up in
// the download — a decision the founder cannot see is a decision they will make twice (spec 63/91).
import { FileWarning } from "lucide-react";
import { deliversSidecar, sidecarPath } from "@airrow/engine";
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
      {/* Pressing the chosen answer again undoes it. The intent is posted rather than worked out
          server-side from the stored value: the button says what it will do, and a stale page
          therefore cannot toggle off a decision the founder is looking at as "not chosen". */}
      <input type="hidden" name="resolution" value={active ? "" : resolution} />
      <Button
        type="submit"
        size="sm"
        variant={active ? "primary" : "secondary"}
        aria-pressed={active}
        title={active ? "Press again to make this undecided" : undefined}
      >
        {label}
      </Button>
    </form>
  );
}

/**
 * What this path's download actually contains, said plainly.
 *
 * Four outcomes, not three: an undecided conflict delivers Airrow's version as a `.airrow` sidecar
 * for a document, and nothing at all for anything else (`deliversSidecar`). Describing both the same
 * way would promise a file that is not in the archive.
 */
function outcome(
  path: string,
  decision: ConflictResolution | undefined
): { label: string; tone: "info" | "success" | "neutral" } {
  if (decision === "use_generated") {
    return { label: "Airrow's version takes this path — yours is not delivered", tone: "success" };
  }
  if (decision === "keep_existing") {
    return { label: "Yours is kept — Airrow's version is not delivered", tone: "neutral" };
  }
  return deliversSidecar(path)
    ? { label: `Undecided — yours is kept, Airrow's arrives as ${sidecarPath(path).split("/").pop()}`, tone: "info" }
    : { label: "Undecided — yours is kept, Airrow's version is not delivered", tone: "info" };
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
  const { label, tone } = outcome(entry.path, decision);
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

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Badge tone={tone}>{label}</Badge>
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
