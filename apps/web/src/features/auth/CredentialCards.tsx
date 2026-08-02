// The two credential cards (spec 171), shared by Settings and by the screen a reset link lands on.
//
// One component per credential rather than one per screen: the recovery arrival differs from the Settings
// one by a single field and a heading, and two copies of a password form would eventually disagree about
// which rules apply.
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineError, Notice } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { PasswordFields } from "@/features/auth/PasswordFields";
import {
  changeEmailAction,
  changePasswordAction,
  sendPasswordSetupAction
} from "@/features/auth/credentials";

/**
 * One sentence per cause, each giving the advice that is right for *that* cause — the shape spec 135
 * settled on for signup.
 *
 * **Split by card, not pooled.** Both cards live on the same page and read the same query string, so a
 * shared map put every answer in both of them: "open the link we sent to the new address" appeared under
 * the password form as well, which is two instructions for one action. Every email-side key therefore
 * carries the `email-` prefix its action redirects with, and each card renders only its own.
 */
export const PASSWORD_MESSAGES: Record<string, string> = {
  "weak-password": "That password doesn't meet every requirement listed below.",
  "password-mismatch": "The two passwords do not match. Retype them and try again.",
  "current-required": "Enter your current password to confirm the change.",
  "wrong-password": "That is not your current password.",
  "no-password": "This account signs in with GitHub or Google and has no password yet. Set one first.",
  "password-failed": "The password could not be changed. Nothing was updated, so it's safe to try again.",
  "password-changed": "Password changed. Other devices have been signed out.",
  "password-link-sent": "Check your inbox — the link sets a password for this account."
};

export const EMAIL_MESSAGES: Record<string, string> = {
  "email-invalid": "Enter a valid email address and your current password.",
  "email-wrong-password": "That is not your current password.",
  "email-no-password":
    "This account signs in with GitHub or Google. Set a password below before changing the address.",
  "email-same": "That is already your login address.",
  "email-taken": "That address already belongs to an account.",
  // No "try signing in" and no mention of the address: a limit is temporary and about us, not them.
  "email-rate-limited":
    "Too much mail from this account in the last hour, so we can't send the confirmation yet. Try again in a few minutes.",
  "email-unknown": "The address could not be changed. Nothing was updated, so it's safe to try again.",
  "email-sent": "Almost there: open the link we sent to the new address to finish the change."
};

/** Errors carry `role="alert"`; a success is read in page order, like every other confirmation here. */
function Feedback({
  messages,
  error,
  status
}: {
  messages: Record<string, string>;
  error?: string;
  status?: string;
}) {
  if (error && messages[error]) return <InlineError className="mb-4">{messages[error]}</InlineError>;
  if (status && messages[status]) {
    return <p className="mb-4 text-sm text-success">{messages[status]}</p>;
  }
  return null;
}

/**
 * Choosing a password.
 *
 * `recovery` is passed by the caller that read the cookie, never inferred here — and it changes only what
 * is *shown*. Whether the current password is actually required is decided again in the action, which is
 * the copy that matters.
 */
export function PasswordCard({
  recovery = false,
  hasPassword,
  error,
  status
}: {
  recovery?: boolean;
  hasPassword: boolean;
  error?: string;
  status?: string;
}) {
  return (
    <Card className={recovery ? undefined : "mt-4"}>
      <CardHeader>
        <CardTitle>{recovery ? "Choose a new password" : "Password"}</CardTitle>
      </CardHeader>
      <CardBody>
        <Feedback messages={PASSWORD_MESSAGES} error={error} status={status} />

        {!recovery && !hasPassword ? (
          <>
            <p className="max-w-prose text-sm leading-relaxed text-fg-muted">
              You sign in with GitHub or Google, so this account has no password yet. Setting one adds a
              second way in — it doesn&apos;t remove the first.
            </p>
            <form action={sendPasswordSetupAction} className="mt-4">
              <SubmitButton size="sm" variant="secondary" pendingLabel="Sending…">
                Email me a link to set one
              </SubmitButton>
            </form>
          </>
        ) : (
          <form action={changePasswordAction} className="max-w-sm space-y-4">
            <input type="hidden" name="from" value={recovery ? "password" : "settings"} />
            {recovery ? (
              <p className="text-sm leading-relaxed text-fg-muted">
                The link you followed is the proof — choose the password you want and you&apos;re back in.
              </p>
            ) : (
              <div>
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
            )}
            <PasswordFields label="New password" />
            <SubmitButton size="sm" pendingLabel="Saving…">
              {recovery ? "Set password and continue" : "Change password"}
            </SubmitButton>
          </form>
        )}
      </CardBody>
    </Card>
  );
}

/** Moving the login address. Nothing changes until the new address confirms, and the card says so first. */
export function EmailCard({
  email,
  hasPassword,
  error,
  status
}: {
  email: string;
  hasPassword: boolean;
  error?: string;
  status?: string;
}) {
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Email</CardTitle>
      </CardHeader>
      <CardBody>
        <Feedback messages={EMAIL_MESSAGES} error={error} status={status} />

        <p className="text-sm text-fg-muted">
          You sign in as <span className="font-medium text-fg">{email}</span>.
        </p>

        {hasPassword ? (
          <form action={changeEmailAction} className="mt-4 max-w-sm space-y-4">
            <div>
              <Label htmlFor="email">New email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
              <p className="mt-1.5 text-xs leading-relaxed text-fg-faint">
                We&apos;ll send a confirmation link to the new address. Your login stays{" "}
                {email} until you open it.
              </p>
            </div>
            <div>
              {/* Not "Current password" a second time: the page carries a password form as well, and two
                  fields with the same name are a coin flip for anyone navigating by label. */}
              <Label htmlFor="emailCurrentPassword">Confirm with your password</Label>
              <Input
                id="emailCurrentPassword"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            <SubmitButton size="sm" pendingLabel="Sending…">
              Send confirmation link
            </SubmitButton>
          </form>
        ) : (
          <Notice title="Set a password first" className="mt-4">
            This account signs in with GitHub or Google. Changing where your login mail goes needs a
            password to confirm it&apos;s you — set one above, then come back.
          </Notice>
        )}
      </CardBody>
    </Card>
  );
}
