// Zod validation at the app boundary (Constraint 7). Types + question data re-exported.

import { z } from "zod";
import {
  ANSWER_MAX_CHARS,
  MAX_UI_REFERENCE_IMAGE_BYTES,
  MAX_UI_REFERENCE_LINKS,
  UI_REFERENCE_MEDIA_TYPES,
  interviewQuestions,
  splitReferenceLinks
} from "./questions.ts";
import { KEEP_EXISTING_UI, UI_KITS } from "./ui-kits.ts";

export * from "./types.ts";
export * from "./questions.ts";
export * from "./authoring.ts";
export * from "./ui-kits.ts";

const TEXT_MAX = 2000;

export const productTypeSchema = z.enum([
  "saas",
  "marketplace",
  "ai_agent",
  "mobile_app",
  "api",
  "internal_tool",
  "browser_extension",
  "hobby",
  "other"
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
  "audit_logs",
  "other"
]);

/** Caps live with the questions (`ANSWER_MAX_CHARS`) so the textarea and this schema can't drift. */
const textAnswer = (max: number) => z.string().trim().min(1).max(max);

/**
 * Products the founder pointed at, as one string of whitespace-separated entries.
 *
 * Capped in count as well as length because the count is what reaches the model, and validated for
 * shape because a "link" holding a paragraph is not a link. Deliberately permissive about the form —
 * `linear.app` and `https://linear.app/method` are both what someone types — since nothing resolves
 * these (spec 159): they are read as names, so the only real requirement is that each one *is* a name
 * rather than a sentence.
 */
const referenceLinksAnswer = z
  .string()
  .trim()
  .max(ANSWER_MAX_CHARS.uiReferenceLinks)
  .refine((s) => splitReferenceLinks(s).length <= MAX_UI_REFERENCE_LINKS, {
    message: `at most ${MAX_UI_REFERENCE_LINKS} links`
  })
  .refine((s) => splitReferenceLinks(s).every((link) => /^[\w.:/-]+\.[a-z]{2,}(\/\S*)?$/i.test(link)), {
    message: "each entry must look like a site address"
  });

/**
 * One uploaded reference image, validated where the bytes arrive (spec 159).
 *
 * The media type is checked against the allowlist rather than trusted from the browser, and the size
 * against the same ceiling the bucket enforces — belt and braces, because this is the one place in
 * Airrow where a founder hands us a binary.
 */
export const uiReferenceUploadSchema = z.object({
  mediaType: z.enum(UI_REFERENCE_MEDIA_TYPES),
  bytes: z.number().int().positive().max(MAX_UI_REFERENCE_IMAGE_BYTES)
});

/**
 * The ceiling on a hidden delivery's folder name, shared by the strict rule below and the answer the
 * interview collects before it (spec 199) — one number, so the field cannot accept a name the store
 * would reject on length.
 */
export const HIDDEN_FOLDER_MAX_CHARS = 48;

export const interviewAnswersSchema = z
  .object({
    productType: productTypeSchema,
    productTypeOther: textAnswer(ANSWER_MAX_CHARS.productTypeOther),
    problem: textAnswer(ANSWER_MAX_CHARS.problem),
    vision: textAnswer(ANSWER_MAX_CHARS.vision),
    mvpFocus: textAnswer(ANSWER_MAX_CHARS.mvpFocus),
    audience: z.enum(["b2b", "b2c", "both", "internal"]),
    coreEntities: textAnswer(ANSWER_MAX_CHARS.coreEntities),
    uiDirection: textAnswer(ANSWER_MAX_CHARS.uiDirection),
    // Closed to the directions we ship, because it names a theme `/start` installs — an id nothing
    // here recognises would be an install target chosen by whoever sent the request (spec 165).
    //
    // **Unknown ids are dropped, not rejected.** This is a *stored* answer, and a curated direction
    // can be renamed or retired between the day it was picked and the day the project generates —
    // `stark_technical` was, during this spec. Failing the enum then failed the whole answer set,
    // and a founder's saved project could no longer generate at all because of a theme they had
    // long since stopped being offered. Dropping it costs them the pick and nothing else. The
    // closed list still does its job: nothing outside it ever reaches `uiKitFor`.
    // `KEEP_EXISTING_UI` joins the kit ids rather than sitting outside them: it is an answer to the
    // same question, and an imported project that keeps its own look must survive this boundary the
    // same way a picked direction does (spec 199).
    uiKit: z.preprocess(
      (value) =>
        value === KEEP_EXISTING_UI || UI_KITS.some((k) => k.id === value) ? value : undefined,
      z.enum([KEEP_EXISTING_UI, ...UI_KITS.map((k) => k.id)] as [string, ...string[]]).optional()
    ),
    uiReferenceLinks: referenceLinksAnswer,
    nonGoals: textAnswer(ANSWER_MAX_CHARS.nonGoals),
    tenancy: z.enum(["single_user", "organizations", "marketplace", "internal", "other"]),
    tenancyOther: textAnswer(ANSWER_MAX_CHARS.tenancyOther),
    authModel: z.array(z.enum(["email_password", "magic_link", "social", "sso", "public"])).min(1).max(5),
    roles: z.enum(["simple", "granular"]),
    capabilities: z.array(featureIdSchema).min(0).max(14),
    capabilitiesOther: textAnswer(ANSWER_MAX_CHARS.capabilitiesOther),
    aiUsage: z.enum(["llm_calls", "rag", "agents", "ml_models", "none"]),
    integrations: textAnswer(ANSWER_MAX_CHARS.integrations),
    dataSensitivity: z.enum(["standard", "pii", "regulated"]),
    scale: z.enum(["validate", "growth", "high_scale"]),
    framework: z.enum(["nextjs", "vite", "custom"]),
    frameworkOther: textAnswer(ANSWER_MAX_CHARS.frameworkOther),
    database: z.enum(["supabase", "postgres", "other"]),
    databaseOther: textAnswer(ANSWER_MAX_CHARS.databaseOther),
    hosting: z.enum(["vercel", "azure", "self_host", "other"]),
    hostingOther: textAnswer(ANSWER_MAX_CHARS.hostingOther),
    repoProvider: z.enum(["github", "azure_devops"]),
    team: z.enum(["solo", "small_team", "startup", "agency"]),
    // Asked as questions, never kept as answers (spec 199): the save writes them through to
    // `import_sources.delivery` and strips them here. They are validated all the same, because
    // "stripped later" is not a reason to let an unchecked value through a boundary.
    deliveryLayout: z.enum(["integrated", "hidden"]),
    hiddenFolder: z.string().trim().max(HIDDEN_FOLDER_MAX_CHARS),
    existingDocs: z.enum(["describe", "adopt", "leave"]),
    // Kept for the same reason as `branchingModel` below: nothing else stores it, so stripping it
    // would hand back the command the founder declined on the next regeneration (spec 217).
    restructure: z.enum(["restructure", "documents_only"]),
    // Kept, unlike the two above: nothing else stores it, so stripping it would change
    // `BRANCHING.md` on the next regeneration (spec 212).
    branchingModel: z.enum(["trunk", "integration_branch", "other"]),
    branchingModelOther: textAnswer(ANSWER_MAX_CHARS.branchingModelOther)
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
/**
 * The name of the folder a hidden delivery nests itself under (spec 187).
 *
 * It is concatenated into every delivered path, so it is validated as exactly one path segment and
 * nothing else: no separator that would let it address a second directory, no `..` that would climb
 * out of the tree, no leading dot that would hide the folder from the founder who has to work in it,
 * and nothing but the characters a slug is made of. Same rule the imported archive's own paths are
 * held to (spec 63) — a name the founder typed is untrusted input like any other.
 */
export const hiddenFolderSchema = z
  .string()
  .min(1)
  .max(HIDDEN_FOLDER_MAX_CHARS)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Use lowercase letters, numbers and dashes.");

/** Integrated, or hidden under a folder the founder named (spec 187). */
export const deliveryLayoutSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("integrated") }),
  z.object({ kind: z.literal("hidden"), folder: hiddenFolderSchema })
]);

export const projectOriginSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("new") }),
  z.object({
    kind: z.literal("imported"),
    stackDetected: z.boolean(),
    // Imports predating spec 187 carry no layout, and every one of them was delivered integrated —
    // so the default is what actually happened to them, not a guess.
    delivery: deliveryLayoutSchema.default({ kind: "integrated" })
  })
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
export const newPasswordSchema = z
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

/**
 * Asking for a reset link (spec 171). An address and nothing else — deliberately not `loginSchema`,
 * which would demand a password from someone whose whole problem is not having one.
 */
export const passwordResetRequestSchema = loginSchema.pick({ email: true });

/**
 * Choosing a new password, from Settings or from a reset link.
 *
 * The **current** password is not part of it: whether it is required at all depends on how the founder
 * arrived, and that is a server-side decision (`features/auth/credentials.ts`) rather than a field on a
 * form. A schema that listed it would invite the reading that a present field is what authorises the
 * change.
 */
export const passwordChangeSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string().max(200)
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "The two passwords do not match.",
    path: ["confirmPassword"]
  });

/**
 * Changing the login address. The current password *is* here, because this one is only ever reached with
 * a session — an unattended one that could move the address to somebody else's inbox owns the account.
 */
export const emailChangeSchema = loginSchema.pick({ email: true }).extend({
  // No `newPasswordSchema` rule: this is an existing credential being proved, not a new one being chosen.
  currentPassword: z.string().min(1).max(200)
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
