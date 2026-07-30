// A caution is not a failure. The distinction matters to anyone using a screen reader: an error
// interrupts, an advisory is read in its turn — and a warning that announces itself like a crash
// teaches founders to dismiss both without reading.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Notice } from "./states";

describe("Notice", () => {
  it("renders its title and body", () => {
    render(<Notice title="Leave secrets out">Rotate anything that has left your machine.</Notice>);

    expect(screen.getByRole("heading", { name: "Leave secrets out" })).toBeInTheDocument();
    expect(screen.getByText(/rotate anything that has left your machine/i)).toBeInTheDocument();
  });

  it("stays silent by default — a standing advisory is not an announcement", () => {
    render(<Notice title="Leave secrets out">Body</Notice>);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("becomes a polite live region when it reports something that just happened", () => {
    render(<Notice role="status">Your archive was too large to keep in this browser.</Notice>);

    expect(screen.getByRole("status")).toHaveTextContent(/too large to keep/i);
    // Still not an alert: the import succeeded, only the caching did not.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders without a title", () => {
    render(<Notice role="status">Body only</Notice>);

    expect(screen.getByText("Body only")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
