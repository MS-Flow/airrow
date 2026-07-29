// Two things the preview has to get right, and they arrived on different branches.
//
// The rail shows the *whole* project (spec 75): what the founder brought is structure only, and
// only Airrow's files can be opened. And on a phone the tree used to be `hidden` outright, putting
// the repository out of reach (spec 31) — the drawer that replaced it is held to its job below.
// One file because it is one component: the drawer opens onto that same tagged tree.
//
// The router and the server actions are stubbed throughout; neither is what any of this is about.
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PreviewFileEntry } from "@airrow/engine";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh: vi.fn(), push: vi.fn() }),
  // No `?file=`, so the reader falls back to README.md exactly as it does in the app.
  useSearchParams: () => new URLSearchParams()
}));

// The reader asks the server to highlight code files; nothing here is a code file, but the
// module is imported at load time and must not reach a server action.
vi.mock("./actions", () => ({
  saveGeneratedFileAction: vi.fn(async () => ({})),
  highlightFileAction: vi.fn(async () => ({ html: null }))
}));

import { PreviewBrowser } from "./PreviewBrowser";

// jsdom has no scrolling of any kind; selecting a file sends both the reader (desktop) and
// the page (phone) back to the top, so both are stubbed rather than left to throw.
beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
  window.scrollTo = vi.fn();
});

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

    // Selection is client state now, not a navigation: the file is on screen without the router
    // being asked, and the URL still carries it so the link keeps working.
    expect(await screen.findByText("Context")).toBeInTheDocument();
    expect(window.location.search).toContain("file=CLAUDE.md");
    expect(replace).not.toHaveBeenCalled();
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

/* ── The drawer, on a phone ───────────────────────────────────────────────── */

const PHONE_FILES = [
  { path: "README.md", content: "# Loop CRM\n\nThe foundation." },
  { path: "docs/architecture/SYSTEM_OVERVIEW.md", content: "# System overview\n\nHow it fits." }
];

// A project started from nothing: every path is Airrow's own, so the drawer is exercised against
// the tree a founder who imported nothing actually sees.
const PHONE_ENTRIES: PreviewFileEntry[] = PHONE_FILES.map((f) => ({
  path: f.path,
  source: "airrow"
}));

const renderPreview = () =>
  render(
    <PreviewBrowser
      projectId="p1"
      files={PHONE_FILES}
      entries={PHONE_ENTRIES}
      highlightedHtml={null}
      highlightedFor={null}
    />
  );

const filesButton = () => screen.getByRole("button", { name: "Files" });
const tree = () => document.getElementById("preview-file-tree");

describe("PreviewBrowser file tree on a phone", () => {
  it("is reachable from the Files button", async () => {
    const user = userEvent.setup();
    renderPreview();

    expect(tree()).toHaveClass("max-md:-translate-x-full");
    expect(filesButton()).toHaveAttribute("aria-expanded", "false");
    expect(filesButton()).toHaveAttribute("aria-controls", "preview-file-tree");

    await user.click(filesButton());

    expect(filesButton()).toHaveAttribute("aria-expanded", "true");
    expect(tree()).toHaveClass("max-md:translate-x-0");
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("shows the file that was picked, and gets out of the way", async () => {
    const user = userEvent.setup();
    renderPreview();

    await user.click(filesButton());
    // The tree opens on the active file's folders, and README.md is at the root.
    await user.click(screen.getByRole("button", { name: "docs/" }));
    await user.click(screen.getByRole("button", { name: "architecture/" }));
    await user.click(screen.getByRole("button", { name: "SYSTEM_OVERVIEW.md" }));

    expect(screen.getByText("docs/architecture/SYSTEM_OVERVIEW.md")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "System overview" })).toBeInTheDocument();
    expect(filesButton()).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
  });

  it("closes on Escape and on the page behind it", async () => {
    const user = userEvent.setup();
    renderPreview();

    await user.click(filesButton());
    await user.keyboard("{Escape}");
    expect(filesButton()).toHaveAttribute("aria-expanded", "false");

    await user.click(filesButton());
    await user.click(screen.getByRole("button", { name: "Close file tree" }));
    expect(filesButton()).toHaveAttribute("aria-expanded", "false");
  });
});
