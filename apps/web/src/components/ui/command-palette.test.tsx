import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette, type CommandItem } from "./command-palette";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const items: CommandItem[] = [
  { id: "nav-app", label: "Projects", href: "/app", group: "Go to" },
  { id: "nav-settings", label: "Settings", href: "/app/settings", group: "Go to" },
  { id: "p-1", label: "Loop CRM", href: "/app/projects/1", group: "Projects" }
];

describe("CommandPalette", () => {
  it("opens on the ⌘K shortcut", async () => {
    const user = userEvent.setup();
    render(<CommandPalette items={items} />);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    await user.keyboard("{Meta>}k{/Meta}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("filters options by query", async () => {
    const user = userEvent.setup();
    render(<CommandPalette items={items} />);
    await user.keyboard("{Control>}k{/Control}");

    await user.type(screen.getByLabelText("Search commands"), "loop");
    expect(screen.getByRole("option", { name: /Loop CRM/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Settings/ })).not.toBeInTheDocument();
  });

  it("navigates to the item selected with the arrow keys and Enter", async () => {
    const user = userEvent.setup();
    render(<CommandPalette items={items} />);
    await user.keyboard("{Control>}k{/Control}");

    await user.keyboard("{ArrowDown}{Enter}");
    expect(push).toHaveBeenCalledWith("/app/settings");
  });

  it("closes on Escape", async () => {
    const user = userEvent.setup();
    render(<CommandPalette items={items} />);
    await user.keyboard("{Control>}k{/Control}");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
