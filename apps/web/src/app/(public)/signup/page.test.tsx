// One sentence per cause, and the advice has to match the cause (spec 135).
//
// The screen used to answer every failure with "That email is already registered, or signup failed. Try
// signing in." — which is wrong advice for a rate limit (there is no account to sign in to) and reads as
// an accusation when the address was fine. Found while testing spec 122's invite flow, where it lands on
// exactly the people the product is trying to attract.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/auth", () => ({ signUp: vi.fn() }));
vi.mock("@/lib/site-url", () => ({ requestOrigin: async () => "https://airrow.test" }));
vi.mock("@/features/auth/ProviderButtons", () => ({ ProviderButtons: () => null }));
vi.mock("@/features/auth/PasswordFields", () => ({ PasswordFields: () => null }));

import SignupPage from "./page";

const signup = (error?: string) => SignupPage({ searchParams: Promise.resolve({ error }) });

describe("signup — telling the founder which wall they hit", () => {
  it("sends someone with an account to sign in", async () => {
    render(await signup("already-registered"));

    expect(screen.getByText(/already has an account/i)).toBeInTheDocument();
    expect(screen.getByText(/try signing in/i)).toBeInTheDocument();
  });

  it("says a rate limit is temporary, and does not send them to sign in", async () => {
    render(await signup("rate-limited"));

    const notice = screen.getByText(/wait a few minutes/i);
    expect(notice).toBeInTheDocument();
    expect(notice.textContent).toMatch(/nothing is wrong with your details/i);
    // The advice that would waste their time: there is no account to sign into yet.
    expect(screen.queryByText(/try signing in/i)).not.toBeInTheDocument();
  });

  it("does not claim the address is taken when the cause is unknown", async () => {
    render(await signup("unknown"));

    expect(screen.getByText(/safe to try again/i)).toBeInTheDocument();
    expect(screen.queryByText(/already has an account/i)).not.toBeInTheDocument();
  });

  it("still explains a form that did not validate", async () => {
    render(await signup("invalid"));

    expect(screen.getByText(/meets every requirement/i)).toBeInTheDocument();
  });

  /*
   * A mismatch is the one failure here that is fixed by retyping rather than by choosing something else,
   * so it gets its own sentence — "check your details" would send the founder looking in the wrong place
   * (spec 140).
   */
  it("tells someone whose passwords differ to retype them", async () => {
    render(await signup("password-mismatch"));

    const notice = screen.getByText(/do not match/i);
    expect(notice).toBeInTheDocument();
    expect(notice.textContent).toMatch(/retype/i);
  });

  it("keeps answering the old query string, for a link someone already has", async () => {
    render(await signup("exists"));

    expect(screen.getByText(/already has an account/i)).toBeInTheDocument();
  });

  it("shows no error at all on a first visit", async () => {
    render(await signup());

    expect(screen.queryByText(/already has an account/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/wait a few minutes/i)).not.toBeInTheDocument();
  });
});
