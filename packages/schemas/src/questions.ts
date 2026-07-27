// Declarative interview schema v1. Pure data + pure evaluator — no runtime deps.
// This is the single source of truth for the interview UI and engine resolution.

import type { InterviewAnswers } from "./types.ts";

export const INTERVIEW_SCHEMA_VERSION = "1";

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}

export interface Condition {
  questionId: keyof InterviewAnswers;
  /** Show when the answer (or any selected value for multi) is in this list. */
  in: string[];
}

export interface Question {
  id: keyof InterviewAnswers;
  title: string;
  help?: string;
  type: "single" | "multi" | "text";
  options?: QuestionOption[];
  placeholder?: string;
  required: boolean;
  showIf?: Condition[];
  /** Character ceiling for a `text` answer — see `ANSWER_MAX_CHARS`. */
  maxChars?: number;
}

/**
 * How long a free-text answer may be, per question (spec 65). One source for three consumers: the
 * textarea's `maxLength`, the Zod schema at the write boundary, and the authoring prompt's budget.
 *
 * Sized to what each question asks for rather than one blanket number. Two reasons they are this
 * tight: these answers are forwarded to an LLM, so their length is a cost the founder neither pays
 * nor sees; and the interview can be answered without an account, so the input is not necessarily
 * the founder's own.
 */
export const ANSWER_MAX_CHARS = {
  problem: 400,
  vision: 300,
  mvpFocus: 300,
  coreEntities: 600,
  nonGoals: 400,
  frameworkOther: 300,
  integrations: 300
} as const;

const WEB_PRODUCT_TYPES = ["saas", "marketplace", "ai_agent", "mobile_app", "api", "browser_extension"];

export const interviewQuestions: Question[] = [
  {
    id: "productType",
    title: "What are you building?",
    help: "This shapes the architecture, roadmap, and specs Airrow generates.",
    type: "single",
    required: true,
    options: [
      { value: "saas", label: "SaaS", description: "A web application sold as a subscription" },
      { value: "marketplace", label: "Marketplace", description: "Connecting two sides: buyers and sellers" },
      { value: "ai_agent", label: "AI product / agent", description: "An AI-first product or autonomous agent" },
      { value: "mobile_app", label: "Mobile app", description: "iOS / Android as the primary surface" },
      { value: "api", label: "API / developer tool", description: "A product other developers build on" },
      { value: "internal_tool", label: "Internal tool", description: "Software for your own company or team" },
      { value: "browser_extension", label: "Browser extension", description: "Lives inside the browser" },
      { value: "hobby", label: "Side project / for fun", description: "A passion project or experiment — not (yet) a business" }
    ]
  },
  {
    // Asked first among the written answers, and asked separately from the vision: without it every
    // document describes features with no account of why any of them matter, and an agent reading
    // them has nothing to weigh a decision against.
    id: "problem",
    title: "What problem are you solving, and who has it?",
    help: "The situation today, and who it hurts. This is the single most useful thing you can tell your AI assistants.",
    type: "text",
    required: true,
    maxChars: ANSWER_MAX_CHARS.problem,
    placeholder:
      "e.g. Independent property managers track applications across email and spreadsheets, so good tenants go days without an answer and get lost to bigger agencies."
  },
  {
    id: "vision",
    title: "Where is this heading long-term?",
    help: "One sentence on what it becomes if it succeeds. Your AI assistants build toward this.",
    type: "text",
    required: true,
    maxChars: ANSWER_MAX_CHARS.vision,
    placeholder: "e.g. The default operating system for independent property managers."
  },
  {
    id: "mvpFocus",
    title: "What's the first thing it needs to do?",
    help: "The one core action of the MVP — this drives your roadmap and first specs. One sentence.",
    type: "text",
    required: true,
    maxChars: ANSWER_MAX_CHARS.mvpFocus,
    placeholder: "e.g. Let a property manager create a listing and receive tenant applications online."
  },
  {
    id: "audience",
    title: "Who is it for?",
    help: "B2B and B2C foundations differ: tenancy, onboarding, billing, compliance.",
    type: "single",
    required: true,
    showIf: [{ questionId: "productType", in: WEB_PRODUCT_TYPES }],
    options: [
      { value: "b2b", label: "Businesses (B2B)", description: "Teams and companies pay" },
      { value: "b2c", label: "Consumers (B2C)", description: "Individuals use and pay" },
      { value: "both", label: "Both", description: "Prosumer or two-sided" }
    ]
  },
  {
    id: "coreEntities",
    title: "What are the core objects in your product?",
    help: "The 3–7 most important things and how they relate. Skip it if you're not sure yet — you can fill it in later.",
    type: "text",
    required: false,
    maxChars: ANSWER_MAX_CHARS.coreEntities,
    placeholder: "e.g. Landlords own Properties; a Property has many Listings; a Listing receives Applications from Tenants."
  },
  {
    // Written into the generated CLAUDE.md, where it is the only thing standing between a coding
    // agent and a week of work nobody asked for. Optional, because a founder who has none yet
    // should not be made to invent them.
    id: "nonGoals",
    title: "What is this explicitly not doing?",
    help: "The things you keep being tempted by and are deliberately leaving out. Your AI assistants will respect these.",
    type: "text",
    required: false,
    maxChars: ANSWER_MAX_CHARS.nonGoals,
    placeholder:
      "e.g. No accounting or rent collection — those stay in the tools people already pay for. No native mobile app in year one."
  },
  {
    id: "tenancy",
    title: "How is your data organized and isolated?",
    help: "This decides the data model and the row-level security strategy — the hardest thing to change later.",
    type: "single",
    required: true,
    options: [
      { value: "single_user", label: "Per user", description: "Each person sees only their own data" },
      { value: "organizations", label: "Teams / organizations", description: "Multi-tenant workspaces; members share data" },
      { value: "marketplace", label: "Two-sided marketplace", description: "Buyers and sellers with separate access" },
      { value: "internal", label: "Single internal org", description: "One company; everyone is in the same tenant" }
    ]
  },
  {
    id: "authModel",
    title: "How will people sign in?",
    help: "Pick every method you'll support. Choose \"Public\" only if there are no accounts at all.",
    type: "multi",
    required: true,
    options: [
      { value: "email_password", label: "Email & password", description: "Classic credentials" },
      { value: "magic_link", label: "Magic link", description: "Passwordless email link" },
      { value: "social", label: "Social login", description: "Google, GitHub, etc." },
      { value: "sso", label: "Enterprise SSO", description: "SAML / OIDC for B2B customers" },
      { value: "public", label: "No accounts (public)", description: "Anonymous — no sign-in" }
    ]
  },
  {
    id: "roles",
    title: "How sophisticated should roles & permissions be?",
    help: "You chose a multi-member tenancy — Airrow will spec the permission model.",
    type: "single",
    required: true,
    showIf: [{ questionId: "tenancy", in: ["organizations", "marketplace"] }],
    options: [
      { value: "simple", label: "Simple", description: "Owner, admin, member — enough for most products" },
      { value: "granular", label: "Granular", description: "Custom roles / per-resource permissions" }
    ]
  },
  {
    id: "capabilities",
    title: "Which capabilities will your product need?",
    help: "Select everything you expect in the first year. Airrow specs the MVP subset and roadmaps the rest. (Accounts and teams come from your earlier answers.)",
    type: "multi",
    required: true,
    options: [
      { value: "payments", label: "Payments & billing", description: "Subscriptions or transactions" },
      { value: "notifications", label: "Notifications", description: "In-app or push" },
      { value: "email", label: "Transactional email", description: "Receipts, invites, digests" },
      { value: "search", label: "Search", description: "Finding things fast" },
      { value: "storage", label: "File storage", description: "Uploads, documents, media" },
      { value: "ai", label: "AI features", description: "LLM-powered functionality" },
      { value: "analytics", label: "Analytics", description: "Product usage insight" },
      { value: "realtime", label: "Realtime", description: "Live updates, collaboration" },
      { value: "admin", label: "Admin panel", description: "Internal operations UI" },
      { value: "audit_logs", label: "Audit logs", description: "Who did what, when" }
    ]
  },
  {
    id: "aiUsage",
    title: "What kind of AI does it use?",
    help: "You selected AI features — this decides the AI architecture, provider wiring, and output validation.",
    type: "single",
    required: true,
    showIf: [{ questionId: "capabilities", in: ["ai"] }],
    options: [
      { value: "llm_calls", label: "LLM calls", description: "Prompt-in, text-out features" },
      { value: "rag", label: "RAG over your data", description: "Retrieval-augmented answers from your content" },
      { value: "agents", label: "Autonomous agents", description: "Multi-step tool-using workflows" },
      { value: "ml_models", label: "Custom ML models", description: "Your own trained/hosted models" },
      { value: "none", label: "No AI after all", description: "Drops AI from the plan — nothing AI-related is generated" }
    ]
  },
  {
    id: "integrations",
    title: "Which external systems will you integrate?",
    help: "Name the services you already know you'll connect. Skip if none yet.",
    type: "text",
    required: false,
    showIf: [{ questionId: "capabilities", in: ["payments", "email", "notifications", "analytics", "ai"] }],
    maxChars: ANSWER_MAX_CHARS.integrations,
    placeholder: "e.g. Stripe for billing, Resend for email, Slack for alerts, HubSpot for CRM."
  },
  {
    id: "dataSensitivity",
    title: "How sensitive is your data?",
    help: "Drives encryption, audit, and security posture across the generated standards.",
    type: "single",
    required: true,
    options: [
      { value: "standard", label: "Standard", description: "Normal user data, best-practice security" },
      { value: "pii", label: "PII at scale", description: "Lots of personal data or payment details" },
      { value: "regulated", label: "Regulated", description: "Health, finance, or data about minors — compliance regime applies" }
    ]
  },
  {
    id: "scale",
    title: "What scale are you designing for first?",
    type: "single",
    required: true,
    options: [
      { value: "validate", label: "Validate first", description: "Optimize for speed of learning — hundreds of users" },
      { value: "growth", label: "Growth-ready", description: "Expect rapid adoption — design for tens of thousands" },
      { value: "high_scale", label: "High scale", description: "Millions of users / heavy load from the start" }
    ]
  },
  {
    // Every stack question states what it *changes* in the output, not just what it means. A founder
    // picked Vite, got `npm run dev` in START_HERE, and read it as a bug — the choice was clear, its
    // consequence was invisible. TypeScript, Tailwind and shadcn/ui are fixed and not asked about.
    id: "framework",
    title: "Which web framework?",
    help: "Recommended: Next.js. Either way you get TypeScript, Tailwind and shadcn/ui — this choice decides the package manager, so it sets every command in your generated docs and CI.",
    type: "single",
    required: true,
    showIf: [{ questionId: "productType", in: ["saas", "marketplace", "ai_agent", "internal_tool", "hobby"] }],
    options: [
      {
        value: "nextjs",
        label: "Next.js — recommended",
        description: "App Router, server actions, server-side rendering. Uses pnpm, so your docs say `pnpm dev`. Pick this unless you know you want an SPA."
      },
      {
        value: "vite",
        label: "Vite + React",
        description: "A pure single-page app with no server of its own — all data goes through Supabase from the browser. Uses npm, so your docs say `npm run dev`."
      },
      {
        value: "custom",
        label: "Something else — describe it",
        description: "Django, Rails, SvelteKit, Go, Laravel — anything. Your docs are written for the stack you name, commands included."
      }
    ]
  },
  {
    // Only the two golden-path frameworks have commands anyone here can derive; for everything else
    // the toolchain is authored from this answer (see TOOLCHAIN_SLOTS). Naming the language and
    // package manager matters more than the framework: it is what decides `pnpm dev` from
    // `python manage.py runserver`.
    id: "frameworkOther",
    title: "Describe your stack",
    help: "Language, framework and package manager at minimum. Everything generated for you — setup steps, the commands in START_HERE.md, the architecture docs — is written for what you put here.",
    type: "text",
    required: true,
    showIf: [{ questionId: "framework", in: ["custom"] }],
    maxChars: ANSWER_MAX_CHARS.frameworkOther,
    placeholder: "e.g. Django 5 with Python 3.12 and uv for dependencies, HTMX and Tailwind on the front end, pytest for tests."
  },
  {
    id: "database",
    title: "Which database?",
    help: "Recommended: Supabase. Both are PostgreSQL — you keep RLS, SQL migrations and the same schema either way. This decides how much you wire up yourself.",
    type: "single",
    required: true,
    options: [
      {
        value: "supabase",
        label: "Supabase — recommended",
        description: "Postgres with Auth, Storage, Realtime and RLS already wired. Your setup steps become 'create a project, paste two keys'."
      },
      {
        value: "postgres",
        label: "Self-hosted Postgres",
        description: "Your own Postgres. Same schema and migrations, but auth and file storage are yours to build — your setup steps say so."
      }
    ]
  },
  {
    id: "hosting",
    title: "Where will you deploy?",
    help: "Recommended: Vercel. This decides the deploy workflow you get in .github/workflows — Vercel ships ready to run; the others ship as a marked placeholder for you to finish.",
    type: "single",
    required: true,
    options: [
      {
        value: "vercel",
        label: "Vercel — recommended",
        description: "Zero-config for Next.js, a preview URL per pull request. The generated deploy workflow targets it and works as shipped."
      },
      {
        value: "azure",
        label: "Azure",
        description: "For Microsoft-centric organizations. The deploy workflow ships as a placeholder you complete."
      },
      {
        value: "self_host",
        label: "Self-host",
        description: "Your own servers or containers. The deploy workflow ships as a placeholder you complete."
      }
    ]
  },
  {
    id: "repoProvider",
    title: "Where will your code live?",
    type: "single",
    required: true,
    options: [
      { value: "github", label: "GitHub", description: "Recommended — best Claude Code & CI ecosystem" },
      { value: "azure_devops", label: "Azure DevOps", description: "For Microsoft-centric organizations" }
    ]
  },
  {
    id: "team",
    title: "Who's building it?",
    help: "Shapes workflow, branching, and how much process Airrow prescribes.",
    type: "single",
    required: true,
    options: [
      { value: "solo", label: "Just me", description: "Solo founder + AI assistants" },
      { value: "small_team", label: "2–5 people", description: "Founding team" },
      { value: "startup", label: "Growing startup", description: "Multiple engineers, needs coordination" },
      { value: "agency", label: "Agency", description: "Building for clients, repeatable process" }
    ]
  }
];

/** Pure evaluator: is a question visible given current answers? */
export function isQuestionVisible(q: Question, answers: InterviewAnswers): boolean {
  if (!q.showIf) return true;
  return q.showIf.every((cond) => {
    const answer = answers[cond.questionId];
    if (answer === undefined || answer === null) return false;
    if (Array.isArray(answer)) return answer.some((v) => cond.in.includes(v));
    return cond.in.includes(String(answer));
  });
}

/** Questions visible for the given answers, in order. */
export function visibleQuestions(answers: InterviewAnswers): Question[] {
  return interviewQuestions.filter((q) => isQuestionVisible(q, answers));
}

/** Drop answers belonging to questions that are no longer visible. */
export function pruneHiddenAnswers(answers: InterviewAnswers): InterviewAnswers {
  const pruned: InterviewAnswers = {};
  for (const q of interviewQuestions) {
    if (isQuestionVisible(q, answers)) {
      const v = answers[q.id];
      if (v !== undefined) (pruned as Record<string, unknown>)[q.id] = v;
    }
  }
  return pruned;
}

/** First visible question with no answer; null when complete. */
export function firstUnanswered(answers: InterviewAnswers): Question | null {
  for (const q of visibleQuestions(answers)) {
    const v = answers[q.id];
    if (v === undefined || (Array.isArray(v) && v.length === 0) || (typeof v === "string" && v.trim() === "")) {
      return q;
    }
  }
  return null;
}

export function isInterviewComplete(answers: InterviewAnswers): boolean {
  return firstUnanswered(answers) === null;
}
