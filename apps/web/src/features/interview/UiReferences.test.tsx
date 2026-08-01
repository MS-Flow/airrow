// The reference screen (spec 159).
//
// Two behaviours worth locking down, and they are the two that decide whether this feature is safe:
// a guest is offered no upload at all — because the signed-out interview writes nothing server-side
// and a screenshot is not a reason to open the first unauthenticated write path — and a refusal from
// the server is shown to the founder rather than swallowed.
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MAX_UI_REFERENCE_IMAGES } from "@airrow/schemas";
import { UiReferences } from "./UiReferences";
import type { ReferenceView } from "./references-action";

function uploads(overrides: Partial<Parameters<typeof UiReferences>[0]["uploads"]> = {}) {
  return {
    list: vi.fn(async (): Promise<ReferenceView[]> => []),
    upload: vi.fn(async () => ({})),
    remove: vi.fn(async () => ({})),
    ...overrides
  };
}

const png = () => new File(["bytes"], "shot.png", { type: "image/png" });

describe("the reference screen", () => {
  it("offers a guest the links and tells them where the rest is", async () => {
    render(<UiReferences links="" onLinksChange={() => {}} />);

    expect(screen.getByLabelText(/Products whose look you like/)).toBeInTheDocument();
    expect(screen.getByText(/Attaching screenshots needs an account/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Attach a screenshot/ })).not.toBeInTheDocument();
  });

  it("lets a signed-in founder attach one, and reloads what is attached", async () => {
    const api = uploads();
    render(<UiReferences links="" onLinksChange={() => {}} uploads={api} />);

    const input = document.querySelector("input[type=file]");
    if (!(input instanceof HTMLInputElement)) throw new Error("no file input");
    await userEvent.upload(input, png());

    await waitFor(() => expect(api.upload).toHaveBeenCalledTimes(1));
    // Twice: once on mount, once after the upload landed — the list is the server's answer, never
    // an optimistic guess about what it now holds.
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
  });

  it("shows the server's refusal rather than failing quietly", async () => {
    const api = uploads({ upload: vi.fn(async () => ({ error: "That image is over 2 MB." })) });
    render(<UiReferences links="" onLinksChange={() => {}} uploads={api} />);

    const input = document.querySelector("input[type=file]");
    if (!(input instanceof HTMLInputElement)) throw new Error("no file input");
    await userEvent.upload(input, png());

    expect(await screen.findByText("That image is over 2 MB.")).toBeInTheDocument();
  });

  it("stops offering the button once the ceiling is reached", async () => {
    const full: ReferenceView[] = Array.from({ length: MAX_UI_REFERENCE_IMAGES }, (_, i) => ({
      id: `ref${i}`,
      bytes: 1024,
      url: null
    }));
    render(<UiReferences links="" onLinksChange={() => {}} uploads={uploads({ list: vi.fn(async () => full) })} />);

    const button = await screen.findByRole("button", { name: /That's all four/ });
    expect(button).toBeDisabled();
  });

  it("says what a reference is for, on the screen and not only in the prompt", async () => {
    render(<UiReferences links="" onLinksChange={() => {}} />);

    expect(screen.getByText(/never as something to copy/)).toBeInTheDocument();
    expect(screen.getByText(/Nothing here is fetched/)).toBeInTheDocument();
  });
});
