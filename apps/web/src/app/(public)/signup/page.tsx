import Link from "next/link";
import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";
import { signupSchema } from "@airrow/schemas";
import { AirrowLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineError } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { PasswordFields } from "@/features/auth/PasswordFields";
import { ProviderButtons } from "@/features/auth/ProviderButtons";
import { signUp } from "@/lib/auth";
import { requestOrigin } from "@/lib/site-url";

async function signupAction(formData: FormData) {
  "use server";
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword")
  });
  // A mismatch gets its own answer: it is the one failure here the founder fixes by retyping rather than
  // by choosing something different, and "check your details" would send them looking in the wrong place.
  if (!parsed.success) {
    const mismatch = parsed.error.issues.some((issue) => issue.path[0] === "confirmPassword");
    redirect(`/signup?error=${mismatch ? "password-mismatch" : "invalid"}`);
  }

  // The confirmation link has to come back to the environment this signup happened on — one Supabase
  // project serves dev and production alike, so its Site URL cannot answer for both (spec 113).
  const result = await signUp(
    parsed.data.name,
    parsed.data.email,
    parsed.data.password,
    `${await requestOrigin()}/auth/confirm`
  );
  // The reason travels; the provider's own words never do (spec 135).
  if (result.status === "error") redirect(`/signup?error=${result.reason}`);
  // No session means the project requires e-mail confirmation — say so instead of
  // sending them to /app, which would bounce them back to /login.
  redirect(result.status === "signed-in" ? "/app" : "/signup?status=check-inbox");
}

export const metadata = { title: "Create account" };

/**
 * One sentence per cause, and each gives the advice that is right for *that* cause (spec 135).
 *
 * `exists` is kept alongside `already-registered`: a founder can be holding a bookmarked or half-typed
 * URL from before this change, and a query string nobody recognises would render a blank error.
 */
const messages: Record<string, string> = {
  invalid: "Enter a name, a valid email, and a password that meets every requirement listed below.",
  "password-mismatch": "The two passwords do not match. Retype them and try again.",
  "already-registered": "That email already has an account. Try signing in instead.",
  exists: "That email already has an account. Try signing in instead.",
  // Deliberately no "try signing in": there is no account yet, and sending them to a login that will
  // also fail is how a temporary limit turns into a founder who never comes back.
  "rate-limited":
    "Too many signups from here in the last hour, so we can't send the confirmation email yet. Wait a few minutes and try again — nothing is wrong with your details.",
  unknown: "Signup didn't go through. Nothing was created, so it's safe to try again."
};

export default async function SignupPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const { error, status } = await searchParams;

  if (status === "check-inbox") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-6 py-16">
        <div className="w-full max-w-sm animate-slide-up text-center">
          <Link href="/" className="mb-10 flex justify-center" aria-label="Airrow home">
            <AirrowLogo size="lg" priority />
          </Link>
          <Card>
            <CardBody className="p-8">
              <MailCheck className="mx-auto size-6 text-fg-muted" />
              <h1 className="mt-4 text-lg font-semibold tracking-tight text-fg">
                Confirm your email
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                Your account exists, but this workspace requires a confirmed email address. Open the
                link we just sent you, then sign in.
              </p>
              <Button variant="secondary" className="mt-6 w-full" asChild>
                <Link href="/login">Go to sign in</Link>
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 py-16">
      <div className="w-full max-w-sm animate-slide-up">
        <Link href="/" className="mb-10 flex justify-center" aria-label="Airrow home">
          <AirrowLogo size="lg" priority />
        </Link>

        <Card>
          <CardBody className="p-8">
            <h1 className="text-lg font-semibold tracking-tight text-fg">Create your account</h1>
            <p className="mt-1 text-sm text-fg-muted">
              A personal workspace is created for you automatically.
            </p>

            {error ? (
              <InlineError className="mt-4">{messages[error] ?? messages.invalid}</InlineError>
            ) : null}

            <form action={signupAction} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" placeholder="John Smith" required autoFocus maxLength={80} />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="you@company.com" required />
              </div>
              <PasswordFields />
              <SubmitButton className="w-full" pendingLabel="Creating account…">
                Create account
              </SubmitButton>
            </form>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-2xs uppercase tracking-wide text-fg-faint">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <ProviderButtons />
          </CardBody>
        </Card>

        <p className="mt-5 text-center text-sm text-fg-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-fg underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
