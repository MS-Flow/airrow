// Declarative interview schema v1. Pure data + pure evaluator — no runtime deps.
// This is the single source of truth for the interview UI and engine resolution.

import type {
  AnswerId,
  Framework,
  InterviewAnswers,
  ProductType,
  ProjectOrigin
} from "./types.ts";
import { KEEP_EXISTING_UI } from "./ui-kits.ts";

export const INTERVIEW_SCHEMA_VERSION = "5";

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
   * Picking this option is how the founder asks to show us instead (spec 165).
   *
   * On a question that takes `references`, this is the one that reveals them. It is a property of the
   * option rather than a hardcoded id because it is a *role* — "the escape from the five" — and the
   * five may change without that role moving.
   */
  opensReferences?: boolean;
  /**
   * The golden path for this question, when it is the same one for everybody. Where the answer
   * depends on an earlier one, use `Question.suggest` instead — never both.
   */
  recommended?: boolean;
}

/**
 * An answer that belongs to a question without being one, keyed by its owning question.
 *
 * Two of them, and both belong to the design question — which is now the *only* UI question there
 * is. `uiKit` records which curated direction was picked; `uiReferenceLinks` holds the products the
 * founder pointed at. Neither is a screen of its own: everything about how this product should look
 * is asked once, in one place.
 *
 * They still have to be pruned when their owner disappears, which is what this map is for:
 * `pruneHiddenAnswers` walks the questions, so an answer no question claims would otherwise be
 * dropped on every save.
 */
export const SATELLITE_ANSWERS: Partial<Record<AnswerId, AnswerId>> = {
  uiKit: "uiDirection",
  uiReferenceLinks: "uiDirection"
};

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
   * One type beyond the original three, added by spec 159 and widened by spec 165.
   *
   * `guided_text` is one free-text answer with starting points above it: picking one writes its words
   * into the field, where the founder edits or extends them. It is not a choice *and* a text answer —
   * it is a text answer the founder does not have to start from nothing, which is why there is one
   * answer at the end of it and not two.
   *
   * Spec 159's `references` type is gone: its one question folded into the design question rather
   * than sitting on the screen after it (see `references` below).
   */
  type: "single" | "multi" | "text" | "guided_text";
  /**
   * This question also takes references — pasted links and, for a signed-in founder, screenshots.
   *
   * A flag rather than a question type, because references are not what is being asked: they are a
   * second way of answering the question already on the screen. The links land in
   * `uiReferenceLinks` and the images in `ui_references`, exactly as they did when this was a screen
   * of its own — bytes never belong in an answer object rewritten on every keystroke (spec 159).
   */
  references?: boolean;
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
  // Raised from 300 when this question absorbed the MVP focus (spec 165): it now carries two
  // answers, and a cap sized for one of them would have cut the second off mid-sentence.
  vision: 500,
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
  branchingModelOther: 300,
  integrations: 300,
  // Matches `hiddenFolderSchema`'s ceiling, so the field cannot accept a name the store would refuse
  // on length alone (spec 199).
  hiddenFolder: 48
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
    placeholder: "e.g. A compression library other people's products embed, plus the service that meters it."
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
      "e.g. Teams moving large media libraries pay for storage they never look at, and every tool that promises to shrink it either mangles the files or takes a week to run."
  },
  {
    // Two questions in one, and the pairing is the point: the first thing it must do is only
    // meaningful next to where it is going, and a founder answering them on consecutive screens
    // wrote the same sentence twice (spec 165). `mvpFocus` is no longer asked and its **field
    // stays** — the `nonGoals` treatment from spec 159, for a stronger reason: it is `/start`'s
    // ceiling in the constitution and appears in six generated documents, so removing the field
    // would be a constitution change rather than one fewer question. Readers of it fall back to
    // this answer (`coreAction`), and an import analysis can still derive one.
    id: "vision",
    title: "What must it do first, and where is it heading?",
    help: "The one thing it has to do to be useful at all — then, in a sentence, what it becomes if it works. Your AI assistants build the first and aim at the second.",
    type: "text",
    required: true,
    maxChars: ANSWER_MAX_CHARS.vision,
    placeholder:
      "e.g. Let someone drop in a folder and get it back materially smaller, losslessly, in minutes. Long-term, the compression layer everything else quietly runs on."
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
    //
    // And as of spec 165 a picked direction is more than words: each one points at a real theme,
    // pinned, that `/start` installs. What it is *not* is a layout. The picture is a specimen of the
    // look — colour, type, corner, spacing — and the screens themselves come from what the founder
    // wrote about their product. A picked picture that decided the navigation would be a template
    // overruling the answers, which is the opposite of the point.
    //
    // Everything about how this product should look is now asked here and nowhere else: the
    // references screen spec 159 gave its own question folded back in, so a founder answers the
    // design question once instead of being asked about the same subject on two consecutive screens
    // (spec 165). `uiReferenceLinks` is still an answer — it is simply no longer a question.
    id: "uiDirection",
    title: "How should it look and feel?",
    help: "Pick the palette and type you like — that theme gets installed, so your first screen looks like it from day one. The screens themselves are built from what you write below, not from the picture.",
    type: "guided_text",
    required: false,
    references: true,
    maxChars: ANSWER_MAX_CHARS.uiDirection,
    placeholder:
      "e.g. Calm and uncluttered. The screen someone lives in is the job list — everything else is secondary. Dark mode matters; our users are engineers and they work late.",
    options: [
      {
        value: "soft_minimal",
        label: "Soft minimal",
        description: "Warm off-white, deep green, a lot of air.",
        prefill:
          "Soft and minimal: a warm off-white ground, near-black text and one deep accent. Generous whitespace, hairline borders rather than shadows, and a large wordmark that leads every page. One typeface, with size and weight doing all the work. Almost nothing moves."
      },
      {
        value: "bold_contrast",
        label: "Bold contrast",
        description: "Near-black, soft red, oversized type. Looks new.",
        prefill:
          "Bold and high-contrast: a near-black ground with one soft red accent, dark by default. Oversized headings against small quiet body text, flat surfaces separated by colour rather than borders, and monospace for anything technical. Motion is short and deliberate."
      },
      {
        value: "stark_terminal",
        label: "Stark & technical",
        description: "Near-black, phosphor green, monospace accents. Terminal feeling.",
        prefill:
          "Stark and technical, like a terminal: a near-black ground with one phosphor-green accent, monospace everywhere at one size and one weight, and colour as the only emphasis. Sharp corners, single-pixel outlines instead of shadows, and no marketing voice — the output is the headline. A cursor blinks; nothing else moves."
      },
      {
        // The sixth option, and the only one that installs nothing: no prefill, no theme, no blocks.
        //
        // It used to read "None of these — my own words", which named the *absence* of a choice and
        // then left the founder in front of an empty box. What someone who rejects five pictures
        // actually wants is to show us the one they had in mind, so this option now opens the way to
        // do that — the link field and the upload, which is where the references screen went when it
        // folded into this question (spec 165).
        value: "show_instead",
        label: "None of these — I'll show you",
        description: "Paste a link, or upload a screenshot. Nothing is installed.",
        opensReferences: true
      }
    ]
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
      "e.g. Each team is a tenant, but a library can be shared read-only with an outside reviewer for a fixed period."
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
    placeholder: "e.g. A public benchmark page — every run scored, so the ratio is something anyone can check."
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
    // Asked here rather than up with the product questions, because half of it is about the
    // capabilities just chosen: a founder who has this moment ticked payments and email knows what
    // they are connecting to, and asking before that made them guess at a list they had not seen.
    id: "coreEntities",
    title: "What are the core pages, and what does it connect to?",
    help: "The 3–7 screens someone actually moves between, and what each one is for — plus any service you already know you'll connect for the capabilities you just picked. Skip it if you're not sure yet; you can fill it in later.",
    type: "text",
    required: false,
    maxChars: ANSWER_MAX_CHARS.coreEntities,
    placeholder:
      "e.g. A dashboard listing your libraries; a library page holding its files; a file page showing each job and the ratio achieved. Stripe for billing, Resend for the finished-job email."
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

/**
 * The two answers an imported interview collects and never keeps (spec 199).
 *
 * They are asked as questions, so they arrive as answers — but `import_sources.delivery` is the one
 * durable record of how a foundation lands, and the one the engine reads. The save writes them
 * through to it and strips them here, because two copies of that decision would eventually disagree
 * and the engine would read the wrong one.
 */
export const TRANSIENT_ANSWERS: readonly AnswerId[] = ["deliveryLayout", "hiddenFolder"];

/**
 * How the foundation lands — the first thing an imported project is asked (spec 199).
 *
 * First because it is the only answer that changes what the founder's *team* sees, and someone who
 * needs hidden should learn it exists before spending ten minutes on the rest. The wording is the
 * import screen's own (spec 187), so a founder meets one explanation of this choice rather than two.
 *
 * `hiddenFolder` follows it and is shown only for hidden — the one question in the set whose
 * visibility is decided by the answer immediately above it.
 */
const deliveryQuestions: Question[] = [
  {
    id: "deliveryLayout",
    title: "How should the foundation land in your project?",
    help: "This is the one answer your team can see. Everything after it is about the project itself.",
    type: "single",
    required: true,
    options: [
      {
        value: "integrated",
        label: "Integrated",
        recommended: true,
        description:
          "Airrow's files take their own paths beside your own. Anything that collides with a file you already have is a conflict you decide. This is what you push, and what your team sees."
      },
      {
        value: "hidden",
        label: "Hidden",
        description:
          "Everything goes into one folder you name, which git is told to ignore locally. Nothing collides and your repository's diff stays empty. No CI comes with this one: a workflow in an ignored folder could never run."
      }
    ]
  },
  {
    id: "hiddenFolder",
    title: "What should the folder be called?",
    help: "Lowercase letters, numbers and dashes. Pick whatever reads as ordinary in your repository.",
    type: "text",
    required: true,
    showIf: [{ questionId: "deliveryLayout", in: ["hidden"] }],
    maxChars: ANSWER_MAX_CHARS.hiddenFolder,
    placeholder: "notes"
  }
];

/**
 * The design question, for a project whose look already exists (spec 199).
 *
 * The five specimens are the wrong opening for someone who has a running interface: the honest first
 * question is whether to keep it. So `KEEP_EXISTING_UI` leads and is the recommendation, and the
 * curated directions stay in the list behind it for the founder who wants one.
 *
 * A picked direction here is **described, never installed** — an imported project installs nothing
 * (spec 165) and `/cleanup` changes no code, so what a pick decides is what `UI_ARCHITECTURE.md`
 * says. That is why the option's own words describe rather than promise: nothing about them may read
 * as an offer to restyle a codebase Airrow will not touch.
 */
const KEEP_EXISTING_UI_OPTION: QuestionOption = {
  value: KEEP_EXISTING_UI,
  label: "Keep the look we already have",
  recommended: true,
  description: "Your interface stays exactly as it is. The foundation describes it instead of proposing one.",
  prefill:
    "Keep the visual language this project already has. The foundation should describe what is there — the palette, the type and the spacing already in the code — rather than introduce a new one."
};

/**
 * What the imported phrasing says differently, question by question (spec 199).
 *
 * A table of differences rather than a second set written out in full: everything not named here is
 * word for word the greenfield question, so the two phrasings cannot drift into two interviews.
 *
 * The shape of the change is the same everywhere — *decide* becomes *confirm*. A founder whose
 * schema already implements a tenancy model is not choosing one; they are telling us which one their
 * code already has, so the documents describe the project rather than a plan for it. None of this
 * wording may suggest Airrow will change any of it: `/cleanup` reads the codebase and rewrites the
 * foundation's documents, and touches no code at all.
 */
const IMPORT_WORDING: Partial<Record<AnswerId, Pick<Question, "title" | "help">>> = {
  productType: {
    title: "What is this project?",
    help: "What it is today. This shapes the architecture, specifications and roadmap written around it."
  },
  problem: {
    title: "What problem does it solve, and who has it?",
    help: "The situation your project already addresses, and who it hurts. This is the single most useful thing you can tell your AI assistants."
  },
  vision: {
    title: "Where is it going from here?",
    help: "What it grows into next. Written down so a decision made now is not re-argued in three months."
  },
  coreEntities: {
    title: "What are the main things in your data model?",
    help: "The nouns your schema already has. Where the analysis could read them, they are filled in below to correct rather than to invent."
  },
  tenancy: {
    title: "How is your data organized and isolated today?",
    help: "Confirm what your code already does. This decides what the data documents describe, and it is the hardest thing to change later."
  },
  authModel: {
    title: "How do people sign in today?",
    help: "What is already implemented, not what you might add."
  },
  capabilities: {
    title: "What does it already do?",
    help: "The capabilities that exist. What comes next belongs in a spec, not here."
  },
  framework: {
    title: "Which stack is it built in?",
    help: "Confirm what the analysis found. Every command in every generated document is written for this answer, so a wrong one shows up everywhere."
  },
  database: {
    title: "Which database does it use?",
    help: "Confirm what was found in your project."
  },
  hosting: {
    title: "Where is it deployed?",
    help: "Confirm what was found, or say where it is going if nothing was."
  },
  repoProvider: {
    title: "Where does the code live?",
    help: "Decides which CLI the workflow documents use for pull requests."
  }
};

/**
 * The documents an imported project already has (spec 199).
 *
 * Asked only when the foundation lands integrated. A hidden one may change nothing outside its own
 * folder, so `describe` would be the only answer available — and a question with one answer is not a
 * question, it is a sentence pretending to be one (§0, adaptive never bureaucratic).
 *
 * No option here changes code. `adopt` means the foundation's documents take over as the source of
 * truth for how the project is worked on; it does not mean anything of the team's is rewritten or
 * deleted, which `/cleanup` is forbidden from doing either way (spec 91).
 */
const existingDocsQuestion: Question = {
  id: "existingDocs",
  title: "What should happen to the documents you already have?",
  help: "A README, decision records, contributing notes, an assistant instruction file. Nothing is deleted or rewritten in your project whichever you pick.",
  type: "single",
  required: true,
  showIf: [{ questionId: "deliveryLayout", in: ["integrated"] }],
  options: [
    {
      value: "describe",
      label: "Describe them",
      recommended: true,
      description: "The foundation points at what you already have and works around it."
    },
    {
      value: "adopt",
      label: "Build on them",
      description: "The foundation's documents become where the project's decisions are recorded from here."
    },
    {
      value: "leave",
      label: "Leave them out of it",
      description: "The foundation stands on its own and says nothing about your existing documents."
    }
  ]
};

/**
 * How the team already branches (spec 212).
 *
 * Asked only when the foundation lands **hidden**, and that is the whole justification for the
 * question existing: hidden's own documents promise the team's repository keeps its branch rules,
 * while the foundation ships a `BRANCHING.md` prescribing one. Integrated does not ask, because
 * nothing there would change — `/cleanup` establishes Airrow's model locally, which is what adopting
 * a foundation into a repository means (spec 91).
 *
 * Two named shapes and the founder's own, because only two change what the document can say. Neither
 * option promises anything: the answer decides what `BRANCHING.md` *describes*, and hidden changes
 * nothing outside its folder in any case.
 */
const branchingQuestions: Question[] = [
  {
    id: "branchingModel",
    title: "How does this team branch today?",
    help: "So the workflow documents describe the branches you actually use. Nothing here changes your repository — this foundation is never pushed.",
    type: "single",
    required: true,
    showIf: [{ questionId: "deliveryLayout", in: ["hidden"] }],
    options: [
      {
        value: "trunk",
        label: "Short branches off the trunk",
        recommended: true,
        description: "Work branches from `main` (or whatever the trunk is called) and merges straight back into it."
      },
      {
        value: "integration_branch",
        label: "An integration branch under the trunk",
        description: "Work lands on a long-lived branch — `develop`, `staging` — and reaches the trunk on a release."
      },
      {
        value: "other",
        label: "Something else",
        description: "Describe it and the documents follow yours instead of naming a shape you do not use."
      }
    ]
  },
  {
    id: "branchingModelOther",
    title: "How does it work?",
    help: "One or two sentences: which branches are long-lived, and what merges into what.",
    type: "text",
    required: true,
    showIf: [{ questionId: "branchingModel", in: ["other"] }],
    maxChars: ANSWER_MAX_CHARS.branchingModelOther,
    placeholder: "Everything goes to `main` behind a flag; release branches are cut per customer."
  }
];

/**
 * The set for a project that already exists, derived from the greenfield one rather than written
 * twice (spec 199).
 *
 * Derived, so a question added to `interviewQuestions` reaches both phrasings and cannot be
 * forgotten here. What differs is stated as overrides: the delivery questions in front, and the
 * design question's option list gaining the answer that only makes sense when there is already an
 * interface to keep.
 */
export const importedQuestions: Question[] = [
  ...deliveryQuestions,
  ...interviewQuestions.map((q) =>
    q.id === "uiDirection"
      ? {
          ...q,
          title: "How should it look and feel?",
          help: "Your project already has a look. Keep it and the foundation describes what is there; pick another and it describes that instead. Nothing is installed either way.",
          options: [KEEP_EXISTING_UI_OPTION, ...(q.options ?? [])]
        }
      : { ...q, ...IMPORT_WORDING[q.id] }
  ),
  existingDocsQuestion,
  ...branchingQuestions
];

/** The question set for a project of this origin. One place decides, so nothing has to guess. */
export function questionsFor(origin: ProjectOrigin): Question[] {
  return origin.kind === "imported" ? importedQuestions : interviewQuestions;
}

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
export function withSuggestions(
  answers: InterviewAnswers,
  questions: Question[] = interviewQuestions
): InterviewAnswers {
  const next: InterviewAnswers = { ...answers };
  for (const q of questions) {
    if (q.type !== "text") continue;
    const current = next[q.id];
    if (typeof current === "string" && current.trim() !== "") continue;
    const suggested = suggestedValue(q, next);
    if (suggested !== null) (next as Record<string, unknown>)[q.id] = suggested;
  }
  return next;
}

/**
 * Questions visible for the given answers, in order.
 *
 * The set defaults to the greenfield one, so every caller that predates the imported phrasing keeps
 * exactly the behaviour it had and only the import path passes something else (spec 199).
 */
export function visibleQuestions(
  answers: InterviewAnswers,
  questions: Question[] = interviewQuestions
): Question[] {
  return questions.filter((q) => isQuestionVisible(q, answers));
}

/** Drop answers belonging to questions that are no longer visible. */
export function pruneHiddenAnswers(
  answers: InterviewAnswers,
  questions: Question[] = interviewQuestions
): InterviewAnswers {
  const pruned: InterviewAnswers = {};
  const visible = new Set<AnswerId>();
  for (const q of questions) {
    if (!isQuestionVisible(q, answers)) continue;
    visible.add(q.id);
    const v = answers[q.id];
    if (v !== undefined) (pruned as Record<string, unknown>)[q.id] = v;
  }
  // An answer set by a question rather than *as* one survives exactly as long as that question does.
  for (const [satellite, owner] of Object.entries(SATELLITE_ANSWERS)) {
    if (owner === undefined || !visible.has(owner)) continue;
    const v = answers[satellite as AnswerId];
    if (v !== undefined) (pruned as Record<string, unknown>)[satellite] = v;
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
export function firstUnanswered(
  answers: InterviewAnswers,
  questions: Question[] = interviewQuestions
): Question | null {
  for (const q of visibleQuestions(answers, questions)) {
    if (!q.required) continue;
    const v = answers[q.id];
    if (v === undefined || (Array.isArray(v) && v.length === 0) || (typeof v === "string" && v.trim() === "")) {
      return q;
    }
  }
  return null;
}

export function isInterviewComplete(
  answers: InterviewAnswers,
  questions: Question[] = interviewQuestions
): boolean {
  return firstUnanswered(answers, questions) === null;
}
