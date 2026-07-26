import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression tests for the auth outcomes that used to collapse into "success" and
// "wrong password" — the pair that made an unconfirmed account indistinguishable
// from bad credentials.

const signUpMock = vi.fn();
const signInMock = vi.fn();

vi.mock("@/lib/data/supabase-server", () => ({
  supabaseServer: async () => ({
    auth: { signUp: signUpMock, signInWithPassword: signInMock }
  })
}));
vi.mock("@/lib/data/store", () => ({
  getOrgForUser: vi.fn(),
  setDisplayName: vi.fn()
}));

const { signIn, signUp } = await import("./auth");

beforeEach(() => {
  signUpMock.mockReset();
  signInMock.mockReset();
});

describe("signUp", () => {
  it("reports a session when the project signs the user straight in", async () => {
    signUpMock.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
    await expect(signUp("Ada", "ada@example.com", "hunter22")).resolves.toEqual({
      status: "signed-in"
    });
  });

  it("reports confirmation-required when no session comes back", async () => {
    signUpMock.mockResolvedValue({ data: { session: null, user: { id: "u1" } }, error: null });
    await expect(signUp("Ada", "ada@example.com", "hunter22")).resolves.toEqual({
      status: "confirmation-required"
    });
  });

  it("surfaces the provider error message", async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: { message: "User exists" } });
    await expect(signUp("Ada", "ada@example.com", "hunter22")).resolves.toEqual({
      status: "error",
      message: "User exists"
    });
  });
});

describe("signIn", () => {
  it("distinguishes an unconfirmed email from a wrong password", async () => {
    signInMock.mockResolvedValue({
      error: { code: "email_not_confirmed", message: "Email not confirmed" }
    });
    await expect(signIn("ada@example.com", "hunter22")).resolves.toEqual({
      status: "unconfirmed"
    });
  });

  it("recognises an unconfirmed email from the message alone", async () => {
    signInMock.mockResolvedValue({ error: { message: "Email not confirmed" } });
    await expect(signIn("ada@example.com", "hunter22")).resolves.toEqual({
      status: "unconfirmed"
    });
  });

  it("reports bad credentials as an error", async () => {
    signInMock.mockResolvedValue({ error: { code: "invalid_credentials", message: "Bad login" } });
    await expect(signIn("ada@example.com", "nope")).resolves.toEqual({
      status: "error",
      message: "Bad login"
    });
  });

  it("reports success", async () => {
    signInMock.mockResolvedValue({ error: null });
    await expect(signIn("ada@example.com", "hunter22")).resolves.toEqual({ status: "signed-in" });
  });
});
