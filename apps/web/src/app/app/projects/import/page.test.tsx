// The warning only does its job if the founder meets it *before* choosing a file — a caution
// underneath the picker is read after the archive is already selected, which is too late to matter.
// So this asserts document order, not merely that the text exists somewhere on the page.
//
// The form's server action and its IndexedDB cache are mocked: neither exists outside a request,
// and neither is what this test is about. So is the repository picker — it calls GitHub, which a
// test never does (§V), and it has its own tests.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/features/import/actions", () => ({ importProjectAction: vi.fn() }));
vi.mock("@/features/import/archive-cache", () => ({ cacheArchive: vi.fn() }));
vi.mock("@/features/import/RepoPicker", () => ({ RepoPicker: () => null }));

import ImportProject from "./page";

const screenFor = () => ImportProject({ searchParams: Promise.resolve({}) });

describe("import screen", () => {
  it("warns about secrets and personal data ahead of the file picker", async () => {
    render(await screenFor());

    const warning = screen.getByRole("heading", {
      name: /leave secrets and personal data out of the archive/i
    });
    const picker = document.querySelector('input[type="file"]');
    expect(picker).not.toBeNull();

    const position = warning.compareDocumentPosition(picker as Node);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("says why, and does not claim Airrow checks the archive for you", async () => {
    render(await screenFor());

    expect(screen.getByText(/has to be rotated/i)).toBeInTheDocument();
    expect(screen.getByText(/scan for secrets/i)).toBeInTheDocument();
  });
});
