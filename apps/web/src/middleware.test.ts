// The gate in front of `/app` (spec 18), and the second thing it now refuses (spec 171).
//
// A reset link has to create a session — Supabase will not change a password without one — and the first
// version of this feature let that session into the workspace. Anyone holding the email held the account.
// The marker is what makes it a key to one screen instead of a sign-in, and this is where that is
// enforced for every route at once rather than page by page.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const updateSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/data/supabase-middleware", () => ({ updateSession }));

const { middleware } = await import("./middleware");
const { RECOVERY_COOKIE } = await import("./features/auth/recovery-cookie");

const request = (path: string, cookies: Record<string, string> = {}): NextRequest => {
  const req = new NextRequest(`https://airrow.test${path}`);
  for (const [name, value] of Object.entries(cookies)) req.cookies.set(name, value);
  return req;
};

const signedIn = async (req: NextRequest) => ({
  response: new Response(null, { status: 200 }),
  userId: "user-1",
  request: req
});

beforeEach(() => {
  updateSession.mockReset();
  updateSession.mockImplementation(async (req: NextRequest) => (await signedIn(req)) as never);
});

describe("the recovery marker", () => {
  it("keeps a mid-reset session out of the app, however valid it is", async () => {
    const response = await middleware(request("/app/projects", { [RECOVERY_COOKIE]: "1" }));

    expect(response.headers.get("location")).toBe("https://airrow.test/reset-password");
    // Not even asked: the answer does not depend on whether the session is good.
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("drops the path it was aiming for, rather than carrying it into the reset screen", async () => {
    const response = await middleware(
      request("/app/projects?tab=recent", { [RECOVERY_COOKIE]: "1" })
    );

    expect(response.headers.get("location")).toBe("https://airrow.test/reset-password");
  });

  it("answers the API with 401 rather than a redirect no fetch can follow", async () => {
    const response = await middleware(request("/api/projects/1", { [RECOVERY_COOKIE]: "1" }));

    expect(response.status).toBe(401);
  });

  it("lets an ordinary session through untouched", async () => {
    await middleware(request("/app/projects"));

    expect(updateSession).toHaveBeenCalled();
  });
});

describe("no session at all", () => {
  it("sends a page to sign-in", async () => {
    updateSession.mockImplementation(async (req: NextRequest) => ({
      response: new Response(null, { status: 200 }),
      userId: null,
      request: req
    }));

    const response = await middleware(request("/app"));

    expect(response.headers.get("location")).toBe("https://airrow.test/login");
  });

  it("answers the API with 401", async () => {
    updateSession.mockImplementation(async (req: NextRequest) => ({
      response: new Response(null, { status: 200 }),
      userId: null,
      request: req
    }));

    const response = await middleware(request("/api/projects/1"));

    expect(response.status).toBe(401);
  });
});
