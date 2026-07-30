// The GitHub section of Settings has to answer the question the founder actually asked: is *my*
// GitHub account connected? It used to answer a different one — whether a GitHub App was configured
// on the server — which told someone who had just signed in with GitHub that they were not connected.
//
// The session, allowance and theme are mocked: all three read cookies or the database, neither of
// which exists outside a request.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const identity = vi.hoisted((): { current: { login: string | null; connectedAt: string | null } | null } => ({
  current: null
}));

vi.mock("@/lib/auth", () => ({
  requireSession: async () => ({
    user: { id: "u1", name: "Ada", email: "ada@example.com", createdAt: "2026-01-01" },
    org: { id: "o1", name: "Ada's workspace", kind: "personal" }
  }),
  githubIdentity: async () => identity.current,
  updateName: vi.fn()
}));
vi.mock("@/lib/theme", () => ({ readTheme: async () => "dark" }));
vi.mock("@/features/generation/allowance", () => ({
  FREE_GENERATION_LIMIT: 3,
  checkAllowance: async () => ({ unlimited: false, used: 1, remaining: 2 })
}));
vi.mock("@/features/auth/actions", () => ({ signInWithGitHubAction: vi.fn() }));

import SettingsPage from "./page";

const settings = () => SettingsPage({ searchParams: Promise.resolve({}) });

describe("Settings — GitHub account", () => {
  it("names the connected account instead of claiming nothing is connected", async () => {
    identity.current = { login: "adalovelace", connectedAt: "2026-07-29T00:00:00Z" };
    render(await settings());

    expect(screen.getByText("@adalovelace")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /import a repository/i })).toHaveAttribute(
      "href",
      "/app/projects/import"
    );
    expect(screen.queryByRole("button", { name: /sign in with github/i })).not.toBeInTheDocument();
  });

  it("offers the sign-in when no GitHub account is connected", async () => {
    identity.current = null;
    render(await settings());

    expect(screen.getByRole("button", { name: /sign in with github/i })).toBeEnabled();
  });

  it("keeps the App — which writes — apart from the sign-in, which cannot", async () => {
    identity.current = { login: "adalovelace", connectedAt: null };
    render(await settings());

    // Both cards exist, and only the App's Connect button is inert: the account is already connected
    // and the App is not built. One badge must never stand for the other.
    expect(screen.getByText(/GitHub App — repository delivery/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeDisabled();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Not set up")).toBeInTheDocument();
  });
});
