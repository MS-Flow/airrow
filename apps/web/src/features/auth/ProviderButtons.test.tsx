import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProviderButtons } from "./ProviderButtons";

describe("ProviderButtons", () => {
  it("renders every unavailable provider as disabled", () => {
    render(<ProviderButtons />);

    for (const name of [/Google/, /GitHub/, /Email/, /magic link/i]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });

  it("never renders a provider as a link that could navigate", () => {
    render(<ProviderButtons />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});
