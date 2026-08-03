import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * An absolute day — "12 Sep 2026".
 *
 * `timeAgo`'s counterpart, for the things that have not happened yet: a renewal or a grant expiring is
 * a date on a calendar, and "in 30d" is not something anyone can act on. Pinned to UTC so the string
 * is the same on a laptop, on Vercel and in CI (§V — tests are deterministic).
 */
export function onDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(iso));
}

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
