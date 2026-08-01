import Link from "next/link";
import { redirect } from "next/navigation";
import { loginSchema } from "@airrow/schemas";
import { AirrowLogo } from "@/components/brand/logo";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineError } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { ProviderButtons } from "@/features/auth/ProviderButtons";
import { signIn } from "@/lib/auth";

async function loginAction(formData: FormData) {
  "use server";
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });
  if (!parsed.success) redirect("/login?error=invalid");

  const result = await signIn(parsed.data.email, parsed.data.password);
  if (result.status === "unconfirmed") redirect("/login?error=unconfirmed");
  if (result.status === "error") redirect("/login?error=invalid");
  redirect("/app");
}

export const metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  invalid: "Invalid email or password.",
  unconfirmed: "Confirm your email address first — open the link we sent you, then sign in.",
  // A confirmation link that has expired or already been used (spec 113). Ordinary, not a fault:
  // signing in resends one if the address still needs confirming.
  confirm: "That confirmation link is no longer valid. Sign in to get a new one.",
  github: "GitHub sign-in did not complete. Try again, or sign in with your email and password.",
  // Verified by GitHub, not by us: an address nobody has proved they own is no way to identify
  // someone, and linking on it would let anyone claim an existing Airrow account (spec 67).
  github_unverified:
    "GitHub has not verified the email address on your account. Verify it with GitHub, then sign in here again — nothing was created.",
  // The same two sentences for Google, because the same two things can go wrong (spec 140). Named
  // separately rather than shared: a founder who pressed Google is not helped by being told about GitHub.
  google: "Google sign-in did not complete. Try again, or sign in with your email and password.",
  google_unverified:
    "Google has not verified the email address on that account. Verify it with Google, then sign in here again — nothing was created.",
  // A flow that failed before there was a session to ask which provider it was. Deliberately names
  // neither: the alternative was a query-string hint on the redirect target, which Supabase's allow-list
  // matches as an exact path and would have refused (spec 140). One vaguer sentence on a rare path is a
  // better trade than two providers that cannot sign anyone in.
  oauth: "That sign-in did not complete. Try again, or sign in with your email and password."
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 py-16">
      <div className="w-full max-w-sm animate-slide-up">
        <Link href="/" className="mb-10 flex justify-center" aria-label="Airrow home">
          <AirrowLogo size="lg" priority />
        </Link>

        <Card>
          <CardBody className="p-8">
            <h1 className="text-lg font-semibold tracking-tight text-fg">Sign in</h1>
            <p className="mt-1 text-sm text-fg-muted">Welcome back to your workspace.</p>

            {error ? (
              <InlineError className="mt-4">{ERRORS[error] ?? ERRORS.invalid}</InlineError>
            ) : null}

            <form action={loginAction} className="mt-6 space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="you@company.com" required autoFocus />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" placeholder="••••••••" required />
              </div>
              <SubmitButton className="w-full" pendingLabel="Signing in…">
                Sign in
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
          No account?{" "}
          <Link href="/signup" className="font-medium text-fg underline-offset-4 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
