// The foundation on its own — what Airrow generated, and nothing of the founder's (spec 188).
//
// The label carries the meaning. A button reading "Download project" that hands back only Airrow's
// files is the defect this spec exists to fix, and explaining the difference *underneath* a
// reassuring label would lean on a sentence people skim — which is the reading spec 63's promise
// depends on. So the button says what is in the archive.
//
// The explanatory line is opt-in, and defaults to off, because every current placement is a tight
// row of buttons (`flex items-center gap-2`). Spec 68 met this already and answered it the same
// way: a header row cannot hold a paragraph. Pages with vertical room pass one; the rest rely on
// the label, which is the load-bearing half.
//
// A plain link, deliberately: no JavaScript, no browser state, nothing that can be in the wrong
// mood. This is the path that always works.
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const button = (projectId: string) => (
  <Button variant="secondary" asChild>
    <a href={`/api/projects/${projectId}/zip`}>
      <Download className="size-4" />
      Download foundation
    </a>
  </Button>
);

export function FoundationDownload({
  projectId,
  /** One line under the button, for placements with room. Omitted leaves the row untouched. */
  hint = null
}: {
  projectId: string;
  hint?: string | null;
}) {
  if (hint === null) return button(projectId);
  return (
    <div>
      {button(projectId)}
      <p className="mt-1.5 text-sm text-fg-faint">{hint}</p>
    </div>
  );
}
