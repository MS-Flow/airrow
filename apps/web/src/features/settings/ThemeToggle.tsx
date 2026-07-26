"use client";

import { useState } from "react";
import { setThemeAction } from "./actions";
import { THEME_OPTIONS } from "./theme-options";
import type { Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * The labelled control in Settings. Like the header switch, it repaints on the client and
 * persists the cookie in the background, so the pressed state moves with the click rather
 * than after a server round trip.
 *
 * Two options only. Dark is what you get until you pick light: `readTheme()` falls back
 * to it for a missing, unrecognised or tampered cookie.
 */
export function ThemeToggle({ current }: { current: Theme }) {
  const [theme, setTheme] = useState<Theme>(current);

  return (
    <div className="flex gap-2">
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = value === theme;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => {
              document.documentElement.dataset.theme = value;
              setTheme(value);
              void setThemeAction(value);
            }}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              active
                ? "border-accent bg-accent-soft text-fg"
                : "border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg"
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
