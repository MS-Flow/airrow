// Asking for a way back in (spec 171).
//
// The one screen in the product that must answer the same way whatever it finds. A form that says "no
// account with that address" is an account-enumeration oracle anyone can query, and knowing which
// addresses have Airrow accounts is the first half of an attack on them.
import Link from "next/link";
import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";
import { passwordResetRequestSchema } from "@airrow/schemas";
import { AirrowLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineError } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { sendPasswordReset } from "@/lib/auth";
import { requestOrigin } from "@/lib/site-url";

async function requestResetAction(formData: FormData) {
  "use server";
  const parsed = passwordResetRequestSchema.safeParse({ email: formData.get("email") });
  // A malformed address is the only refusal here, and it is about the *typing*, not about who has an
  // account — which is why it is safe to say out loud.
  if (!parsed.success) redirect("/forgot-password?error=invalid");

  // Per request, like the confirmation link: one Supabase project serves dev and production, so its Site
  // URL cannot answer for both (spec 113).
  await sendPasswordReset(parsed.data.email, `${await requestOrigin()}/auth/reset`);
  redirect("/forgot-password?status=sent");
}

export const metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const { error, status } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6 py-16">
      <div className="w-full max-w-sm animate-slide-up">
        <Link href="/" className="mb-10 flex justify-center" aria-label="Airrow home">
          <AirrowLogo size="lg" priority />
        </Link>

        <Card>
          <CardBody className="p-8">
            {status === "sent" ? (
              <div className="text-center">
                <MailCheck className="mx-auto size-6 text-fg-muted" />
                <h1 className="mt-4 text-lg font-semibold tracking-tight text-fg">Check your inbox</h1>
                {/* "If there is an account" is the whole sentence doing the work: it is true either way,
                    and it tells the founder who mistyped their address why nothing arrived. */}
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                  If there is an Airrow account for that address, a link to choose a new password is on
                  its way. It expires in an hour, and nothing changes until you open it.
                </p>
                <Button variant="secondary" className="mt-6 w-full" asChild>
                  <Link href="/login">Back to sign in</Link>
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-lg font-semibold tracking-tight text-fg">Reset your password</h1>
                <p className="mt-1 text-sm text-fg-muted">
                  We&apos;ll email you a link to choose a new one.
                </p>

                {error ? (
                  <InlineError className="mt-4">
                    That doesn&apos;t look like an email address. Check it and try again.
                  </InlineError>
                ) : null}

                <form action={requestResetAction} className="mt-6 space-y-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="you@company.com"
                      autoComplete="email"
                      required
                      autoFocus
                    />
                  </div>
                  <SubmitButton className="w-full" pendingLabel="Sending…">
                    Send reset link
                  </SubmitButton>
                </form>
              </>
            )}
          </CardBody>
        </Card>

        <p className="mt-5 text-center text-sm text-fg-muted">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-fg underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
