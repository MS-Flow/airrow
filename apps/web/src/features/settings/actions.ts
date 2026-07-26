"use server";

import { cookies } from "next/headers";
import { isTheme, THEME_COOKIE } from "@/lib/theme";

/**
 * Persist the theme choice for a year. Unknown values are ignored, not stored.
 *
 * Deliberately unauthenticated: the theme is a per-browser display preference, not
 * account state, and the header switch has to work for signed-out visitors. The only
 * thing that reaches storage is a value `isTheme` has narrowed to "dark" | "light".
 *
 * It deliberately does **not** revalidate. This only has to outlive the tab: the switch
 * flips `data-theme` on the client the moment it is clicked, so the paint is already
 * correct and the cookie is just what makes it survive a reload. Revalidating the layout
 * to repaint a CSS attribute re-ran the session check and the project list on every
 * click, which is what made the button feel slow.
 */
export async function setThemeAction(theme: string): Promise<void> {
  if (!isTheme(theme)) return;

  (await cookies()).set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax"
  });
}
