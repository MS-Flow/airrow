"use client";

import { useState } from "react";
import { setThemeAction } from "@/features/settings/actions";
import { nextTheme, THEME_OPTIONS } from "@/features/settings/theme-options";
import type { Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Compact theme switch for the headers — a single button that flips to the other
 * theme, showing the icon of where you'd land. Settings keeps the labelled control.
 *
 * The swap happens on the client, against `data-theme` on <html>, which is the only
 * thing the stylesheet reads. `current` still comes from the cookie server-side, so the
 * first paint is right and there is no flash; the action then persists the choice
 * without revalidating anything. Round-tripping the whole layout to repaint an attribute
 * is what made this button lag.
 */
export function ThemeSwitch({ current, className }: { current: Theme; className?: string }) {
  const [theme, setTheme] = useState<Theme>(current);
  const target = nextTheme(theme);
  const option = THEME_OPTIONS.find((o) => o.value === target);
  if (!option) return null;
  const Icon = option.icon;

  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.dataset.theme = target;
        setTheme(target);
        void setThemeAction(target);
      }}
      title={`Switch to ${option.label.toLowerCase()} theme`}
      aria-label={`Switch to ${option.label.toLowerCase()} theme`}
      className={cn(
        "flex cursor-pointer items-center justify-center rounded-md p-2 text-fg-muted transition-colors",
        "hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className
      )}
    >
      <Icon className="size-4.5" />
    </button>
  );
}
