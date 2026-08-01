// Declarative interview schema v1. Pure data + pure evaluator — no runtime deps.
// This is the single source of truth for the interview UI and engine resolution.

import type { Framework, InterviewAnswers, ProductType } from "./types.ts";

export const INTERVIEW_SCHEMA_VERSION = "4";

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
  /**
   * For a `guided_text` question: the words this option writes into the field when it is picked
   * (spec 159). The founder then edits or extends them, and what they end up with is the answer —
   * which is why the prefill is written as something a founder could plausibly have typed, not as a
   * label. An option with no prefill is the "start from nothing" one.
   */
  prefill?: string;
  /**
   * The golden path for this question, when it is the same one for everybody. Where the answer
   * depends on an earlier one, use `Question.suggest` instead — never both.
   */
  recommended?: boolean;
}

export interface Condition {
  questionId: keyof InterviewAnswers;
  /** Show when the answer (or any selected value for multi) is in this list. */
  in: string[];
}

/**
 * What this question suggests, given an earlier answer.
 *
 * For a `single` question the value is the option to mark as recommended; for a `text` one it is the
 * text prefilled into the field. One shape for both because it is one idea: the founder is answering
 * a question we can already make a good guess at, and the guess is theirs to keep or replace.
 */
export interface Suggestion {
  /** The earlier answer this suggestion keys off. */
  from: keyof InterviewAnswers;
  /** Suggested value per answer to `from`. A missing key means no suggestion. */
  value: Record<string, string>;
}

export interface Question {
  id: keyof InterviewAnswers;
  title: string;
  help?: string;
  /**
   * Two types beyond the original three, both added by spec 159.
   *
   * `guided_text` is one free-text answer with starting points above it: picking one writes its words
   * into the field, where the founder edits or extends them. It is not a choice *and* a text answer —
   * it is a text answer the founder does not have to start from nothing, which is why there is one
   * answer at the end of it and not two.
   *
   * `references` is a text answer with a screen of its own: the founder's links live in the answer,
   * and the images they upload beside it live in the database — bytes never belong in an answer
   * object that is rewritten on every keystroke and replayed into a guest's `localStorage`.
   */
  type: "single" | "multi" | "text" | "guided_text" | "references";
  options?: QuestionOption[];
  placeholder?: string;
  required: boolean;
  showIf?: Condition[];
  suggest?: Suggestion;
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
  uiDirection: 500,
  uiReferenceLinks: 300,
  // No longer asked (spec 159 removed the question), but still the ceiling on the field: an answer
  // saved before it went, or one an import analysis derived, is still validated against it.
  nonGoals: 400,
  frameworkOther: 300,
  productTypeOther: 200,
  tenancyOther: 300,
  capabilitiesOther: 300,
  databaseOther: 200,
  hostingOther: 200,
  integrations: 300
} as const;

/** How many products the founder may point at. Five is more than anyone needs to make a point. */
export const MAX_UI_REFERENCE_LINKS = 5;

/**
 * How many screenshots one project may carry, and how large each may be.
 *
 * Four because a design direction that takes five screenshots to convey is not a direction; 2 MB
 * because a full-page screenshot fits in it and an unoptimised export does not. Both are checked
 * server-side — the field's own limits are a courtesy, not the boundary.
 */
export const MAX_UI_REFERENCE_IMAGES = 4;
export const MAX_UI_REFERENCE_IMAGE_BYTES = 2 * 1024 * 1024;

/** What an attached reference may be. Three formats every screenshot tool produces. */
export const UI_REFERENCE_MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/**
 * The founder's reference links, split the one way every reader of them splits.
 *
 * Here rather than beside the Zod schema that validates them, so the engine can use it without
 * taking a dependency on Zod — `questions.ts` is pure data and pure functions by design.
 */
export function splitReferenceLinks(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** The stack a product type points at before the founder says otherwise. */
export interface StandardStack {
  /** The `framework` option this product type recommends. */
  framework: Framework;
  /**
   * Prefilled into `frameworkOther` when the recommendation is a stack this engine cannot scaffold
   * itself. Written the way the `frameworkOther` question asks for it — language, framework and
   * package manager — because that is what decides every command in the generated documents.
   *
   * A fragment, with no closing period: it is rendered inline in a stack summary as often as it is
   * rendered as a sentence, and the renderer adds the period where one belongs.
   */
  describe?: string;
}

/**
 * What each product type is normally built in.
 *
 * The two scaffoldable golden paths cover the web products. Everything else gets the stack its own
 * community treats as standard, *described* rather than derived — the toolchain, the setup steps and
 * `/start` are then written for it, the same way they are for any stack a founder names themselves.
 *
 * This exists because the silent default was worse than any of these. A mobile app was never asked
 * which stack it wanted and was resolved to Vite + React, so a founder building for iOS downloaded a
 * web SPA whose documents said `npm run dev`. A default nobody is shown is a decision nobody made.
 */
export const STANDARD_STACK: Record<ProductType, StandardStack> = {
  saas: { framework: "nextjs" },
  marketplace: { framework: "nextjs" },
  ai_agent: { framework: "nextjs" },
  internal_tool: { framework: "nextjs" },
  hobby: { framework: "nextjs" },
  mobile_app: {
    framework: "custom",
    describe:
      "Expo (React Native) with TypeScript and expo-router, npm for packages, Jest with jest-expo for tests"
  },
  api: {
    framework: "custom",
    describe: "Node 20 with TypeScript and Hono for the HTTP layer, pnpm for packages, Vitest for tests"
  },
  browser_extension: {
    framework: "custom",
    describe:
      "Vite with React and TypeScript, CRXJS for the extension manifest and build, npm for packages, Vitest for tests"
  },
  // A product none of the eight covered: nothing here knows what it is normally built in, so the
  // recommendation is the question that asks — `custom` puts the founder in front of the stack field
  // rather than in front of a web app they never asked for (spec 159).
  other: { framework: "custom" }
};

/** One `Suggestion.value` map per field of the table above — derived, so the two cannot drift. */
function standardStackMap(pick: (s: StandardStack) => string | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [productType, stack] of Object.entries(STANDARD_STACK)) {
    const value = pick(stack);
    if (value !== undefined) map[productType] = value;
  }
  return map;
}

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
      { value: "hobby", label: "Side project / for fun", description: "A passion project or experiment — not (yet) a business" },
      {
        value: "other",
        label: "Something else — describe it",
        description: "A game, a CLI tool, firmware, a desktop app. Your documents are written for what you name."
      }
    ]
  },
  {
    // The escape hatch, built exactly like `frameworkOther`: an option that admits the list was
    // incomplete, and a field that makes the admission useful. Eight types covered the products we
    // had seen; the ninth answer used to be whichever of them was least wrong (spec 159).
    id: "productTypeOther",
    title: "What are you building?",
    help: "A sentence is enough. Everything generated for you is written for this rather than for the nearest option on the last screen.",
    type: "text",
    required: true,
    showIf: [{ questionId: "productType", in: ["other"] }],
    maxChars: ANSWER_MAX_CHARS.productTypeOther,
    placeholder: "e.g. A turn-based strategy game for two players, running in the browser."
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
    id: "coreEntities",
    title: "What are the core objects in your product?",
    help: "The 3–7 most important things and how they relate. Skip it if you're not sure yet — you can fill it in later.",
    type: "text",
    required: false,
    maxChars: ANSWER_MAX_CHARS.coreEntities,
    placeholder: "e.g. Landlords own Properties; a Property has many Listings; a Listing receives Applications from Tenants."
  },
  {
    // Two readers: the founder, who wants to know what their product looks like, and the assistant
    // running `/start`, for whom this is a build brief — so the help text pushes toward something
    // specific enough to act on, not merely a mood board. Never a hard requirement: a thin or empty
    // answer still produces a usable, if less specific, `UI_ARCHITECTURE.md`.
    // One question where there were two (spec 159, revised). Asking for a design brief and then
    // asking which of five directions was closest made the founder answer the same question twice,
    // and left the engine holding two answers that could disagree. The starting points now write
    // themselves into this field instead: pick one and it is your sentence, to edit or extend or
    // delete. What comes out is one answer, in the founder's own words, whether or not they started
    // from ours.
    id: "uiDirection",
    title: "How should it look and feel?",
    help: "Layout, tone, the screens that matter most, how someone moves through it. This becomes docs/architecture/UI_ARCHITECTURE.md — the design brief your AI assistant builds the first version from. Change it any time; it's a starting point, not a lock-in.",
    type: "guided_text",
    required: false,
    maxChars: ANSWER_MAX_CHARS.uiDirection,
    placeholder:
      "e.g. Calm and uncluttered — a sidebar of properties, a single detail view per listing, dense tables over cards. Dark mode first. The applications inbox is the screen a property manager lives in.",
    options: [
      {
        value: "calm_focused",
        label: "Calm & focused",
        description: "Generous space, few colours, one clear action per screen. Reads quiet and expensive.",
        prefill:
          "Calm and focused: generous whitespace, a restrained palette of one accent against neutrals, and one clear action per screen. Type is quiet and consistent, borders do the separating rather than shadows, and nothing moves unless something changed."
      },
      {
        value: "dense_operational",
        label: "Dense & operational",
        description: "Tables over cards, keyboard-first, a lot of information at once. For people who live in it all day.",
        prefill:
          "Dense and operational: tables over cards, tight row heights, and as much of the working set on screen at once as stays readable. Keyboard paths for anything done more than twice, and colour reserved for status rather than decoration."
      },
      {
        value: "bright_editorial",
        label: "Bright & editorial",
        description: "Large type, strong headings, plenty of contrast. The screen reads like a well-set page.",
        prefill:
          "Bright and editorial: large headings, strong vertical rhythm, and high contrast between sections. Generous line length for reading, images given room, and a clear typographic hierarchy doing the work navigation would otherwise do."
      },
      {
        value: "warm_consumer",
        label: "Warm & consumer",
        description: "Rounded shapes, soft colour, friendly copy. For someone who did not come here to work.",
        prefill:
          "Warm and consumer: rounded shapes, soft colour, and copy that speaks plainly. Larger touch targets than a desktop tool needs, colour where a work tool would leave blank space, and a light default theme."
      },
      {
        value: "stark_technical",
        label: "Stark & technical",
        description: "Monospace accents, high contrast, no decoration. For a developer audience.",
        prefill:
          "Stark and technical: high contrast, monospace for anything a developer would copy, and no decoration that is not carrying information. Dense by default, dark-mode first, and precise about states."
      },
      {
        // No prefill, and that is the option: an empty field, and a brief written from nothing but
        // what the founder types into it.
        value: "describe_myself",
        label: "None of these — my own words",
        description: "The brief is written from what you write, and from nothing else."
      }
    ]
  },
  {
    // One screen, two kinds of reference (spec 159). The links are this answer; the images the
    // founder uploads beside them are rows in `ui_references`, because bytes have no business in an
    // answer object. Optional in the real sense — `firstUnanswered` skips it when it is empty.
    id: "uiReferenceLinks",
    title: "Anything you can show us?",
    help: `Products whose look you like, and screenshots of them — read as direction, never as something to copy. At most ${MAX_UI_REFERENCE_LINKS} links and ${MAX_UI_REFERENCE_IMAGES} images.`,
    type: "references",
    required: false,
    maxChars: ANSWER_MAX_CHARS.uiReferenceLinks,
    placeholder: "linear.app  stripe.com/dashboard"
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
      { value: "internal", label: "Single internal org", description: "One company; everyone is in the same tenant" },
      {
        value: "other",
        label: "Something else — describe it",
        description: "An isolation model none of these describes. Your data documents are written from what you write."
      }
    ]
  },
  {
    // Not folded into `tenancy`'s options as prose: this answer decides the row-level security
    // strategy, and a described model has to be read as the founder wrote it rather than mapped onto
    // the nearest of four. Nothing derives `organization_id` from it — see `Tenancy` (spec 159).
    id: "tenancyOther",
    title: "How is your data organized and isolated?",
    help: "Who can see whose data, and what the boundary is. This is the hardest thing to change later, so be concrete.",
    type: "text",
    required: true,
    showIf: [{ questionId: "tenancy", in: ["other"] }],
    maxChars: ANSWER_MAX_CHARS.tenancyOther,
    placeholder:
      "e.g. Each clinic is a tenant, but a patient record can be shared with a second clinic for a referral, for a fixed period."
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
      { value: "audit_logs", label: "Audit logs", description: "Who did what, when" },
      {
        value: "other",
        label: "Something else — describe it",
        description: "The capability this product needs that no box above covers"
      }
    ]
  },
  {
    id: "capabilitiesOther",
    title: "What else does it need to do?",
    help: "The capability none of the boxes covered. It gets its own section in your roadmap and its own first spec, like every other one you picked.",
    type: "text",
    required: true,
    showIf: [{ questionId: "capabilities", in: ["other"] }],
    maxChars: ANSWER_MAX_CHARS.capabilitiesOther,
    placeholder: "e.g. Offline sync — the field app has to keep working with no signal and reconcile later."
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
    // Every stack question states what it *changes* in the output, not just what it means. A founder
    // picked Vite, got `npm run dev` in START_HERE, and read it as a bug — the choice was clear, its
    // consequence was invisible.
    //
    // Asked of everyone. It used to be hidden for mobile apps, APIs and browser extensions, which
    // resolved them to Vite behind the founder's back; the recommendation now comes from
    // STANDARD_STACK instead, so the answer is always theirs to see and change.
    id: "framework",
    title: "Which stack?",
    help: "This decides the package manager, so it sets every command in your generated docs and CI — and the setup steps `/start` runs on your machine. The two web paths ship TypeScript, Tailwind and shadcn/ui; anything else is written for the stack you name.",
    type: "single",
    required: true,
    suggest: { from: "productType", value: standardStackMap((s) => s.framework) },
    options: [
      {
        value: "nextjs",
        label: "Next.js",
        description: "App Router, server actions, server-side rendering. Uses pnpm, so your docs say `pnpm dev`. The golden path for anything that lives on the web."
      },
      {
        value: "vite",
        label: "Vite + React",
        description: "A pure single-page app with no server of its own — all data goes through Supabase from the browser. Uses npm, so your docs say `npm run dev`."
      },
      {
        value: "custom",
        label: "Something else — describe it",
        description: "Expo for a mobile app, Django, Rails, SvelteKit, Go, Laravel — anything. Your docs are written for the stack you name, commands included."
      }
    ]
  },
  {
    // Only the two golden-path frameworks have commands anyone here can derive; for everything else
    // the toolchain is authored from this answer (see TOOLCHAIN_SLOTS). Naming the language and
    // package manager matters more than the framework: it is what decides `pnpm dev` from
    // `python manage.py runserver`.
    //
    // Prefilled from STANDARD_STACK when the product type has an obvious answer, so a founder
    // building a mobile app is shown Expo rather than made to know it. It is a starting sentence,
    // not a lock: everything below the field is written for whatever they leave in it.
    id: "frameworkOther",
    title: "Describe your stack",
    help: "Language, framework and package manager at minimum. Everything generated for you — setup steps, the commands in START_HERE.md, the architecture docs — is written for what you put here. Edit or replace the suggestion freely.",
    type: "text",
    required: true,
    showIf: [{ questionId: "framework", in: ["custom"] }],
    suggest: { from: "productType", value: standardStackMap((s) => s.describe) },
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
        label: "Supabase",
        recommended: true,
        description: "Postgres with Auth, Storage, Realtime and RLS already wired. Your setup steps become 'create a project, paste two keys'."
      },
      {
        value: "postgres",
        label: "Self-hosted Postgres",
        description: "Your own Postgres. Same schema and migrations, but auth and file storage are yours to build — your setup steps say so."
      },
      {
        value: "other",
        label: "Something else — describe it",
        description: "MySQL, SQLite, Mongo, Firebase, DynamoDB. Your setup steps and data documents are written for what you name."
      }
    ]
  },
  {
    id: "databaseOther",
    title: "Which database?",
    help: "Name it, and where it runs — managed or your own. Your setup steps, your data documents and the migration advice in them are written for this.",
    type: "text",
    required: true,
    showIf: [{ questionId: "database", in: ["other"] }],
    maxChars: ANSWER_MAX_CHARS.databaseOther,
    placeholder: "e.g. MongoDB Atlas, with Mongoose for the schema and migrate-mongo for migrations."
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
        label: "Vercel",
        recommended: true,
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
      },
      {
        value: "other",
        label: "Something else — describe it",
        description: "Fly, Railway, Netlify, Cloudflare, AWS, an app store. The deploy workflow ships as a placeholder named for what you say."
      }
    ]
  },
  {
    id: "hostingOther",
    title: "Where will you deploy?",
    help: "Name the target. Your deploy steps and the setup guide are written for it — and the generated workflow ships as a placeholder you finish, since nothing here can wire a target it has not seen.",
    type: "text",
    required: true,
    showIf: [{ questionId: "hosting", in: ["other"] }],
    maxChars: ANSWER_MAX_CHARS.hostingOther,
    placeholder: "e.g. Fly.io, one app per environment, deployed with flyctl from CI."
  },
  {
    id: "repoProvider",
    title: "Where will your code live?",
    help: "Decides the CI workflow, the branch-policy setup, and which CLI your assistant uses to open PRs — GitHub Actions and `gh`, or Azure Pipelines and `az`.",
    type: "single",
    required: true,
    options: [
      { value: "github", label: "GitHub", recommended: true, description: "Best Claude Code & CI ecosystem" },
      { value: "azure_devops", label: "Azure DevOps", description: "For Microsoft-centric organizations" }
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

/** What this question suggests given the answers so far; null when it has no opinion. */
export function suggestedValue(q: Question, answers: InterviewAnswers): string | null {
  if (!q.suggest) return null;
  const from = answers[q.suggest.from];
  if (typeof from !== "string") return null;
  return q.suggest.value[from] ?? null;
}

/** True when this option is the one to point the founder at, given the answers so far. */
export function isRecommendedOption(
  q: Question,
  option: QuestionOption,
  answers: InterviewAnswers
): boolean {
  const suggested = suggestedValue(q, answers);
  return suggested === null ? option.recommended === true : suggested === option.value;
}

/**
 * Fill in the suggested text answers the founder has not written over.
 *
 * Only empty answers are touched, so nothing typed is ever lost — including a suggestion the founder
 * cleared and replaced. Applied to every answer change rather than at one screen, because a
 * suggestion keys off an *earlier* answer and that answer can be edited from the review screen.
 */
export function withSuggestions(answers: InterviewAnswers): InterviewAnswers {
  const next: InterviewAnswers = { ...answers };
  for (const q of interviewQuestions) {
    if (q.type !== "text") continue;
    const current = next[q.id];
    if (typeof current === "string" && current.trim() !== "") continue;
    const suggested = suggestedValue(q, next);
    if (suggested !== null) (next as Record<string, unknown>)[q.id] = suggested;
  }
  return next;
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

/**
 * First visible **required** question with no answer; null when the interview may be submitted.
 *
 * `required` is honoured here as of spec 159, and that is a fix rather than a refinement: this
 * function decides both where a resumed interview lands and whether the submit button is enabled, so
 * ignoring `required` made every optional question mandatory in the interface while
 * `validateCompleteAnswers` — the actual gate — had always let them pass. `coreEntities` said "Skip
 * it if you're not sure yet" and could not be skipped. An optional question is still shown, in its
 * place in the order; it simply no longer blocks the way past it.
 */
export function firstUnanswered(answers: InterviewAnswers): Question | null {
  for (const q of visibleQuestions(answers)) {
    if (!q.required) continue;
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
