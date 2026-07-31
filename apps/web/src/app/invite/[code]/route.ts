// The link a founder sends (spec 122). Remembers the code and gets out of the way.
//
// A route rather than `?ref=` on the landing page for a boring reason: a server component cannot set
// a cookie while it renders, and the landing page is outside the middleware matcher. It also happens
// to be the nicer thing to paste into a message.
//
// The code is not checked against the database here. Whether it resolves to a workspace is decided
// when the referral is attached, after verification — this route's only job is to not lose it, and an
// unknown code must look exactly like a known one to whoever is holding the link.
import { NextResponse, type NextRequest } from "next/server";
import { INVITE_COOKIE, INVITE_COOKIE_MAX_AGE, isInviteCode } from "@/features/referrals/attach";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
): Promise<NextResponse> {
  const { code } = await params;
  const { origin } = new URL(request.url);
  const response = NextResponse.redirect(`${origin}/signup`);

  if (!isInviteCode(code)) return response;

  response.cookies.set(INVITE_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    path: "/",
    maxAge: INVITE_COOKIE_MAX_AGE
  });
  return response;
}
