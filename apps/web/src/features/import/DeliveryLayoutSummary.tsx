// How the foundation lands, as it stands (specs 187, 199).
//
// This screen used to ask the question. It no longer does: the interview asks it first, because it
// is the only answer the founder's team can see and nobody should spend ten minutes on the rest
// before learning it exists. What is left here is the answer, and the way back to change it — one
// writer, one stored value, and no second control that could disagree with the first.
import Link from "next/link";
import { EyeOff, GitMerge } from "lucide-react";
import type { DeliveryLayout } from "@airrow/schemas";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/states";

export function DeliveryLayoutSummary({
  projectId,
  delivery,
  /** True when a foundation already exists, so this choice only reaches the next generation. */
  regenerateNeeded
}: {
  projectId: string;
  delivery: DeliveryLayout;
  regenerateNeeded: boolean;
}) {
  const hidden = delivery.kind === "hidden";
  const Icon = hidden ? EyeOff : GitMerge;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-fg-faint" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg">{hidden ? "Hidden" : "Integrated"}</p>
          <p className="mt-1 text-sm text-fg-muted">
            {hidden ? (
              <>
                Everything Airrow generates goes into{" "}
                <code className="font-mono text-2xs">{delivery.folder}/</code>, which{" "}
                <code className="font-mono text-2xs">/cleanup</code> tells git to ignore. Nothing
                collides, and your repository&rsquo;s diff stays empty. No CI files are delivered: a
                workflow in an ignored folder could never run.
              </>
            ) : (
              <>
                Airrow&rsquo;s files take their own paths in your project, beside your own. Anything
                that collides with a file you already have becomes a conflict you decide. This is
                what you push, and what your team sees.
              </>
            )}
          </p>
        </div>
      </div>

      {regenerateNeeded ? (
        <Notice role="status">
          Your foundation was already generated in the layout it has now. Changing this takes effect
          the next time you generate.
        </Notice>
      ) : null}

      <Button variant="secondary" size="sm" asChild>
        <Link href={`/app/projects/${projectId}/interview`}>Change this in the interview</Link>
      </Button>
    </div>
  );
}
