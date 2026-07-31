// The delivery screen is the one moment a founder has just seen what Airrow made them, which is why
// the invite line lives here as well as in Settings (spec 122). Two things matter: it is there, and it
// is *not* there for someone who has already used every place — asking a fourth time is asking for
// nothing, since a fourth invitation earns them no week.
//
// The download button and the model lookup are mocked: neither exists outside a request, and neither
// is what this file is about.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const requireSession = vi.hoisted(() => vi.fn());
const getProject = vi.hoisted(() => vi.fn());
const latestModelVersion = vi.hoisted(() => vi.fn());
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

vi.mock("@/lib/auth", () => ({ requireSession }));
vi.mock("@/lib/data/store", () => ({ getProject, latestModelVersion }));
vi.mock("@/lib/data/referrals", () => ({ REFERRAL_GRANT_DAYS: 7, referralSummary }));
vi.mock("@/lib/site-url", () => ({ requestOrigin: async () => "https://airrow.test" }));
vi.mock("@/features/import/DownloadProject", () => ({ DownloadProject: () => null }));

import ContinuePage from "./page";

const continueScreen = () => ContinuePage({ params: Promise.resolve({ id: "p1" }) });

beforeEach(() => {
  requireSession.mockResolvedValue({
    user: { id: "u1", email: "f@example.com", name: "F", createdAt: "2026-01-01T00:00:00.000Z" },
    org: { id: "o1", name: "Workspace", kind: "personal", createdBy: "u1", plan: "free" }
  });
  getProject.mockResolvedValue({ id: "p1", name: "Loop CRM", slug: "loop-crm", status: "ready" });
  latestModelVersion.mockResolvedValue({ id: "mv1", model: { stack: { repoProvider: "github" } } });
  referralSummary.mockResolvedValue({
    code: "invite-code",
    invites: [],
    credited: 0,
    remaining: 3,
    activeUntil: null,
    queued: 0
  });
});

describe("continue locally — inviting a friend", () => {
  it("offers the link once the foundation is generated", async () => {
    render(await continueScreen());

    expect(screen.getByText(/know another founder starting something/i)).toBeInTheDocument();
    expect(screen.getByText("https://airrow.test/invite/invite-code")).toBeInTheDocument();
  });

  it("says what the invitation is worth, without overstating when", async () => {
    render(await continueScreen());

    // The reward lands when *they* generate, which is days away — the copy has to say so, because a
    // founder who expects it immediately reads the silence as a broken feature.
    expect(screen.getByText(/when they generate their first foundation/i)).toBeInTheDocument();
  });

  it("says nothing to a founder who has used every place", async () => {
    referralSummary.mockResolvedValue({
      code: "invite-code",
      invites: [],
      credited: 3,
      remaining: 0,
      activeUntil: null,
      queued: 0
    });

    render(await continueScreen());

    expect(screen.queryByText(/know another founder/i)).not.toBeInTheDocument();
    expect(screen.queryByText("https://airrow.test/invite/invite-code")).not.toBeInTheDocument();
  });

  it("still hands over the five steps, which are what the screen is for", async () => {
    // The invite line is an aside. If it ever becomes the reason this page exists, that is a bug.
    render(await continueScreen());

    expect(screen.getByRole("heading", { name: /from foundation to first feature/i })).toBeInTheDocument();
    expect(screen.getByText(/download and extract/i)).toBeInTheDocument();
  });
});
