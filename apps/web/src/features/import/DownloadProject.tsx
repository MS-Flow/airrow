// The download button, in the one place that knows whether a project was imported (spec 68).
//
// A project built from scratch downloads what Airrow generated — a plain link, no JavaScript. An
// imported project must never hand back only Airrow's additions dressed up as the whole project,
// so it goes through the browser-side merge instead.
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getImportSource, listImportFiles } from "@/lib/data/store";
import { MergedDownload } from "./MergedDownload";

export async function DownloadProject({
  projectId,
  slug
}: {
  projectId: string;
  slug: string;
}) {
  const source = await getImportSource(projectId);
  if (source === null) {
    return (
      <Button variant="secondary" asChild>
        <a href={`/api/projects/${projectId}/zip`}>
          <Download className="size-4" />
          Download project
        </a>
      </Button>
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
