"use server";

// Changing the two things a founder signs in with (spec 171).
//
// One action per credential, both reached from two screens: the Settings cards and the page a reset link
// lands on. What differs between those arrivals is only whether the current password has to be given, and
// that is decided here — from a cookie only `/auth/reset` can set — never from anything the form sends.
import { redirect } from "next/navigation";
import { emailChangeSchema, passwordChangeSchema } from "@airrow/schemas";
import {
  changeEmail,
  hasPassword,
  requireSession,
  sendPasswordReset,
  updatePassword,
  verifyPassword
} from "@/lib/auth";
import { requestOrigin } from "@/lib/site-url";
import { clearRecovery, inRecovery } from "./recovery";

/**
 * The two screens these actions can return to, as a closed set.
 *
 * The form says which one it came from, and a form field is not a redirect target: it picks between two
 * constants written here. Threading the URL itself would make every one of these actions an open
 * redirect reachable by anyone who can post to it.
 */
const RETURN_TO = {
  settings: "/app/settings",
  password: "/app/password"
} as const;

function returnTo(value: FormDataEntryValue | null): string {
  return value === "password" ? RETURN_TO.password : RETURN_TO.settings;
}

/**
 * Replace the password.
 *
 * The current one is required unless the founder arrived on a reset link — they have just proved control
 * of the mailbox, which is the same proof a password is, and by definition cannot supply the old one.
 */
export async function changePasswordAction(formData: FormData): Promise<void> {
  const { user } = await requireSession();
  const back = returnTo(formData.get("from"));

  const parsed = passwordChangeSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword")
  });
  if (!parsed.success) {
    const mismatch = parsed.error.issues.some((issue) => issue.path[0] === "confirmPassword");
    redirect(`${back}?error=${mismatch ? "password-mismatch" : "weak-password"}`);
  }

  const recovery = await inRecovery();
  if (!recovery) {
    const current = formData.get("currentPassword");
    if (typeof current !== "string" || !current) redirect(`${back}?error=current-required`);
    // Asked before it is verified: an account with no password cannot have given the right one, and
    // "that isn't your current password" would be a confusing thing to tell someone who has never set
    // one. The Settings card offers the link that fixes it.
    if (!(await hasPassword())) redirect(`${back}?error=no-password`);
    if (!(await verifyPassword(user.email, current))) redirect(`${back}?error=wrong-password`);
  }

  const result = await updatePassword(parsed.data.password);
  if (!result.ok) redirect(`${back}?error=password-failed`);

  // Spent, whichever screen this was. A waiver that outlived the change it paid for would let a second
  // one through without the current password.
  await clearRecovery();
  // Settings either way, and out of the recovery screen entirely: that form has nothing left to say, and
  // leaving the founder on one they have just satisfied reads as though it did not take. `/app` was the
  // first choice and is wrong — the dashboard reads no query string, so the one confirmation that a
  // locked-out founder needs ("it worked, and the other sessions are gone") vanished on arrival.
  redirect(`${RETURN_TO.settings}?status=password-changed`);
}

/**
 * Start moving the login address. Nothing changes until the new address confirms.
 *
 * Password-only, deliberately: an account that signs in with GitHub or Google has nothing to prove itself
 * with here, and "set a password first" is a smaller ask than inventing a second re-authentication path
 * for a screen that changes where the founder's mail goes.
 */
export async function changeEmailAction(formData: FormData): Promise<void> {
  const { user } = await requireSession();

  const parsed = emailChangeSchema.safeParse({
    email: formData.get("email"),
    currentPassword: formData.get("currentPassword")
  });
  if (!parsed.success) redirect("/app/settings?error=email-invalid");
  if (parsed.data.email.toLowerCase() === user.email.toLowerCase()) {
    redirect("/app/settings?error=email-same");
  }

  // Prefixed, like every other answer this action gives: the Settings page renders two cards from one
  // query string, and an unprefixed reason would be shown under the password form as well.
  if (!(await hasPassword())) redirect("/app/settings?error=email-no-password");
  if (!(await verifyPassword(user.email, parsed.data.currentPassword))) {
    redirect("/app/settings?error=email-wrong-password");
  }

  // The same landing as a signup confirmation, and safely so: `attachPendingReferral` there ignores
  // accounts older than ten minutes, so an established founder confirming a new address cannot spend an
  // invitation. One fewer redirect target for both allow-lists to carry.
  const result = await changeEmail(parsed.data.email, `${await requestOrigin()}/auth/confirm`);
  if (result.status === "error") redirect(`/app/settings?error=email-${result.reason}`);
  redirect("/app/settings?status=email-sent");
}

/**
 * Mail a link to an account that has no password yet, so it can set one.
 *
 * The same reset mail the signed-out flow sends — to Supabase there is no difference between choosing a
 * password and replacing one, and there is no reason for Airrow to invent one.
 */
export async function sendPasswordSetupAction(): Promise<void> {
  const { user } = await requireSession();
  await sendPasswordReset(user.email, `${await requestOrigin()}/auth/reset`);
  redirect("/app/settings?status=password-link-sent");
}
