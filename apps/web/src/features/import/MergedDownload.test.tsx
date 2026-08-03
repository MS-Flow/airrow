// The download button must never be a dead click. When this browser has no cached archive, pressing
// it opens the file picker on that same gesture — the bug this covers was a first press that only
// spawned a second button and left the founder reading a paragraph in a header row.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "@/components/ui/toast";

const hasCachedArchive = vi.hoisted(() => vi.fn());
const readCachedArchive = vi.hoisted(() => vi.fn());
vi.mock("./archive-cache", () => ({ hasCachedArchive, readCachedArchive }));

import { MergedDownload } from "./MergedDownload";

function renderButton() {
  return render(
    <Toaster>
      <MergedDownload projectId="p1" slug="loop-crm" expectedPaths={["README.md"]} />
    </Toaster>
  );
}

const downloadButton = () => screen.getByRole("button", { name: /Download project/ });

describe("MergedDownload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the file picker on the first click when this browser has no archive", async () => {
    hasCachedArchive.mockResolvedValue(false);
    const user = userEvent.setup();
    renderButton();
    await waitFor(() => expect(downloadButton()).toBeEnabled());

    const picker = document.querySelector<HTMLInputElement>('input[type="file"]');
    const opened = vi.fn();
    picker?.addEventListener("click", opened);

    await user.click(downloadButton());

    expect(opened).toHaveBeenCalledOnce();
    // And it says why, rather than opening a bare dialog.
    //
    // `getAllBy`, not `getBy`: Radix Toast renders the message twice on purpose — once visibly and
    // once into an `aria-live` region for screen readers — and it populates that region on a timer.
    // A `getBy` here therefore passed or threw "found multiple elements" depending on whether the
    // assertion won the race, which is the intermittent failure this file had. Both copies are
    // correct; asserting on one of them is what was wrong.
    expect(screen.getAllByText(/choose the archive you imported/i).length).toBeGreaterThan(0);
  });

  it("does not ask for a file when the archive is already cached", async () => {
    hasCachedArchive.mockResolvedValue(true);
    readCachedArchive.mockResolvedValue(null); // Fails past this point; the picker must stay shut.
    const user = userEvent.setup();
    renderButton();
    await waitFor(() => expect(downloadButton()).toBeEnabled());

    const picker = document.querySelector<HTMLInputElement>('input[type="file"]');
    const opened = vi.fn();
    picker?.addEventListener("click", opened);

    await user.click(downloadButton());

    expect(opened).not.toHaveBeenCalled();
    expect(readCachedArchive).toHaveBeenCalledWith("p1");
  });

  it("stays one control — no second button, no paragraph in the header row", async () => {
    hasCachedArchive.mockResolvedValue(false);
    renderButton();
    await waitFor(() => expect(downloadButton()).toBeEnabled());

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Choose your archive/ })).not.toBeInTheDocument();
  });

  it("waits for the storage check before it can be pressed", () => {
    hasCachedArchive.mockReturnValue(new Promise(() => undefined));
    renderButton();
    expect(downloadButton()).toBeDisabled();
  });

  // Spec 188: asking is right, but "ask, or nothing" strands a founder whose archive is on their
  // other machine — the same dead end the routing fix removes, one step later.
  describe("when this browser has no archive", () => {
    const escapeHatch = () => screen.queryByRole("link", { name: /Foundation only/ });

    it("offers a way past the picker", async () => {
      hasCachedArchive.mockResolvedValue(false);
      renderButton();
      await waitFor(() => expect(downloadButton()).toBeEnabled());

      const link = escapeHatch();
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/api/projects/p1/zip");
    });

    it("keeps the merge primary — the escape hatch is a link, not a second button", async () => {
      hasCachedArchive.mockResolvedValue(false);
      renderButton();
      await waitFor(() => expect(downloadButton()).toBeEnabled());

      expect(screen.getAllByRole("button")).toHaveLength(1);
    });
  });

  it("offers no escape hatch when the archive is here — the merge is what they get", async () => {
    hasCachedArchive.mockResolvedValue(true);
    renderButton();
    await waitFor(() => expect(downloadButton()).toBeEnabled());

    expect(screen.queryByRole("link", { name: /Foundation only/ })).not.toBeInTheDocument();
  });
});
