import { AirrowMark } from "./mark";
import { cn } from "@/lib/utils";

/**
 * Full-bleed loading/splash screen — the mark in metal, breathing. Used by
 * route-level `loading.tsx` files so a slow navigation still feels like Airrow.
 *
 * `.viewport-column` centres it on the viewport rather than on the space beside the app
 * rail, so a navigation that starts while the rail is animating doesn't drift.
 */
export function BrandSplash({ label, className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn(
        "viewport-column flex min-h-[60vh] flex-col items-center justify-center gap-6",
        className
      )}
    >
      <AirrowMark priority className="h-12 animate-blur-in" />
      {label ? <p className="animate-fade-in text-sm text-fg-muted">{label}</p> : null}
    </div>
  );
}
