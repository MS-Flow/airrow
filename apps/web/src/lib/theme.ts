import { cookies } from "next/headers";

export const THEME_COOKIE = "airrow-theme";

export type Theme = "dark" | "light";

export function isTheme(value: string | undefined): value is Theme {
  return value === "dark" || value === "light";
}

/**
 * The active theme, read server-side so the correct one is in the HTML on first
 * paint. Anything unrecognised (missing, tampered, stale) falls back to dark.
 */
export async function readTheme(): Promise<Theme> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(value) ? value : "dark";
}
