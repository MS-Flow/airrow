// Where a reset link finishes (spec 171).
//
// Public rather than under `/app`, and that is the whole point. It used to be `/app/password`, which
// meant the session `/auth/reset` creates was an ordinary sign-in: whoever opened the email was in the
// workspace, and the password they came to change had stopped being what let them in. Now the marker
// shuts `/app` for as long as it is set, this is the only screen it opens, and setting the password ends
// the session and sends the founder to `/login` to use it.
//
// The marker is the only key. Without it there is nothing to do here, so an arrival with no marker is
// sent to sign-in with the reason — the same answer a spent or expired link gets from `/auth/reset`.
import Link from "next/link";
import { redirect } from "next/navigation";
import { AirrowLogo } from "@/components/brand/logo";
import { PasswordCard } from "@/features/auth/CredentialCards";
import { inRecovery } from "@/features/auth/recovery";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (!(await inRecovery())) redirect("/login?error=reset");

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 py-16">
      <div className="w-full max-w-sm animate-slide-up">
        <Link href="/" className="mb-10 flex justify-center" aria-label="Airrow home">
          <AirrowLogo size="lg" priority />
        </Link>

        <PasswordCard recovery hasPassword error={error} />

        {/* No way onward but this one: there is nothing else this session may reach, and a link into the
            app would be an invitation to try. */}
        <p className="mt-5 text-center text-sm text-fg-muted">
          Changed your mind?{" "}
          <Link href="/login" className="font-medium text-fg underline-offset-4 hover:underline">
            Back to sign in
          </Link>{" "}
          — your old password still works until you set a new one.
        </p>
      </div>
    </div>
  );
}
