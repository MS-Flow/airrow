// When Airrow asks for a verdict, and when it has the sense not to (spec 144).
//
// The review card is the last thing on a finished project. Before there is a foundation there is
// nothing to have an opinion about, and asking anyway would be asking about us rather than about the
// work — so its absence is worth a test as much as its presence.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const requireSession = vi.hoisted(() => vi.fn());
const getProject = vi.hoisted(() => vi.fn());
const latestJob = vi.hoisted(() => vi.fn());
const loadArtifact = vi.hoisted(() => vi.fn());
const previousCompletedJob = vi.hoisted(() => vi.fn());
const getReview = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ requireSession }));
vi.mock("@/lib/data/store", () => ({
  getProject,
  latestJob,
  loadArtifact,
  previousCompletedJob
}));
vi.mock("@/lib/data/support", () => ({ getReview }));
vi.mock("@airrow/engine", () => ({ diffGenerations: () => null }));
vi.mock("@/features/import/DownloadProject", () => ({ DownloadProject: () => null }));
vi.mock("@/features/projects/actions", () => ({ deleteProjectAction: vi.fn() }));
vi.mock("@/features/support/actions", () => ({ submitReviewAction: vi.fn() }));

import ProjectOverview from "./page";

const overview = (review?: string) =>
  ProjectOverview({
    params: Promise.resolve({ id: "p1" }),
    searchParams: Promise.resolve(review ? { review } : {})
  });

const project = (status: string) => ({
  id: "p1",
  organizationId: "org1",
  name: "Loop CRM",
  slug: "loop-crm",
  description: "A lightweight CRM.",
  status,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-31T00:00:00.000Z"
});

const rating = () => screen.queryByRole("radio", { name: "5 out of 5" });

beforeEach(() => {
  vi.clearAllMocks();
  requireSession.mockResolvedValue({
    user: { id: "u1", email: "f@example.com", name: "Founder", createdAt: "2026-01-01T00:00:00.000Z" },
    org: { id: "org1", name: "Workspace", kind: "personal", createdBy: "u1", plan: "free" }
  });
  getProject.mockResolvedValue(project("ready"));
  latestJob.mockResolvedValue({ id: "j1", status: "completed", finishedAt: "2026-07-31T00:00:00.000Z" });
  loadArtifact.mockResolvedValue({
    files: [{ path: "README.md", content: "# Loop" }],
    manifest: { fileCount: 1, engineVersion: "1" }
  });
  previousCompletedJob.mockResolvedValue(null);
  getReview.mockResolvedValue(null);
});

describe("the review at the bottom of a project", () => {
  it("asks once the foundation is ready", async () => {
    render(await overview());

    expect(screen.getByText("How was it?")).toBeInTheDocument();
    expect(rating()).toBeInTheDocument();
  });

  it.each(["interviewing", "generating", "failed"])("stays away while the project is %s", async (status) => {
    getProject.mockResolvedValue(project(status));

    render(await overview());

    expect(screen.queryByText("How was it?")).not.toBeInTheDocument();
    expect(rating()).not.toBeInTheDocument();
    // Not even asked for: a status that cannot show the card must not cost a query.
    expect(getReview).not.toHaveBeenCalled();
  });

  it("shows the founder what they said last time, ready to change", async () => {
    getReview.mockResolvedValue({
      id: "r1",
      projectId: "p1",
      rating: 4,
      body: "The roadmap was the useful part.",
      consentPublic: true,
      displayName: "Founder",
      createdAt: "2026-07-31T00:00:00.000Z",
      updatedAt: "2026-07-31T00:00:00.000Z"
    });

    render(await overview());

    expect(screen.getByText("Your review")).toBeInTheDocument();
    expect(screen.getByDisplayValue("The roadmap was the useful part.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "4 out of 5" })).toBeChecked();
  });

  it("confirms a save, and says what was wrong when there was something wrong", async () => {
    const { unmount } = render(await overview("saved"));
    expect(screen.getByText("Saved — thank you.")).toBeInTheDocument();
    unmount();

    render(await overview("invalid"));
    expect(screen.getByRole("alert")).toHaveTextContent(/rating between one and five/i);
  });
});
