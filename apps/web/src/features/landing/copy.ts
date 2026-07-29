/**
 * Every visible string on the landing page, in one place. The marketing voice is then
 * reviewed (and tested) as a whole instead of being hunted for across JSX: no single
 * assistant is named, and no sentence leans on an em dash (spec 23).
 *
 * The free tier's numbers are read from `features/generation/limits.ts` rather than written out
 * here, so the pricing section cannot promise a limit the product does not enforce (spec 74).
 */
import {
  FREE_GENERATION_LIMIT,
  FREE_REPAIR_LIMIT,
  REPAIR_WINDOW_HOURS
} from "@/features/generation/limits";

/** English for the free ceiling. One is the shipped value; the rest keeps the copy honest if it moves. */
const FOUNDATIONS = FREE_GENERATION_LIMIT === 1 ? "One" : String(FREE_GENERATION_LIMIT);
const foundationNoun = FREE_GENERATION_LIMIT === 1 ? "foundation" : "foundations";

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
    " generates the architecture, specifications, standards and AI context your project needs, then sets the project up on your machine until it runs. Your AI agents build like a senior team instead of guessing.",
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
    body: "Download your repository, open it and run one command to take it from documents to a project that runs. You stay in control of what gets built after that, one spec at a time, and your agents finally have the context of a senior engineering team.",
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
    // Two clauses, one promise each: the pipeline catches a bad commit, the branch structure stops
    // two agents writing over each other. Kept to the length of the other five cards — this one ran
    // to twice that and the claim got lost in it.
    title: "CI/CD and branching",
    body: "GitHub Actions that lint, typecheck, test and deploy, plus an automated branch structure that prevents merge conflicts",
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
    path: "START_HERE.md",
    reason:
      "A clear guide to how it all works: how to get started, and how to carry it to a finished product.",
  },
  {
    path: ".claude/spec-kit/constitution.md",
    reason:
      "Clear rules for your project, taken straight from your interview answers and followed in every file after.",
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
  "Without a spec, an agent optimises for looking finished. It invents requirements you never gave it and quietly reopens decisions you made last week.",
  "The spec is the source of truth. Code is reviewed against it, not the other way round.",
  "It replaces “does this look right?” with “does this match what we agreed?”, which is a question you can actually answer.",
  "Decisions made once, in writing, survive the context window and the three months after it.",
  "You spend far fewer tokens when the agent knows exactly what to build. Guessing, exploring and undoing the wrong thing is the expensive part.",
];

/* Two tiers, and only one of them is real. Pro is labelled "coming soon" and carries no price
   because it has none yet — naming a figure we have not decided would be a promise, and the free
   tier is what someone can actually have today. */
export const INCLUDED = [
  `${FOUNDATIONS} generated ${foundationNoun}, with ${FREE_REPAIR_LIMIT} free revisions`,
  "The full CTO interview",
  "Documents written for your product, not filled in from a template",
  "ZIP delivery of your repository",
  "Every document type Airrow produces",
  "Yours to keep, with no lock-in",
];

/** What Pro adds. Deliberately short: most of this is unbuilt, and a long list would read as one. */
export const PRO_INCLUDED = [
  "Unlimited generated foundations",
  "Import an existing project",
  "Push straight to a GitHub repository",
  "Regenerate as your product changes",
];

export const SECTIONS = {
  how: { title: "How it works" },
  features: {
    title: "Everything before the first line of code",
    body: "Airrow doesn't build your app. It builds the foundation that makes AI-assisted development consistent, correct and fast.",
  },
  specDriven: {
    title: "Why spec-driven development",
    body: "AI writes code faster than any team can review it. The bottleneck moved: it is no longer typing, it is deciding. Specs are how decisions survive, and how you stay the one making them.",
    loopTitle: "The loop your agents run",
    loopNote:
      "Every issue goes round this loop. The commands ship in your repository, ready to run.",
    structureTitle: "A few files that make it work",
    moreSuffix: "more files waiting in your repository",
  },
  pricing: {
    title: "Pricing",
    body: `Start free: ${FOUNDATIONS.toLowerCase()} complete ${foundationNoun}, every document Airrow writes, no card. Pro lifts the limit when it lands.`,
    free: {
      name: "Free",
      amount: "$0",
      note: `${FOUNDATIONS} ${foundationNoun}, revisable for ${REPAIR_WINDOW_HOURS} hours.`,
      action: "Create your project",
    },
    pro: {
      name: "Pro",
      badge: "Coming soon",
      /* No figure, because none is decided. Naming one would be a promise, and "TBD" at the size
         of a price is just a shrug. The word says what the card is for. */
      amount: "Monthly",
      note: "Unlimited foundations, and importing a project you have already started.",
      action: "Not available yet",
    },
  },
  cta: {
    title: "Start with the foundation.",
    body: "Five minutes of questions. A complete engineering foundation. Yours.",
    action: "Create your project",
  },
};
