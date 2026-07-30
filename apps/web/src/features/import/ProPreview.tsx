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
import { UpgradeNotice } from "@/components/ui/states";
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

      <UpgradeNotice
        title="Keep this as a project with Pro"
        action={
          /* The upgrade screen owns this, because it is what knows whether payment is configured on
             this deployment (spec 99/100). A second checkout button here would duplicate that
             judgement and eventually disagree with it. */
          <Button size="sm" asChild>
            <Link href="/app/upgrade">See what Pro gives</Link>
          </Button>
        }
      >
        Importing an existing project is part of Pro, along with unlimited foundations.
        <p className="mt-3 text-fg-faint">
          Nothing was saved — your files were read in this request and never stored.{" "}
          <Link
            href="/app/projects/new"
            className="text-fg-muted underline underline-offset-4 hover:text-fg"
          >
            Start a new project instead
          </Link>
          .
        </p>
      </UpgradeNotice>
    </div>
  );
}
