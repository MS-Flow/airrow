// Auth gate (issue #18, supersedes the F-202 cookie-presence check). Refreshes the
// Supabase session on every matched request and redirects unauthenticated users away
// from the app. Coarse enforcement — RSC/actions still call requireSession() for the
// actual org-scoping (defense in depth).
import { NextResponse, type NextRequest } from "next/server";
import { RECOVERY_COOKIE } from "@/features/auth/recovery-cookie";
import { updateSession } from "@/lib/data/supabase-middleware";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  /*
   * A reset link is not a sign-in (spec 171).
   *
   * Supabase cannot change a password without a session, so `/auth/reset` has to create one — and the
   * first version of this stopped there, which meant clicking the link in an email dropped the founder
   * into a fully signed-in workspace. Anyone holding that mail held the account, and the password they
   * came to change was never the thing that let them in.
   *
   * So while the marker is set, this session reaches exactly one screen. Checked before the Supabase
   * round-trip because it does not depend on it, and it is deliberately blind to whether the session is
   * valid: a request carrying this cookie has no business in `/app` either way.
   */
  if (request.cookies.get(RECOVERY_COOKIE)) return refuse(request, "/reset-password");

  const { response, userId } = await updateSession(request);
  if (userId) return response;

  return refuse(request, "/login");
}

/** Matched but not allowed: 401 for the API, and for a page the screen that says what to do instead. */
function refuse(request: NextRequest, pathname: string): NextResponse {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/app/:path*", "/api/projects/:path*"]
};
