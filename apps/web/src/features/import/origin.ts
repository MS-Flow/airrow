// Where a project came from, resolved for the engine (spec 91). The engine cannot read the database
// — it is pure — so the origin has to be looked up here and travel on the model.

import { projectOriginSchema, type ProjectOrigin } from "@airrow/schemas";
import { getImportSource } from "@/lib/data/store";

/**
 * Decide the origin from the import source, or the absence of one.
 *
 * `import_sources` is the only record of where a project came from, and a project with no row *is*
 * one started from nothing — so "new" is a fact here, not a default. Validated rather than cast
 * because `analysis` is a jsonb column: what comes back is whatever was written into it.
 */
export async function projectOrigin(projectId: string): Promise<ProjectOrigin> {
  const source = await getImportSource(projectId);
  if (source === null) return { kind: "new" };

  const parsed = projectOriginSchema.safeParse({
    kind: "imported",
    stackDetected: source.analysis.stackDetected,
    delivery: source.delivery
  });
  // An import source exists, so the one thing this project is not is new. A malformed analysis
  // therefore falls back to the other half of the pair rather than to the opposite answer: assume
  // there is code to read, and let `/cleanup` report finding none.
  //
  // The layout falls back the same way, to the mode that changes nothing about how imports already
  // behave (spec 187). Guessing `hidden` from a row we could not read would scatter a foundation
  // into a folder the founder never named.
  return parsed.success
    ? parsed.data
    : { kind: "imported", stackDetected: true, delivery: { kind: "integrated" } };
}
