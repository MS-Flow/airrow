// What the preview tree is built from (spec 75): Airrow's generated files plus — when the project
// was imported — the founder's own paths. Server-side only, and only ever paths: `import_files`
// holds path, size and a peppered digest, never content, so the founder's code cannot leak into a
// view that has no business holding it.
import { diffAgainstExisting, mergePreviewFiles } from "@airrow/engine";
import type { PreviewFileEntry } from "@airrow/engine";
import type { GeneratedFile } from "@airrow/schemas";
import { getImportSource, listConflictResolutions, listImportFiles } from "@/lib/data/store";
import { digestFor } from "@/features/import/digest";

export interface PreviewFiles {
  entries: PreviewFileEntry[];
  /** How many files the founder brought, for the header. Zero when nothing was imported. */
  yoursCount: number;
}

export async function loadPreviewFiles(
  projectId: string,
  jobId: string,
  generated: GeneratedFile[]
): Promise<PreviewFiles> {
  const source = await getImportSource(projectId);
  if (!source) {
    return { entries: mergePreviewFiles([], generated, [], new Map()), yoursCount: 0 };
  }

  const [existing, decisions] = await Promise.all([
    listImportFiles(source.id),
    listConflictResolutions(jobId)
  ]);
  // Hashed with the key the import was stored under, so a rotated pepper doesn't turn every file
  // into a conflict (spec 68).
  const diff = diffAgainstExisting(generated, existing, digestFor(source.digestVersion));

  return {
    entries: mergePreviewFiles(
      existing,
      generated,
      diff.conflicts.map((c) => c.path),
      decisions
    ),
    yoursCount: existing.length
  };
}
