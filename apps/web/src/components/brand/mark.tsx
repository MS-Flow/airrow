import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The Airrow mark — the approved artwork itself, from `docs/design/airrow-mark.png`
 * cropped to its alpha bounding box. Not a redrawn path: earlier attempts to trace it
 * changed the design, and the source is a raster render with no vector original.
 *
 * The metal is baked into the asset, so there is no colour variant. On a light
 * background the silver would disappear, so `.brand-asset` darkens it there — see
 * globals.css.
 */
export function AirrowMark({
  className,
  priority = false
}: {
  className?: string;
  /** Set on above-the-fold placements (hero, auth, splash) to avoid a late pop-in. */
  priority?: boolean;
}) {
  return (
    <Image
      src="/brand/airrow-mark.png"
      alt=""
      aria-hidden
      width={526}
      height={495}
      priority={priority}
      className={cn("brand-asset size-5 w-auto object-contain", className)}
    />
  );
}
