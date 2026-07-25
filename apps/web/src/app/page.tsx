import Link from "next/link";
import {
  BookMarked,
  Boxes,
  FileCode2,
  GitBranch,
  Map,
  ShieldCheck,
  Sparkles
} from "lucide-react";
import { AirrowLogo } from "@/components/brand/logo";
import { AirrowMark } from "@/components/brand/mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { getSession } from "@/lib/auth";

const steps = [
  {
    n: "01",
    title: "Answer the CTO interview",
    body: "An adaptive interview captures your product, audience, capabilities and technical decisions. Only questions whose answers change the output."
  },
  {
    n: "02",
    title: "Airrow generates your foundation",
    body: "Architecture, specifications, standards, roadmap, prompt library and an AI context system — personalised to your product, not boilerplate."
  },
  {
    n: "03",
    title: "Build with Claude Code",
    body: "Download your repository, open VS Code and start implementing. Your AI assistant finally has the context of a senior engineering team."
  }
];

const deliverables = [
  { icon: Boxes, title: "Architecture", body: "System design, database schema with RLS, tech-stack decisions" },
  { icon: FileCode2, title: "Specifications", body: "A real spec per capability — requirements, edge cases, security" },
  { icon: Sparkles, title: "AI context system", body: "CLAUDE.md and context files so assistants never guess" },
  { icon: Map, title: "Roadmap", body: "Milestones ordered around your MVP promise" },
  { icon: ShieldCheck, title: "Standards", body: "Coding, testing, security, git — decided, not debated" },
  { icon: BookMarked, title: "Prompt library", body: "Proven prompts for every stage of the workflow" }
];

const whySdd = [
  "The spec is the source of truth — code is reviewed against it, not the other way round.",
  "An AI assistant with a written architecture stops inventing one per session.",
  "Decisions made once, in writing, survive the context window."
];

/* Placeholder until product supplies real tiers (spec 19, Out of scope). */
const pricing = [
  { name: "Free", price: "$0", note: "One project. ZIP delivery. Full foundation." },
  { name: "Founder", price: "TBD", note: "Unlimited projects, GitHub push, regeneration." },
  { name: "Team", price: "TBD", note: "Shared workspaces, org roles, review flow." }
];

export default async function Landing() {
  const session = await getSession();
  const primaryHref = session ? "/app/projects/new" : "/signup";

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <AirrowLogo priority />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">{session ? "Open dashboard" : "Sign in"}</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={primaryHref}>Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        {/* Hero — the one place, with the logo, where the metal shows. */}
        <section className="flex flex-col items-center py-28 text-center md:py-40">
          <AirrowMark priority className="h-16 animate-blur-in md:h-20" />
          <Badge className="mt-8 animate-fade-in">For AI-native startups</Badge>
          <h1 className="mt-6 max-w-4xl animate-slide-up text-balance text-4xl font-semibold tracking-tight text-fg md:text-6xl">
            Your startup deserves a real engineering foundation.
          </h1>
          <p className="mt-6 max-w-xl animate-slide-up text-balance text-md leading-relaxed text-fg-muted md:text-lg">
            Airrow generates the architecture, specifications, standards and AI context your project
            needs — so Claude Code builds it like a senior team, not a gamble.
          </p>
          <div className="mt-10 flex animate-slide-up items-center gap-3">
            <Button size="lg" asChild>
              <Link href={primaryHref}>Generate your foundation</Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="#how">See how it works</Link>
            </Button>
          </div>
          <p className="mt-8 font-mono text-xs text-fg-faint">
            Idea → Airrow → Claude Code → Company
          </p>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 border-t border-border py-24">
          <h2 className="text-2xl font-semibold tracking-tight text-fg">How it works</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map((s) => (
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
            Everything before the first line of code
          </h2>
          <p className="mt-3 max-w-xl text-base text-fg-muted">
            Airrow doesn&apos;t build your app. It builds the foundation that makes AI-assisted
            development consistent, correct and fast.
          </p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
            {deliverables.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-surface p-6">
                <Icon className="size-4 text-fg-faint" />
                <h3 className="mt-3 text-base font-semibold text-fg">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Why spec-driven development */}
        <section className="border-t border-border py-24">
          <div className="grid gap-10 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-fg">
                Why spec-driven development
              </h2>
              <p className="mt-3 text-base leading-relaxed text-fg-muted">
                AI writes code faster than any team can review it. The bottleneck moved: it is no
                longer typing, it is deciding. Specs are how decisions survive.
              </p>
            </div>
            <ul className="space-y-4">
              {whySdd.map((line) => (
                <li key={line} className="flex gap-3">
                  <GitBranch className="mt-0.5 size-4 shrink-0 text-fg-faint" />
                  <span className="text-base leading-relaxed text-fg-muted">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Examples — placeholder until a real generated repo is published. */}
        <section className="border-t border-border py-24">
          <h2 className="text-2xl font-semibold tracking-tight text-fg">Examples</h2>
          <p className="mt-3 max-w-xl text-base text-fg-muted">
            Airrow is built with Airrow. This repository&apos;s own constitution, specs and branching
            model came out of the same generator — the sample gallery lands with the public beta.
          </p>
          <Card className="mt-8 border-dashed">
            <CardBody className="flex flex-col items-center px-8 py-14 text-center">
              <AirrowMark className="h-6 opacity-50" />
              <p className="mt-4 text-base text-fg-muted">Sample foundations — coming soon</p>
            </CardBody>
          </Card>
        </section>

        {/* Pricing teaser — placeholder tiers. */}
        <section className="border-t border-border py-24">
          <h2 className="text-2xl font-semibold tracking-tight text-fg">Pricing</h2>
          <p className="mt-3 text-base text-fg-muted">
            Start free. Final pricing is being set — early projects keep their plan.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {pricing.map((tier) => (
              <Card key={tier.name}>
                <CardBody className="p-6">
                  <p className="text-sm font-medium text-fg-muted">{tier.name}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-fg">{tier.price}</p>
                  <p className="mt-3 text-sm leading-relaxed text-fg-muted">{tier.note}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-border py-28 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-fg">Start with the foundation.</h2>
          <p className="mx-auto mt-4 max-w-md text-base text-fg-muted">
            Ten minutes of questions. A complete engineering foundation. Yours.
          </p>
          <Button size="lg" className="mt-9" asChild>
            <Link href={primaryHref}>Create your project</Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-10 sm:flex-row sm:justify-between">
          <AirrowLogo />
          <p className="font-mono text-xs text-fg-faint">
            Built with Airrow&apos;s own methodology.
          </p>
        </div>
      </footer>
    </div>
  );
}
