import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "accent" | "info" | "success" | "danger";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface-raised text-fg-muted border-border",
  accent: "bg-accent-soft text-fg border-border-strong",
  info: "bg-info/10 text-info border-info/25",
  success: "bg-success/10 text-success border-success/25",
  danger: "bg-danger/10 text-danger border-danger/25"
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}
