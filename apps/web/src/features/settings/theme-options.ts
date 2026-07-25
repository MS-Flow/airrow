import { Moon, Sun } from "lucide-react";
import type { Theme } from "@/lib/theme";

/**
 * The themes on offer, shared by the labelled control in Settings and the compact
 * switch in the headers — so the two can never drift apart.
 */
export const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun }
];

/** The theme a click should move to — with two options, simply the other one. */
export function nextTheme(current: Theme): Theme {
  return current === "dark" ? "light" : "dark";
}
