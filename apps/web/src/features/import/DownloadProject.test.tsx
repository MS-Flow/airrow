// Which download a project gets, and why (spec 188).
//
// This is the layer that had no test at all, which is how a repository import shipped with a button
// that could only ever open a file picker for an archive that never existed. `MergedDownload`'s own
// tests mock the cache check and prove "no archive → ask"; nothing proved that a project incapable
// of ever having an archive was being handed to it in the first place.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ImportSourceKind } from "@airrow/schemas";

const getImportSource = vi.hoisted(() => vi.fn());
const listImportFiles = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/store", () => ({ getImportSource, listImportFiles }));

// The merged path is a client component with its own storage check; this suite is about which of
// the two gets rendered, not about what either does once it is.
const hasCachedArchive = vi.hoisted(() => vi.fn());
const readCachedArchive = vi.hoisted(() => vi.fn());
vi.mock("./archive-cache", () => ({ hasCachedArchive, readCachedArchive }));

import { Toaster } from "@/components/ui/toast";
import { DownloadProject } from "./DownloadProject";

/** Just enough of the record for the routing decision; the rest never reaches this component. */
function source(kind: ImportSourceKind) {
  return { id: "src1", projectId: "p1", kind, originalName: "loop-crm.zip" };
}

async function renderFor(imported: ReturnType<typeof source> | null, explain = false) {
  getImportSource.mockResolvedValue(imported);
  listImportFiles.mockResolvedValue([{ path: "README.md", bytes: 10, digest: "d" }]);
  hasCachedArchive.mockResolvedValue(true);
  render(
    <Toaster>{await DownloadProject({ projectId: "p1", slug: "loop-crm", explain })}</Toaster>
  );
}

const foundationButton = () => screen.queryByRole("link", { name: /Download foundation/ });
const mergedButton = () => screen.queryByRole("button", { name: /Download project/ });

describe("DownloadProject", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gives a repo import a download, not a demand for an archive it never had", async () => {
    await renderFor(source("repo"));
    expect(foundationButton()).toBeInTheDocument();
    expect(mergedButton()).not.toBeInTheDocument();
  });

  it("names what the archive is in the label, not only in copy beneath it", async () => {
    await renderFor(source("repo"));
    // The load-bearing half: it survives a founder who reads nothing but the button.
    expect(foundationButton()).toHaveTextContent("Download foundation");
  });

  it("explains where the archive goes where the placement has room for it", async () => {
    await renderFor(source("repo"), true);
    expect(screen.getByText(/Unzip it into your project/)).toBeInTheDocument();
  });

  it("adds no paragraph to a button row that cannot hold one (spec 68)", async () => {
    await renderFor(source("repo"));
    expect(screen.queryByText(/Unzip it into your project/)).not.toBeInTheDocument();
  });

  it("still merges for a ZIP import — the one case where Airrow holds the only copy", async () => {
    await renderFor(source("zip"));
    expect(mergedButton()).toBeInTheDocument();
    expect(foundationButton()).not.toBeInTheDocument();
  });

  it("reads the imported paths only for the import that can use them", async () => {
    await renderFor(source("zip"));
    expect(listImportFiles).toHaveBeenCalledWith("src1");

    vi.clearAllMocks();
    await renderFor(source("repo"));
    expect(listImportFiles).not.toHaveBeenCalled();
  });

  it("leaves a project that was never imported on the plain link", async () => {
    await renderFor(null);
    expect(foundationButton()).toBeInTheDocument();
    expect(mergedButton()).not.toBeInTheDocument();
  });

  it("never explains where to unzip when the project was never imported", async () => {
    // There is no existing checkout to unzip into — the foundation *is* the project — so the line
    // stays off even where the placement would allow it.
    await renderFor(null, true);
    expect(screen.queryByText(/Unzip it into your project/)).not.toBeInTheDocument();
  });
});
