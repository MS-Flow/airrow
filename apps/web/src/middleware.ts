// Route protection (F-202 FR-2). Cookie presence check only — full validation
// happens server-side in requireSession().
import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has("airrow_session");
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/app") && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (pathname === "/login" && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/login"]
};
