"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isTheme, THEME_COOKIE } from "@/lib/theme";
import { requireSession } from "@/lib/auth";

/** Persist the theme choice for a year. Unknown values are ignored, not stored. */
export async function setThemeAction(formData: FormData): Promise<void> {
  await requireSession();
  const next = formData.get("theme");
  if (typeof next !== "string" || !isTheme(next)) return;

  (await cookies()).set(THEME_COOKIE, next, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax"
  });
  revalidatePath("/", "layout");
}
