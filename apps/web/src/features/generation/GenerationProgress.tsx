"use client";

// Live generation progress: the five stages the engine emits, as a large
// animated visualisation rather than a spinner.
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { JobStage } from "@airrow/schemas";
import { AirrowMark } from "@/components/brand/mark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { InlineError } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { JOB_STAGES, JOB_STAGE_COUNT } from "./stages";
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

export function GenerationProgress({
  projectId,
  projectName
}: {
  projectId: string;
  projectName: string;
}) {
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
  const percent = job ? (job.stagesDone.length / JOB_STAGE_COUNT) * 100 : 0;

  return (
    <div className="mx-auto max-w-2xl px-6 py-16 md:px-8">
      <div className="flex flex-col items-center text-center">
        <span
          className={cn(
            "flex size-20 items-center justify-center rounded-2xl border border-border bg-surface shadow-e2",
            !failed && "animate-blur-in"
          )}
        >
          <AirrowMark className={cn("h-9", failed && "opacity-40 saturate-0")} />
        </span>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-fg">
          {failed ? "Generation stopped" : `Building ${projectName}'s foundation`}
        </h1>
        <p className="mt-2 text-base text-fg-muted">
          {failed
            ? "Nothing was written. Review the error and retry."
            : "This takes under a minute. Worth watching."}
        </p>
        <Progress
          value={percent}
          aria-label="Generation progress"
          className="mt-8 w-full max-w-sm"
        />
      </div>

      <Card className="mt-10 divide-y divide-border">
        {JOB_STAGES.map((s) => {
          const isDone = job?.stagesDone.includes(s.id) ?? false;
          const isCurrent = job?.stage === s.id && job.status === "running";
          const isFailedHere = failed && job?.stage === s.id;
          return (
            <div key={s.id} className="flex items-center gap-4 px-5 py-4">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                  isFailedHere
                    ? "border-danger/50 bg-danger/15 text-danger"
                    : isDone
                      ? "border-success/40 bg-success/15 text-success"
                      : isCurrent
                        ? "border-accent text-fg"
                        : "border-border text-fg-faint"
                )}
              >
                {isDone ? (
                  <Check className="size-3.5" />
                ) : isCurrent ? (
                  <Spinner className="size-3.5 border-border-strong border-t-fg" />
                ) : null}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-base font-medium",
                    isDone || isCurrent ? "text-fg" : "text-fg-faint"
                  )}
                >
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
                  <p className={cn("mt-0.5 text-sm", isCurrent ? "text-fg-muted" : "text-fg-faint")}>
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
          <InlineError>{job?.error ?? "Generation failed."}</InlineError>
          {retryError ? <InlineError className="mt-2">{retryError}</InlineError> : null}
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
