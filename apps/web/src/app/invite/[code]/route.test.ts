// The link a founder pastes into a message (spec 122). It has to work for someone who is not signed
// in, on a device that has never seen Airrow, and it must not tell the holder whether the code is real
// — an unknown code and a valid one look the same from here, and the difference is decided later.
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { INVITE_COOKIE } from "@/features/referrals/attach";
import { GET } from "./route";

const visit = (code: string, origin = "https://airrow.test") =>
  GET(new NextRequest(`${origin}/invite/${code}`), { params: Promise.resolve({ code }) });

describe("GET /invite/[code]", () => {
  it("remembers the code and sends the visitor to signup", async () => {
    const response = await visit("Ab3-_xyzQR12");

    expect(response.headers.get("location")).toBe("https://airrow.test/signup");
    const cookie = response.cookies.get(INVITE_COOKIE);
    expect(cookie?.value).toBe("Ab3-_xyzQR12");
    // Never readable by script: the cookie is the only thing that can attach a referral.
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
  });

  it("still sends a nonsense code to signup, remembering nothing", async () => {
    const response = await visit("not a code");

    expect(response.headers.get("location")).toBe("https://airrow.test/signup");
    expect(response.cookies.get(INVITE_COOKIE)).toBeUndefined();
  });

  it("leaves the cookie insecure only where the connection is", async () => {
    // Local development is http, and a `secure` cookie there is a cookie that never arrives.
    const response = await visit("Ab3-_xyzQR12", "http://localhost:3000");

    expect(response.cookies.get(INVITE_COOKIE)?.secure).toBe(false);
  });
});
