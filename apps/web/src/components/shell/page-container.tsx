import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The page column for every /app screen, and the reason content sits still while the rail
 * moves: `.viewport-column` steps back out of the shell's `--rail` offset and centres in
 * the viewport instead. Outside the app shell `--rail` is 0 and this is simply the landing
 * page's column (`max-w-6xl px-6`).
 *
 * Screens that want a narrower measure pass it in `className`; it lands on the inner
 * column, so they stay centred too.
 */
export function PageContainer({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="viewport-column">
      {/* Tighter gutters on a phone: 48px of 360 spent on margins is a column nobody can read
          in. Written as `max-sm:` overrides so the screens that pass their own `py-*` keep it. */}
      <div
        className={cn("mx-auto w-full max-w-6xl px-6 py-10 max-sm:px-4 max-sm:py-8", className)}
        {...props}
      />
    </div>
  );
}
