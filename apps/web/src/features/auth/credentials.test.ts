// What may replace a credential, and on what evidence (spec 171).
//
// Every test here is about the same question asked twice: the current password is required, unless the
// founder arrived on a reset link — and "arrived on a reset link" is a cookie only `/auth/reset` can set,
// never a field on the form. A form that could waive it would be a password change anyone with a borrowed
// laptop could make.
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireSession = vi.hoisted(() => vi.fn());
const hasPassword = vi.hoisted(() => vi.fn());
const verifyPassword = vi.hoisted(() => vi.fn());
const updatePassword = vi.hoisted(() => vi.fn());
const changeEmail = vi.hoisted(() => vi.fn());
const sendPasswordReset = vi.hoisted(() => vi.fn());
const inRecovery = vi.hoisted(() => vi.fn());
const clearRecovery = vi.hoisted(() => vi.fn());
// Thrown, like the real one: the code after a `redirect()` never runs in production, and a mock that
// merely records would let these tests pass on control flow that cannot happen.
const redirect = vi.hoisted(() =>
  vi.fn((url: string): never => {
    throw new Error(`REDIRECT:${url}`);
  })
);

vi.mock("@/lib/auth", () => ({
  requireSession,
  hasPassword,
  verifyPassword,
  updatePassword,
  changeEmail,
  sendPasswordReset
}));
vi.mock("@/lib/site-url", () => ({ requestOrigin: async () => "https://airrow.test" }));
vi.mock("./recovery", () => ({ inRecovery, clearRecovery }));
vi.mock("next/navigation", () => ({ redirect }));

const { changeEmailAction, changePasswordAction, sendPasswordSetupAction } = await import(
  "./credentials"
);

/** Where an action sent the founder. Every path through these actions ends in exactly one redirect. */
async function landsOn(run: () => Promise<void>): Promise<string> {
  try {
    await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("REDIRECT:")) return message.slice("REDIRECT:".length);
    throw error;
  }
  throw new Error("the action returned without redirecting");
}

const form = (fields: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
};

const GOOD = { password: "Hunter22x", confirmPassword: "Hunter22x" };

beforeEach(() => {
  vi.clearAllMocks();
  requireSession.mockResolvedValue({ user: { id: "u1", email: "ada@example.com" } });
  hasPassword.mockResolvedValue(true);
  verifyPassword.mockResolvedValue(true);
  updatePassword.mockResolvedValue({ ok: true });
  changeEmail.mockResolvedValue({ status: "confirm-sent" });
  inRecovery.mockResolvedValue(false);
});

describe("changePasswordAction, from Settings", () => {
  it("changes the password when the current one is right", async () => {
    const to = await landsOn(() =>
      changePasswordAction(form({ ...GOOD, currentPassword: "old-one", from: "settings" }))
    );

    expect(verifyPassword).toHaveBeenCalledWith("ada@example.com", "old-one");
    // `others`, not `global`: they are signed in legitimately and stay that way on this device.
    expect(updatePassword).toHaveBeenCalledWith("Hunter22x", "others");
    expect(to).toBe("/app/settings?status=password-changed");
  });

  it("refuses without the current password", async () => {
    const to = await landsOn(() => changePasswordAction(form({ ...GOOD, from: "settings" })));

    expect(to).toBe("/app/settings?error=current-required");
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it("refuses a wrong current password", async () => {
    verifyPassword.mockResolvedValue(false);

    const to = await landsOn(() =>
      changePasswordAction(form({ ...GOOD, currentPassword: "guess", from: "settings" }))
    );

    expect(to).toBe("/app/settings?error=wrong-password");
    expect(updatePassword).not.toHaveBeenCalled();
  });

  // A GitHub-only account cannot have given the right current password, and telling it "that isn't your
  // current password" would send the founder looking for one they never set.
  it("tells a provider-only account it has no password rather than that it got it wrong", async () => {
    hasPassword.mockResolvedValue(false);

    const to = await landsOn(() =>
      changePasswordAction(form({ ...GOOD, currentPassword: "anything", from: "settings" }))
    );

    expect(to).toBe("/app/settings?error=no-password");
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("refuses a mismatched repeat before it reaches Supabase", async () => {
    const to = await landsOn(() =>
      changePasswordAction(
        form({ password: "Hunter22x", confirmPassword: "Hunter22y", currentPassword: "old", from: "settings" })
      )
    );

    expect(to).toBe("/app/settings?error=password-mismatch");
    expect(updatePassword).not.toHaveBeenCalled();
  });

  it("refuses a password that does not meet the rules", async () => {
    const to = await landsOn(() =>
      changePasswordAction(
        form({ password: "alllower", confirmPassword: "alllower", currentPassword: "old", from: "settings" })
      )
    );

    expect(to).toBe("/app/settings?error=weak-password");
  });
});

describe("changePasswordAction, from a reset link", () => {
  beforeEach(() => inRecovery.mockResolvedValue(true));

  it("takes no current password, because the link was the proof", async () => {
    await landsOn(() => changePasswordAction(form({ ...GOOD, from: "reset" })));

    expect(verifyPassword).not.toHaveBeenCalled();
  });

  /*
   * The bug this flow was reported for: clicking the link in the email signed the founder in. Supabase
   * cannot change a password without a session, so one has to exist — but it must not outlive the change.
   * `global` takes this session with it; `others` (what Settings uses) would have left it alive.
   */
  it("ends this session too, so the emailed link never becomes a sign-in", async () => {
    await landsOn(() => changePasswordAction(form({ ...GOOD, from: "reset" })));

    expect(updatePassword).toHaveBeenCalledWith("Hunter22x", "global");
  });

  it("returns the founder to sign-in, to use the password they just chose", async () => {
    const to = await landsOn(() => changePasswordAction(form({ ...GOOD, from: "reset" })));

    expect(to).toBe("/login?status=password-changed");
  });

  // The marker is also what shuts `/app` (middleware.ts) — carrying it past the change would bounce the
  // founder back to a reset screen they have already finished.
  it("spends the marker", async () => {
    await landsOn(() => changePasswordAction(form({ ...GOOD, from: "reset" })));

    expect(clearRecovery).toHaveBeenCalled();
  });

  it("still refuses a password that does not meet the rules", async () => {
    const to = await landsOn(() =>
      changePasswordAction(form({ password: "short", confirmPassword: "short", from: "reset" }))
    );

    expect(to).toBe("/reset-password?error=weak-password");
    expect(updatePassword).not.toHaveBeenCalled();
  });
});

describe("changePasswordAction's return target", () => {
  // The form says which screen it came from, and that value picks between two constants written in the
  // action. Threading a URL would make this an open redirect anyone could post to.
  it("ignores a return target that is not one of the two screens", async () => {
    const to = await landsOn(() =>
      changePasswordAction(form({ ...GOOD, currentPassword: "old", from: "https://evil.test" }))
    );

    expect(to).toBe("/app/settings?status=password-changed");
  });
});

describe("changeEmailAction", () => {
  it("sends a confirmation to the new address and changes nothing yet", async () => {
    const to = await landsOn(() =>
      changeEmailAction(form({ email: "new@example.com", currentPassword: "old-one" }))
    );

    expect(changeEmail).toHaveBeenCalledWith("new@example.com", "https://airrow.test/auth/confirm");
    expect(to).toBe("/app/settings?status=email-sent");
  });

  it("refuses a wrong current password", async () => {
    verifyPassword.mockResolvedValue(false);

    const to = await landsOn(() =>
      changeEmailAction(form({ email: "new@example.com", currentPassword: "guess" }))
    );

    expect(to).toBe("/app/settings?error=email-wrong-password");
    expect(changeEmail).not.toHaveBeenCalled();
  });

  it("refuses without a current password at all", async () => {
    const to = await landsOn(() => changeEmailAction(form({ email: "new@example.com" })));

    expect(to).toBe("/app/settings?error=email-invalid");
    expect(changeEmail).not.toHaveBeenCalled();
  });

  // The recovery marker waives the *password* check, and only that one. A reset link is proof of the old
  // mailbox, which is no reason to hand the account to a new one.
  it("is not waived by a recovery session", async () => {
    inRecovery.mockResolvedValue(true);
    verifyPassword.mockResolvedValue(false);

    const to = await landsOn(() =>
      changeEmailAction(form({ email: "new@example.com", currentPassword: "guess" }))
    );

    expect(to).toBe("/app/settings?error=email-wrong-password");
  });

  it("says so when the address is already this account's", async () => {
    const to = await landsOn(() =>
      changeEmailAction(form({ email: "ADA@example.com", currentPassword: "old-one" }))
    );

    expect(to).toBe("/app/settings?error=email-same");
    expect(changeEmail).not.toHaveBeenCalled();
  });

  it("carries the reason back, rather than the provider's wording", async () => {
    changeEmail.mockResolvedValue({ status: "error", reason: "taken" });

    const to = await landsOn(() =>
      changeEmailAction(form({ email: "taken@example.com", currentPassword: "old-one" }))
    );

    expect(to).toBe("/app/settings?error=email-taken");
  });

  it("tells a provider-only account to set a password first", async () => {
    hasPassword.mockResolvedValue(false);

    const to = await landsOn(() =>
      changeEmailAction(form({ email: "new@example.com", currentPassword: "anything" }))
    );

    expect(to).toBe("/app/settings?error=email-no-password");
  });
});

describe("sendPasswordSetupAction", () => {
  it("mails the account's own address, at this environment's landing", async () => {
    const to = await landsOn(() => sendPasswordSetupAction());

    expect(sendPasswordReset).toHaveBeenCalledWith(
      "ada@example.com",
      "https://airrow.test/auth/reset"
    );
    expect(to).toBe("/app/settings?status=password-link-sent");
  });
});
