/**
 * Every visible string on the landing page, in one place. The marketing voice is then
 * reviewed (and tested) as a whole instead of being hunted for across JSX: no single
 * assistant is named, and no sentence leans on an em dash (spec 23).
 */

/** Icon key, resolved by the page so this file stays plain data (as `nav-items.ts` does). */
export type DeliverableIcon =
  | "architecture"
  | "specifications"
  | "context"
  | "pipeline"
  | "standards"
  | "prompts";

export const HERO = {
  badge: "For AI-native startups",
  title: "Your startup deserves a real engineering foundation.",
  /* Split so the brand name can carry emphasis inside the muted lead line. */
  leadBrand: "Airrow",
  leadRest:
    " generates the architecture, specifications, standards and AI context your project needs, so your AI agents build like a senior team instead of guessing.",
  primaryCta: "Generate your foundation",
  secondaryCta: "See how it works",
  strapline: "Idea → Airrow → Code → Company",
};

export const HEADER = {
  signIn: "Sign in",
  getStarted: "Get started",
  openDashboard: "Open dashboard",
};

export const STEPS = [
  {
    n: "01",
    title: "Answer the CTO interview",
    body: "An adaptive interview captures your product, audience, capabilities and technical decisions. Only questions whose answers change the output.",
  },
  {
    n: "02",
    title: "Airrow generates your foundation",
    body: "A language model turns your answers into the architecture, specifications, standards, roadmap and AI context your project needs. Your stack decisions are applied exactly as you chose them; the writing around them is done for your product, not filled in from a template.",
  },
  {
    n: "03",
    title: "Build with your AI agents",
    body: "Download your repository, open it in your editor and start implementing. Your agents finally have the context of a senior engineering team.",
  },
];

export const DELIVERABLES: {
  icon: DeliverableIcon;
  title: string;
  body: string;
}[] = [
  {
    icon: "architecture",
    title: "Architecture",
    body: "System design, database schema with RLS, tech-stack decisions",
  },
  {
    icon: "specifications",
    title: "Specifications",
    body: "One real spec per capability, covering requirements, edge cases and security",
  },
  {
    icon: "context",
    title: "AI context system",
    body: "CLAUDE.md and context files so your agents never guess",
  },
  {
    icon: "pipeline",
    title: "CI/CD pipeline",
    body: "GitHub Actions that lint, typecheck, test and deploy from your first commit",
  },
  {
    icon: "standards",
    title: "Standards",
    body: "Coding, testing, security and git, decided rather than debated",
  },
  {
    icon: "prompts",
    title: "Prompt library",
    body: "Proven prompts for every stage of the workflow",
  },
];

/**
 * The four lifecycle commands, in the order an issue travels through them. Their
 * descriptions come from the scaffold itself, so the loop shown is the loop shipped.
 */
export const SPEC_LOOP = ["createspec", "clarify", "implement", "analyze"];

/**
 * A taste of the structure, not an inventory: the files that explain why the method
 * holds, each with the reason it earns its place. The rest is left to discover.
 */
export const FOUNDATION_HIGHLIGHTS = [
  {
    path: ".claude/spec-kit/constitution.md",
    reason:
      "The rules your agents cannot drift from, written once and enforced in review.",
  },
  {
    path: "CLAUDE.md",
    reason:
      "The first file an agent opens: stack, architecture and conventions, no guessing.",
  },
  {
    path: "specs/README.md",
    reason:
      "One spec per issue, so a decision is made once instead of re-argued per session.",
  },
  {
    path: "docs/architecture/SYSTEM_OVERVIEW.md",
    reason:
      "How the system fits together, decided before there is code to contradict it.",
  },
  {
    path: ".github/workflows/ci.yml",
    reason:
      "Lint, typecheck and tests running from commit one, so drift fails loudly.",
  },
];

export const WHY_SDD = [
  "The spec is the source of truth. Code is reviewed against it, not the other way round.",
  "An AI agent with a written architecture stops inventing one per session.",
  "Decisions made once, in writing, survive the context window.",
  "You spend far fewer tokens when the agent knows exactly what to build. Guessing, exploring and undoing the wrong thing is the expensive part.",
];

/* Everything is free for now. No invented tiers and no "TBD" — if a price isn't decided,
   the honest thing is to say the product is free, not to imply a paywall that isn't built. */
export const INCLUDED = [
  "Three generated foundations",
  "The full CTO interview",
  "Documents written for your product, not filled in from a template",
  "ZIP delivery of your repository",
  "Every document type Airrow produces",
  "Yours to keep, with no lock-in",
];

export const SECTIONS = {
  how: { title: "How it works" },
  features: {
    title: "Everything before the first line of code",
    body: "Airrow doesn't build your app. It builds the foundation that makes AI-assisted development consistent, correct and fast.",
  },
  specDriven: {
    title: "Why spec-driven development",
    body: "AI writes code faster than any team can review it. The bottleneck moved: it is no longer typing, it is deciding. Specs are how decisions survive.",
    loopTitle: "The loop your agents run",
    loopNote:
      "Every issue goes round this loop. The commands ship in your repository, ready to run.",
    structureTitle: "A few files that make it work",
    moreSuffix: "more files waiting in your repository",
  },
  pricing: {
    title: "Pricing",
    body: "Airrow is free while it's in early access. Three generated foundations per account, every feature, no card.",
    amount: "$0",
    note: "Three foundations, everything included.",
  },
  cta: {
    title: "Start with the foundation.",
    body: "Five minutes of questions. A complete engineering foundation. Yours.",
    action: "Create your project",
  },
};
