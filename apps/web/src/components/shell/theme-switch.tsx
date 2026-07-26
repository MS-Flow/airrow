import { setThemeAction } from "@/features/settings/actions";
import { nextTheme, THEME_OPTIONS } from "@/features/settings/theme-options";
import type { Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Compact theme switch for the headers — a single button that flips to the other
 * theme, showing the icon of where you'd land. Settings keeps the labelled control.
 *
 * A plain form posting to a server action: no client JS, and because the cookie is
 * read server-side in the root layout the next paint is already correct. The action
 * is unauthenticated by design, so this works signed out.
 */
export function ThemeSwitch({ current, className }: { current: Theme; className?: string }) {
  const target = nextTheme(current);
  const option = THEME_OPTIONS.find((o) => o.value === target);
  if (!option) return null;
  const Icon = option.icon;

  return (
    <form action={setThemeAction} className={className}>
      <input type="hidden" name="theme" value={target} />
      <button
        type="submit"
        title={`Switch to ${option.label.toLowerCase()} theme`}
        aria-label={`Switch to ${option.label.toLowerCase()} theme`}
        className={cn(
          "flex cursor-pointer items-center justify-center rounded-md p-2 text-fg-muted transition-colors",
          "hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        )}
      >
        <Icon className="size-4.5" />
      </button>
    </form>
  );
}
