import * as React from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-md border border-border-strong bg-bg-subtle text-base text-fg placeholder:text-fg-faint transition-colors focus:border-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

// `ComponentPropsWithRef` rather than `InputHTMLAttributes` so callers can hold the element: the signup
// password fields drive native constraint validation, which is set on the node itself (spec 140).
export function Input({ className, ...props }: React.ComponentPropsWithRef<"input">) {
  return <input className={cn(field, "h-10 px-3", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, "resize-none px-3 py-2.5", className)} {...props} />;
}
