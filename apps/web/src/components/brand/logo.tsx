import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Mark + wordmark, the approved lockup — the artwork from
 * `docs/design/airrow-lockup.png`, cropped to its alpha bounding box. The wordmark is
 * part of the asset rather than set as type, so the letterforms and tracking are the
 * designed ones.
 */
export function AirrowLogo({
  className,
  size = "sm",
  priority = false
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  priority?: boolean;
}) {
  // `lg` steps down on a phone: at `h-10` the lockup is ~151px wide, which is half of a
  // 360px header before the theme switch and the actions beside it have asked for anything.
  const height = { sm: "h-5", md: "h-7", lg: "h-7 sm:h-10" }[size];

  return (
    <Image
      src="/brand/airrow-lockup.png"
      alt="Airrow"
      width={1135}
      height={301}
      priority={priority}
      className={cn("brand-asset w-auto object-contain", height, className)}
    />
  );
}
