// The download button, in the one place that knows where the founder's files could come from
// (specs 68, 188).
//
// The merge exists to keep spec 63's promise — never hand back Airrow's additions dressed up as the
// whole project — and that promise only has teeth where Airrow is the *only* place the founder's
// files could come from. That is true of an uploaded ZIP and of nothing else, which is why the
// routing asks what kind of import this was rather than merely whether there was one.
//
// It used to ask the weaker question, and a repository import has no archive to merge with: nothing
// caches one, because the files were read server-side and never passed through the browser. Every
// press therefore opened a file picker asking for an archive that had never existed, and the only
// way through was to download a ZIP of your own repository and hand it back (spec 188).
import { getImportSource, listImportFiles } from "@/lib/data/store";
import { FoundationDownload } from "./FoundationDownload";
import { MergedDownload } from "./MergedDownload";

export async function DownloadProject({
  projectId,
  slug,
  /**
   * Whether this placement has room for a line under the button. Off by default: the button rows
   * this sits in cannot hold a paragraph (spec 68), and the label already says what the archive is.
   */
  explain = false
}: {
  projectId: string;
  slug: string;
  explain?: boolean;
}) {
  const source = await getImportSource(projectId);

  // Never imported: there is nothing of the founder's to merge with, and never was. No line either
  // — there is no existing checkout to unzip into, because the foundation *is* the project.
  if (source === null) {
    return <FoundationDownload projectId={projectId} />;
  }

  // Two ways to reach the same answer, and the layout is checked first because it outranks the
  // source (spec 187):
  //
  // - **Hidden delivery** — every generated file sits under one folder that shares no path with the
  //   founder's tree, so there is nothing to merge. This holds even for a ZIP import whose archive
  //   is cached: they are working in their real checkout, and rebuilding a copy of it around the
  //   folder is not what they asked for.
  // - **Repository import** — the founder's code is in a repository they control and have checked
  //   out. Handing them the foundation to unzip into it is the useful answer; asking them for a ZIP
  //   of what they already own is not.
  // Kept as the narrowed arm rather than a boolean, so the folder name is reachable below without a
  // second check that could disagree with this one (§I).
  const hidden = source.delivery.kind === "hidden" ? source.delivery : null;
  if (hidden !== null || source.kind !== "zip") {
    return (
      <FoundationDownload
        projectId={projectId}
        hint={
          explain
            ? hidden !== null
              ? `Unzip it into your project — everything lands in ${hidden.folder}/, which git ignores.`
              : "Unzip it into your project — nothing of yours is touched."
            : null
        }
      />
    );
  }

  const files = await listImportFiles(source.id);
  return (
    <MergedDownload
      projectId={projectId}
      slug={slug}
      expectedPaths={files.map((f) => f.path)}
    />
  );
}
