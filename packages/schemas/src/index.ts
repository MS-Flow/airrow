// Zod validation at the app boundary (Constraint 7). Types + question data re-exported.

import { z } from "zod";
import { interviewQuestions } from "./questions.ts";

export * from "./types.ts";
export * from "./questions.ts";

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

const textAnswer = z.string().trim().min(1).max(TEXT_MAX);

export const interviewAnswersSchema = z
  .object({
    productType: productTypeSchema,
    vision: textAnswer,
    mvpFocus: textAnswer,
    audience: z.enum(["b2b", "b2c", "both", "internal"]),
    coreEntities: textAnswer,
    tenancy: z.enum(["single_user", "organizations", "marketplace", "internal"]),
    authModel: z.array(z.enum(["email_password", "magic_link", "social", "sso", "public"])).min(1).max(5),
    roles: z.enum(["simple", "granular"]),
    capabilities: z.array(featureIdSchema).min(0).max(13),
    aiUsage: z.enum(["llm_calls", "rag", "agents", "ml_models"]),
    integrations: textAnswer,
    dataSensitivity: z.enum(["standard", "pii", "regulated"]),
    scale: z.enum(["validate", "growth", "high_scale"]),
    framework: z.enum(["nextjs", "vite"]),
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
