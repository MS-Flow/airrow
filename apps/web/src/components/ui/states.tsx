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

/**
 * An advisory the founder should read before acting, or a consequence worth knowing
 * about after. Deliberately *not* an error: nothing has failed, so it never carries
 * `role="alert"` and never borrows the danger tone — a caution that looks like a
 * failure teaches founders to dismiss both.
 */
export function Notice({
  title,
  children,
  role,
  className
}: {
  title?: string;
  children: React.ReactNode;
  /**
   * Set only when the notice appears in response to something the founder just did,
   * which a screen reader should hear. Standing advisories are read in page order
   * and stay silent.
   */
  role?: "status";
  className?: string;
}) {
  return (
    <div
      role={role}
      className={cn(
        "flex gap-3 rounded-lg border border-warn/30 bg-warn/5 px-4 py-3.5",
        className
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
      <div className="min-w-0">
        {title ? <h3 className="text-base font-semibold text-fg">{title}</h3> : null}
        <div className={cn("text-sm leading-relaxed text-fg-muted", title && "mt-1.5")}>
          {children}
        </div>
      </div>
    </div>
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

/**
 * A limit met, and the way past it (spec 100).
 *
 * Deliberately its own tone. It is not an error — nothing failed, and borrowing the danger colour
 * would teach founders that hitting a plan boundary and losing work look the same. It is not a
 * `Notice` either: that carries the warn tone for "read this before you act", and running out of
 * free foundations is neither a caution nor a mistake. It is a price.
 *
 * Extracted because the same panel had been hand-rolled in three places — the import screen, the
 * import result and the end of the interview — with identical classes and identical meaning.
 */
export function UpgradeNotice({
  title,
  children,
  action,
  role,
  className
}: {
  title?: string;
  children: React.ReactNode;
  /** The way on. Optional, because one of these appears where the CTA is already on screen. */
  action?: React.ReactNode;
  /** Set when the panel appears in response to something the founder just did. */
  role?: "status";
  className?: string;
}) {
  return (
    <div
      role={role}
      className={cn("rounded-lg border border-accent/30 bg-accent/5 px-5 py-4", className)}
    >
      {title ? <h3 className="text-base font-semibold text-fg">{title}</h3> : null}
      <div className={cn("text-sm leading-relaxed text-fg-muted", title && "mt-1.5")}>
        {children}
      </div>
      {action ? <div className="mt-4">{action}</div> : null}
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
