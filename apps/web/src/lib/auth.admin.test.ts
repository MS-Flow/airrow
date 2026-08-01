// The gate (spec 150).
//
// Two behaviours that decide whether the console is safe, tested without a database because both are
// pure control flow over `profileFlags`:
//
// - a signed-in founder who is not an operator gets `notFound()`, not a redirect that would confirm
//   the route exists;
// - a suspended account has no session at all, so the token it is holding stops working at the next
//   server call rather than whenever it happens to expire.
import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/supabase-server", () => ({
  supabaseServer: async () => ({ auth: { getUser } })
}));

const getOrgForUser = vi.hoisted(() => vi.fn());
const profileFlags = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/store", () => ({ getOrgForUser, profileFlags, setDisplayName: vi.fn() }));

// `notFound` and `redirect` throw in Next, which is how they interrupt a render. Thrown sentinels
// here let a test assert *which* one was reached.
const NOT_FOUND = new Error("NEXT_NOT_FOUND");
const REDIRECT = new Error("NEXT_REDIRECT");
const redirect = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
  notFound: () => notFound()
}));

import { getSession, requireAdmin, requireSession } from "./auth";

const ORG = { id: "org1", name: "Workspace", kind: "personal", createdBy: "u1", plan: "free" };

function signedInAs(flags: { isAdmin: boolean; suspendedAt: string | null }): void {
  getUser.mockResolvedValue({
    data: { user: { id: "u1", email: "founder@example.com", created_at: "2026-01-01", user_metadata: {} } }
  });
  getOrgForUser.mockResolvedValue(ORG);
  profileFlags.mockResolvedValue(flags);
}

describe("the session gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirect.mockImplementation(() => {
      throw REDIRECT;
    });
    notFound.mockImplementation(() => {
      throw NOT_FOUND;
    });
  });

  it("carries whether the account operates Airrow", async () => {
    signedInAs({ isAdmin: true, suspendedAt: null });
    await expect(getSession()).resolves.toMatchObject({ isAdmin: true });
  });

  it("refuses a suspended account even though its token is still valid", async () => {
    // The point of the whole design: Supabase still says this is a real, signed-in user.
    signedInAs({ isAdmin: false, suspendedAt: "2026-07-31T00:00:00.000Z" });

    await expect(getSession()).resolves.toBeNull();
  });

  it("sends a suspended account back to sign-in rather than rendering the app", async () => {
    signedInAs({ isAdmin: false, suspendedAt: "2026-07-31T00:00:00.000Z" });

    await expect(requireSession()).rejects.toBe(REDIRECT);
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("lets a reactivated account straight back in", async () => {
    signedInAs({ isAdmin: false, suspendedAt: null });
    await expect(getSession()).resolves.toMatchObject({ user: { id: "u1" } });
  });
});

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirect.mockImplementation(() => {
      throw REDIRECT;
    });
    notFound.mockImplementation(() => {
      throw NOT_FOUND;
    });
  });

  it("lets an operator through", async () => {
    signedInAs({ isAdmin: true, suspendedAt: null });
    await expect(requireAdmin()).resolves.toMatchObject({ isAdmin: true });
    expect(notFound).not.toHaveBeenCalled();
  });

  it("404s a signed-in founder instead of redirecting them", async () => {
    // A redirect to /app would tell them /app/admin is real and merely forbidden. It is none of
    // their business that an operator console exists at all.
    signedInAs({ isAdmin: false, suspendedAt: null });

    await expect(requireAdmin()).rejects.toBe(NOT_FOUND);
    expect(notFound).toHaveBeenCalledTimes(1);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("refuses a suspended admin before it ever asks whether they are an admin", async () => {
    // Suspension outranks the flag: the session is gone, so this is a sign-in redirect and not a 404.
    signedInAs({ isAdmin: true, suspendedAt: "2026-07-31T00:00:00.000Z" });

    await expect(requireAdmin()).rejects.toBe(REDIRECT);
    expect(notFound).not.toHaveBeenCalled();
  });

  it("refuses a signed-out visitor", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    await expect(requireAdmin()).rejects.toBe(REDIRECT);
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});
