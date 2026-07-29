// A conflict row has to say which version ends up in the download. The founder is deciding what
// happens to their own files, and a row that only offers two buttons without stating the outcome
// makes them guess — or click again because nothing looked like it changed (spec 63/91).
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ImportDiffEntry } from "@airrow/schemas";

vi.mock("./actions", () => ({ resolveConflictAction: vi.fn() }));

import { ConflictRow } from "./ConflictRow";

const entry = (path: string): ImportDiffEntry => ({
  path,
  generatedBytes: 120,
  existingBytes: 80
});

function row(path: string, decision: "keep_existing" | "use_generated" | undefined) {
  render(
    <ul>
      <ConflictRow projectId="p1" entry={entry(path)} decision={decision} />
    </ul>
  );
}

describe("ConflictRow", () => {
  it("says the founder's file is kept and Airrow's arrives beside it, undecided", () => {
    row("README.md", undefined);
    expect(screen.getByText(/yours is kept, Airrow's arrives as README.airrow.md/)).toBeTruthy();
  });

  it("names the sidecar for a nested document, not the whole path", () => {
    row("docs/architecture/SYSTEM_OVERVIEW.md", undefined);
    expect(screen.getByText(/arrives as SYSTEM_OVERVIEW.airrow.md/)).toBeTruthy();
  });

  it("does not promise a sidecar for a file that never gets one", () => {
    row(".github/workflows/ci.yml", undefined);
    expect(screen.getByText(/yours is kept, Airrow's version is not delivered/)).toBeTruthy();
  });

  it("states the outcome of an explicit 'Keep mine'", () => {
    row("README.md", "keep_existing");
    expect(screen.getByText(/Yours is kept — Airrow's version is not delivered/)).toBeTruthy();
  });

  it("states the outcome of an explicit 'Use Airrow's'", () => {
    row("README.md", "use_generated");
    expect(screen.getByText(/Airrow's version takes this path — yours is not delivered/)).toBeTruthy();
  });

  it("marks the chosen button as pressed, so the decision is visible without reading the badge", () => {
    row("README.md", "use_generated");
    expect(screen.getByRole("button", { name: "Use Airrow's" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Keep mine" }).getAttribute("aria-pressed")).toBe("false");
  });

  /** The posted resolution is the whole contract with the action: "" undoes, a value decides. */
  const posted = (label: string): string | null =>
    screen
      .getByRole("button", { name: label })
      .closest("form")
      ?.querySelector<HTMLInputElement>('input[name="resolution"]')
      ?.value ?? null;

  it("posts an empty resolution from the chosen button, so pressing it again undoes the choice", () => {
    row("README.md", "keep_existing");
    expect(posted("Keep mine")).toBe("");
    expect(posted("Use Airrow's")).toBe("use_generated");
  });

  it("posts a real resolution from both buttons while nothing is chosen", () => {
    row("README.md", undefined);
    expect(posted("Keep mine")).toBe("keep_existing");
    expect(posted("Use Airrow's")).toBe("use_generated");
  });
});
