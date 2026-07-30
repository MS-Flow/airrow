// What a revision moved (spec 100).
//
// A founder who reopens the interview, changes one answer and regenerates needs to know which files
// that touched before they take the result anywhere. Both generations hold every file's full text,
// so this is exact classification rather than a guess — and it is pure, which is why it lives in the
// engine rather than in the app.
import type { GeneratedFile } from "../../schemas/src/types.ts";

export type RevisionChange = "added" | "changed" | "removed";

export interface RevisionEntry {
  path: string;
  change: RevisionChange;
  /** Byte length before and after, so a founder can see the size of a change without opening it. */
  previousBytes: number | null;
  nextBytes: number | null;
}

export interface RevisionDiff {
  entries: RevisionEntry[];
  /** Files that came out byte-identical. Counted rather than listed — the list is the noise. */
  unchanged: number;
}

const bytes = (content: string): number => new TextEncoder().encode(content).length;

/**
 * Compare two generations of the same project.
 *
 * Ordered added → changed → removed, then by path within each. That is the order a founder reads it
 * in: what is new, what moved, and what is gone — the last being the one worth noticing, and the one
 * a diff that only walked the new tree would silently omit.
 */
export function diffGenerations(previous: GeneratedFile[], next: GeneratedFile[]): RevisionDiff {
  const before = new Map(previous.map((f) => [f.path, f.content]));
  const after = new Map(next.map((f) => [f.path, f.content]));

  const entries: RevisionEntry[] = [];
  let unchanged = 0;

  for (const [path, content] of after) {
    const old = before.get(path);
    if (old === undefined) {
      entries.push({ path, change: "added", previousBytes: null, nextBytes: bytes(content) });
    } else if (old === content) {
      unchanged += 1;
    } else {
      entries.push({
        path,
        change: "changed",
        previousBytes: bytes(old),
        nextBytes: bytes(content)
      });
    }
  }

  for (const [path, content] of before) {
    if (after.has(path)) continue;
    entries.push({ path, change: "removed", previousBytes: bytes(content), nextBytes: null });
  }

  const rank: Record<RevisionChange, number> = { added: 0, changed: 1, removed: 2 };
  entries.sort((a, b) => rank[a.change] - rank[b.change] || a.path.localeCompare(b.path));

  return { entries, unchanged };
}
