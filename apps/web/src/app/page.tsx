// Landing (F-501 scope pulled forward: functional, minimal, premium).
import Link from "next/link";
import { ArrowMark, Badge, Button, Card } from "@/components/ui";
import { getSession } from "@/lib/auth";

const steps = [
  {
    n: "01",
    title: "Answer the CTO interview",
    body: "An adaptive interview captures your product, audience, capabilities, and technical decisions. Only questions that change the output."
  },
  {
    n: "02",
    title: "Arrow generates your foundation",
    body: "Architecture, specifications, standards, roadmap, prompt library, and an AI context system — personalized to your product, not boilerplate."
  },
  {
    n: "03",
    title: "Build with Claude Code",
    body: "Download your repository, open VS Code, and start implementing. Your AI assistant finally has the context of a senior engineering team."
  }
];

const deliverables = [
  ["Architecture", "System design, database schema with RLS, tech stack decisions"],
  ["Specifications", "A real spec per capability — requirements, edge cases, security"],
  ["AI context system", "CLAUDE.md and context files so assistants never guess"],
  ["Roadmap", "Milestones ordered around your MVP promise"],
  ["Standards", "Coding, testing, security, git — decided, not debated"],
  ["Prompt library", "Proven prompts for every stage of the workflow"]
];

export default async function Landing() {
  const session = await getSession();
  return (
    <div className="min-h-screen bg-bg">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5 text-fg">
          <ArrowMark className="text-accent" />
          <span className="text-[15px] font-semibold tracking-tight">Arrow</span>
        </div>
        <Link href={session ? "/app" : "/login"}>
          <Button variant="secondary" size="sm">
            {session ? "Open dashboard" : "Sign in"}
          </Button>
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        {/* Hero */}
        <section className="py-24 text-center md:py-32">
          <Badge tone="accent" className="mb-6">
            For AI-native startups
          </Badge>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-fg md:text-6xl">
            Your startup deserves a real engineering foundation.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-fg-muted md:text-lg">
            Arrow generates the architecture, specifications, standards, and AI context your project
            needs — so Claude Code builds it like a senior team, not a gamble.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3">
            <Link href={session ? "/app/projects/new" : "/login"}>
              <Button size="lg">Generate your foundation</Button>
            </Link>
          </div>
          <p className="mt-6 font-mono text-xs text-fg-faint">
            Idea → Arrow → Claude Code → Company
          </p>
        </section>

        {/* How it works */}
        <section className="grid gap-4 pb-24 md:grid-cols-3">
          {steps.map((s) => (
            <Card key={s.n} className="p-6">
              <span className="font-mono text-xs text-accent">{s.n}</span>
              <h3 className="mt-3 text-[15px] font-semibold text-fg">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.body}</p>
            </Card>
          ))}
        </section>

        {/* What you get */}
        <section className="pb-24">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-fg">
            Everything before the first line of code
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-sm text-fg-muted">
            Arrow doesn&apos;t build your app. It builds the foundation that makes AI-assisted
            development consistent, correct, and fast.
          </p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
            {deliverables.map(([title, body]) => (
              <div key={title} className="bg-surface p-6">
                <h3 className="text-sm font-semibold text-fg">{title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="pb-32 text-center">
          <Card className="mx-auto max-w-2xl bg-bg-subtle p-12">
            <h2 className="text-2xl font-semibold tracking-tight text-fg">
              Start with the foundation.
            </h2>
            <p className="mt-3 text-sm text-fg-muted">
              Ten minutes of questions. A complete engineering foundation. Yours.
            </p>
            <Link href={session ? "/app/projects/new" : "/login"} className="mt-8 inline-block">
              <Button size="lg">Create your project</Button>
            </Link>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <p className="text-center font-mono text-xs text-fg-faint">
          Arrow — built with Arrow&apos;s own methodology.
        </p>
      </footer>
    </div>
  );
}
