// The email confirmation landing (spec 113). The rules here are deliberately thinner than the GitHub
// callback's: clicking the link is the verification, so there is no provider flag to second-guess and
// no account to delete. What matters is that a stale or reused link lands somewhere useful — and, since
// spec 122, that an invitation is spent at the one moment this account is known to be verified.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const exchange = vi.fn();
const attachPendingReferral = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("@/lib/data/supabase-server", () => ({
  supabaseServer: async () => ({ auth: { exchangeCodeForSession: exchange } })
}));
vi.mock("@/features/referrals/attach", () => ({ attachPendingReferral }));

const { GET } = await import("./route");

const request = (query: string): NextRequest =>
  new NextRequest(`https://airrow.test/auth/confirm${query}`);

const confirmed = {
  data: { user: { id: "user-1", created_at: "2026-08-01T09:00:00.000Z" } },
  error: null
};

beforeEach(() => {
  exchange.mockReset();
  attachPendingReferral.mockClear();
});

describe("GET /auth/confirm", () => {
  it("lands a confirmed founder in the workspace", async () => {
    exchange.mockResolvedValue(confirmed);

    const response = await GET(request("?code=abc"));

    expect(exchange).toHaveBeenCalledWith("abc");
    expect(response.headers.get("location")).toBe("https://airrow.test/app");
  });

  it("spends any pending invitation for the account it just confirmed", async () => {
    exchange.mockResolvedValue(confirmed);

    await GET(request("?code=abc"));

    expect(attachPendingReferral).toHaveBeenCalledWith({
      id: "user-1",
      createdAt: "2026-08-01T09:00:00.000Z"
    });
  });

  it("sends a link with no code to sign-in with a reason", async () => {
    const response = await GET(request(""));

    expect(exchange).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://airrow.test/login?error=confirm");
  });

  // Clicking yesterday's link, or the same link twice, is ordinary behaviour — not a crash.
  it("sends an expired or reused link to sign-in with a reason", async () => {
    exchange.mockResolvedValue({ data: { user: null }, error: { message: "invalid flow state" } });

    const response = await GET(request("?code=stale"));

    expect(response.headers.get("location")).toBe("https://airrow.test/login?error=confirm");
    expect(attachPendingReferral).not.toHaveBeenCalled();
  });
});
