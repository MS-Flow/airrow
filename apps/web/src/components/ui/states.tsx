import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { AirrowMark } from "@/components/brand/mark";
import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading / error / empty as real components — the constitution forbids
 * scattering them as conditionals across JSX.
 */

export function EmptyState({
  title,
  description,
  action,
  icon,
  className
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Defaults to the Airrow mark — empty space is a branding moment, not a void. */
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border border-dashed border-border bg-surface px-8 py-16 text-center",
        className
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-lg border border-border bg-surface-raised text-fg-faint">
        {icon ?? <AirrowMark className="h-5 opacity-60" />}
      </span>
      <h2 className="mt-5 text-md font-semibold text-fg">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-sm text-base leading-relaxed text-fg-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
  className
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center rounded-lg border border-danger/30 bg-danger/5 px-8 py-12 text-center",
        className
      )}
    >
      <AlertTriangle className="size-5 text-danger" />
      <h2 className="mt-4 text-md font-semibold text-fg">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-sm text-base leading-relaxed text-fg-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

/** Inline form/action error — the one-liner variant of <ErrorState>. */
export function InlineError({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      role="alert"
      className={cn(
        "rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger",
        className
      )}
    >
      {children}
    </p>
  );
}

export function LoadingState({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)} role="status" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

/** A surface that exists in the UI but has no backend yet. Never looks enabled. */
export function ComingSoon({
  title,
  description,
  className
}: {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border bg-bg-subtle px-5 py-6",
        className
      )}
    >
      <div className="flex items-center gap-2.5">
        <h3 className="text-base font-semibold text-fg-muted">{title}</h3>
        <span className="rounded-full border border-border bg-surface px-2 py-0.5 text-2xs font-medium uppercase tracking-wide text-fg-faint">
          Coming soon
        </span>
      </div>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-fg-faint">{description}</p>
    </div>
  );
}
