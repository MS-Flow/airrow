import type * as React from "react";

/**
 * Reserved dock for the future repository-aware AI assistant (issue #19: "leave
 * room for a future AI chat"). It renders nothing today — the shell simply keeps
 * the column, so adding the panel later is a change of one file, not a re-layout.
 */
export function ChatSlot({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <aside
      aria-label="Assistant"
      className="hidden w-96 shrink-0 border-l border-border bg-bg-subtle xl:block"
    >
      {children}
    </aside>
  );
}
