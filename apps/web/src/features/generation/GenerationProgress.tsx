"use client";

// Live generation progress (F-401 FR-3): staged checklist + authored-file ticker.
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { JobStage } from "@arrow/schemas";
import { Button, Card, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";
import { retryGenerationAction } from "./actions";

interface JobView {
  status: "queued" | "running" | "completed" | "failed";
  stage: JobStage | null;
  stagesDone: JobStage[];
  filesAuthored: number;
  totalFiles: number;
  currentPath: string | null;
  error: string | null;
}

const stageLabels: Array<{ id: JobStage; label: string; detail: string }> = [
  { id: "resolve", label: "Resolving project model", detail: "Turning your answers into engineering decisions" },
  { id: "author", label: "Authoring documents", detail: "Architecture, specs, standards, AI context" },
  { id: "assemble", label: "Assembling repository", detail: "Folder structure and cross-references" },
  { id: "validate", label: "Validating completeness", detail: "Every required document, no gaps" },
  { id: "manifest", label: "Writing manifest", detail: "Per-file provenance for future regeneration" }
];

export function GenerationProgress({ projectId, projectName }: { projectId: string; projectName: string }) {
  const router = useRouter();
  const [job, setJob] = useState<JobView | null>(null);
  const [retrying, startRetry] = useTransition();
  const [retryError, setRetryError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/job`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { job: JobView | null };
        if (!active || !data.job) return;
        setJob(data.job);
        if (data.job.status === "completed" && !done.current) {
          done.current = true;
          setTimeout(() => router.push(`/app/projects/${projectId}/preview`), 900);
        }
      } catch {
        /* transient poll failure — next tick retries */
      }
    };
    void poll();
    const t = setInterval(poll, 1000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [projectId, router]);

  const failed = job?.status === "failed";

  return (
    <div className="mx-auto max-w-xl px-8 py-16">
      <p className="font-mono text-xs text-accent">Generating</p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-fg">
        Building {projectName}&apos;s foundation
      </h1>
      <p className="mt-1.5 text-sm text-fg-muted">
        {failed ? "Something went wrong." : "This takes under a minute. Worth watching."}
      </p>

      <Card className="mt-8 divide-y divide-border">
        {stageLabels.map((s) => {
          const isDone = job?.stagesDone.includes(s.id) ?? false;
          const isCurrent = job?.stage === s.id && job.status === "running";
          return (
            <div key={s.id} className="flex items-center gap-4 px-5 py-4">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border",
                  isDone
                    ? "border-success/40 bg-success/15 text-success"
                    : isCurrent
                      ? "border-accent text-accent"
                      : "border-border text-fg-faint"
                )}
              >
                {isDone ? <Check className="size-3.5" /> : isCurrent ? <Spinner className="size-3.5 border-accent/30 border-t-accent" /> : null}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", isDone || isCurrent ? "text-fg" : "text-fg-faint")}>
                  {s.label}
                  {s.id === "author" && (isCurrent || isDone) && job && job.totalFiles > 0 ? (
                    <span className="ml-2 font-mono text-xs text-fg-muted">
                      {job.filesAuthored}/{job.totalFiles}
                    </span>
                  ) : null}
                </p>
                {isCurrent && s.id === "author" && job?.currentPath ? (
                  <p className="mt-0.5 truncate font-mono text-xs text-fg-muted">{job.currentPath}</p>
                ) : (
                  <p className={cn("mt-0.5 text-[13px]", isCurrent ? "text-fg-muted" : "text-fg-faint")}>
                    {s.detail}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      {failed ? (
        <div className="mt-6">
          <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
            {job?.error ?? "Generation failed."}
          </p>
          {retryError ? <p className="mt-2 text-[13px] text-danger">{retryError}</p> : null}
          <div className="mt-4 flex justify-end">
            <Button
              disabled={retrying}
              onClick={() =>
                startRetry(async () => {
                  const res = await retryGenerationAction(projectId);
                  if (res?.error) setRetryError(res.error);
                })
              }
            >
              {retrying ? "Retrying…" : "Retry generation"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
