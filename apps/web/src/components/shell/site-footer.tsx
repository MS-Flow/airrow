import Link from "next/link";
import { AirrowLogo } from "@/components/brand/logo";
import { FOOTER_LINKS } from "./footer-links";

/**
 * The public footer, shared by the landing page and the legal pages. One thin row:
 * mark, links, year. It closes the page rather than competing with it.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-4 px-6 py-5">
        <Link href="/" aria-label="Airrow home" className="shrink-0">
          <AirrowLogo size="md" />
        </Link>

        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-fg-muted transition-colors hover:text-fg"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <p className="font-mono text-xs text-fg-faint">© {new Date().getFullYear()} Airrow</p>
      </div>
    </footer>
  );
}
