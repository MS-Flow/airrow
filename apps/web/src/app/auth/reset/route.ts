// Where the password-reset link lands (spec 171).
//
// Its own route rather than a branch inside `/auth/confirm`, for the reason that kept confirm out of
// `/auth/callback`: the exchange is the same, and what happens next is not. A confirmation drops the
// founder in the workspace they were already heading for; a recovery has to land on the one screen that
// finishes the job, carrying the marker that lets it skip a password nobody in this flow remembers.
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

  const response = NextResponse.redirect(`${origin}/app/password`);
  response.cookies.set(recoveryCookie);
  return response;
}
