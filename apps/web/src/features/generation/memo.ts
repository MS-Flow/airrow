// Reusing authored prose when nothing that shapes it has changed (spec 65).
//
// A regeneration costs ~45 seconds, a Claude call, and a slice of the founder's three-generation
// allowance. Founders regenerate constantly while tuning an answer, and most of those runs change
// nothing that the prose depends on. This is what makes "nothing changed" answerable without
// calling out.
import { createHash } from "node:crypto";
import {
  pickValidDocuments,
  pickValidSlots,
  pickValidToolchain,
  type ProjectModel,
  type UiReferenceImage
} from "@airrow/schemas";
import type { AuthoredFoundation } from "./author";

/**
 * Everything that decides what the model writes: the resolved answers, the prompt that framed them,
 * and the model that wrote them.
 *
 * The whole `ProjectModel` goes in rather than a hand-picked subset. Picking fields would mean
 * remembering to add each new one, and forgetting would silently serve stale prose for changed
 * answers — a much worse failure than an unnecessary cache miss. `JSON.stringify` is stable here
 * because the model is built field-by-field in `resolveProjectModel`, not assembled from a map.
 *
 * The reference images are the one input that is *not* in the model — their bytes live in the app's
 * database, and the engine takes strings (spec 159). So they are hashed alongside it: attaching a
 * screenshot changes what the model is looking at, and a founder who attaches one and regenerates
 * must get a brief written from it rather than the prose written before they did.
 */
export function inputsHash(
  model: ProjectModel,
  promptVersion: string,
  authoringModel: string,
  references: readonly UiReferenceImage[] = []
): string {
  // Digested rather than included: a hash of a base64 megabyte is the same answer for a fraction of
  // the work, and this runs on every generation.
  const referenceDigests = references.map((image) =>
    createHash("sha256").update(image.mediaType).update(image.base64).digest("hex")
  );
  return createHash("sha256")
    .update(JSON.stringify({ model, promptVersion, authoringModel, referenceDigests }))
    .digest("hex");
}

/**
 * Turn a stored payload back into an `AuthoredFoundation`, or `null` if there is nothing usable in it.
 *
 * The column is `jsonb` and comes back as `unknown`, so it runs through the same per-field validation
 * the live response does rather than being cast into shape. It was valid when written, but "we wrote
 * it" is not a property this code can check: caps can tighten and slots can be removed between the
 * write and the read, and a stored value that no longer satisfies the contract must not reach the
 * engine just because it is old. Cheap to re-check, and the miss path is only ever a Claude call.
 */
export function reviveAuthored(stored: unknown): AuthoredFoundation | null {
  if (typeof stored !== "object" || stored === null) return null;
  // Reading three properties off a value already narrowed to a non-null object, as `unknown`. The
  // cast claims nothing about their contents — `pickValid*` below decides what is real — it only
  // lets the names be read at all, which `object` does not permit.
  const {
    slots: rawSlots,
    documents: rawDocuments,
    toolchain: rawToolchain
  } = stored as { slots?: unknown; documents?: unknown; toolchain?: unknown };
  const slots = pickValidSlots(rawSlots);
  const documents = pickValidDocuments(rawDocuments);
  const toolchain = pickValidToolchain(rawToolchain);
  if (
    Object.keys(slots).length === 0 &&
    Object.keys(documents).length === 0 &&
    Object.keys(toolchain).length === 0
  )
    return null;
  return { slots, documents, toolchain };
}
