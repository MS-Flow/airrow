import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./button";

describe("Button", () => {
  it("renders its label and is enabled by default", () => {
    render(<Button>Generate</Button>);
    const button = screen.getByRole("button", { name: "Generate" });
    expect(button).toBeEnabled();
  });

  it("blocks interaction when disabled", () => {
    render(<Button disabled>Generate</Button>);
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
  });

  it("renders each variant with a distinct class set", () => {
    const { container: primary } = render(<Button variant="primary">a</Button>);
    const { container: danger } = render(<Button variant="danger">b</Button>);
    expect(primary.firstElementChild?.className).not.toBe(danger.firstElementChild?.className);
  });

  it("renders the child element instead of a button when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/app">Open dashboard</a>
      </Button>
    );
    expect(screen.getByRole("link", { name: "Open dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
