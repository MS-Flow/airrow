"use client";

import * as React from "react";

/**
 * What an overlay drawer owes the page underneath it: Escape closes it, and the page does
 * not scroll while it is open. Neither is optional on a phone — the drawers have no close
 * button of their own, and a page that keeps scrolling behind a scrim reads as broken.
 *
 * Shared by the app's navigation drawer and the preview's file tree, which is why it lives
 * here rather than being written twice. The lock is released on unmount, so a drawer that
 * is open when its screen navigates away cannot leave the body stuck.
 */
export function useOverlay({ open, onDismiss }: { open: boolean; onDismiss: () => void }): void {
  React.useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onDismiss]);
}
