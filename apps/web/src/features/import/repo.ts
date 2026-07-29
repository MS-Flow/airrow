// Reading a public GitHub repository into an import (spec 67). Server-side only.
//
// There is no second import path here, and that is the point: the zipball GitHub serves for the
// default branch goes through the *same* `readArchive` an uploaded file does, so the limits, the
// ignored directories, the path normalisation and the common-root strip are the same code — not two
// implementations kept in step by hand.
import type { GitHubReader } from "@/lib/github";
import { readArchive, type ArchiveRead } from "./archive";

export async function readRepository(
  reader: GitHubReader,
  token: string,
  owner: string,
  repo: string
): Promise<ArchiveRead> {
  const zipball = await reader.downloadZipball(token, owner, repo);
  if (!zipball.ok) return { ok: false, error: zipball.error.message };

  // GitHub's zipball wraps the tree in an `owner-repo-sha/` folder; `readArchive` strips a shared
  // root already, which is why an empty repository (no commits, no entries) also lands here as an
  // empty file list rather than an error — the analysis handles that, and the interview asks it all.
  return readArchive(zipball.value, "repository");
}
