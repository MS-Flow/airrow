"use client";

// Download the whole project: the founder's own files with Airrow's foundation over the top.
//
// The merge happens here, in the browser, because Airrow does not store the founder's source. The
// server sends only what `applyResolutions` deemed safe to write, so overlaying it is correct by
// construction — an undecided conflict never arrives and their file survives untouched.
import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { mergeOverlay, pathOverlap, stripCommonRoot } from "@airrow/engine";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/states";
import { readCachedArchive } from "./archive-cache";

/** Below this, the archive probably isn't the project that was imported. */
const OVERLAP_WARNING_THRESHOLD = 0.5;

type State =
  | { step: "idle" }
  | { step: "working"; label: string }
  | { step: "needs-archive" }
  | { step: "error"; message: string };

interface ZipFile {
  path: string;
  content: Promise<Uint8Array>;
}

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
  const [state, setState] = useState<State>({ step: "idle" });
  const [warning, setWarning] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  async function build(archive: Blob): Promise<void> {
    setState({ step: "working", label: "Merging…" });
    setWarning(null);
    try {
      // Lazy: JSZip is only needed on the one click, and it is not small.
      const { default: JSZip } = await import("jszip");

      const theirZip = await JSZip.loadAsync(await archive.arrayBuffer());
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
        setWarning(
          `Only ${Math.round(overlap * 100)}% of the files from your import are in this archive — it may be a different project. The download still went ahead.`
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
      setState({ step: "idle" });
    } catch (error) {
      setState({
        step: "error",
        message: error instanceof Error ? error.message : "The merge failed."
      });
    }
  }

  async function start(): Promise<void> {
    setState({ step: "working", label: "Preparing…" });
    const cached = await readCachedArchive(projectId);
    if (cached === null) {
      setState({ step: "needs-archive" });
      return;
    }
    await build(cached);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          variant="secondary"
          onClick={start}
          disabled={state.step === "working"}
          aria-busy={state.step === "working"}
        >
          <Download className="size-4" />
          {state.step === "working" ? state.label : "Download project"}
        </Button>
        {state.step === "needs-archive" ? (
          <Button variant="secondary" onClick={() => picker.current?.click()}>
            Choose your archive
          </Button>
        ) : null}
      </div>

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

      {state.step === "needs-archive" ? (
        <p className="mt-2 max-w-md text-sm text-fg-muted">
          Airrow doesn&rsquo;t keep a copy of your code, and this browser no longer has the archive
          you imported. Choose it again and the download will contain your whole project.
        </p>
      ) : null}

      {warning ? <p className="mt-2 max-w-md text-sm text-fg-muted">{warning}</p> : null}
      {state.step === "error" ? <InlineError className="mt-2">{state.message}</InlineError> : null}
    </div>
  );
}
