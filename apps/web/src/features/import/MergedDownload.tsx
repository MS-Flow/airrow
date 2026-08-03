"use client";

// Download the whole project: the founder's own files with Airrow's foundation over the top.
//
// The merge happens here, in the browser, because Airrow does not store the founder's source. The
// server sends only what `applyResolutions` deemed safe to write, so overlaying it is correct by
// construction — an undecided conflict arrives under a `.airrow` path, so their file survives untouched.
//
// One button, always. It sits in the preview header as well as on the project pages, so it stays a
// single control and says everything transient through the toaster instead of growing a paragraph
// that a header row cannot hold.
import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { mergeOverlay, pathOverlap, stripCommonRoot } from "@airrow/engine";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { hasCachedArchive, readCachedArchive } from "./archive-cache";

/** Below this, the archive probably isn't the project that was imported. */
const OVERLAP_WARNING_THRESHOLD = 0.5;

const PICK_PROMPT = "Your code never left your machine — choose the archive you imported.";

interface ZipFile {
  path: string;
  content: Promise<Uint8Array>;
}

/**
 * Whether this browser still holds the founder's archive. Settled *before* the first click: a file
 * picker can only be opened from a real user gesture, so the button must not have to await an
 * IndexedDB read to find out which of its two jobs it has.
 */
type Archive = "checking" | "ready" | "missing";

export function MergedDownload({
  projectId,
  slug,
  expectedPaths
}: {
  projectId: string;
  slug: string;
  /** Paths recorded at import, used to notice a wrong archive being picked. */
  expectedPaths: string[];
}) {
  const notify = useToast();
  const [archive, setArchive] = useState<Archive>("checking");
  const [working, setWorking] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  // Browser storage, not server data — the constitution's no-useEffect-for-fetching rule is about
  // the latter, and this cannot be answered on the server at all.
  useEffect(() => {
    let current = true;
    void hasCachedArchive(projectId).then((held) => {
      if (current) setArchive(held ? "ready" : "missing");
    });
    return () => {
      current = false;
    };
  }, [projectId]);

  async function build(source: Blob): Promise<void> {
    setWorking(true);
    try {
      // Lazy: JSZip is only needed on the one click, and it is not small.
      const { default: JSZip } = await import("jszip");

      const theirZip = await JSZip.loadAsync(await source.arrayBuffer());
      const theirs: ZipFile[] = stripCommonRoot(
        Object.values(theirZip.files)
          .filter((e) => !e.dir)
          .map((e) => ({ path: e.name.replace(/\\/g, "/"), content: e.async("uint8array") }))
      ).filter((f) => !f.path.endsWith("/"));

      const response = await fetch(`/api/projects/${projectId}/zip`);
      if (!response.ok) throw new Error(`Airrow's files could not be fetched (${response.status})`);
      const ourZip = await JSZip.loadAsync(await response.arrayBuffer());
      const ours: ZipFile[] = Object.values(ourZip.files)
        .filter((e) => !e.dir)
        // The route roots its archive at the project slug; strip it so paths line up with theirs.
        .map((e) => ({ path: e.name.replace(/^[^/]+\//, ""), content: e.async("uint8array") }));

      const overlap = pathOverlap(expectedPaths, theirs.map((f) => f.path));
      if (overlap < OVERLAP_WARNING_THRESHOLD) {
        notify(
          `Only ${Math.round(overlap * 100)}% of your imported files are in that archive — it may be a different project. The download went ahead anyway.`
        );
      }

      const merged = new JSZip();
      for (const file of mergeOverlay(theirs, ours)) {
        merged.file(`${slug}/${file.path}`, await file.content);
      }
      const blob = await merged.generateAsync({ type: "blob", compression: "DEFLATE" });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${slug}.zip`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      notify(error instanceof Error ? error.message : "The merge failed.", "danger");
    } finally {
      setWorking(false);
    }
  }

  /** The cached archive, or the picker — decided before the click so neither path is a dead end. */
  function download(): void {
    if (archive === "missing") {
      notify(PICK_PROMPT);
      picker.current?.click();
      return;
    }
    void (async () => {
      setWorking(true);
      const cached = await readCachedArchive(projectId);
      if (cached === null) {
        // Cleared between mount and click. The gesture is spent, so ask for one more click rather
        // than open a picker the browser would block.
        setArchive("missing");
        setWorking(false);
        notify("This browser no longer has your archive — click Download again to choose it.");
        return;
      }
      await build(cached);
    })();
  }

  return (
    <span className="inline-flex items-center gap-3">
      <Button
        variant="secondary"
        onClick={download}
        disabled={working || archive === "checking"}
        aria-busy={working}
      >
        <Download className="size-4" />
        {working ? "Preparing…" : "Download project"}
      </Button>

      {/* A way past the picker, for a founder whose archive is on their other machine (spec 188).
          Secondary and secondary only: they uploaded a ZIP and asked for the merge, so handing them
          the foundation alone by default would short-change them. But "ask, or nothing" leaves them
          in the same dead end this spec exists to remove, one step later — so the answer to "I do
          not have that archive here" is never "then you get nothing".

          A compact link on the same line, not a paragraph beneath: every placement of this component
          is a row of buttons, and a row cannot hold a paragraph (spec 68). Why the picker opens at
          all is said by `PICK_PROMPT` through the toaster, which is that rule's own answer. */}
      {archive === "missing" ? (
        <a
          href={`/api/projects/${projectId}/zip`}
          className="text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline"
        >
          Foundation only
        </a>
      ) : null}

      <input
        ref={picker}
        type="file"
        accept=".zip,application/zip"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void build(file);
        }}
      />
    </span>
  );
}
