// The signed-out interview. Deliberately outside `/app` so the auth matcher in
// middleware.ts leaves it alone — the whole point is that no account is needed yet.
import Link from "next/link";
import { redirect } from "next/navigation";
import { AirrowLogo } from "@/components/brand/logo";
import { ThemeSwitch } from "@/components/shell/theme-switch";
import { Button } from "@/components/ui/button";
import { GuestInterview } from "@/features/interview/GuestInterview";
import { getSession } from "@/lib/auth";
import { readTheme } from "@/lib/theme";

export const metadata = { title: "Start your foundation" };

export default async function StartPage() {
  // Already signed in? The real project flow is strictly better — send them there.
  if (await getSession()) redirect("/app/projects/new");
  const theme = await readTheme();

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" aria-label="Airrow home">
            <AirrowLogo size="lg" priority />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeSwitch current={theme} />
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>
      <main>
        <GuestInterview />
      </main>
    </div>
  );
}
