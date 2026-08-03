// The invited half of "invite a friend" (spec 122): carrying a code from a link click to a verified
// account, and spending it there.
//
// A cookie rather than a query parameter threaded through signup, because the founder leaves us
// entirely in between — to their inbox, or to GitHub's consent screen — and comes back on a URL we do
// not control. httpOnly, so the one thing that can attach a referral is never readable by script.
import { cookies } from "next/headers";
import { attachReferral } from "@/lib/data/referrals";
import { getOrgForUser } from "@/lib/data/store";

export const INVITE_COOKIE = "airrow_invite";

/** Long enough to survive a confirmation email that sits unread over a holiday. */
export const INVITE_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * How new an account has to be for a referral to count.
 *
 * `/auth/callback` runs on *every* GitHub sign-in, not only the first, so without this an old cookie
 * would attach a referral to an account that existed long before the link was clicked. Generous
 * enough for a slow consent screen, far short of a returning founder.
 */
const NEW_ACCOUNT_MS = 10 * 60_000;

/** Codes are 80 random bits in base64url; anything else never came from us. */
export function isInviteCode(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,64}$/.test(value);
}

/**
 * Spend the invite cookie, if this account is one an invitation can be credited for.
 *
 * The cookie is cleared whatever happens: it has been used, it did not apply, or it was never valid,
 * and in all three cases keeping it only risks attaching it to some later account.
 *
 * Never throws. A referral is the least important thing happening in a verification route — a founder
 * whose signup broke because somebody else's reward could not be recorded is a far worse outcome than
 * a reward quietly not recorded.
 */
export async function attachPendingReferral(user: { id: string; createdAt: string }): Promise<void> {
  try {
    const jar = await cookies();
    const code = jar.get(INVITE_COOKIE)?.value;
    if (!code) return;
    jar.delete(INVITE_COOKIE);

    if (!isInviteCode(code)) return;
    if (Date.now() - Date.parse(user.createdAt) > NEW_ACCOUNT_MS) return;

    // The workspace `handle_new_user` provisioned on signup. Its absence would mean the account is
    // half-created, which is not a state to attach anything to.
    const org = await getOrgForUser(user.id);
    if (!org) return;

    await attachReferral(code, org.id);
  } catch {
    // Deliberately silent, per the contract above.
  }
}
