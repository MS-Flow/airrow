import { guestDraftSchema, type GuestDraft } from "./draft-schema";

const STORAGE_KEY = "airrow-guest-interview";

/**
 * The signed-out interview lives in `localStorage` until an authenticated user claims
 * it. Nothing is written server-side before then, so there is no orgless row and no
 * unauthenticated write endpoint (constitution §II).
 *
 * The cost is honest: a draft is per-browser. Clearing site data or switching device
 * loses it, which is why `storageAvailable()` exists — the UI warns rather than
 * failing silently.
 */

export function storageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const probe = "__airrow_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    // Private mode, blocked storage, or a full quota — all mean "no draft here".
    return false;
  }
}

/** The stored draft, or null when absent, unreadable, or written by an older version. */
export function readDraft(): GuestDraft | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    clearDraft();
    return null;
  }

  const result = guestDraftSchema.safeParse(parsed);
  if (!result.success) {
    // Stale or tampered — drop it rather than leaving it to fail again on every load.
    clearDraft();
    return null;
  }
  return result.data;
}

/** Returns false when storage is unavailable, so callers can warn instead of pretending. */
export function writeDraft(draft: GuestDraft): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing useful to do — the draft is unreachable either way.
  }
}
