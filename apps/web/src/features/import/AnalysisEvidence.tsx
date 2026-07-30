// What Airrow worked out from an imported project, and where each answer came from.
//
// Rendered in two places, which is why it is a component rather than markup: the import review of a
// project that exists, and — since spec 74 put import behind Pro — the free preview a founder sees
// before deciding whether to upgrade. Both have to show the same thing, because the second is a
// promise about the first.
import type { ImportEvidence } from "@airrow/schemas";

export function AnalysisEvidence({ evidence }: { evidence: ImportEvidence[] }) {
  if (evidence.length === 0) {
    return (
      <p className="px-5 py-4 text-sm text-fg-muted">
        Nothing could be derived from this project, so the interview asks everything.
      </p>
    );
  }

  return (
    <ul>
      {evidence.map((e) => (
        <li
          key={`${e.field}:${e.value}`}
          className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3 last:border-b-0"
        >
          <span className="text-sm text-fg">
            <span className="text-fg-faint">{e.field}</span> — {e.value}
          </span>
          <span className="font-mono text-2xs text-fg-faint">{e.source}</span>
        </li>
      ))}
    </ul>
  );
}

export function AnalysisNotes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="mt-4 space-y-2">
      {notes.map((note) => (
        <li
          key={note}
          className="rounded-md border border-border bg-bg-subtle px-4 py-3 text-sm text-fg-muted"
        >
          {note}
        </li>
      ))}
    </ul>
  );
}
