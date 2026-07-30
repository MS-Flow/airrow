// Where the email confirmation link lands (spec 113).
//
// Separate from `/auth/callback` on purpose. That route is GitHub's: it applies a gate Supabase does
// not — the address the provider returned must be verified *by GitHub* — and deletes the account when
// it is not. None of that belongs to an email confirmation, where clicking the link *is* the
// verification. Sharing the route would have worked today and quietly coupled two flows whose rules
// differ.
//
// Deliberately outside the middleware matcher, like the GitHub callback: the founder has no session
// yet when they arrive.
import { NextResponse, type NextRequest } from "next/server";
import { attachPendingReferral } from "@/features/referrals/attach";
import { supabaseServer } from "@/lib/data/supabase-server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  // An expired or already-used link is the common case here, not an exotic one: founders click the
  // link twice, or a day later. Both land on sign-in with a reason rather than on a stack trace.
  if (!code) return NextResponse.redirect(`${origin}/login?error=confirm`);

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(`${origin}/login?error=confirm`);

  // Clicking the link *is* the verification, so this is the moment an invitation can be attached to
  // the new workspace (spec 122). It cannot fail loudly: nothing about a referral is worth breaking a
  // confirmed signup over.
  await attachPendingReferral({ id: data.user.id, createdAt: data.user.created_at });

  // Confirmed and signed in — straight to the workspace, which is what the founder was doing when
  // the confirmation interrupted them.
  return NextResponse.redirect(`${origin}/app`);
}
