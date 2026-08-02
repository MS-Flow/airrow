// Where the password-reset link lands (spec 171).
//
// Its own route rather than a branch inside `/auth/confirm`, for the reason that kept confirm out of
// `/auth/callback`: the exchange is the same, and what happens next is not. A confirmation drops the
// founder in the workspace they were already heading for. A recovery must not — clicking a link in an
// email is not a sign-in, and the session created here exists only so that Supabase will accept a new
// password. The marker set below is what keeps it that way: `middleware.ts` shuts `/app` while it is
// there, and the change ends the session and returns the founder to `/login`.
//
// Deliberately outside the middleware matcher, like the other two: the founder has no session on arrival.
import { NextResponse, type NextRequest } from "next/server";
import { recoveryCookie } from "@/features/auth/recovery";
import { supabaseServer } from "@/lib/data/supabase-server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);

  // Expired, already used, or opened from a mail client that pre-fetched it — all ordinary here, and all
  // fixed the same way: ask for another link. `/login` is where that offer lives.
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(`${origin}/login?error=reset`);

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${origin}/login?error=reset`);

  const response = NextResponse.redirect(`${origin}/reset-password`);
  response.cookies.set(recoveryCookie);
  return response;
}
