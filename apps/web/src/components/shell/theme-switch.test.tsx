import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const setThemeAction = vi.hoisted(() => vi.fn(async (_theme: string) => {}));
vi.mock("@/features/settings/actions", () => ({ setThemeAction }));

import { ThemeSwitch } from "./theme-switch";

describe("ThemeSwitch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.dataset.theme = "dark";
  });

  it("repaints on click rather than waiting for the server", async () => {
    // The regression this guards: the switch used to post a form and revalidate the whole
    // layout just to repaint an attribute, so the theme changed a round trip after the click.
    const user = userEvent.setup();
    const pending = new Promise<void>(() => {}); // never resolves
    setThemeAction.mockReturnValue(pending);

    render(<ThemeSwitch current="dark" />);
    await user.click(screen.getByRole("button"));

    // Still in flight, and the page is already light.
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("persists the theme it switched to", async () => {
    const user = userEvent.setup();
    render(<ThemeSwitch current="dark" />);

    await user.click(screen.getByRole("button"));

    expect(setThemeAction).toHaveBeenCalledWith("light");
  });

  it("offers the theme you would land on, and flips after switching", async () => {
    const user = userEvent.setup();
    render(<ThemeSwitch current="dark" />);

    const button = screen.getByRole("button");
    expect(button).toHaveAccessibleName(/light/i);

    await user.click(button);
    expect(screen.getByRole("button")).toHaveAccessibleName(/dark/i);
  });
});
