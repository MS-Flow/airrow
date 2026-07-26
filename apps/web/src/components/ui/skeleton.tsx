import { cn } from "@/lib/utils";

/** Shimmering placeholder. Collapses to a flat block under prefers-reduced-motion. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("shimmer rounded-md", className)} />;
}

/** A stack of skeleton rows — the default loading state for lists. */
export function SkeletonList({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}
