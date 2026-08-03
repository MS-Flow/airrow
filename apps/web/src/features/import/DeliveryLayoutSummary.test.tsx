// The import review screen, after the question moved to the interview (spec 199).
//
// It used to ask; now it reports. What is worth testing is that it still says the two things a
// founder cannot see from a label — hidden ships no CI, and integrated is what their team sees —
// and that it offers the one way back, so "read-only" never means "stuck".
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { DeliveryLayoutSummary } from "./DeliveryLayoutSummary";

describe("DeliveryLayoutSummary", () => {
  it("reports an integrated foundation as what the team sees", () => {
    render(
      <DeliveryLayoutSummary
        projectId="p1"
        delivery={{ kind: "integrated" }}
        regenerateNeeded={false}
      />
    );
    expect(screen.getByText("Integrated")).toBeTruthy();
    expect(screen.getByText(/what your team sees/)).toBeTruthy();
  });

  it("names the folder, the ignore rule and the missing CI for a hidden one", () => {
    render(
      <DeliveryLayoutSummary
        projectId="p1"
        delivery={{ kind: "hidden", folder: "notes" }}
        regenerateNeeded={false}
      />
    );
    expect(screen.getByText("Hidden")).toBeTruthy();
    expect(screen.getByText("notes/")).toBeTruthy();
    expect(screen.getByText(/No CI files are delivered/)).toBeTruthy();
  });

  it("sends the founder back to the interview to change it, rather than asking again", () => {
    render(
      <DeliveryLayoutSummary
        projectId="p1"
        delivery={{ kind: "integrated" }}
        regenerateNeeded={false}
      />
    );
    // No control that writes: this screen is not the second writer it used to be.
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByRole("link", { name: /Change this in the interview/ })).toHaveAttribute(
      "href",
      "/app/projects/p1/interview"
    );
  });

  it("says a generated foundation keeps its current layout until the next run", () => {
    render(
      <DeliveryLayoutSummary projectId="p1" delivery={{ kind: "integrated" }} regenerateNeeded />
    );
    expect(screen.getByText(/next time you generate/)).toBeTruthy();
  });
});
