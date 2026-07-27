// The rail shows the whole project (spec 75): what the founder brought is structure only, and only
// Airrow's files can be opened. The router and the save action are stubbed — this is about the tree.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PreviewFileEntry } from "@airrow/engine";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
  // No `?file=`, so the reader falls back to README.md exactly as it does in the app.
  useSearchParams: () => new URLSearchParams()
}));
vi.mock("./actions", () => ({ saveGeneratedFileAction: vi.fn() }));

import { PreviewBrowser } from "./PreviewBrowser";

const files = [
  { path: "README.md", content: "# Airrow's readme" },
  { path: "CLAUDE.md", content: "# Context" }
];

const entries: PreviewFileEntry[] = [
  { path: "CLAUDE.md", source: "airrow" },
  { path: "package.json", source: "yours" },
  { path: "README.md", source: "conflict_keeps_yours" },
  { path: "src/app.ts", source: "yours" }
];

function renderRail(overrides: Partial<Parameters<typeof PreviewBrowser>[0]> = {}) {
  return render(
    <PreviewBrowser
      projectId="p1"
      files={files}
      entries={entries}
      highlightedHtml={null}
      highlightedFor={null}
      {...overrides}
    />
  );
}

describe("PreviewBrowser rail", () => {
  it("lists the founder's files alongside Airrow's, in one tree", () => {
    renderRail();
    expect(screen.getByText("package.json")).toBeInTheDocument();
    expect(screen.getByText("CLAUDE.md")).toBeInTheDocument();
    expect(screen.getByText("src/")).toBeInTheDocument();
  });

  it("never makes the founder's files clickable, and says why", () => {
    renderRail();
    expect(screen.queryByRole("button", { name: /package\.json/ })).not.toBeInTheDocument();
    expect(screen.getByText(/stored the structure, never the contents/)).toBeInTheDocument();
  });

  it("marks whose each of the founder's files is, rather than leaning on the dimming alone", () => {
    renderRail();
    // Only the root one renders — their other file sits inside `src/`, which starts collapsed.
    expect(screen.getAllByText("yours")).toHaveLength(1);
    expect(screen.getByText("package.json").parentElement).toHaveTextContent("yours");
  });

  it("opens Airrow's files as before", async () => {
    const user = userEvent.setup();
    renderRail();

    await user.click(screen.getByRole("button", { name: /CLAUDE\.md/ }));

    expect(replace).toHaveBeenCalledWith("?file=CLAUDE.md", { scroll: false });
  });

  it("filters the founder's files out when 'Show my project' is switched off", async () => {
    const user = userEvent.setup();
    renderRail();

    await user.click(screen.getByRole("button", { name: /Show my project/ }));

    expect(screen.queryByText("package.json")).not.toBeInTheDocument();
    // The directory holding only their files goes with them.
    expect(screen.queryByText("src/")).not.toBeInTheDocument();
    expect(screen.getByText("CLAUDE.md")).toBeInTheDocument();
  });

  it("has no toggle and no notice for a project that was never imported", () => {
    renderRail({ entries: entries.filter((e) => e.source === "airrow") });
    expect(screen.queryByRole("button", { name: /Show my project/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/stored the structure, never the contents/)).not.toBeInTheDocument();
  });

  it("opens a conflicting file on Airrow's version, stating what the download will do", () => {
    renderRail();
    // README.md is the default active file, and it is the conflicting one here.
    expect(screen.getByText(/Airrow's readme/)).toBeInTheDocument();
    expect(screen.getByText(/your version is kept in the download/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Change that" })).toHaveAttribute(
      "href",
      "/app/projects/p1/import"
    );
  });

  it("says Airrow's version wins once the founder has picked it", () => {
    renderRail({
      entries: entries.map((e) =>
        e.path === "README.md" ? { ...e, source: "conflict_takes_airrow" } : e
      )
    });
    expect(screen.getByText(/replaces yours in the download/)).toBeInTheDocument();
  });
});
