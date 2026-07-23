import Link from "next/link";
import { redirect } from "next/navigation";
import { loginSchema } from "@arrow/schemas";
import { ArrowMark, Button, Card, Input, Label } from "@/components/ui";
import { signIn } from "@/lib/auth";

async function loginAction(formData: FormData) {
  "use server";
  const parsed = loginSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email")
  });
  if (!parsed.success) redirect("/login?error=1");
  await signIn(parsed.data.name, parsed.data.email);
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
          <ArrowMark className="text-accent" />
          <span className="text-[15px] font-semibold tracking-tight">Arrow</span>
        </Link>
        <Card className="p-8">
          <h1 className="text-lg font-semibold tracking-tight text-fg">Sign in</h1>
          <p className="mt-1 text-[13px] text-fg-muted">
            Your projects are stored under this identity.
          </p>
          {error ? (
            <p className="mt-3 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
              Please enter a valid name and email address.
            </p>
          ) : null}
          <form action={loginAction} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" placeholder="Ada Lovelace" required autoFocus />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@company.com" required />
            </div>
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center font-mono text-[11px] leading-relaxed text-fg-faint">
          Local development auth — no password, data stays on this machine.
          <br />
          Supabase Auth activates with production keys (ADR-0005).
        </p>
      </div>
    </div>
  );
}
