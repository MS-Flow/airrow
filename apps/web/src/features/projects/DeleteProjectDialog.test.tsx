import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DeleteProjectDialog } from "./DeleteProjectDialog";

describe("DeleteProjectDialog", () => {
  it("does not delete on the initial click — a confirmation dialog opens first", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    render(<DeleteProjectDialog projectId="p1" projectName="Airrow" action={action} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByRole("dialog")).toHaveAccessibleName("Delete project?");
    expect(screen.getByText(/Airrow/)).toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("cancels without calling the action", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    render(<DeleteProjectDialog projectId="p1" projectName="Airrow" action={action} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(action).not.toHaveBeenCalled();
  });

  it("calls the delete action with the project id once confirmed", async () => {
    const user = userEvent.setup();
    const action = vi.fn();
    render(<DeleteProjectDialog projectId="p1" projectName="Airrow" action={action} />);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete project" }));

    expect(action).toHaveBeenCalledOnce();
    const formData = action.mock.calls[0]?.[0] as FormData;
    expect(formData.get("projectId")).toBe("p1");
  });
});
