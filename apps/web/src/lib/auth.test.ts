import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression tests for the auth outcomes that used to collapse into "success" and
// "wrong password" — the pair that made an unconfirmed account indistinguishable
// from bad credentials.

const signUpMock = vi.fn();
const signInMock = vi.fn();
const oauthMock = vi.fn();

vi.mock("@/lib/data/supabase-server", () => ({
  supabaseServer: async () => ({
    auth: { signUp: signUpMock, signInWithPassword: signInMock, signInWithOAuth: oauthMock }
  })
}));
vi.mock("@/lib/data/store", () => ({
  getOrgForUser: vi.fn(),
  setDisplayName: vi.fn()
}));

const { githubEmailVerified, signIn, signInWithGitHub, signUp } = await import("./auth");

beforeEach(() => {
  signUpMock.mockReset();
  signInMock.mockReset();
  oauthMock.mockReset();
});

const CONFIRM_URL = "https://dev.airrow.app/auth/confirm";

describe("signUp", () => {
  it("reports a session when the project signs the user straight in", async () => {
    signUpMock.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
    await expect(signUp("Ada", "ada@example.com", "hunter22", CONFIRM_URL)).resolves.toEqual({
      status: "signed-in"
    });
  });

  it("reports confirmation-required when no session comes back", async () => {
    signUpMock.mockResolvedValue({ data: { session: null, user: { id: "u1" } }, error: null });
    await expect(signUp("Ada", "ada@example.com", "hunter22", CONFIRM_URL)).resolves.toEqual({
      status: "confirmation-required"
    });
  });

  it("surfaces the provider error message", async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: { message: "User exists" } });
    await expect(signUp("Ada", "ada@example.com", "hunter22", CONFIRM_URL)).resolves.toEqual({
      status: "error",
      message: "User exists"
    });
  });

  // The confirmation link's host comes from this argument, not from the project's Site URL — one
  // Supabase project serves both dev and production, so dropping it mails everyone the same link
  // (spec 113).
  it("sends the confirmation link back to the environment the founder signed up on", async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null });

    await signUp("Ada", "ada@example.com", "hunter22", CONFIRM_URL);

    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ emailRedirectTo: CONFIRM_URL })
      })
    );
  });

  it("still carries the display name through as user metadata", async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null });

    await signUp("Ada", "ada@example.com", "hunter22", CONFIRM_URL);

    expect(signUpMock).toHaveBeenCalledWith(
      expect.objectContaining({ options: expect.objectContaining({ data: { name: "Ada" } }) })
    );
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

describe("signInWithGitHub", () => {
  it("asks GitHub for no scopes at all", async () => {
    oauthMock.mockResolvedValue({ data: { url: "https://github.com/login/oauth" }, error: null });

    await signInWithGitHub("https://airrow.test/auth/callback");

    expect(oauthMock).toHaveBeenCalledWith({
      provider: "github",
      options: { scopes: "", redirectTo: "https://airrow.test/auth/callback" }
    });
  });

  it("reports a provider that will not start the flow", async () => {
    oauthMock.mockResolvedValue({ data: { url: null }, error: { message: "provider disabled" } });

    await expect(signInWithGitHub("https://airrow.test/auth/callback")).resolves.toEqual({
      error: "provider disabled"
    });
  });
});

describe("githubEmailVerified", () => {
  // `as` justified throughout: these are the two fields the function reads, and building a whole
  // Supabase `User` would say nothing extra about the decision being tested.
  const asUser = (value: unknown) => value as Parameters<typeof githubEmailVerified>[0];

  it("accepts an address GitHub says it verified", () => {
    const user = { identities: [{ provider: "github", identity_data: { email_verified: true } }] };
    expect(githubEmailVerified(asUser(user))).toBe(true);
  });

  it("rejects an unverified address even when the account looks confirmed", () => {
    const user = {
      email_confirmed_at: "2026-07-01T00:00:00Z",
      identities: [{ provider: "github", identity_data: { email_verified: false } }]
    };
    expect(githubEmailVerified(asUser(user))).toBe(false);
  });

  it("falls back to the account's own confirmation when the identity carries no flag", () => {
    const withFlag = { email_confirmed_at: "2026-07-01T00:00:00Z", identities: [] };
    const without = { email_confirmed_at: null, identities: [] };

    expect(githubEmailVerified(asUser(withFlag))).toBe(true);
    expect(githubEmailVerified(asUser(without))).toBe(false);
  });
});
