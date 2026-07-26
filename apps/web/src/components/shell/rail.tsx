"use client";

import * as React from "react";

/**
 * How much horizontal space the left rail claims, shared by everything that has to react
 * to it. The rail itself, the top bar and full-bleed screens shift with it; centred page
 * content deliberately does not, which is why the width lives in a CSS variable rather
 * than in each screen's layout (see `PageContainer`).
 *
 * `--rail` is 0 outside this provider and below `md`, where the rail is an overlay
 * drawer — see `globals.css`.
 */
const RailContext = React.createContext<{ collapsed: boolean; toggle: () => void } | null>(null);

export function useRail(): { collapsed: boolean; toggle: () => void } {
  const value = React.useContext(RailContext);
  if (!value) throw new Error("useRail must be used inside <RailProvider>.");
  return value;
}

export function RailProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const toggle = React.useCallback(() => setCollapsed((v) => !v), []);
  const value = React.useMemo(() => ({ collapsed, toggle }), [collapsed, toggle]);

  return (
    <RailContext.Provider value={value}>
      <div
        className="app-shell flex min-h-screen bg-bg"
        // Matches the rail's own `w-16` / `w-52`.
        style={{ "--rail-width": collapsed ? "4rem" : "13rem" } as React.CSSProperties}
      >
        {children}
      </div>
    </RailContext.Provider>
  );
}
