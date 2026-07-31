import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  /**
   * Colour of the filled part. Defaults to `bg-accent` — progress usually means one thing getting
   * closer to done, and one colour says that.
   *
   * A bar that *judges* what it measures needs more than one: the password meter reads danger → warn →
   * accent → success as the password improves (spec 140). `className` cannot express this, since it
   * reaches the track rather than the fill.
   */
  indicatorClassName?: string;
}

export function Progress({ value, className, indicatorClassName, ...props }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, value ?? 0));
  return (
    <ProgressPrimitive.Root
      value={pct}
      className={cn("h-1 w-full overflow-hidden rounded-full bg-surface-raised", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn(
          "h-full transition-transform duration-500 ease-out-quart",
          indicatorClassName ?? "bg-accent"
        )}
        style={{ transform: `translateX(-${100 - pct}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
