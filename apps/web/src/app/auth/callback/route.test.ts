// The OAuth callback, and the one rule it enforces that Supabase does not: the provider must have
// verified the address. The unverified case is the security-relevant one — an account nobody proved they
// own must not exist afterwards, and must not be linked to anybody's workspace.
//
// Both GitHub and Google land here (spec 140), so the route also has to name the right one.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const exchange = vi.fn();
const signOut = vi.fn();
const purge = vi.fn();
const attachPendingReferral = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("@/features/referrals/attach", () => ({ attachPendingReferral }));

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

/**
 * A user as Supabase returns one, with the identity's verification flag under our control.
 *
 * `app_metadata.provider` is what the route reads to decide *which* identity to check, so it travels
 * with the provider rather than being set separately — a fixture where the two disagree would be
 * testing a state Supabase never produces.
 */
const user = (
  emailVerified: boolean | undefined,
  createdAt = new Date().toISOString(),
  provider: "github" | "google" = "github"
) => ({
  id: "user-1",
  email: "ada@example.com",
  created_at: createdAt,
  email_confirmed_at: null,
  app_metadata: { provider },
  identities: [{ provider, identity_data: { email_verified: emailVerified } }]
});

beforeEach(() => {
  exchange.mockReset();
  signOut.mockReset();
  purge.mockReset();
  attachPendingReferral.mockClear();
});

describe("GET /auth/callback", () => {
  it("lands a verified sign-in in the app", async () => {
    exchange.mockResolvedValue({ data: { user: user(true) }, error: null });

    const response = await GET(request("?code=abc"));

    expect(response.headers.get("location")).toBe("https://airrow.test/app");
    expect(purge).not.toHaveBeenCalled();
  });

  // GitHub is the other way in, and losing the invitation for everyone who prefers it would leave
  // half the feature silently broken (spec 122).
  it("spends a pending invitation on a verified sign-in", async () => {
    exchange.mockResolvedValue({ data: { user: user(true, "2026-08-01T09:00:00.000Z") }, error: null });

    await GET(request("?code=abc"));

    expect(attachPendingReferral).toHaveBeenCalledWith({
      id: "user-1",
      createdAt: "2026-08-01T09:00:00.000Z"
    });
  });

  it("spends nothing for an address GitHub has not verified", async () => {
    exchange.mockResolvedValue({ data: { user: user(false) }, error: null });

    await GET(request("?code=abc"));

    expect(attachPendingReferral).not.toHaveBeenCalled();
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

  /*
   * Names no provider, and that is the point (spec 140). Before the exchange there is no session, so
   * nothing here can say which button was pressed — and the obvious fix, a `?provider=` hint on the
   * redirect target, is the one thing that must not happen: Supabase matches that target against an
   * allow-list of exact paths, so a query string would have stopped both GitHub and Google working.
   */
  it("reports a failed exchange rather than pretending to be signed in", async () => {
    exchange.mockResolvedValue({ data: { user: null }, error: { message: "bad code" } });

    const response = await GET(request("?code=abc"));

    expect(response.headers.get("location")).toBe("https://airrow.test/login?error=oauth");
  });

  it("names the provider once the session can say which one it was", async () => {
    exchange.mockResolvedValue({ data: { user: user(false, new Date().toISOString(), "google") }, error: null });

    const response = await GET(request("?code=abc"));

    expect(response.headers.get("location")).toBe("https://airrow.test/login?error=google_unverified");
  });
});
