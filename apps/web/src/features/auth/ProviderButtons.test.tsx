// The server action is mocked: it reads request headers, which only exist inside a request, and
// what this test is about is which providers are real and which are still honest about not being.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("./actions", () => ({ signInWithGitHubAction: vi.fn() }));

import { ProviderButtons } from "./ProviderButtons";

describe("ProviderButtons", () => {
  it("offers GitHub as a working sign-in", () => {
    render(<ProviderButtons />);

    const github = screen.getByRole("button", { name: /GitHub/ });
    expect(github).toBeEnabled();
    expect(github).toHaveAttribute("type", "submit");
  });

  it("renders every provider that has no flow yet as disabled", () => {
    render(<ProviderButtons />);

    for (const name of [/Google/, /Email/, /magic link/i]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });

  it("never renders a provider as a link that could navigate", () => {
    render(<ProviderButtons />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
