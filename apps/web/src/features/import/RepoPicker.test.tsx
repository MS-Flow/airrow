// The repository picker's four states. Two of them are promises the product makes rather than
// decoration: a founder must be told that private repositories are invisible *before* they wonder
// where one went, and a GitHub failure must leave the ZIP path standing rather than a crash.
//
// The listing and both server actions are mocked — neither exists outside a request, and no test
// touches GitHub (§V).
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/features/auth/actions", () => ({ signInWithGitHubAction: vi.fn() }));
vi.mock("./actions", () => ({ importRepoAction: vi.fn() }));

const listRepos = vi.fn();
vi.mock("./queries", () => ({ listRepos: (page: number) => listRepos(page) }));

const { RepoPicker } = await import("./RepoPicker");

const repo = (name: string) => ({
  owner: "ada",
  name,
  fullName: `ada/${name}`,
  description: "A lightweight CRM",
  sizeKb: 100,
  updatedAt: "2026-07-01T10:00:00Z"
});

const ready = (repos: ReturnType<typeof repo>[], hasMore = false) => ({
  kind: "ready" as const,
  repos,
  page: 1,
  hasMore
});

describe("RepoPicker", () => {
  it("says that only public repositories are listed, and where a private one goes instead", async () => {
    listRepos.mockResolvedValue(ready([repo("loop-crm")]));
    render(await RepoPicker({ page: 1 }));

    expect(screen.getByText(/only your/i)).toHaveTextContent(/public/i);
    expect(screen.getByText(/import that one as a ZIP/i)).toBeInTheDocument();
  });

  it("lists the repositories it was given", async () => {
    listRepos.mockResolvedValue(ready([repo("loop-crm"), repo("side-project")]));
    render(await RepoPicker({ page: 1 }));

    expect(screen.getByRole("button", { name: /ada\/loop-crm/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ada\/side-project/ })).toBeInTheDocument();
  });

  it("offers GitHub sign-in to an account that has no GitHub identity", async () => {
    listRepos.mockResolvedValue({ kind: "disconnected" });
    render(await RepoPicker({ page: 1 }));

    expect(screen.getByRole("button", { name: /sign in with github/i })).toBeInTheDocument();
  });

  it("shows a GitHub failure as a state, and still says the ZIP path exists", async () => {
    listRepos.mockResolvedValue({
      kind: "error",
      message: "GitHub is rate-limiting Airrow right now. Wait a few minutes and try again."
    });
    render(await RepoPicker({ page: 1 }));

    expect(screen.getByRole("alert")).toHaveTextContent(/rate-limiting/i);
    expect(screen.getByText(/import that one as a ZIP/i)).toBeInTheDocument();
  });

  it("points an account with no public repositories at the upload instead", async () => {
    listRepos.mockResolvedValue(ready([]));
    render(await RepoPicker({ page: 1 }));

    expect(screen.getByRole("heading", { name: /no public repositories/i })).toBeInTheDocument();
    expect(screen.getByText(/only one for a private project/i)).toBeInTheDocument();
  });

  it("paginates rather than offering an endless list", async () => {
    listRepos.mockResolvedValue(ready([repo("loop-crm")], true));
    render(await RepoPicker({ page: 2 }));

    expect(screen.getByRole("link", { name: /older/i })).toHaveAttribute(
      "href",
      "/app/projects/import?repoPage=3"
    );
    expect(screen.getByRole("link", { name: /newer/i })).toHaveAttribute(
      "href",
      "/app/projects/import?repoPage=1"
    );
  });
});
