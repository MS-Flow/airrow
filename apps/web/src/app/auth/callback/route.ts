// Where GitHub and Google send the founder back (specs 67, 140). Exchanges the one-time code for a
// session, then applies the one gate Supabase does not: the address the provider returned must be
// verified *by that provider*.
//
// Both providers land here, so every message it can send names the one actually used — a founder who
// clicked Google is not helped by being told GitHub failed.
//
// Deliberately outside the middleware matcher — the founder has no session yet when they arrive.
import { NextResponse, type NextRequest } from "next/server";
import { captureSignup } from "@/features/analytics/signup";
import { attachPendingReferral } from "@/features/referrals/attach";
import { oauthProviderOf, providerEmailVerified } from "@/lib/auth";
import { purgeUnverifiedSignup } from "@/lib/data/store";
import { supabaseServer } from "@/lib/data/supabase-server";

/** Signed up within this window counts as "created by the request being rejected". */
const FRESH_SIGNUP_MS = 60_000;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const back = (error?: string): NextResponse =>
    NextResponse.redirect(`${origin}/login${error ? `?error=${error}` : ""}`);

  const code = searchParams.get("code");
  // Both providers send `error=access_denied` when the founder declines on the consent screen. Nothing
  // has gone wrong, so they land back on the sign-in page rather than on a failure.
  if (searchParams.has("error")) return back();
  // Before the exchange there is no session, and therefore nothing that can say which provider this was.
  // It stays unnamed rather than guessed: the redirect target carries no `?provider=` hint, because
  // Supabase matches that target against an allow-list of exact paths and a query string stops matching
  // — which would break both providers to make one sentence more specific (spec 140).
  if (!code) return back("oauth");

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return back("oauth");

  // Past the exchange the session names the identity that was actually used, which is what the gate
  // below has to be decided on anyway.
  const provider = oauthProviderOf(data.user);

  if (!providerEmailVerified(data.user, provider)) {
    await supabase.auth.signOut();
    // No account is created by an unverified address — but `handle_new_user` has already fired, so
    // "not created" has to be made true here. Narrowed to an account this request itself produced:
    // one identity, seconds old. Anything else is somebody's real account and is left alone.
    const identities = data.user.identities ?? [];
    const fresh = Date.now() - Date.parse(data.user.created_at) < FRESH_SIGNUP_MS;
    if (identities.length === 1 && fresh) await purgeUnverifiedSignup(data.user.id);
    return back(`${provider}_unverified`);
  }

  // Past the gate above, the address is verified by the provider — the same standard the email route's link
  // click meets, so an invitation counts here too (spec 122). `attachPendingReferral` decides for
  // itself whether this account is new enough: this route runs on every sign-in, not only the first.
  await attachPendingReferral({ id: data.user.id, createdAt: data.user.created_at });
  // Beside the referral, on the same freshness test: this route runs on every sign-in, and only the
  // first one is a signup (spec 182).
  await captureSignup({ id: data.user.id, createdAt: data.user.created_at }, provider);

  return NextResponse.redirect(`${origin}/app`);
}
