// Reading an uploaded archive (spec 63). Server-side only — imported from actions and route
// handlers, never from a client component.
//
// Everything in here treats the archive as hostile: the size is checked before a single byte is
// decompressed, the running total is checked again during decompression (an archive's declared
// size proves nothing), and entry names are normalised so a crafted path cannot escape the tree.
// Nothing read here is ever executed or written to disk.
import JSZip from "jszip";
import { checkImportLimits, isIgnoredImportPath, stripCommonRoot, IMPORT_LIMITS } from "@airrow/engine";
import type { ImportedFile } from "@airrow/schemas";

export type ArchiveRead =
  | { ok: true; files: ImportedFile[]; ignored: number }
  | { ok: false; error: string };

const megabytes = (bytes: number): string => `${Math.round(bytes / (1024 * 1024))} MB`;

/**
 * What the founder called the thing they gave us. A repository read through GitHub's zipball takes
 * exactly this path (spec 67), and telling that founder their "archive" is too large would name
 * something they never made.
 */
export type ArchiveNoun = "archive" | "repository";

/** Archive entry name → repo-relative path. Returns null for anything that tries to escape. */
export function normalizePath(name: string): string | null {
  const path = name.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
  if (path === "" || path.split("/").includes("..")) return null;
  return path;
}

/** Read a ZIP — uploaded, or fetched from a repository — into the file list the engine analyses. */
export async function readArchive(
  bytes: ArrayBuffer,
  noun: ArchiveNoun = "archive"
): Promise<ArchiveRead> {
  const tooBig = `That ${noun} is over the ${megabytes(IMPORT_LIMITS.maxBytes)} import limit.`;
  if (bytes.byteLength > IMPORT_LIMITS.maxBytes) return { ok: false, error: tooBig };

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    return { ok: false, error: `That ${noun} could not be read as a ZIP archive.` };
  }

  // Filter before decompressing: a dependency directory should cost nothing to skip, and the
  // entry count is a cheap first guard against an archive with millions of tiny members.
  //
  // Directories are recognised from the *normalised* path, not JSZip's `dir` flag alone: an
  // archive written by Windows (`Compress-Archive`) separates with backslashes, which leaves
  // that flag false for every folder and would otherwise store them as empty files.
  const named = Object.values(zip.files)
    .map((entry) => ({ entry, path: normalizePath(entry.name) }))
    .filter((e): e is { entry: JSZip.JSZipObject; path: string } => e.path !== null)
    .filter((e) => !e.entry.dir && !e.path.endsWith("/"));
  const entries = named.filter((e) => !isIgnoredImportPath(e.path));
  const skipped = named.length - entries.length;

  if (entries.length > IMPORT_LIMITS.maxFiles) {
    return {
      ok: false,
      error: `That ${noun} has ${entries.length} files — the import limit is ${IMPORT_LIMITS.maxFiles}.`
    };
  }

  const files: ImportedFile[] = [];
  let total = 0;
  for (const { entry, path } of entries) {
    const content = await entry.async("string");
    total += Buffer.byteLength(content, "utf8");
    if (total > IMPORT_LIMITS.maxBytes) return { ok: false, error: tooBig };
    files.push({ path, content });
  }

  const checked = checkImportLimits(stripCommonRoot(files));
  if (!checked.ok) return { ok: false, error: checked.error };
  // `skipped` is the real count: the ignored directories never got as far as checkImportLimits.
  return { ok: true, files: checked.files, ignored: skipped + checked.ignored };
}

