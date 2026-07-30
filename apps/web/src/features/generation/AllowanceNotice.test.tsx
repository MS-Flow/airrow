// The notice exists so the limit is never a surprise (spec 100). Two things are worth holding: it
// says the *right* thing when the founder is out, and it says nothing at all when they are not —
// a standing banner about a wall nobody is near is how a product teaches people to ignore it.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AllowanceNotice } from "./AllowanceNotice";
import type { Entitlement } from "./allowance";

const free = (remaining: number): Entitlement =>
  remaining > 0
    ? { allowed: true, plan: "free", grant: "free", used: 0, remaining, unlimited: false }
    : { allowed: false, plan: "free", denial: "free-spent", used: 1, remaining: 0, unlimited: false };

const pro: Entitlement = {
  allowed: true,
  plan: "pro",
  grant: "pro",
  used: 12,
  remaining: Number.POSITIVE_INFINITY,
  unlimited: true
};

describe("AllowanceNotice", () => {
  it("renders nothing for an organization with no limit", () => {
    const { container } = render(<AllowanceNotice allowance={pro} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("states what is left while there is something left", () => {
    render(<AllowanceNotice allowance={free(1)} />);

    expect(screen.getByText(/1 of 1 free foundation left/i)).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("says the interview is still open when the allowance is spent", () => {
    // The behaviour issue #100 asks for by name: a founder who is out may still answer every
    // question, and meets Pro at generate. Telling them the opposite would stop them dead.
    render(<AllowanceNotice allowance={free(0)} />);

    expect(screen.getByText(/still answer the interview/i)).toBeInTheDocument();
  });

  it("offers a way on rather than only a refusal", () => {
    render(<AllowanceNotice allowance={free(0)} />);

    expect(screen.getByRole("link", { name: /what pro gives/i })).toHaveAttribute(
      "href",
      "/app/upgrade"
    );
  });
});
