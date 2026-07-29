// What a free organization gets from an import: the whole analysis, and an honest wall (spec 74).
//
// The analysis runs locally and makes no Claude call, so showing it costs Airrow nothing — and it is
// the moment a founder with an existing repository learns that Airrow read their code rather than
// guessing at it. Charging before that would be asking them to buy blind, so the wall stands here,
// after the result and before the project.
//
// Deliberately not an error: nothing failed. It borrows neither the danger tone nor `role="alert"`,
// because a limit dressed as a failure teaches founders to dismiss both.
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { AnalysisEvidence, AnalysisNotes } from "./AnalysisEvidence";
import type { ImportPreview } from "./actions";

export function ProPreview({ preview }: { preview: ImportPreview }) {
  return (
    <div role="status" className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>What Airrow worked out</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <p className="px-5 pb-1 pt-4 text-sm text-fg-muted">
            Read from <span className="font-mono text-sm text-fg">{preview.originalName}</span> —{" "}
            {preview.filesAnalyzed} files analysed, {preview.filesIgnored} skipped.
          </p>
          <AnalysisEvidence evidence={preview.evidence} />
        </CardBody>
      </Card>

      <AnalysisNotes notes={preview.notes} />

      <div className="rounded-lg border border-accent/30 bg-accent/5 px-5 py-4">
        <h3 className="text-base font-semibold text-fg">Keep this as a project with Pro</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">
          Importing an existing project is part of Pro, along with unlimited foundations.
        </p>
        <p className="mt-3 text-sm text-fg-faint">
          Nothing was saved — your files were read in this request and never stored.{" "}
          <Link
            href="/app/projects/new"
            className="text-fg-muted underline underline-offset-4 hover:text-fg"
          >
            Start a new project instead
          </Link>
          .
        </p>
        {/* Settings owns the upgrade, because it is the screen that knows whether payment is
            configured on this deployment (spec 99). Linking there beats a second checkout button
            that has to duplicate that judgement. */}
        <Button size="sm" className="mt-4" asChild>
          <Link href="/app/settings">Upgrade to Pro</Link>
        </Button>
      </div>
    </div>
  );
}
