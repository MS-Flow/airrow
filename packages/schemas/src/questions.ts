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
}

export const interviewQuestions: Question[] = [
  {
    id: "productType",
    title: "What are you building?",
    help: "This shapes the architecture, roadmap, and specs Arrow generates.",
    type: "single",
    required: true,
    options: [
      { value: "saas", label: "SaaS", description: "A web application sold as a subscription" },
      { value: "marketplace", label: "Marketplace", description: "Connecting two sides: buyers and sellers" },
      { value: "ai_agent", label: "AI product / agent", description: "An AI-first product or autonomous agent" },
      { value: "mobile_app", label: "Mobile app", description: "iOS / Android as the primary surface" },
      { value: "api", label: "API / developer tool", description: "A product other developers build on" },
      { value: "internal_tool", label: "Internal tool", description: "Software for your own company or team" },
      { value: "browser_extension", label: "Browser extension", description: "Lives inside the browser" }
    ]
  },
  {
    id: "audience",
    title: "Who is it for?",
    help: "B2B and B2C foundations differ: tenancy, onboarding, billing, compliance.",
    type: "single",
    required: true,
    showIf: [{ questionId: "productType", in: ["saas", "marketplace", "ai_agent", "mobile_app", "api", "browser_extension"] }],
    options: [
      { value: "b2b", label: "Businesses (B2B)", description: "Teams and companies pay" },
      { value: "b2c", label: "Consumers (B2C)", description: "Individuals use and pay" },
      { value: "both", label: "Both", description: "Prosumer or two-sided" }
    ]
  },
  {
    id: "features",
    title: "Which capabilities will your product need?",
    help: "Select everything you expect in the first year. Arrow specs the MVP subset and roadmaps the rest.",
    type: "multi",
    required: true,
    options: [
      { value: "auth", label: "User accounts", description: "Sign up, sign in, sessions" },
      { value: "organizations", label: "Organizations / teams", description: "Multi-user workspaces, multi-tenancy" },
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
    id: "roles",
    title: "How sophisticated should roles & permissions be?",
    help: "You selected organizations — Arrow will spec the permission model.",
    type: "single",
    required: true,
    showIf: [{ questionId: "features", in: ["organizations"] }],
    options: [
      { value: "simple", label: "Simple", description: "Owner, admin, member — enough for most products" },
      { value: "granular", label: "Granular", description: "Custom roles / per-resource permissions" }
    ]
  },
  {
    id: "framework",
    title: "Which web framework?",
    help: "Arrow's golden path is Next.js on Vercel. Vite fits pure SPAs.",
    type: "single",
    required: true,
    showIf: [{ questionId: "productType", in: ["saas", "marketplace", "ai_agent", "internal_tool"] }],
    options: [
      { value: "nextjs", label: "Next.js", description: "Recommended — SSR, server actions, Vercel-native" },
      { value: "vite", label: "Vite + React", description: "Lightweight SPA, backend via Supabase only" }
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
    help: "Shapes workflow, branching, and how much process Arrow prescribes.",
    type: "single",
    required: true,
    options: [
      { value: "solo", label: "Just me", description: "Solo founder + AI assistants" },
      { value: "small_team", label: "2–5 people", description: "Founding team" },
      { value: "startup", label: "Growing startup", description: "Multiple engineers, needs coordination" },
      { value: "agency", label: "Agency", description: "Building for clients, repeatable process" }
    ]
  },
  {
    id: "security",
    title: "How sensitive is your data?",
    type: "single",
    required: true,
    options: [
      { value: "standard", label: "Standard", description: "Normal user data, best-practice security" },
      { value: "elevated", label: "Elevated", description: "PII at scale, payments data, health, or regulated industry" }
    ]
  },
  {
    id: "scale",
    title: "What scale are you designing for first?",
    type: "single",
    required: true,
    options: [
      { value: "validate", label: "Validate first", description: "Optimize for speed of learning — hundreds of users" },
      { value: "growth", label: "Growth-ready", description: "Expect rapid adoption — design for tens of thousands" }
    ]
  },
  {
    id: "mvpFocus",
    title: "What must the MVP do, above all else?",
    help: "One or two sentences. This becomes the heart of your roadmap and first specs.",
    type: "text",
    required: true,
    placeholder: "e.g. Let a property manager create a listing and receive tenant applications online."
  },
  {
    id: "goal90",
    title: "What does success look like in 90 days?",
    help: "A business outcome, not a feature list.",
    type: "text",
    required: true,
    placeholder: "e.g. 20 paying customers and a repeatable onboarding motion."
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
