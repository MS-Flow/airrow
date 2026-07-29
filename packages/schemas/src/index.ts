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
 * Importing an existing project: the basics, same bar as creating one from scratch. `source` only
 * admits `zip` — the repo path waits on the GitHub App integration (spec 63, deferred).
 */
export const importCreateSchema = projectCreateSchema.extend({
  source: z.literal("zip")
});

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

export const loginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200)
});

export const signupSchema = loginSchema.extend({
  name: z.string().trim().min(1).max(80)
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
