// The signup password fields (spec 140). The estimator is mocked: it is a dictionary lookup with its own
// tests upstream, and what matters here is that the screen refuses, explains and unblocks correctly.
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const score = vi.fn<(password: string) => number>(() => 4);

vi.mock("@zxcvbn-ts/core", () => ({
  ZxcvbnFactory: class {
    check(password: string) {
      return { score: score(password) };
    }
  }
}));
vi.mock("@zxcvbn-ts/language-common", () => ({ dictionary: {}, adjacencyGraphs: {} }));

import { PasswordFields } from "./PasswordFields";

const STRONG = "Correct-Horse9";

const password = () => screen.getByLabelText("Password");
const repeat = () => screen.getByLabelText("Repeat password");

describe("PasswordFields", () => {
  it("shows every requirement before a character is typed", () => {
    render(<PasswordFields />);

    for (const requirement of [
      "At least 8 characters",
      "A lowercase letter",
      "A capital letter",
      "A number"
    ]) {
      expect(screen.getByText(requirement)).toBeInTheDocument();
    }
  });

  /*
   * Removed on purpose: demanding a symbol is what produces `Passw0rd!`, and the estimator below judges
   * the result better than the rule ever did. Asserted absent so it does not creep back.
   */
  it("does not demand a special character", () => {
    render(<PasswordFields />);

    expect(screen.queryByText(/special character/i)).not.toBeInTheDocument();
  });

  it("ticks requirements off as they are satisfied", async () => {
    const user = userEvent.setup();
    render(<PasswordFields />);

    await user.type(password(), "abcdefgh");

    expect(screen.getByText("At least 8 characters").parentElement).toHaveTextContent("done");
    expect(screen.getByText("A capital letter").parentElement).toHaveTextContent("still needed");
  });

  it("blocks a password that has not met every requirement", async () => {
    const user = userEvent.setup();
    render(<PasswordFields />);

    await user.type(password(), "abcdefgh");

    await waitFor(() =>
      expect((password() as HTMLInputElement).validationMessage).toMatch(/does not meet all/i)
    );
  });

  /*
   * The whole reason the estimator is here rather than a character count: this password satisfies all
   * five rules and is still one of the first a guesser tries.
   */
  it("blocks a structurally valid password the estimator rates as guessable", async () => {
    const user = userEvent.setup();
    score.mockReturnValue(1);
    render(<PasswordFields />);

    await user.type(password(), "Passw0rd!");

    await waitFor(() =>
      expect((password() as HTMLInputElement).validationMessage).toMatch(/harder to guess/i)
    );
    expect(screen.getByText("Weak")).toBeInTheDocument();
  });

  it("clears the block once the password is both complete and hard enough", async () => {
    const user = userEvent.setup();
    score.mockReturnValue(4);
    render(<PasswordFields />);

    await user.type(password(), STRONG);
    await user.type(repeat(), STRONG);

    await waitFor(() => expect((password() as HTMLInputElement).validationMessage).toBe(""));
    expect((repeat() as HTMLInputElement).validationMessage).toBe("");
    expect(screen.getByText("Strong")).toBeInTheDocument();
  });

  it("reveals and re-hides what was typed without submitting the form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PasswordFields />
      </form>
    );

    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).toHaveAttribute("type", "button");

    await user.click(toggle);
    expect(password()).toHaveAttribute("type", "text");
    expect(onSubmit).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password()).toHaveAttribute("type", "password");
  });

  /*
   * Each toggle owns its own field. Revealing the repeat while the original stays hidden is the
   * comparison the second field exists for, and a button inside one box that silently changed the other
   * would be a surprise.
   */
  it("gives the repeat field its own toggle, independent of the first", async () => {
    const user = userEvent.setup();
    render(<PasswordFields />);

    await user.click(screen.getByRole("button", { name: "Show repeat password" }));

    expect(repeat()).toHaveAttribute("type", "text");
    expect(password()).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Hide repeat password" }));
    expect(repeat()).toHaveAttribute("type", "password");
  });

  it("reports a mismatch as it is typed, and blocks on it", async () => {
    const user = userEvent.setup();
    render(<PasswordFields />);

    await user.type(password(), STRONG);
    await user.type(repeat(), "Correct-Horse8");

    expect(screen.getByText("The two passwords do not match.")).toBeInTheDocument();
    expect(repeat()).toHaveAttribute("aria-invalid", "true");
    await waitFor(() =>
      expect((repeat() as HTMLInputElement).validationMessage).toMatch(/do not match/i)
    );
  });

  it("says nothing about a repeat field nobody has filled in yet", async () => {
    const user = userEvent.setup();
    render(<PasswordFields />);

    await user.type(password(), STRONG);

    expect(screen.queryByText("The two passwords do not match.")).not.toBeInTheDocument();
  });

  it("posts the two fields under the names the schema parses", () => {
    render(<PasswordFields />);

    expect(password()).toHaveAttribute("name", "password");
    expect(repeat()).toHaveAttribute("name", "confirmPassword");
  });
});
