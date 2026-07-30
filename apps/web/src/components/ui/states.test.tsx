// A caution is not a failure. The distinction matters to anyone using a screen reader: an error
// interrupts, an advisory is read in its turn — and a warning that announces itself like a crash
// teaches founders to dismiss both without reading.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Notice, UpgradeNotice } from "./states";

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

// A plan boundary is not a failure (spec 100). The whole reason this is its own component rather
// than the danger-toned InlineError, or the warn-toned Notice, is that a founder who learns "limit
// reached" and "something broke" look identical will start ignoring both.
describe("UpgradeNotice", () => {
  it("is never an alert, because nothing has gone wrong", () => {
    render(<UpgradeNotice title="Import is part of Pro">Body</UpgradeNotice>);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("announces politely when it answers something the founder just did", () => {
    render(<UpgradeNotice role="status">You have used your free foundation.</UpgradeNotice>);

    expect(screen.getByRole("status")).toHaveTextContent(/free foundation/i);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("carries the way on when there is one", () => {
    render(
      <UpgradeNotice action={<a href="/app/upgrade">See what Pro gives</a>}>Body</UpgradeNotice>
    );

    expect(screen.getByRole("link", { name: /what pro gives/i })).toBeInTheDocument();
  });

  it("renders without a title or an action", () => {
    render(<UpgradeNotice>Body only</UpgradeNotice>);

    expect(screen.getByText("Body only")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
