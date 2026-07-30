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
    expect(screen.getByText(/choose the archive you imported/i)).toBeInTheDocument();
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
});
