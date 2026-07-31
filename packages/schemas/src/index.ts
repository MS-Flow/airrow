// Zod validation at the app boundary (Constraint 7). Types + question data re-exported.

import { z } from "zod";
import { ANSWER_MAX_CHARS, interviewQuestions } from "./questions.ts";

export * from "./types.ts";
export * from "./questions.ts";
export * from "./authoring.ts";

const TEXT_MAX = 2000;

export const productTypeSchema = z.enum([
  "saas",
  "marketplace",
  "ai_agent",
  "mobile_app",
  "api",
  "internal_tool",
  "browser_extension",
  "hobby"
]);

export const featureIdSchema = z.enum([
  "auth",
  "organizations",
  "roles",
  "payments",
  "notifications",
  "search",
  "storage",
  "ai",
  "analytics",
  "realtime",
  "email",
  "admin",
  "audit_logs"
]);

/** Caps live with the questions (`ANSWER_MAX_CHARS`) so the textarea and this schema can't drift. */
const textAnswer = (max: number) => z.string().trim().min(1).max(max);

export const interviewAnswersSchema = z
  .object({
    productType: productTypeSchema,
    problem: textAnswer(ANSWER_MAX_CHARS.problem),
    vision: textAnswer(ANSWER_MAX_CHARS.vision),
    mvpFocus: textAnswer(ANSWER_MAX_CHARS.mvpFocus),
    audience: z.enum(["b2b", "b2c", "both", "internal"]),
    coreEntities: textAnswer(ANSWER_MAX_CHARS.coreEntities),
    uiDirection: textAnswer(ANSWER_MAX_CHARS.uiDirection),
    nonGoals: textAnswer(ANSWER_MAX_CHARS.nonGoals),
    tenancy: z.enum(["single_user", "organizations", "marketplace", "internal"]),
    authModel: z.array(z.enum(["email_password", "magic_link", "social", "sso", "public"])).min(1).max(5),
    roles: z.enum(["simple", "granular"]),
    capabilities: z.array(featureIdSchema).min(0).max(13),
    aiUsage: z.enum(["llm_calls", "rag", "agents", "ml_models", "none"]),
    integrations: textAnswer(ANSWER_MAX_CHARS.integrations),
    dataSensitivity: z.enum(["standard", "pii", "regulated"]),
    scale: z.enum(["validate", "growth", "high_scale"]),
    framework: z.enum(["nextjs", "vite", "custom"]),
    frameworkOther: textAnswer(ANSWER_MAX_CHARS.frameworkOther),
    database: z.enum(["supabase", "postgres"]),
    hosting: z.enum(["vercel", "azure", "self_host"]),
    repoProvider: z.enum(["github", "azure_devops"]),
    team: z.enum(["solo", "small_team", "startup", "agency"])
  })
  .partial();

/** Partial answers during the interview (persistence). */
export type PartialAnswers = z.infer<typeof interviewAnswersSchema>;

export const projectCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(10).max(TEXT_MAX)
});

/** One file read out of an imported archive — untrusted content, validated at the boundary. */
export const importedFileSchema = z.object({
  path: z.string().min(1).max(400),
  content: z.string()
});

/**
 * Where the project came from (spec 91). Validated rather than cast because it is derived from
 * `import_sources.analysis` — a jsonb column, and rows written before `stackDetected` existed carry
 * no answer at all. A missing field must fail here and be defaulted deliberately by the caller, not
 * arrive in the engine as `undefined` and silently pick a command.
 */
export const projectOriginSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("new") }),
  z.object({ kind: z.literal("imported"), stackDetected: z.boolean() })
]);

export const conflictResolutionSchema = z.enum(["keep_existing", "use_generated"]);

/**
 * Importing an existing project: the basics, same bar as creating one from scratch. `source` says
 * where the files came from — an uploaded archive, or a public GitHub repository read with the
 * signed-in founder's scope-less identity (spec 67). Both feed the same analysis.
 */
export const importCreateSchema = projectCreateSchema.extend({
  source: z.enum(["zip", "repo"])
});

/**
 * A repository the founder picked out of the list. Owner and name are GitHub's own character set —
 * validated rather than trusted because they arrive from the browser and end up in a URL path, where
 * a slash or a `..` would address a different endpoint entirely (spec 67).
 */
export const repoSelectionSchema = z.object({
  owner: z.string().min(1).max(39).regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/),
  repo: z.string().min(1).max(100).regex(/^[A-Za-z0-9._-]+$/)
});

export type RepoSelection = z.infer<typeof repoSelectionSchema>;

/**
 * A single conflict decision posted back from the review screen.
 *
 * An empty resolution means "undo this decision" — pressing the active button again returns the path
 * to undecided. It is its own value rather than a second action because the review screen posts one
 * form per button, and an unmade decision is a real state: undecided delivers Airrow's document as a
 * `.airrow` sidecar, which neither explicit answer does (spec 91).
 */
export const conflictDecisionSchema = z.object({
  path: z.string().min(1).max(400),
  resolution: z.union([conflictResolutionSchema, z.literal("")])
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80)
});

/**
 * What a support ticket can be about (spec 144).
 *
 * Four, and deliberately not more. The category exists so a ticket can be read in the right frame of
 * mind, not so it can be routed — one person reads them all — and a longer list only makes a founder
 * in trouble stop to classify their own problem.
 */
export const SUPPORT_CATEGORIES = ["generation", "billing", "account", "other"] as const;

export const supportTicketSchema = z.object({
  category: z.enum(SUPPORT_CATEGORIES),
  subject: z.string().trim().min(3).max(120),
  body: z.string().trim().min(10).max(TEXT_MAX),
  /** The project this is about, when the founder picked one. `""` from an unset <select> means none. */
  projectId: z.union([z.string().uuid(), z.literal("")])
});

export type SupportTicketInput = z.infer<typeof supportTicketSchema>;

/**
 * A founder's verdict on the foundation they were just given (spec 144).
 *
 * The stars are required and the words are not: a rating alone is still worth having, and demanding a
 * paragraph is how you get no answer at all. `consentPublic` is what separates feedback from a
 * testimonial — without it the review is ours to read and nobody else's to see.
 */
export const projectReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().max(1000),
  consentPublic: z.boolean(),
  displayName: z.string().trim().max(80)
});

export type ProjectReviewInput = z.infer<typeof projectReviewSchema>;

export const loginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200)
});

/**
 * What a **new** password must contain — one entry per line of the checklist the signup form shows.
 *
 * Exported as data rather than baked into a regex so the screen and the schema are the same rule read
 * twice: the founder ticks these off as they type, and `signupSchema` refuses on exactly the ones still
 * unticked. Two copies of this list would eventually disagree, and the boundary is the worst place for
 * that (spec 140).
 *
 * Structure only. The strength *score* that also gates the form is browser-side — the estimator it needs
 * is a dictionary, and this package is imported by everything.
 *
 * **No special-character rule.** It was here and was removed deliberately: forcing a symbol is the
 * requirement that most reliably produces `Passw0rd!` — a predictable suffix on a word — while a long
 * passphrase without one is the stronger password. The zxcvbn gate on the signup form judges that
 * properly, so the list keeps the rules a founder can act on and drops the one that teaches a bad habit.
 */
export const PASSWORD_RULES = [
  { id: "length", label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { id: "lowercase", label: "A lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { id: "uppercase", label: "A capital letter", test: (v: string) => /[A-Z]/.test(v) },
  { id: "number", label: "A number", test: (v: string) => /\d/.test(v) }
] as const;

export type PasswordRuleId = (typeof PASSWORD_RULES)[number]["id"];

/** Which rules a candidate password already satisfies — drives the checklist and the schema alike. */
export function unmetPasswordRules(value: string): PasswordRuleId[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.id);
}

/**
 * Deliberately **not** `loginSchema`'s password rule. Accounts created before these requirements existed
 * must keep signing in, so tightening what we accept for a new password must never tighten what we accept
 * for an old one (spec 140).
 */
const newPasswordSchema = z
  .string()
  .max(200)
  .superRefine((value, ctx) => {
    for (const rule of PASSWORD_RULES) {
      if (!rule.test(value)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: rule.label });
    }
  });

export const signupSchema = loginSchema
  .extend({
    name: z.string().trim().min(1).max(80),
    password: newPasswordSchema,
    // No rule of its own: its only job is to equal the password, checked below.
    confirmPassword: z.string().max(200)
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "The two passwords do not match.",
    path: ["confirmPassword"]
  });

/** Validate a COMPLETE answer set: every visible question answered with a valid value. */
export function validateCompleteAnswers(raw: unknown):
  | { ok: true; answers: PartialAnswers }
  | { ok: false; error: string } {
  const parsed = interviewAnswersSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  }
  const answers = parsed.data;
  for (const q of interviewQuestions) {
    // Visibility rules live in questions.ts; re-implemented check via dynamic import
    // is avoided — caller must prune hidden answers first (pruneHiddenAnswers).
    const v = answers[q.id as keyof PartialAnswers];
    const visible = q.showIf
      ? q.showIf.every((c) => {
          const a = answers[c.questionId as keyof PartialAnswers];
          if (a === undefined) return false;
          return Array.isArray(a) ? a.some((x) => c.in.includes(x)) : c.in.includes(String(a));
        })
      : true;
    if (visible && q.required) {
      if (v === undefined || (Array.isArray(v) && v.length === 0) || (typeof v === "string" && v.trim() === "")) {
        return { ok: false, error: `Question "${q.id}" is required and unanswered.` };
      }
    }
  }
  return { ok: true, answers };
}
