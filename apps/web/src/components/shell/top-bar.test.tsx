// The top bar has one row for a breadcrumb trail and three controls, and at 360px they do
// not all fit (spec 31). The label is what gives way — so the guard is that dropping it
// costs the action neither its name nor its place.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const pathname = vi.hoisted(() => ({ current: "/app/projects/p1" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

import { buildCrumbs, TopBar } from "./top-bar";

function renderBar() {
  return render(
    <TopBar
      projectNames={{ p1: "A project with a deliberately long name" }}
      themeSwitch={<button type="button">Theme</button>}
      userMenu={<button type="button">Account</button>}
    />
  );
}

describe("TopBar at phone width", () => {
  it("keeps the new-project action named when its label is hidden", () => {
    renderBar();

    const action = screen.getByRole("link", { name: "New project" });
    expect(action).toHaveAttribute("href", "/app/projects/new");
    // The text is still rendered for wider screens; below `sm` only the icon shows, which is
    // why the accessible name has to come from the link itself.
    expect(action.querySelector(".max-sm\\:hidden")).not.toBeNull();
  });

  it("lets the trail truncate instead of pushing the controls off screen", () => {
    renderBar();

    const crumb = screen.getByText("A project with a deliberately long name");
    expect(crumb).toHaveClass("truncate");
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveClass("min-w-0");
  });
});

describe("the trail names every screen (spec 164)", () => {
  it.each([
    ["/app/admin", "Admin"],
    ["/app/support", "Support"],
    ["/app/suspended", "Account suspended"],
    ["/app/settings", "Settings"]
  ])("%s reads as %s", (path, label) => {
    // A segment with no entry in `SEGMENT_LABELS` falls through to the raw URL, which is how the
    // breadcrumb came to say a lower-case "admin" while the heading and the sidebar said Admin.
    expect(buildCrumbs(path, {})).toEqual([{ label }]);
  });
});
