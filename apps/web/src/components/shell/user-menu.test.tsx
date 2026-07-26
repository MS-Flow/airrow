import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserMenu } from "./user-menu";

describe("UserMenu", () => {
  it("shows the account, its destinations and sign-out", async () => {
    const user = userEvent.setup();
    render(<UserMenu name="Ada Lovelace" email="ada@example.com" signOutAction={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Account menu" }));

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /projects/i })).toHaveAttribute("href", "/app");
    expect(screen.getByRole("menuitem", { name: /settings/i })).toHaveAttribute(
      "href",
      "/app/settings"
    );
  });

  it("wires the sign-out form to the action", async () => {
    const user = userEvent.setup();
    const signOutAction = vi.fn();
    render(<UserMenu name="Ada Lovelace" email="ada@example.com" signOutAction={signOutAction} />);

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("button", { name: /sign out/i }));

    expect(signOutAction).toHaveBeenCalledOnce();
  });

  it("keeps the sign-out form mounted through the click", async () => {
    // This is the actual regression guard. Sign-out silently did nothing because Radix
    // closes the menu on select, unmounting the form before the browser dispatches its
    // submit event. jsdom still runs the action either way, so asserting the call alone
    // would pass against the bug — what has to hold is that the form survives the click.
    const user = userEvent.setup();
    render(<UserMenu name="Ada Lovelace" email="ada@example.com" signOutAction={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("button", { name: /sign out/i }));

    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});
