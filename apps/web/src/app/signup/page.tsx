import Link from "next/link";
import { redirect } from "next/navigation";
import { signupSchema } from "@airrow/schemas";
import { AirrowMark, Button, Card, Input, Label } from "@/components/ui";
import { signUp } from "@/lib/auth";

async function signupAction(formData: FormData) {
  "use server";
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password")
  });
  if (!parsed.success) redirect("/signup?error=invalid");
  const { error } = await signUp(parsed.data.name, parsed.data.email, parsed.data.password);
  if (error) redirect("/signup?error=exists");
  redirect("/app");
}

export const metadata = { title: "Create account" };

const messages: Record<string, string> = {
  invalid: "Enter a name, a valid email, and a password of at least 8 characters.",
  exists: "That email is already registered, or signup failed. Try signing in."
};

export default async function SignupPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5 text-fg">
          <AirrowMark className="text-accent" />
          <span className="text-[15px] font-semibold tracking-tight">Airrow</span>
        </Link>
        <Card className="p-8">
          <h1 className="text-lg font-semibold tracking-tight text-fg">Create your account</h1>
          <p className="mt-1 text-[13px] text-fg-muted">
            A personal workspace is created for you automatically.
          </p>
          {error ? (
            <p className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
              {messages[error] ?? messages.invalid}
            </p>
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
              <Input id="password" name="password" type="password" placeholder="At least 8 characters" required minLength={8} />
            </div>
            <Button type="submit" className="w-full">
              Create account
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-[13px] text-fg-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-fg underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
