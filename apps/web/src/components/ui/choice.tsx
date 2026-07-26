"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import * as RadioPrimitive from "@radix-ui/react-radio-group";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const box =
  "flex size-4 shrink-0 cursor-pointer items-center justify-center rounded border border-border-strong transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-fg data-[state=checked]:bg-fg data-[state=checked]:text-bg";

export function Checkbox({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root className={cn(box, className)} {...props}>
      <CheckboxPrimitive.Indicator>
        <Check className="size-3" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export const RadioGroup = RadioPrimitive.Root;

export function RadioItem({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadioPrimitive.Item>) {
  return (
    <RadioPrimitive.Item className={cn(box, "rounded-full", className)} {...props}>
      <RadioPrimitive.Indicator className="size-1.5 rounded-full bg-bg" />
    </RadioPrimitive.Item>
  );
}
