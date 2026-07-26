import { setThemeAction } from "./actions";
import { THEME_OPTIONS } from "./theme-options";
import type { Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * A form per option — the theme is a cookie set by a server action, so the next
 * render already has the right theme and there is no client-side flash.
 *
 * Two options only. Dark is what you get until you pick light: `readTheme()` falls back
 * to it for a missing, unrecognised or tampered cookie.
 */
export function ThemeToggle({ current }: { current: Theme }) {
  return (
    <div className="flex gap-2">
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = value === current;
        return (
          <form key={value} action={setThemeAction}>
            <input type="hidden" name="theme" value={value} />
            <button
              type="submit"
              aria-pressed={active}
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
          </form>
        );
      })}
    </div>
  );
}
