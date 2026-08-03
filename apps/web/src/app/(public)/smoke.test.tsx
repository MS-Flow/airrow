// Render smoke test for the public pages (issue #14). The point is narrow and blunt:
// a PR must not merge if `/`, `/login` or `/signup` throws on render. These three are
// chosen because they render for a signed-out visitor with no data fixtures — the
// first thing anyone sees, and the pages a crash would take down for everyone.
//
// Server Components are exercised by awaiting the page function and rendering what it
// returns; that is what Next does, minus the request. The session and theme boundaries
// are mocked because they read cookies, which only exist inside a real request.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Only the fields the landing page reads: the header's account, and the organization the pricing
// section's Pro action is decided from. Hoisted so the mock below can flip the session per test;
// `vi.mock` factories run before the module graph is imported.
type FakeSession = {
  user: { id: string; name: string; email: string };
  org: { id: string; plan: "free" | "pro" };
} | null;

const session = vi.hoisted((): { current: FakeSession } => ({ current: null }));

vi.mock("@/lib/auth", () => ({
  getSession: () => Promise.resolve(session.current),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn()
}));

vi.mock("@/lib/theme", () => ({
  readTheme: () => Promise.resolve("dark")
}));

// A database boundary, mocked for the same reason the session is: there is no request here, and the
// landing page asks it one question — how much of the free allowance is gone.
const allowanceUsed = vi.hoisted(() => ({ current: 1 }));

vi.mock("@/features/generation/allowance", () => ({
  checkAllowance: () =>
    Promise.resolve({
      allowed: false,
      plan: "free",
      denial: "free-spent",
      used: allowanceUsed.current,
      remaining: 0,
      unlimited: false
    })
}));

import Landing from "./page";
import LoginPage from "./login/page";
import SignupPage from "./signup/page";

describe("public pages render without crashing", () => {
  it("renders the landing page for a signed-out visitor", async () => {
    session.current = null;
    render(await Landing());

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Your startup deserves a real engineering foundation."
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    // Pro needs an account, so the Pro card asks for one — it does not quietly start a free
    // foundation, which is what pointing this at the guest interview used to do.
    expect(screen.getByRole("link", { name: /start with pro/i })).toHaveAttribute("href", "/signup");
  });

  it("renders the landing page for a signed-in visitor", async () => {
    // The signed-in branch mounts a different header (dashboard link + account menu),
    // so rendering only the signed-out case would leave half the page untested.
    session.current = {
      user: { id: "user1", name: "Ada Lovelace", email: "ada@example.com" },
      org: { id: "org1", plan: "free" }
    };
    render(await Landing());

    expect(screen.getByRole("link", { name: /open dashboard/i })).toHaveAttribute("href", "/app");
  });

  it("offers the upgrade screen to a founder whose free foundation is spent", async () => {
    // The bug this replaces: "Start with Pro" pointed at the new-project form, so the one visitor who
    // had actually met the limit was sent to the screen that cannot lift it.
    session.current = {
      user: { id: "user1", name: "Ada Lovelace", email: "ada@example.com" },
      org: { id: "org1", plan: "free" }
    };
    allowanceUsed.current = 1;
    render(await Landing());

    expect(screen.getByRole("link", { name: /start with pro/i })).toHaveAttribute(
      "href",
      "/app/upgrade"
    );
  });

  it("sends a founder with nothing generated to their free foundation instead", async () => {
    session.current = {
      user: { id: "user1", name: "Ada Lovelace", email: "ada@example.com" },
      org: { id: "org1", plan: "free" }
    };
    allowanceUsed.current = 0;
    render(await Landing());

    expect(screen.getByRole("link", { name: /start with pro/i })).toHaveAttribute(
      "href",
      "/app/projects/new"
    );
  });

  it("renders the sign-in page", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Sign in");
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("renders the sign-in page with an error", async () => {
    render(await LoginPage({ searchParams: Promise.resolve({ error: "unconfirmed" }) }));

    expect(screen.getByText(/confirm your email address first/i)).toBeInTheDocument();
  });

  it("renders the sign-up page", async () => {
    render(await SignupPage({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Create your account");
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("renders the sign-up confirmation state", async () => {
    render(await SignupPage({ searchParams: Promise.resolve({ status: "check-inbox" }) }));

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Confirm your email");
  });
});
