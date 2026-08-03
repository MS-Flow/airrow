// The choice that decides where a whole foundation lands (spec 187).
//
// What matters here is that each mode's consequence is stated before it is picked — a founder
// choosing "hidden" is choosing what their team will and will not see, and a label alone does not
// tell them that. The folder field is the other half: it arrives filled in, and it stays editable,
// because a name they cannot change is a name they cannot make ordinary.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./actions", () => ({ setDeliveryLayoutAction: vi.fn() }));

import { DeliveryLayoutChoice } from "./DeliveryLayoutChoice";

function choice(current: "integrated" | "hidden", regenerateNeeded = false) {
  render(
    <DeliveryLayoutChoice
      projectId="p1"
      current={current}
      folderPrefill="sebastian"
      regenerateNeeded={regenerateNeeded}
    />
  );
}

describe("DeliveryLayoutChoice", () => {
  it("offers both layouts with what each one does to the founder's repository", () => {
    choice("integrated");
    expect(screen.getByRole("radio", { name: /Integrated/ })).toBeTruthy();
    expect(screen.getByRole("radio", { name: /Hidden/ })).toBeTruthy();
    expect(screen.getByText(/what your team sees/)).toBeTruthy();
    expect(screen.getByText(/diff stays empty/)).toBeTruthy();
  });

  it("says the ignore rule is the one that is never pushed", () => {
    choice("integrated");
    expect(screen.getByText(/\.git\/info\/exclude/)).toBeTruthy();
  });

  it("warns that no CI ships, before the founder picks hidden", () => {
    choice("integrated");
    expect(screen.getByText(/No CI files are delivered/)).toBeTruthy();
  });

  it("keeps the folder field out of the way until hidden is chosen", () => {
    choice("integrated");
    expect(screen.queryByLabelText("Folder name")).toBeNull();
  });

  it("prefills the folder with the founder's own name, and lets them replace it", async () => {
    choice("hidden");
    const field = screen.getByLabelText("Folder name");
    expect((field as HTMLInputElement).value).toBe("sebastian");

    await userEvent.clear(field);
    await userEvent.type(field, "notes");
    expect((field as HTMLInputElement).value).toBe("notes");
  });

  it("reveals the folder field when the founder switches to hidden", async () => {
    choice("integrated");
    await userEvent.click(screen.getByRole("radio", { name: /Hidden/ }));
    expect(screen.getByLabelText("Folder name")).toBeTruthy();
  });
});
