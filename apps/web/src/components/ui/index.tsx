// Airrow UI kit — shadcn-style primitives on design tokens (F-201 FR-3).
import * as React from "react";
import { cn } from "@/lib/utils";

/* ── Button ─────────────────────────────────────────────────────────────── */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-fg text-bg hover:bg-fg/90 font-medium",
  secondary: "bg-surface border border-border-strong text-fg hover:bg-surface-raised",
  ghost: "text-fg-muted hover:text-fg hover:bg-surface",
  danger: "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20"
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-5 text-sm"
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent cursor-pointer",
        buttonVariants[variant],
        buttonSizes[size],
        className
      )}
      {...props}
    />
  );
}

/* ── Card ───────────────────────────────────────────────────────────────── */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-surface", className)}
      {...props}
    />
  );
}

/* ── Inputs ─────────────────────────────────────────────────────────────── */

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-border-strong bg-bg-subtle px-3 text-sm text-fg placeholder:text-fg-faint transition-colors focus:border-accent focus:outline-none",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-md border border-border-strong bg-bg-subtle px-3 py-2.5 text-sm text-fg placeholder:text-fg-faint transition-colors focus:border-accent focus:outline-none resize-none",
        className
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("mb-1.5 block text-[13px] font-medium text-fg-muted", className)} {...props} />
  );
}

/* ── Badge ──────────────────────────────────────────────────────────────── */

type BadgeTone = "neutral" | "accent" | "success" | "danger";

const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-surface-raised text-fg-muted border-border",
  accent: "bg-accent-muted text-accent border-accent/30",
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
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        badgeTones[tone],
        className
      )}
      {...props}
    />
  );
}

/* ── Misc ───────────────────────────────────────────────────────────────── */

export function Separator({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-border", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "size-4 animate-spin rounded-full border-2 border-border-strong border-t-fg",
        className
      )}
    />
  );
}

/** Airrow product mark. */
export function AirrowMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-5", className)} aria-hidden>
      <path
        d="M4 20 L20 4 M20 4 H10 M20 4 V14"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
