import Link from "next/link";
import { redirect } from "next/navigation";
import { loginSchema } from "@airrow/schemas";
import { AirrowMark, Button, Card, Input, Label } from "@/components/ui";
import { signIn } from "@/lib/auth";

async function loginAction(formData: FormData) {
  "use server";
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });
  if (!parsed.success) redirect("/login?error=1");
  const { error } = await signIn(parsed.data.email, parsed.data.password);
  if (error) redirect("/login?error=1");
  redirect("/app");
}

export const metadata = { title: "Sign in" };

export default async function LoginPage({
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
          <h1 className="text-lg font-semibold tracking-tight text-fg">Sign in</h1>
          <p className="mt-1 text-[13px] text-fg-muted">Welcome back to your workspace.</p>
          {error ? (
            <p className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
              Invalid email or password.
            </p>
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
        </Card>
        <p className="mt-4 text-center text-[13px] text-fg-muted">
          No account?{" "}
          <Link href="/signup" className="font-medium text-fg underline-offset-4 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
