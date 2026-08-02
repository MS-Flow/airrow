// Where a reset link finishes, and what it looks like when the link is spent (spec 171).
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const requireSession = vi.hoisted(() => vi.fn(async () => ({ user: { email: "ada@example.com" } })));
const hasPassword = vi.hoisted(() => vi.fn(async () => true));
const inRecovery = vi.hoisted(() => vi.fn(async () => true));

vi.mock("@/lib/auth", () => ({ requireSession, hasPassword }));
vi.mock("@/features/auth/recovery", () => ({ inRecovery }));
vi.mock("@/features/auth/credentials", () => ({
  changePasswordAction: vi.fn(),
  changeEmailAction: vi.fn(),
  sendPasswordSetupAction: vi.fn()
}));
vi.mock("@/features/auth/PasswordFields", () => ({ PasswordFields: () => null }));

import PasswordPage from "./page";

const page = (params: { error?: string; status?: string } = {}) =>
  PasswordPage({ searchParams: Promise.resolve(params) });

describe("/app/password", () => {
  it("asks only for the new password when the founder came from a link", async () => {
    inRecovery.mockResolvedValue(true);

    render(await page());

    expect(screen.getByRole("heading", { name: /choose a new password/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/current password/i)).not.toBeInTheDocument();
  });

  /*
   * The suspension gate, and the reason this screen lives inside `/app` at all: `requireSession()` reads
   * the suspension from the database on every request and redirects, so resetting a password can never
   * be a way back into a suspended account (spec 164).
   */
  it("goes through requireSession, so a suspended account is still stopped", async () => {
    render(await page());

    expect(requireSession).toHaveBeenCalled();
  });

  // Landing here without the marker means the link was already used, or an hour went by. Saying "nothing
  // was reset" is the difference between a dead end and a detour.
  it("explains a spent link and asks for the current password instead", async () => {
    inRecovery.mockResolvedValue(false);

    render(await page());

    expect(screen.getByText(/nothing was reset/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /send yourself another link/i })).toBeInTheDocument();
  });

  it("shows the reason a change was refused", async () => {
    inRecovery.mockResolvedValue(true);

    render(await page({ error: "password-mismatch" }));

    expect(screen.getByRole("alert").textContent).toMatch(/do not match/i);
  });
});
