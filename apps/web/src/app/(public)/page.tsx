import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookMarked,
  Boxes,
  Check,
  EyeOff,
  FileCode2,
  GitBranch,
  GitMerge,
  ShieldCheck,
  Sparkles,
  Workflow,
  type LucideIcon
} from "lucide-react";
import { AirrowLogo } from "@/components/brand/logo";
import { AirrowMark } from "@/components/brand/mark";
import { SiteFooter } from "@/components/shell/site-footer";
import { ThemeSwitch } from "@/components/shell/theme-switch";
import { UserMenu } from "@/components/shell/user-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { SpecDrivenShowcase } from "@/features/landing/SpecDrivenShowcase";
import {
  DELIVERABLES,
  DELIVERY_MODES,
  HEADER,
  HERO,
  INCLUDED,
  PRO_INCLUDED,
  SECTIONS,
  STEPS,
  WHY_SDD,
  type DeliverableIcon
} from "@/features/landing/copy";
import { readPricing } from "@/features/billing/prices";
import { readFoundation } from "@/features/landing/foundation";
import { proCtaHref } from "@/features/landing/pro-cta";
import { startCtaHref } from "@/features/landing/start-cta";
import { checkAllowance } from "@/features/generation/allowance";
import { getSession, signOut } from "@/lib/auth";
import { readTheme } from "@/lib/theme";

// getSession() hits Supabase over the network; forcing dynamic skips Next's build-time
// static-generation probe (which would otherwise make that call during every build) rather
// than relying on cookies() usage to trigger the same bailout implicitly.
export const dynamic = "force-dynamic";

const deliverableIcons: Record<DeliverableIcon, LucideIcon> = {
  architecture: Boxes,
  specifications: FileCode2,
  context: Sparkles,
  pipeline: Workflow,
  standards: ShieldCheck,
  prompts: BookMarked
};

const deliveryModeIcons: Record<(typeof DELIVERY_MODES)[number]["key"], LucideIcon> = {
  integrated: GitMerge,
  hidden: EyeOff
};

async function landingSignOutAction() {
  "use server";
  await signOut();
  redirect("/");
}

export default async function Landing() {
  const session = await getSession();
  const theme = await readTheme();
  // The Examples section shows the canonical scaffold, read from disk on the server.
  const foundation = readFoundation();
  // Signed out, "get started" is the interview itself — the account comes at generate. Shared with
  // the chat panel's footer, which now renders on every public page and must not pick a different one.
  const primaryHref = startCtaHref(Boolean(session));
  // The Pro action needs to know what the founder has already used, so it can offer Pro to the
  // person who has met the limit and the free foundation to the person who has not.
  const allowance = session
    ? await checkAllowance({
        orgId: session.org.id,
        plan: session.org.plan,
        userId: session.user.id
      })
    : null;
  const proHref = proCtaHref(allowance);
  // What Pro costs, from Stripe (spec 179). Cached for an hour, so this is one call per deployment
  // per hour rather than one per visitor. Returns nothing to show when Stripe is unconfigured or
  // unreachable, and the card draws itself without an amount rather than failing.
  const { prices, founding } = await readPricing();
  const monthly = prices.find((p) => p.interval === "month");

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur-md">
        {/* Wraps rather than overflows: below 360px the lockup and the actions need more room
            than the row has, and a second line is the honest way to give it to them. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-y-2 px-6 py-3.5">
          <AirrowLogo size="lg" priority />
          <div className="flex items-center gap-2">
            <ThemeSwitch current={theme} />
            {session ? (
              <>
                {/* Signed in, this is the landing page's real action — so it gets the
                    primary treatment rather than reading as a muted afterthought. */}
                <Button size="sm" asChild>
                  <Link href="/app">
                    {HEADER.openDashboard}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <UserMenu
                  name={session.user.name}
                  email={session.user.email}
                  signOutAction={landingSignOutAction}
                />
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">{HEADER.signIn}</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href={primaryHref}>{HEADER.getStarted}</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        {/* Hero — the one place, with the logo, where the metal shows. */}
        <section className="flex flex-col items-center py-28 text-center md:py-40">
          <AirrowMark priority className="h-24 animate-blur-in md:h-32" />
          <Badge className="mt-8 animate-fade-in">{HERO.badge}</Badge>
          <h1 className="mt-6 max-w-4xl animate-slide-up text-balance text-4xl font-semibold tracking-tight text-fg md:text-6xl">
            {HERO.title}
          </h1>
          <p className="mt-6 max-w-xl animate-slide-up text-balance text-md leading-relaxed text-fg-muted md:text-lg">
            {/* The brand name is the subject of the sentence, so it carries the full
                foreground colour instead of sinking into the muted line. */}
            <span className="font-medium text-fg">{HERO.leadBrand}</span>
            {HERO.leadRest}
          </p>
          <div className="mt-10 flex animate-slide-up flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href={primaryHref}>{HERO.primaryCta}</Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="#how">{HERO.secondaryCta}</Link>
            </Button>
          </div>
          <p className="mt-8 font-mono text-xs text-fg-faint">{HERO.strapline}</p>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 border-t border-border py-24">
          <h2 className="text-2xl font-semibold tracking-tight text-fg">{SECTIONS.how.title}</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <Card key={s.n} interactive>
                <CardBody className="p-6">
                  <span className="font-mono text-xs text-fg-faint">{s.n}</span>
                  <h3 className="mt-3 text-md font-semibold text-fg">{s.title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-fg-muted">{s.body}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border py-24">
          <h2 className="text-2xl font-semibold tracking-tight text-fg">
            {SECTIONS.features.title}
          </h2>
          <p className="mt-3 max-w-xl text-base text-fg-muted">{SECTIONS.features.body}</p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
            {DELIVERABLES.map(({ icon, title, body }) => {
              const Icon = deliverableIcons[icon];
              return (
                <div key={title} className="bg-surface p-6">
                  <Icon className="size-4 text-fg-faint" />
                  <h3 className="mt-3 text-base font-semibold text-fg">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Why spec-driven development — the argument, then the loop and the files that
            make it hold, read from the scaffold itself. */}
        <section id="spec-driven" className="scroll-mt-20 border-t border-border py-24">
          <div className="grid gap-10 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-fg">
                {SECTIONS.specDriven.title}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-fg-muted">
                {SECTIONS.specDriven.body}
              </p>
            </div>
            <ul className="space-y-4">
              {WHY_SDD.map((line) => (
                <li key={line} className="flex gap-3">
                  <GitBranch className="mt-0.5 size-4 shrink-0 text-fg-faint" />
                  <span className="text-base leading-relaxed text-fg-muted">{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <SpecDrivenShowcase foundation={foundation} />
        </section>

        {/* Already have a project (spec 196). Immediately above Pricing, so the two ways a
            foundation lands and the tier that buys them read as one thought: both modes are Pro.
            Two cards, same size and same treatment, integrated first: this is a choice about what a
            founder's team sees, not a headline with a footnote under it. */}
        <section id="existing-project" className="scroll-mt-20 border-t border-border py-24">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight text-fg">
              {SECTIONS.existingProject.title}
            </h2>
            <Badge tone="accent">{SECTIONS.existingProject.badge}</Badge>
          </div>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-fg-muted">
            {SECTIONS.existingProject.body}
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {DELIVERY_MODES.map(({ key, title, lead, body }) => {
              const Icon = deliveryModeIcons[key];
              return (
                <Card key={key} interactive>
                  <CardBody className="p-6">
                    <Icon className="size-4 text-fg-faint" />
                    <h3 className="mt-3 text-md font-semibold text-fg">{title}</h3>
                    <p className="mt-1.5 text-base font-medium text-fg">{lead}</p>
                    <p className="mt-2 text-base leading-relaxed text-fg-muted">{body}</p>
                  </CardBody>
                </Card>
              );
            })}
          </div>
          <p className="mt-6 text-sm text-fg-faint">{SECTIONS.existingProject.note}</p>
        </section>

        {/* Pricing. Two cards, both real: free is the whole first foundation and Pro is purchasable
            (spec 99). The actions differ, because the same destination cannot serve both — see
            `proCtaHref`. */}
        <section id="pricing" className="scroll-mt-20 border-t border-border py-24">
          <h2 className="text-2xl font-semibold tracking-tight text-fg">
            {SECTIONS.pricing.title}
          </h2>
          <p className="mt-3 max-w-xl text-base text-fg-muted">{SECTIONS.pricing.body}</p>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardBody className="p-8">
                <p className="text-sm font-medium text-fg-muted">{SECTIONS.pricing.free.name}</p>
                <p className="mt-2 text-5xl font-semibold tracking-tight text-fg">
                  {SECTIONS.pricing.free.amount}
                </p>
                <p className="mt-2 text-base text-fg-muted">{SECTIONS.pricing.free.note}</p>
                <ul className="mt-7 grid gap-3">
                  {INCLUDED.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-base text-fg-muted">
                      <Check className="mt-0.5 size-4 shrink-0 text-fg" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button className="mt-8 w-full" asChild>
                  <Link href={primaryHref}>{SECTIONS.pricing.free.action}</Link>
                </Button>
              </CardBody>
            </Card>

            {/* Solid, not dashed, and no "coming soon" badge: Pro is purchasable (spec 99), and a
                pricing section that says otherwise is the one screen whose whole job is to be
                believed. The figure is read from Stripe rather than written here (spec 179), so the
                amount still lives in one place and the card still names it. When Stripe cannot be
                asked, the amount line is absent rather than filled with a placeholder. */}
            <Card>
              <CardBody className="p-8">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-fg-muted">{SECTIONS.pricing.pro.name}</p>
                  {founding && founding.remaining > 0 ? (
                    <Badge tone="accent">{SECTIONS.pricing.pro.founding.badge}</Badge>
                  ) : null}
                </div>
                {monthly ? (
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-fg">
                    {monthly.amount}
                    <span className="ml-1.5 text-base font-normal text-fg-muted">
                      {SECTIONS.pricing.pro.perMonth}
                    </span>
                  </p>
                ) : null}
                <p className="mt-2 text-base text-fg-muted">{SECTIONS.pricing.pro.note}</p>
                {founding ? (
                  <div className="mt-4 rounded-lg border border-border bg-surface-raised p-4">
                    {founding.remaining > 0 ? (
                      <>
                        <p className="text-sm font-medium text-fg">
                          {SECTIONS.pricing.pro.founding.seatsLeft(
                            founding.remaining,
                            founding.total
                          )}
                          {/* The founding amount, not the list price: Checkout applies the coupon,
                              so `yearly.amount` here would advertise the deal at the rate you get
                              for declining it. */}
                          {founding.amount
                            ? ` at ${founding.amount} ${SECTIONS.pricing.pro.perYear}`
                            : ""}
                        </p>
                        <p className="mt-1 text-sm text-fg-muted">
                          {SECTIONS.pricing.pro.founding.promise}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-fg-muted">
                        {SECTIONS.pricing.pro.founding.soldOut}
                      </p>
                    )}
                  </div>
                ) : null}
                <ul className="mt-7 grid gap-3">
                  {PRO_INCLUDED.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-base text-fg-muted">
                      <Check className="mt-0.5 size-4 shrink-0 text-fg" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button variant="secondary" className="mt-8 w-full" asChild>
                  <Link href={proHref}>{SECTIONS.pricing.pro.action}</Link>
                </Button>
              </CardBody>
            </Card>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border py-28 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-fg">{SECTIONS.cta.title}</h2>
          <p className="mx-auto mt-4 max-w-md text-base text-fg-muted">{SECTIONS.cta.body}</p>
          <Button size="lg" className="mt-9" asChild>
            <Link href={primaryHref}>{SECTIONS.cta.action}</Link>
          </Button>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
