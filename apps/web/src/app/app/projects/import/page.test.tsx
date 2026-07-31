// The warning only does its job if the founder meets it *before* choosing a file — a caution
// underneath the picker is read after the archive is already selected, which is too late to matter.
// So this asserts document order, not merely that the text exists somewhere on the page.
//
// The form's server action and its IndexedDB cache are mocked: neither exists outside a request,
// and neither is what this test is about. So is the repository picker — it calls GitHub, which a
// test never does (§V), and it has its own tests.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { OrgPlan } from "@/lib/data/store";

const requireSession = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/auth", () => ({ requireSession }));
vi.mock("@/features/import/actions", () => ({ importProjectAction: vi.fn() }));
vi.mock("@/features/import/archive-cache", () => ({ cacheArchive: vi.fn() }));
vi.mock("@/features/import/RepoPicker", () => ({ RepoPicker: () => null }));

// No earned week by default, so the paywall assertions below are about the plan and nothing else.
const referralSummary = vi.hoisted(() =>
  vi.fn(async () => ({
    code: "invite-code",
    invites: [],
    credited: 0,
    remaining: 3,
    activeUntil: null as string | null,
    queued: 0
  }))
);
vi.mock("@/lib/data/referrals", () => ({ referralSummary }));

import ImportProject from "./page";

const screenFor = () => ImportProject({ searchParams: Promise.resolve({}) });

function signedInOn(plan: OrgPlan): void {
  requireSession.mockResolvedValue({
    user: { id: "u1", email: "f@example.com", name: "F", createdAt: "2026-01-01T00:00:00.000Z" },
    org: { id: "o1", name: "Workspace", kind: "personal", createdBy: "u1", plan }
  });
}

describe("import screen", () => {
  beforeEach(() => signedInOn("free"));
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

  // Spec 74: the wall is stated up front and the analysis is still offered. A founder who finds out
  // only after uploading has been wasted, and one who is told nothing at all is ambushed.
  it("tells a free founder that import is Pro, before the file picker", async () => {
    render(await screenFor());

    const heading = screen.getByRole("heading", { name: /import is part of pro/i });
    const picker = document.querySelector('input[type="file"]');
    expect(picker).not.toBeNull();

    const position = heading.compareDocumentPosition(picker as Node);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("still offers a free founder the analysis, rather than locking the form", async () => {
    render(await screenFor());

    expect(screen.getByText(/run the analysis now/i)).toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).not.toBeNull();
  });

  it("says nothing about Pro to an organization that already has it", async () => {
    signedInOn("pro");

    render(await screenFor());

    expect(screen.queryByRole("heading", { name: /import is part of pro/i })).toBeNull();
  });
});
