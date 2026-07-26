"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isTheme, THEME_COOKIE } from "@/lib/theme";

/**
 * Persist the theme choice for a year. Unknown values are ignored, not stored.
 *
 * Deliberately unauthenticated: the theme is a per-browser display preference, not
 * account state, and the header switch has to work for signed-out visitors. The only
 * thing that reaches storage is a value `isTheme` has narrowed to "dark" | "light".
 */
export async function setThemeAction(formData: FormData): Promise<void> {
  const next = formData.get("theme");
  if (typeof next !== "string" || !isTheme(next)) return;

  (await cookies()).set(THEME_COOKIE, next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax"
  });
  revalidatePath("/", "layout");
}
