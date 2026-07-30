// The OAuth callback, and the one rule it enforces that Supabase does not: GitHub must have verified
// the address. The unverified case is the security-relevant one — an account nobody proved they own
// must not exist afterwards, and must not be linked to anybody's workspace.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const exchange = vi.fn();
const signOut = vi.fn();
const purge = vi.fn();

vi.mock("@/lib/data/supabase-server", () => ({
  supabaseServer: async () => ({ auth: { exchangeCodeForSession: exchange, signOut } })
}));
// `@/lib/auth` pulls the store in for its session helpers; only the purge matters here.
vi.mock("@/lib/data/store", () => ({
  purgeUnverifiedSignup: purge,
  getOrgForUser: vi.fn(),
  setDisplayName: vi.fn()
}));

const { GET } = await import("./route");

const request = (query: string): NextRequest =>
  new NextRequest(`https://airrow.test/auth/callback${query}`);

/** A user as Supabase returns one, with the GitHub identity's verification flag under our control. */
const user = (emailVerified: boolean | undefined, createdAt = new Date().toISOString()) => ({
  id: "user-1",
  email: "ada@example.com",
  created_at: createdAt,
  email_confirmed_at: null,
  identities: [{ provider: "github", identity_data: { email_verified: emailVerified } }]
});

beforeEach(() => {
  exchange.mockReset();
  signOut.mockReset();
  purge.mockReset();
});

describe("GET /auth/callback", () => {
  it("lands a verified sign-in in the app", async () => {
    exchange.mockResolvedValue({ data: { user: user(true) }, error: null });

    const response = await GET(request("?code=abc"));

    expect(response.headers.get("location")).toBe("https://airrow.test/app");
    expect(purge).not.toHaveBeenCalled();
  });

  it("refuses an address GitHub has not verified, and leaves no account behind", async () => {
    exchange.mockResolvedValue({ data: { user: user(false) }, error: null });

    const response = await GET(request("?code=abc"));

    expect(response.headers.get("location")).toBe(
      "https://airrow.test/login?error=github_unverified"
    );
    expect(signOut).toHaveBeenCalled();
    expect(purge).toHaveBeenCalledWith("user-1");
  });

  it("never deletes an account that already existed before this sign-in", async () => {
    const old = new Date("2026-01-01T00:00:00Z").toISOString();
    exchange.mockResolvedValue({ data: { user: user(false, old) }, error: null });

    await GET(request("?code=abc"));

    expect(signOut).toHaveBeenCalled();
    expect(purge).not.toHaveBeenCalled();
  });

  it("sends a declined consent screen back to sign-in without an error", async () => {
    const response = await GET(request("?error=access_denied"));

    expect(response.headers.get("location")).toBe("https://airrow.test/login");
    expect(exchange).not.toHaveBeenCalled();
  });

  it("reports a failed exchange rather than pretending to be signed in", async () => {
    exchange.mockResolvedValue({ data: { user: null }, error: { message: "bad code" } });

    const response = await GET(request("?code=abc"));

    expect(response.headers.get("location")).toBe("https://airrow.test/login?error=github");
  });
});
