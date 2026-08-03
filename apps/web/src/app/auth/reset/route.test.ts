// The password-reset landing (spec 171). Two things matter here and nothing else: a real code produces
// the recovery marker, and everything that is not a real code produces none — because that cookie is
// what waives the current-password check on the screen this redirects to.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const exchange = vi.fn();

vi.mock("@/lib/data/supabase-server", () => ({
  supabaseServer: async () => ({ auth: { exchangeCodeForSession: exchange } })
}));

const { GET } = await import("./route");
const { RECOVERY_COOKIE, RECOVERY_MAX_AGE } = await import("@/features/auth/recovery");

const request = (query: string): NextRequest =>
  new NextRequest(`https://airrow.test/auth/reset${query}`);

beforeEach(() => {
  exchange.mockReset();
});

describe("GET /auth/reset", () => {
  it("lands a verified founder on the password screen", async () => {
    exchange.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const response = await GET(request("?code=abc"));

    expect(exchange).toHaveBeenCalledWith("abc");
    expect(response.headers.get("location")).toBe("https://airrow.test/app/password");
  });

  it("marks the session as a recovery, httpOnly and short-lived", async () => {
    exchange.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    const cookie = (await GET(request("?code=abc"))).cookies.get(RECOVERY_COOKIE);

    expect(cookie?.value).toBe("1");
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.maxAge).toBe(RECOVERY_MAX_AGE);
  });

  it("sends a link with no code to sign-in with a reason, and marks nothing", async () => {
    const response = await GET(request(""));

    expect(exchange).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://airrow.test/login?error=reset");
    expect(response.cookies.get(RECOVERY_COOKIE)).toBeUndefined();
  });

  // A reset link is single-use and expires in an hour, so this is the ordinary path, not the exotic one.
  it("sends an expired or reused link to sign-in with a reason, and marks nothing", async () => {
    exchange.mockResolvedValue({ data: { user: null }, error: { message: "invalid flow state" } });

    const response = await GET(request("?code=stale"));

    expect(response.headers.get("location")).toBe("https://airrow.test/login?error=reset");
    expect(response.cookies.get(RECOVERY_COOKIE)).toBeUndefined();
  });
});
