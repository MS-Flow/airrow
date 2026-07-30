// What the last revision moved (spec 100).
//
// Shown on the preview, which is where a founder already goes to look at their foundation, and
// before the download — nothing has been written to their machine yet, so this is the approval step
// §0 asks for rather than a report after the fact.
//
// Removed files lead the eye deliberately: a document that disappeared is the change a founder is
// least likely to notice on their own, and the one they will miss months later.
import Link from "next/link";
import type { RevisionChange, RevisionDiff as Diff } from "@airrow/engine";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

const TONE: Record<RevisionChange, string> = {
  added: "text-success",
  changed: "text-warn",
  removed: "text-danger"
};

const LABEL: Record<RevisionChange, string> = {
  added: "new",
  changed: "changed",
  removed: "removed"
};

/** Byte counts as the founder would see them on disk, not rounded into vagueness. */
function size(previous: number | null, next: number | null): string {
  if (previous === null) return `${next} B`;
  if (next === null) return `${previous} B`;
  const delta = next - previous;
  return `${next} B (${delta >= 0 ? "+" : ""}${delta})`;
}

export function RevisionDiff({ diff, projectId }: { diff: Diff; projectId: string }) {
  if (diff.entries.length === 0) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Nothing changed</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-fg-muted">
            This regeneration produced the same {diff.unchanged} files as the one before it. Your
            answers did not move anything the foundation depends on — and because nothing changed,
            it cost you nothing.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>What this revision changed</CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        <ul>
          {diff.entries.map((entry) => (
            <li
              key={entry.path}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3 last:border-b-0"
            >
              <span className="flex min-w-0 items-baseline gap-2.5">
                <span className={`font-mono text-2xs uppercase tracking-wide ${TONE[entry.change]}`}>
                  {LABEL[entry.change]}
                </span>
                {/* A removed file has nothing to open — the reader would 404 on it. */}
                {entry.change === "removed" ? (
                  <span className="truncate font-mono text-sm text-fg-muted line-through">
                    {entry.path}
                  </span>
                ) : (
                  <Link
                    href={`/app/projects/${projectId}/preview?file=${encodeURIComponent(entry.path)}`}
                    className="truncate font-mono text-sm text-fg underline-offset-4 hover:underline"
                  >
                    {entry.path}
                  </Link>
                )}
              </span>
              <span className="shrink-0 font-mono text-2xs text-fg-faint">
                {size(entry.previousBytes, entry.nextBytes)}
              </span>
            </li>
          ))}
        </ul>
        {diff.unchanged > 0 ? (
          <p className="border-t border-border px-5 py-3 text-xs text-fg-faint">
            {diff.unchanged} other {diff.unchanged === 1 ? "file is" : "files are"} unchanged.
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
