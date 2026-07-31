// The server actions are mocked: they read request headers, which only exist inside a request, and what
// this test is about is which providers are offered at all.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./actions", () => ({
  signInWithGitHubAction: vi.fn(),
  signInWithGoogleAction: vi.fn()
}));

import { ProviderButtons } from "./ProviderButtons";

describe("ProviderButtons", () => {
  it("offers GitHub and Google as working sign-ins", () => {
    render(<ProviderButtons />);

    for (const name of [/GitHub/, /Google/]) {
      const button = screen.getByRole("button", { name });
      expect(button).toBeEnabled();
      expect(button).toHaveAttribute("type", "submit");
    }
  });

  /*
   * Spec 19 shipped these behind a "Soon" badge and spec 140 removed them: we never intended to build
   * either, and a badge promising something that is not coming is a slower way of saying the same untrue
   * thing. Asserted by name so re-adding one is a deliberate act rather than an accident.
   */
  it("promises no provider it does not have", () => {
    render(<ProviderButtons />);

    expect(screen.queryByRole("button", { name: /Continue with Email/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /magic link/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/soon/i)).not.toBeInTheDocument();
  });

  it("leaves no disabled button behind", () => {
    render(<ProviderButtons />);

    for (const button of screen.getAllByRole("button")) expect(button).toBeEnabled();
  });

  it("never renders a provider as a link that could navigate", () => {
    render(<ProviderButtons />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
