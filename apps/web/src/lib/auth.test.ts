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

const {
  oauthProviderOf,
  providerEmailVerified,
  signIn,
  signInWithGitHub,
  signInWithGoogle,
  signUp,
  signUpFailure
} = await import("./auth");

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

  // Every failure used to come back as one message, which the screen then rendered as "that email is
  // already registered" — telling a rate-limited founder they have an account they do not have (spec 135).
  it("classifies the failure instead of passing the provider's words on", async () => {
    signUpMock.mockResolvedValue({
      data: { session: null },
      error: { message: "User already registered", code: "user_already_exists" }
    });

    await expect(signUp("Ada", "ada@example.com", "hunter22", CONFIRM_URL)).resolves.toEqual({
      status: "error",
      reason: "already-registered"
    });
  });

  it("does not call a rate limit a duplicate address", async () => {
    // The failure that started this: a fresh address, refused because Supabase would not send more
    // confirmation mail that hour, reported to the founder as "that email is already registered".
    signUpMock.mockResolvedValue({
      data: { session: null },
      error: { message: "email rate limit exceeded", code: "over_email_send_rate_limit" }
    });

    await expect(signUp("Ada", "new@example.com", "hunter22", CONFIRM_URL)).resolves.toEqual({
      status: "error",
      reason: "rate-limited"
    });
  });

  describe("classifying a failure", () => {
    it.each([
      ["a duplicate by code", { code: "user_already_exists" }, "already-registered"],
      ["a duplicate by the other code", { code: "email_exists" }, "already-registered"],
      ["a rate limit by code", { code: "over_email_send_rate_limit" }, "rate-limited"],
      ["a rate limit by status", { status: 429, message: "Too Many Requests" }, "rate-limited"],
      // No code at all: an older client, where the message is all there is.
      ["a duplicate by message", { message: "User already registered" }, "already-registered"],
      [
        "a rate limit by message",
        { message: "For security purposes, you can only request this after 51 seconds." },
        "rate-limited"
      ]
    ])("reads %s", (_label, error, expected) => {
      expect(signUpFailure(error)).toBe(expected);
    });

    it("refuses to guess at a cause it does not recognise", () => {
      // The whole bug in one line: the old code called this one "already registered" too.
      expect(signUpFailure({ message: "Database error saving new user" })).toBe("unknown");
      expect(signUpFailure({})).toBe("unknown");
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

describe("providerEmailVerified", () => {
  // `as` justified throughout: these are the two fields the function reads, and building a whole
  // Supabase `User` would say nothing extra about the decision being tested.
  const asUser = (value: unknown) => value as Parameters<typeof providerEmailVerified>[0];

  it("accepts an address GitHub says it verified", () => {
    const user = { identities: [{ provider: "github", identity_data: { email_verified: true } }] };
    expect(providerEmailVerified(asUser(user), "github")).toBe(true);
  });

  it("rejects an unverified address even when the account looks confirmed", () => {
    const user = {
      email_confirmed_at: "2026-07-01T00:00:00Z",
      identities: [{ provider: "github", identity_data: { email_verified: false } }]
    };
    expect(providerEmailVerified(asUser(user), "github")).toBe(false);
  });

  it("falls back to the account's own confirmation when the identity carries no flag", () => {
    const withFlag = { email_confirmed_at: "2026-07-01T00:00:00Z", identities: [] };
    const without = { email_confirmed_at: null, identities: [] };

    expect(providerEmailVerified(asUser(withFlag), "github")).toBe(true);
    expect(providerEmailVerified(asUser(without), "github")).toBe(false);
  });

  it("reads Google's own flag, not GitHub's, for a Google sign-in (spec 140)", () => {
    const user = { identities: [{ provider: "google", identity_data: { email_verified: false } }] };
    expect(providerEmailVerified(asUser(user), "google")).toBe(false);
  });

  /*
   * The bug the provider argument exists to prevent. A founder who linked both accounts has two
   * identities; searching for "the GitHub one" would clear a Google sign-in on evidence GitHub gave
   * about a different address.
   */
  it("does not let a verified GitHub identity vouch for an unverified Google one", () => {
    const user = {
      email_confirmed_at: null,
      identities: [
        { provider: "github", identity_data: { email_verified: true } },
        { provider: "google", identity_data: { email_verified: false } }
      ]
    };

    expect(providerEmailVerified(asUser(user), "google")).toBe(false);
    expect(providerEmailVerified(asUser(user), "github")).toBe(true);
  });
});

describe("oauthProviderOf", () => {
  const asUser = (value: unknown) => value as Parameters<typeof oauthProviderOf>[0];

  it("names Google when that is the identity the session was created with", () => {
    expect(oauthProviderOf(asUser({ app_metadata: { provider: "google" } }))).toBe("google");
  });

  it("treats anything else as GitHub, so the gate still runs", () => {
    expect(oauthProviderOf(asUser({ app_metadata: { provider: "github" } }))).toBe("github");
    expect(oauthProviderOf(asUser({ app_metadata: {} }))).toBe("github");
  });
});

describe("signInWithGoogle", () => {
  it("always asks Google which account to use", async () => {
    oauthMock.mockResolvedValue({ data: { url: "https://accounts.google.com/o/oauth2" }, error: null });

    await expect(signInWithGoogle("https://airrow.test/auth/callback?provider=google")).resolves.toEqual({
      url: "https://accounts.google.com/o/oauth2"
    });
    expect(oauthMock).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://airrow.test/auth/callback?provider=google",
        queryParams: { prompt: "select_account" }
      }
    });
  });

  it("reports a provider that is switched off without repeating its wording", async () => {
    oauthMock.mockResolvedValue({ data: { url: null }, error: { message: "provider disabled" } });

    await expect(signInWithGoogle("https://airrow.test/auth/callback")).resolves.toEqual({
      error: "provider disabled"
    });
  });
});
