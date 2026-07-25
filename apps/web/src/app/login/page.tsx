import Link from "next/link";
import { redirect } from "next/navigation";
import { loginSchema } from "@airrow/schemas";
import { AirrowLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineError } from "@/components/ui/states";
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
  unconfirmed: "Confirm your email address first — open the link we sent you, then sign in."
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
          <AirrowLogo size="md" priority />
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
              <Button type="submit" className="w-full">
                Sign in
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
          No account?{" "}
          <Link href="/signup" className="font-medium text-fg underline-offset-4 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
