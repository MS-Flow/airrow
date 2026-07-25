/** The public site footer's one row of links. Every href must resolve — no placeholders. */
export interface FooterLink {
  href: string;
  label: string;
}

export const FOOTER_LINKS: FooterLink[] = [
  { href: "/#how", label: "How it works" },
  { href: "/#spec-driven", label: "Spec-driven" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/cookies", label: "Cookies" }
];
