// Shared chrome for the legal pages: they are often opened straight from a search result
// or a footer link, so each one stands on its own with a way back into the site.
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AirrowLogo } from "@/components/brand/logo";
import { SiteFooter } from "@/components/shell/site-footer";
import { ThemeSwitch } from "@/components/shell/theme-switch";
import { Button } from "@/components/ui/button";
import { LEGAL } from "@/features/legal/meta";
import { readTheme } from "@/lib/theme";

export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const theme = await readTheme();

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur-md">
        {/* Same width, lockup size and `py-3.5` as the landing header, so the logo does not
            move when you follow a footer link off the marketing page. */}
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" aria-label="Airrow home">
            <AirrowLogo size="lg" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeSwitch current={theme} />
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <ArrowLeft className="size-4" />
                Back to site
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Text spans the same column as the landing page's, so both edges line up across the two. */}
      <main className="mx-auto w-full max-w-6xl grow px-6 py-16">
        <p className="font-mono text-xs text-fg-faint">Last updated {LEGAL.lastUpdated}</p>
        <div className="prose-airrow mt-6">{children}</div>
        <p className="mt-12 rounded-lg border border-border bg-surface px-5 py-4 text-sm leading-relaxed text-fg-muted">
          {LEGAL.earlyAccess}
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
