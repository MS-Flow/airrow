import { ArrowRight } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { SECTIONS } from "./copy";
import type { Foundation } from "./foundation";

/**
 * The method, shown rather than asserted: the loop an issue travels through, then the
 * handful of files that make it hold. Presentational only, and deliberately partial —
 * the rest of the scaffold is there to be found after signing up.
 */
export function SpecDrivenShowcase({ foundation }: { foundation: Foundation }) {
  const { loopTitle, loopNote, structureTitle, moreSuffix } = SECTIONS.specDriven;
  const remaining = foundation.fileCount - foundation.highlights.length;

  return (
    <div className="mt-14 grid gap-10">
      <div>
        <h3 className="text-base font-semibold text-fg">{loopTitle}</h3>
        <ol className="mt-4 grid gap-3 md:grid-cols-4">
          {foundation.loop.map((step, i) => (
            <li key={step.name} className="relative">
              <Card interactive className="h-full">
                <CardBody className="p-5">
                  <code className="font-mono text-xs text-fg">/{step.name}</code>
                  <p className="mt-2 text-sm leading-relaxed text-fg-muted">{step.description}</p>
                </CardBody>
              </Card>
              {i < foundation.loop.length - 1 && (
                <ArrowRight
                  aria-hidden
                  className="absolute top-1/2 -right-3 hidden size-3.5 -translate-y-1/2 text-fg-faint md:block"
                />
              )}
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-fg-muted">{loopNote}</p>
      </div>

      <div>
        <h3 className="text-base font-semibold text-fg">{structureTitle}</h3>
        <ul className="mt-4 grid gap-px overflow-hidden rounded-lg border border-border bg-border">
          {foundation.highlights.map((file) => (
            <li key={file.path} className="grid gap-1 bg-surface px-5 py-4 sm:grid-cols-2 sm:gap-6">
              <code className="overflow-x-auto font-mono text-xs whitespace-nowrap text-fg">
                {file.path}
              </code>
              <span className="text-sm leading-relaxed text-fg-muted">{file.reason}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 font-mono text-xs text-fg-faint">
          + {remaining} {moreSuffix}
        </p>
      </div>
    </div>
  );
}
