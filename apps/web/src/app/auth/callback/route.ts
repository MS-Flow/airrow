// Where GitHub sends the founder back (spec 67). Exchanges the one-time code for a session, then
// applies the one gate Supabase does not: the address GitHub returned must be verified *by GitHub*.
//
// Deliberately outside the middleware matcher — the founder has no session yet when they arrive.
import { NextResponse, type NextRequest } from "next/server";
import { githubEmailVerified } from "@/lib/auth";
import { purgeUnverifiedSignup } from "@/lib/data/store";
import { supabaseServer } from "@/lib/data/supabase-server";

/** Signed up within this window counts as "created by the request being rejected". */
const FRESH_SIGNUP_MS = 60_000;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const back = (error?: string): NextResponse =>
    NextResponse.redirect(`${origin}/login${error ? `?error=${error}` : ""}`);

  const code = searchParams.get("code");
  // GitHub sends `error=access_denied` when the founder declines on the consent screen. Nothing has
  // gone wrong, so they land back on the sign-in page rather than on a failure.
  if (searchParams.has("error")) return back();
  if (!code) return back("github");

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return back("github");

  if (!githubEmailVerified(data.user)) {
    await supabase.auth.signOut();
    // No account is created by an unverified address — but `handle_new_user` has already fired, so
    // "not created" has to be made true here. Narrowed to an account this request itself produced:
    // one identity, seconds old. Anything else is somebody's real account and is left alone.
    const identities = data.user.identities ?? [];
    const fresh = Date.now() - Date.parse(data.user.created_at) < FRESH_SIGNUP_MS;
    if (identities.length === 1 && fresh) await purgeUnverifiedSignup(data.user.id);
    return back("github_unverified");
  }

  return NextResponse.redirect(`${origin}/app`);
}
