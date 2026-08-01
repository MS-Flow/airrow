// The navigation drawer is the only way into navigation on a phone (spec 31), so what it
// owes the page underneath is tested rather than assumed: it opens, it holds the page still
// while it is open, and it closes every way out a founder would try.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({ usePathname: () => "/app" }));

import { navItems } from "./nav-items";
import { RailProvider } from "./rail";
import { Sidebar } from "./sidebar";

function renderSidebar() {
  return render(
    <RailProvider>
      <Sidebar items={navItems({ isAdmin: false })} />
    </RailProvider>
  );
}

const toggle = () => screen.getByRole("button", { name: "Open navigation" });
const drawer = () => document.getElementById("app-nav-drawer");

describe("Sidebar drawer", () => {
  it("opens from a 44px toggle that reports the drawer's state", async () => {
    const user = userEvent.setup();
    renderSidebar();

    // 44×44 is the tap target the spec commits to for the primary navigation affordance;
    // it used to be a 28px icon button, which is a miss on a phone.
    expect(toggle()).toHaveClass("size-11");
    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(toggle()).toHaveAttribute("aria-controls", "app-nav-drawer");
    expect(drawer()).toHaveClass("-translate-x-full");

    await user.click(toggle());

    expect(toggle()).toHaveAttribute("aria-expanded", "true");
    expect(drawer()).toHaveClass("translate-x-0");
  });

  it("holds the page still while it is open, and releases it on close", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(toggle());
    expect(document.body.style.overflow).toBe("hidden");

    await user.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(document.body.style.overflow).toBe("");
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(toggle());
    await user.keyboard("{Escape}");

    expect(toggle()).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
  });

  it("closes when a navigation link is followed", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(toggle());
    await user.click(screen.getByRole("link", { name: "Settings" }));

    expect(toggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("releases the page when it unmounts while open", async () => {
    const user = userEvent.setup();
    const { unmount } = renderSidebar();

    await user.click(toggle());
    unmount();

    // A drawer left open by a navigation must not leave the body locked behind it.
    expect(document.body.style.overflow).toBe("");
  });
});
