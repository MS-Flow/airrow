// Auth gate (issue #18, supersedes the F-202 cookie-presence check). Refreshes the
// Supabase session on every matched request and redirects unauthenticated users away
// from the app. Coarse enforcement — RSC/actions still call requireSession() for the
// actual org-scoping (defense in depth).
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/data/supabase-middleware";

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { response, userId } = await updateSession(request);
  if (userId) return response;

  // Matched but unauthenticated: 401 for the API, redirect to /login for pages.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/app/:path*", "/api/projects/:path*"]
};
