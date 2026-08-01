"use server";

// Attaching a screenshot to the UI question (spec 159).
//
// The one place in Airrow where a founder hands us a binary, so the shape of this file is the shape
// of that: session first, project ownership second, then the content — type, size and count — decided
// server-side and never from what the browser claimed. Nothing here is reachable without an account,
// which is deliberate: the guest interview writes nothing server-side before it is claimed, and a
// screenshot is not a good enough reason to open the first unauthenticated write path (§II).
import {
  MAX_UI_REFERENCE_IMAGES,
  MAX_UI_REFERENCE_IMAGE_BYTES,
  UI_REFERENCE_MEDIA_TYPES
} from "@airrow/schemas";
import { requireSession } from "@/lib/auth";
import { getProject } from "@/lib/data/store";
import {
  addUiReference,
  listUiReferences,
  removeUiReference,
  signUiReference,
  type UploadRefusal
} from "@/lib/data/ui-references";

/** One reference as the interview screen needs it: what it is, and where the founder can see it. */
export interface ReferenceView {
  id: string;
  bytes: number;
  /** Short-lived and minted per read — the bucket is private and stays private. */
  url: string | null;
}

const MB = (bytes: number) => `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;

/** What a refusal reads like on screen. Says which rule, so the founder can act on it. */
function refusalMessage(refusal: UploadRefusal): string {
  switch (refusal) {
    case "type":
      return `That file isn't an image we can read. PNG, JPG or WebP — ${UI_REFERENCE_MEDIA_TYPES.join(", ")}.`;
    case "size":
      return `That image is over ${MB(MAX_UI_REFERENCE_IMAGE_BYTES)}. A screenshot fits well inside it; a full export usually doesn't.`;
    case "count":
      return `You've attached ${MAX_UI_REFERENCE_IMAGES} already. Remove one to add another — a direction that takes five screenshots isn't a direction.`;
  }
}

export async function listReferencesAction(projectId: string): Promise<ReferenceView[]> {
  const { org } = await requireSession();
  const project = await getProject(org.id, projectId);
  if (!project) return [];
  const references = await listUiReferences(org.id, projectId);
  return Promise.all(
    references.map(async (reference) => ({
      id: reference.id,
      bytes: reference.bytes,
      url: await signUiReference(org.id, projectId, reference.id)
    }))
  );
}

/**
 * Take one uploaded image.
 *
 * `FormData` rather than a JSON body, so the bytes travel as bytes: base64 through a server action's
 * argument list would inflate them by a third and put a megabyte of string in a payload that is not
 * meant to carry one.
 */
export async function uploadReferenceAction(
  projectId: string,
  form: FormData
): Promise<{ error?: string }> {
  const { org, user } = await requireSession();
  const project = await getProject(org.id, projectId);
  if (!project) return { error: "Project not found." };

  const file = form.get("file");
  if (!(file instanceof File)) return { error: "No image was attached." };
  // Checked before the bytes are read into memory, not after: the size is the one property we can
  // know without paying for it.
  if (file.size > MAX_UI_REFERENCE_IMAGE_BYTES) return { error: refusalMessage("size") };

  const result = await addUiReference({
    orgId: org.id,
    projectId,
    userId: user.id,
    mediaType: file.type,
    bytes: new Uint8Array(await file.arrayBuffer())
  });
  return result.ok ? {} : { error: refusalMessage(result.refusal) };
}

export async function removeReferenceAction(
  projectId: string,
  referenceId: string
): Promise<{ error?: string }> {
  const { org } = await requireSession();
  const project = await getProject(org.id, projectId);
  if (!project) return { error: "Project not found." };
  await removeUiReference(org.id, projectId, referenceId);
  return {};
}
