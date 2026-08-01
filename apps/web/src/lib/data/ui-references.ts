// The screenshots a founder attached to the UI question (spec 159).
//
// Part of the DataStore, and server-only for the same reason the rest of it is: the client here is
// built from the service-role key, so every query below is additionally scoped by `organization_id`
// (defense in depth, §II).
//
// The bytes live in a private Storage bucket and are read in exactly two places — the interview
// screen, through a short-expiry signed URL minted for the founder who uploaded them, and the
// authoring provider, which describes them in words. They are never written into a generated
// foundation and never rendered to anyone else.
import { randomUUID } from "node:crypto";
import {
  MAX_UI_REFERENCE_IMAGES,
  MAX_UI_REFERENCE_IMAGE_BYTES,
  UI_REFERENCE_MEDIA_TYPES,
  type UiReferenceImage
} from "@airrow/schemas";
import { db, isMissingTable, rows, single } from "./supabase";

export const UI_REFERENCE_BUCKET = "ui-references";

/** How long a founder's own preview link lives. Long enough to load a screen, short enough to leak nothing. */
const SIGNED_URL_TTL_SECONDS = 300;

export interface UiReferenceRecord {
  id: string;
  projectId: string;
  mediaType: UiReferenceImage["mediaType"];
  bytes: number;
  createdAt: string;
}

interface UiReferenceRow {
  id: string;
  project_id: string;
  storage_path: string;
  media_type: UiReferenceImage["mediaType"];
  bytes: number;
  created_at: string;
}

const toRecord = (r: UiReferenceRow): UiReferenceRecord => ({
  id: r.id,
  projectId: r.project_id,
  mediaType: r.media_type,
  bytes: r.bytes,
  createdAt: r.created_at
});

/** Why an upload was refused, in the terms the founder will read it in. */
export type UploadRefusal = "type" | "size" | "count";

export type UploadResult =
  | { ok: true; reference: UiReferenceRecord }
  | { ok: false; refusal: UploadRefusal };

/**
 * Every reference on a project, oldest first.
 *
 * Returns `[]` rather than throwing when the table is not there yet: a deployment running ahead of
 * its migrations should cost the founder an upload button, not the interview.
 */
export async function listUiReferences(
  orgId: string,
  projectId: string
): Promise<UiReferenceRecord[]> {
  const res = await db()
    .from("ui_references")
    .select("id, project_id, storage_path, media_type, bytes, created_at")
    .eq("organization_id", orgId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (res.error && isMissingTable(res.error)) return [];
  return rows<UiReferenceRow>(res).map(toRecord);
}

/**
 * Store one image and record it.
 *
 * Type, size and count are all checked here rather than only in the browser — this is the one place
 * in Airrow where a founder hands us a binary, and the field's own `accept` attribute is a courtesy
 * to them, not a boundary. The object is written before the row so a failed insert cannot leave a
 * row pointing at nothing; the orphaned object is cleaned up on the way out.
 */
export async function addUiReference(input: {
  orgId: string;
  projectId: string;
  userId: string;
  mediaType: string;
  bytes: Uint8Array;
}): Promise<UploadResult> {
  const mediaType = UI_REFERENCE_MEDIA_TYPES.find((t) => t === input.mediaType);
  if (!mediaType) return { ok: false, refusal: "type" };
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_UI_REFERENCE_IMAGE_BYTES) {
    return { ok: false, refusal: "size" };
  }

  const existing = await listUiReferences(input.orgId, input.projectId);
  if (existing.length >= MAX_UI_REFERENCE_IMAGES) return { ok: false, refusal: "count" };

  const extension = mediaType === "image/jpeg" ? "jpg" : mediaType === "image/webp" ? "webp" : "png";
  // Named by a fresh id rather than by the founder's filename: a filename is founder-supplied text,
  // and a storage key built from one is a path-traversal question nobody needs to answer.
  const storagePath = `projects/${input.projectId}/${randomUUID()}.${extension}`;

  const upload = await db()
    .storage.from(UI_REFERENCE_BUCKET)
    .upload(storagePath, input.bytes, { contentType: mediaType, upsert: false });
  if (upload.error) throw new Error(`Supabase storage: ${upload.error.message}`);

  try {
    const row = single<UiReferenceRow>(
      await db()
        .from("ui_references")
        .insert({
          organization_id: input.orgId,
          project_id: input.projectId,
          storage_path: storagePath,
          media_type: mediaType,
          bytes: input.bytes.byteLength,
          created_by: input.userId
        })
        .select("id, project_id, storage_path, media_type, bytes, created_at")
        .single()
    );
    return { ok: true, reference: toRecord(row) };
  } catch (error) {
    await db().storage.from(UI_REFERENCE_BUCKET).remove([storagePath]);
    throw error;
  }
}

/** Remove one reference — the row and the object, in that order. */
export async function removeUiReference(
  orgId: string,
  projectId: string,
  referenceId: string
): Promise<void> {
  const deleted = rows<UiReferenceRow>(
    await db()
      .from("ui_references")
      .delete()
      .eq("id", referenceId)
      .eq("organization_id", orgId)
      .eq("project_id", projectId)
      .select("id, project_id, storage_path, media_type, bytes, created_at")
  );
  const paths = deleted.map((r) => r.storage_path);
  if (paths.length > 0) await db().storage.from(UI_REFERENCE_BUCKET).remove(paths);
}

/**
 * Every object belonging to a project, removed.
 *
 * Called when a project is deleted: the rows go with it by foreign key, but Storage has no foreign
 * key to go by, so the objects would otherwise outlive the project they belong to (§II — deleting a
 * project cascades to its Storage objects).
 */
export async function removeProjectUiReferences(orgId: string, projectId: string): Promise<void> {
  const res = await db()
    .from("ui_references")
    .select("id, project_id, storage_path, media_type, bytes, created_at")
    .eq("organization_id", orgId)
    .eq("project_id", projectId);
  // A deployment running ahead of its migrations has no references to clean up, and must still be
  // able to delete a project — the one caller of this is `deleteProject`.
  if (res.error && isMissingTable(res.error)) return;

  const references = rows<UiReferenceRow>(res);
  if (references.length === 0) return;
  await db()
    .storage.from(UI_REFERENCE_BUCKET)
    .remove(references.map((r) => r.storage_path));
}

/**
 * A short-lived URL the founder's own browser can load, for the references they uploaded.
 *
 * The bucket is private and stays private; this is the only way an image is ever seen again, and it
 * expires (§II — Storage is served through short-expiry signed URLs, never a public path).
 */
export async function signUiReference(
  orgId: string,
  projectId: string,
  referenceId: string
): Promise<string | null> {
  const [row] = rows<UiReferenceRow>(
    await db()
      .from("ui_references")
      .select("id, project_id, storage_path, media_type, bytes, created_at")
      .eq("id", referenceId)
      .eq("organization_id", orgId)
      .eq("project_id", projectId)
      .limit(1)
  );
  if (!row) return null;
  const signed = await db()
    .storage.from(UI_REFERENCE_BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
  if (signed.error) return null;
  return signed.data?.signedUrl ?? null;
}

/**
 * The images themselves, base64-encoded for the authoring provider's vision blocks.
 *
 * Best-effort by design: an unreachable object, a missing bucket or a slow download costs this
 * generation its references, never the generation. A founder who attached a screenshot and got a
 * brief written from their words alone has lost specificity; one whose generation failed over a
 * Storage blip has lost the foundation.
 */
export async function loadUiReferenceImages(
  orgId: string,
  projectId: string
): Promise<UiReferenceImage[]> {
  const references = await listUiReferences(orgId, projectId);
  const images: UiReferenceImage[] = [];
  for (const reference of references.slice(0, MAX_UI_REFERENCE_IMAGES)) {
    try {
      const [row] = rows<UiReferenceRow>(
        await db()
          .from("ui_references")
          .select("id, project_id, storage_path, media_type, bytes, created_at")
          .eq("id", reference.id)
          .limit(1)
      );
      if (!row) continue;
      const file = await db().storage.from(UI_REFERENCE_BUCKET).download(row.storage_path);
      if (file.error || !file.data) continue;
      const buffer = Buffer.from(await file.data.arrayBuffer());
      images.push({ mediaType: reference.mediaType, base64: buffer.toString("base64") });
    } catch {
      // One unreadable reference must not cost the others, or the generation.
      continue;
    }
  }
  return images;
}
