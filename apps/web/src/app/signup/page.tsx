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
import { ProviderButtons } from "@/features/auth/ProviderButtons";
import { signUp } from "@/lib/auth";

async function signupAction(formData: FormData) {
  "use server";
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password")
  });
  if (!parsed.success) redirect("/signup?error=invalid");

  const result = await signUp(parsed.data.name, parsed.data.email, parsed.data.password);
  if (result.status === "error") redirect("/signup?error=exists");
  // No session means the project requires e-mail confirmation — say so instead of
  // sending them to /app, which would bounce them back to /login.
  redirect(result.status === "signed-in" ? "/app" : "/signup?status=check-inbox");
}

export const metadata = { title: "Create account" };

const messages: Record<string, string> = {
  invalid: "Enter a name, a valid email, and a password of at least 8 characters.",
  exists: "That email is already registered, or signup failed. Try signing in."
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
            <AirrowLogo size="md" priority />
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
          <AirrowLogo size="md" priority />
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
                <Input id="name" name="name" placeholder="Ada Lovelace" required autoFocus maxLength={80} />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" placeholder="you@company.com" required />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full">
                Create account
              </Button>
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
