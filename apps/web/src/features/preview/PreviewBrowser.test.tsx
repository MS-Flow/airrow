// The preview is where a founder decides whether the foundation is any good, and on a phone
// the file tree used to be `hidden` outright — the repository was unreachable (spec 31).
// These tests hold the drawer that replaced it to its job.
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams()
}));

// The reader asks the server to highlight code files; nothing here is a code file, but the
// module is imported at load time and must not reach a server action.
vi.mock("./actions", () => ({
  highlightFileAction: vi.fn(async () => ({ html: null })),
  saveGeneratedFileAction: vi.fn(async () => ({}))
}));

import { PreviewBrowser } from "./PreviewBrowser";

const FILES = [
  { path: "README.md", content: "# Loop CRM\n\nThe foundation." },
  { path: "docs/architecture/SYSTEM_OVERVIEW.md", content: "# System overview\n\nHow it fits." }
];

function renderPreview() {
  return render(
    <PreviewBrowser projectId="p1" files={FILES} highlightedHtml={null} highlightedFor={null} />
  );
}

const filesButton = () => screen.getByRole("button", { name: "Files" });
const tree = () => document.getElementById("preview-file-tree");

// jsdom has no scrolling of any kind; selecting a file sends both the reader (desktop) and
// the page (phone) back to the top, so both are stubbed rather than left to throw.
beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
  window.scrollTo = vi.fn();
});

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
