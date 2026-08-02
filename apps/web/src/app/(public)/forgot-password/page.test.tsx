// The one screen that must answer the same way whatever it finds (spec 171).
//
// A reset form that says "no account with that address" is an oracle: anyone can ask it which addresses
// have Airrow accounts, and that is the first half of an attack on those accounts. The property is easy
// to lose in a later "helpful" edit, so it is asserted on the rendered screen rather than trusted to
// review.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/auth", () => ({ sendPasswordReset: vi.fn() }));
vi.mock("@/lib/site-url", () => ({ requestOrigin: async () => "https://airrow.test" }));

import ForgotPasswordPage from "./page";

const page = (params: { error?: string; status?: string } = {}) =>
  ForgotPasswordPage({ searchParams: Promise.resolve(params) });

describe("forgot password", () => {
  it("asks for an address", async () => {
    render(await page());

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send reset link/i })).toBeInTheDocument();
  });

  it("answers a sent request conditionally — never that the account exists", async () => {
    render(await page({ status: "sent" }));

    const answer = screen.getByText(/if there is an airrow account/i);
    expect(answer).toBeInTheDocument();
    // The two phrasings that would give the game away, in either direction.
    expect(screen.queryByText(/we (have )?sent you/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no account/i)).not.toBeInTheDocument();
  });

  it("says the link is single-use and time-limited, so an old one is not a mystery", async () => {
    render(await page({ status: "sent" }));

    expect(screen.getByText(/expires in an hour/i)).toBeInTheDocument();
  });

  // The only refusal here is about the typing, which is why it is safe to say out loud.
  it("explains a malformed address without saying anything about accounts", async () => {
    render(await page({ error: "invalid" }));

    const error = screen.getByRole("alert");
    expect(error.textContent).toMatch(/doesn't look like an email address/i);
  });

  it("shows no error on a first visit", async () => {
    render(await page());

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
