// The state a founder actually met: an "Upgrade to Pro" button that could not be clicked, with the
// reason hidden in a `title` attribute — invisible on a phone, and to anyone who does not think to
// hover a control that looks broken. A disabled button with no visible reason is not a plan boundary,
// it is a bug report waiting to be filed.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// The module also exports the two buttons that leave for Stripe, which import the server action.
// Only this one is under test here, so the action module is stubbed rather than dragged in.
vi.mock("./actions", () => ({
  startCheckoutAction: vi.fn(),
  openBillingPortalAction: vi.fn()
}));

import { BillingUnavailable } from "./BillingActions";

describe("BillingUnavailable", () => {
  it("says on the page why the button does nothing", () => {
    render(<BillingUnavailable />);

    expect(screen.getByRole("button", { name: /upgrade to pro/i })).toBeDisabled();
    // `isn.t` because the copy uses a typographic apostrophe, which is the point of the copy.
    expect(screen.getByText(/card payment isn.t set up on this deployment/i)).toBeInTheDocument();
  });

  it("promises that nothing already generated is affected", () => {
    // The first fear at anything that looks like a billing failure is losing work.
    render(<BillingUnavailable />);

    expect(screen.getByText(/nothing you have already generated is affected/i)).toBeInTheDocument();
  });
});
