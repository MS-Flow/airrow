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

const plan = vi.hoisted((): { current: "free" | "pro" } => ({ current: "free" }));

vi.mock("@/lib/auth", () => ({
  requireSession: async () => ({
    user: { id: "u1", name: "Ada", email: "ada@example.com", createdAt: "2026-01-01" },
    org: { id: "o1", name: "Ada's workspace", kind: "personal", plan: plan.current }
  }),
  githubIdentity: async () => identity.current,
  updateName: vi.fn()
}));
vi.mock("@/lib/data/store", () => ({ getSubscription: async () => null }));
vi.mock("@/lib/theme", () => ({ readTheme: async () => "dark" }));
vi.mock("@/features/generation/allowance", () => ({
  FREE_GENERATION_LIMIT: 1,
  FREE_REPAIR_LIMIT: 2,
  REPAIR_WINDOW_HOURS: 24,
  checkAllowance: async () => ({ allowed: true, unlimited: false, used: 0, remaining: 1 })
}));
vi.mock("@/features/auth/actions", () => ({ signInWithGitHubAction: vi.fn() }));

import SettingsPage from "./page";

const settings = (searchParams: { saved?: string; upgraded?: string } = {}) =>
  SettingsPage({ searchParams: Promise.resolve(searchParams) });

// A founder came back from Checkout, money had left their account, and Settings said "You're on Pro"
// directly above "Free · 0 of 1 foundation left". Both sentences came from the same page and only one
// of them was checked against the database — the other was inferred from a query string, which is the
// exact thing spec 99 says proves nothing.
describe("Settings — coming back from Checkout", () => {
  it("does not claim Pro while the plan still says free", async () => {
    plan.current = "free";
    render(await settings({ upgraded: "1" }));

    expect(screen.queryByText(/you're on pro/i)).not.toBeInTheDocument();
    expect(screen.getByText(/payment received, waiting for stripe/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing is lost/i)).toBeInTheDocument();
  });

  it("confirms it once the plan actually says so", async () => {
    plan.current = "pro";
    render(await settings({ upgraded: "1" }));

    expect(screen.getByText(/payment confirmed/i)).toBeInTheDocument();
  });

  it("says nothing about a payment when nobody came back from Checkout", async () => {
    plan.current = "free";
    render(await settings());

    expect(screen.queryByText(/payment received/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/payment confirmed/i)).not.toBeInTheDocument();
  });
});

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
