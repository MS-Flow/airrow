// Where a reset link finishes (spec 171), and what it refuses.
//
// The screen used to live at `/app/password`, which made the session `/auth/reset` creates an ordinary
// sign-in — open the email, be in the workspace. It is public now, and the marker is the only key to it.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const inRecovery = vi.hoisted(() => vi.fn(async () => true));
const redirect = vi.hoisted(() =>
  vi.fn((url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  })
);

vi.mock("@/features/auth/recovery", () => ({ inRecovery }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/features/auth/credentials", () => ({
  changePasswordAction: vi.fn(),
  changeEmailAction: vi.fn(),
  sendPasswordSetupAction: vi.fn()
}));
vi.mock("@/features/auth/PasswordFields", () => ({ PasswordFields: () => null }));

import ResetPasswordPage from "./page";

const page = (params: { error?: string } = {}) =>
  ResetPasswordPage({ searchParams: Promise.resolve(params) });

describe("/reset-password", () => {
  it("asks only for the new password — there is no old one to give", async () => {
    inRecovery.mockResolvedValue(true);

    render(await page());

    expect(screen.getByRole("heading", { name: /choose a new password/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/current password/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /set password and sign in/i })).toBeInTheDocument();
  });

  // Without the marker there is nothing to do here, and no session that should be trusted to do it.
  it("sends an arrival with no marker to sign-in with the reason", async () => {
    inRecovery.mockResolvedValue(false);

    await expect(page()).rejects.toThrow("REDIRECT:/login?error=reset");
  });

  it("offers no way into the app, only back to sign-in", async () => {
    inRecovery.mockResolvedValue(true);

    render(await page());

    const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(links).toContain("/login");
    expect(links.filter((href) => href?.startsWith("/app"))).toHaveLength(0);
  });

  it("shows the reason a change was refused", async () => {
    inRecovery.mockResolvedValue(true);

    render(await page({ error: "password-mismatch" }));

    expect(screen.getByRole("alert").textContent).toMatch(/do not match/i);
  });
});
