// The contract between the app's authoring provider and the generation engine (spec 65).
//
// Interview answers are untrusted — the interview can be answered without an account — and they are
// fed to an LLM whose output lands in the founder's files. A prompt instruction is not a security
// boundary: no wording makes a model reliably refuse. So containment is structural, and this file is
// where the structure lives.
//
// Two rules do the work:
//   1. Only the slots named below may ever be authored. Everything else the engine derives —
//      commands, setup steps, deploy steps — stays out of reach *by construction*, because those are
//      procedures a founder will run.
//   2. Every authored value is length-capped here, so what reaches a file is bounded regardless of
//      what the model returned.
//
// `null` is a first-class answer meaning "the interview does not support a value for this". The
// engine falls back to its deterministic value, which already emits `[NEEDS CLARIFICATION: …]`
// rather than inventing one.
import { z } from "zod";

/**
 * The slots an LLM may write — prose a reader judges as writing.
 *
 * Deliberately excluded: `CMD_*`, `SETUP_STEPS`, `CI_SETUP_STEPS`, `DEPLOY_STEPS`, `DEPLOY_TARGET`,
 * `STACK_SUMMARY`, `PROJECT_NAME`, `PROJECT_SLUG`, `REPO_PROVIDER`, `TOKENS`. Those are facts and
 * procedures: they must be *correct*, not well phrased.
 */
export const PROSE_SLOTS = [
  "PROJECT_TAGLINE",
  "PROJECT_DESCRIPTION",
  "DOMAIN_OVERVIEW",
  "VISION",
  "MVP_FOCUS",
  "PROBLEM",
  "NON_GOALS",
  "CAPABILITY_SCOPE",
  "CAPABILITY_SPECS",
  "CORE_ENTITIES",
  "TENANCY_MODEL",
  "AUTH_MODEL",
  "ROLES",
  "INTEGRATIONS",
  "SECURITY_POSTURE",
  "SCALE_POSTURE",
  "STACK_DETAIL",
  "ARCHITECTURE_LAYERS",
  "ARCHITECTURE_INVARIANTS",
  "DATA_INVARIANTS",
  "DESIGN_INVARIANTS",
  "KEY_CONVENTIONS",
  "FIRST_SPEC_HINT"
] as const;

export type ProseSlot = (typeof PROSE_SLOTS)[number];

/** Fast membership test for the engine's merge step. */
const PROSE_SLOT_SET: ReadonlySet<string> = new Set(PROSE_SLOTS);

export function isProseSlot(token: string): token is ProseSlot {
  return PROSE_SLOT_SET.has(token);
}

/**
 * Per-slot ceilings, sized to what the slot is for — a tagline is not a paragraph. These bound both
 * the cost of a generation and the blast radius of an answer that talked the model into rambling.
 */
export const SLOT_MAX_CHARS: Record<ProseSlot, number> = {
  PROJECT_TAGLINE: 120,
  PROJECT_DESCRIPTION: 600,
  DOMAIN_OVERVIEW: 800,
  VISION: 600,
  MVP_FOCUS: 400,
  PROBLEM: 800,
  NON_GOALS: 800,
  CAPABILITY_SCOPE: 1200,
  CAPABILITY_SPECS: 1600,
  CORE_ENTITIES: 1200,
  TENANCY_MODEL: 800,
  AUTH_MODEL: 600,
  ROLES: 600,
  INTEGRATIONS: 600,
  SECURITY_POSTURE: 1000,
  SCALE_POSTURE: 800,
  STACK_DETAIL: 600,
  ARCHITECTURE_LAYERS: 1600,
  ARCHITECTURE_INVARIANTS: 1600,
  DATA_INVARIANTS: 1600,
  DESIGN_INVARIANTS: 1200,
  KEY_CONVENTIONS: 1600,
  FIRST_SPEC_HINT: 800
};

/** Total characters an authoring response may contribute, used to size `max_tokens`. */
export const AUTHORED_TOTAL_MAX_CHARS = Object.values(SLOT_MAX_CHARS).reduce((a, b) => a + b, 0);

/**
 * A template token that survived rendering means the model echoed the prompt scaffolding back —
 * never legitimate content.
 */
const UNRESOLVED_TOKEN_RE = /\{\{[A-Z_]+\}\}/;

const slotSchema = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((s) => !UNRESOLVED_TOKEN_RE.test(s), {
      message: "authored value contains an unrendered template token"
    })
    .nullable();

/**
 * Every slot is optional and nullable: a partial response is valid and simply leaves the rest
 * deterministic. Unknown keys are stripped rather than rejected — a model inventing an extra field
 * should not fail a generation that is otherwise fine, and the engine's allowlist ignores it anyway.
 */
type SlotSchema = z.ZodOptional<ReturnType<typeof slotSchema>>;

export const authoredSlotsSchema = z.object(
  // `Object.fromEntries` widens the keys to `string`; the cast restores what the mapped construction
  // above already guarantees — one entry per PROSE_SLOTS member, built by the same expression.
  Object.fromEntries(
    PROSE_SLOTS.map((slot) => [slot, slotSchema(SLOT_MAX_CHARS[slot]).optional()])
  ) as Record<ProseSlot, SlotSchema>
);

export type AuthoredSlots = Partial<Record<ProseSlot, string | null>>;

/* ── Whole documents ──────────────────────────────────────────────────────────
 *
 * Filling tokens inside fixed scaffolding still produces a filled-in template: the headings and
 * transitions are identical in every project. The files below are narrative — they exist to explain
 * the product — so the model writes them end to end instead, and the prose reads as one piece.
 *
 * Membership is decided by one rule, not by taste: **a file containing a fact token is never
 * authored whole.** `README.md`, `CLAUDE.md` and `DEVELOPER_GUIDE.md` carry `{{CMD_*}}` — commands
 * the founder runs — so they stay token-filled and their prose slots are authored individually.
 * The workflow files (`.claude/**`, `.github/workflows/**`, `BRANCHING.md`, `specs/README.md`) are
 * never touched at all: they *are* the spec-driven process, and a process that varies per project
 * cannot be reviewed or relied on.
 */
export const AUTHORED_DOCUMENTS = [
  "docs/VISION.md",
  "docs/architecture/SYSTEM_OVERVIEW.md",
  "docs/README.md"
] as const;

export type AuthoredDocumentPath = (typeof AUTHORED_DOCUMENTS)[number];

const AUTHORED_DOCUMENT_SET: ReadonlySet<string> = new Set(AUTHORED_DOCUMENTS);

export function isAuthoredDocument(path: string): path is AuthoredDocumentPath {
  return AUTHORED_DOCUMENT_SET.has(path);
}

/**
 * Sized against what the model actually writes, not a guess: a measured run produced a 4,908
 * character system overview. A ceiling below that means the most important architecture document
 * silently falls back to its template on every generation.
 */
export const DOCUMENT_MAX_CHARS: Record<AuthoredDocumentPath, number> = {
  "docs/VISION.md": 3000,
  "docs/architecture/SYSTEM_OVERVIEW.md": 6000,
  "docs/README.md": 2500
};

/**
 * These three documents are prose. None of them contains a command today, and none of them should:
 * a fenced block or a shell prompt in an authored document is the one shape by which an injected
 * answer could put something runnable in front of a founder. Rejecting the shape outright is
 * cheaper and more honest than trying to tell a safe command from an unsafe one.
 */
const CODE_FENCE_RE = /```|~~~|^\s*\$ /m;

const documentSchema = (max: number) =>
  z
    .string()
    .trim()
    .min(80)
    .max(max)
    .refine((s) => !UNRESOLVED_TOKEN_RE.test(s), {
      message: "authored document contains an unrendered template token"
    })
    .refine((s) => !CODE_FENCE_RE.test(s), {
      message: "authored document contains a code block — these documents are prose"
    })
    .nullable();

type DocumentSchema = z.ZodOptional<ReturnType<typeof documentSchema>>;

export const authoredDocumentsSchema = z.object(
  // Same widening as above: `Object.fromEntries` loses the key union the mapped build guarantees.
  Object.fromEntries(
    AUTHORED_DOCUMENTS.map((path) => [path, documentSchema(DOCUMENT_MAX_CHARS[path]).optional()])
  ) as Record<AuthoredDocumentPath, DocumentSchema>
);

/** Total characters the documents may contribute. Counted into `max_tokens` alongside the slots. */
export const DOCUMENT_TOTAL_MAX_CHARS = Object.values(DOCUMENT_MAX_CHARS).reduce((a, b) => a + b, 0);

export type AuthoredDocuments = Partial<Record<AuthoredDocumentPath, string | null>>;

/* ── Accepting a response ─────────────────────────────────────────────────────
 *
 * Two kinds of failure, deliberately handled differently.
 *
 * A **contract violation** — a value over its ceiling, carrying a template token, or containing a
 * code block — is the model being verbose or careless about one field. Dropping that field is
 * enough: it falls back to the deterministic value, which is exactly what `null` already means.
 * Rejecting the whole response would throw away twenty good fields because one ran long, and in
 * practice that is what happened: a single document 1408 characters over its cap discarded an
 * otherwise correct foundation.
 *
 * A **security signal** — the canary, assistant voice, an off-topic verdict — is different in kind.
 * It says the model was steered, so nothing it wrote is trustworthy and the caller discards the
 * response whole. That check lives with the caller, not here.
 */
function pickValid<T extends Record<string, unknown>>(
  raw: unknown,
  shape: Record<string, { safeParse: (v: unknown) => { success: boolean; data?: unknown } }>
): T {
  // `T` is always a Partial of the allowlist, and every key written below came from `shape` and
  // survived that key's own schema — so the accumulator is a valid `T` by construction. TypeScript
  // can't follow that through the index signature, hence the cast on both exits.
  const out: Record<string, unknown> = {};
  if (typeof raw !== "object" || raw === null) return out as T;

  for (const [key, value] of Object.entries(raw)) {
    const field = shape[key];
    if (!field) continue; // not in the allowlist — ignored, never an error
    const parsed = field.safeParse(value);
    if (parsed.success && typeof parsed.data === "string") out[key] = parsed.data;
  }
  return out as T;
}

/** The slots in `raw` that satisfy the contract. Anything else is left deterministic. */
export function pickValidSlots(raw: unknown): AuthoredSlots {
  return pickValid<AuthoredSlots>(raw, authoredSlotsSchema.shape);
}

/** The documents in `raw` that satisfy the contract. Anything else keeps its template body. */
export function pickValidDocuments(raw: unknown): AuthoredDocuments {
  return pickValid<AuthoredDocuments>(raw, authoredDocumentsSchema.shape);
}

/* ── Toolchain: the one place the model may write something runnable ──────────
 *
 * Airrow's two known frameworks derive their commands: Next.js → pnpm, Vite → npm. A founder on
 * Django, Rails, SvelteKit or Go cannot be served that way — nothing here knows that `manage.py`
 * exists — so when they describe their own stack, these values come from the model instead.
 *
 * That is a deliberate, narrow hole in a wall that is otherwise absolute. Everywhere else the rule
 * is "the model never writes anything the founder runs", because interview answers are
 * attacker-controlled and a command in START_HERE.md is a command someone pastes into a shell. The
 * hole is made survivable by shape, not by trust:
 *
 *   - The character allowlist below admits no shell metacharacter at all. No `|`, `;`, `&`, `$`,
 *     backtick, `>`, `<`, newline, quote or backslash survives, so chaining, substitution and
 *     redirection are impossible to express — not discouraged, unrepresentable.
 *   - The first word must be a bare program name, and a handful of fetch-and-execute tools are
 *     refused outright even though the allowlist already prevents piping them anywhere.
 *   - Length is capped hard. A real dev command is short; anything long is doing something else.
 *
 * A rejected command falls back to the deterministic value, exactly like a rejected prose slot.
 */
export const TOOLCHAIN_SLOTS = ["CMD_DEV", "CMD_BUILD", "CMD_TYPECHECK", "CMD_LINT", "CMD_TEST"] as const;

export type ToolchainSlot = (typeof TOOLCHAIN_SLOTS)[number];

const TOOLCHAIN_SLOT_SET: ReadonlySet<string> = new Set(TOOLCHAIN_SLOTS);

export function isToolchainSlot(token: string): token is ToolchainSlot {
  return TOOLCHAIN_SLOT_SET.has(token);
}

/** Long enough for `./gradlew :app:testDebugUnitTest`, far too short to hide a payload. */
export const COMMAND_MAX_CHARS = 60;

/**
 * Letters, digits, and the punctuation real commands need: `. _ - / : = @ + space`. Everything a
 * shell would act on is absent by construction.
 */
const COMMAND_SHAPE_RE = /^[A-Za-z0-9][A-Za-z0-9 ._:@/=+-]*$/;

/**
 * Refused as the program being run. The allowlist already makes `curl … | bash` unrepresentable, so
 * this is the second lock on the same door: a founder should never find a command in their own
 * documentation that fetches and runs code from the internet.
 */
const FORBIDDEN_PROGRAMS = new Set([
  "curl", "wget", "bash", "sh", "zsh", "fish", "eval", "exec", "source", "ssh", "scp", "nc",
  "telnet", "chmod", "chown", "sudo", "su", "rm", "mv", "dd", "mkfs", "shutdown", "reboot"
]);

const commandSchema = z
  .string()
  .trim()
  .min(2)
  .max(COMMAND_MAX_CHARS)
  .refine((s) => COMMAND_SHAPE_RE.test(s), {
    message: "command contains a character no dev command needs and a shell would act on"
  })
  .refine((s) => !FORBIDDEN_PROGRAMS.has(s.split(" ")[0] ?? ""), {
    message: "command runs a fetch-or-execute program"
  })
  .nullable();

export const authoredToolchainSchema = z.object(
  // Same mapped construction as the slots above: one entry per TOOLCHAIN_SLOTS member, so the cast
  // restores the key type that `Object.fromEntries` widens away.
  Object.fromEntries(TOOLCHAIN_SLOTS.map((slot) => [slot, commandSchema.optional()])) as Record<
    ToolchainSlot,
    z.ZodOptional<typeof commandSchema>
  >
);

export type AuthoredToolchain = Partial<Record<ToolchainSlot, string | null>>;

/** The commands in `raw` that satisfy the contract. Anything else stays deterministic. */
export function pickValidToolchain(raw: unknown): AuthoredToolchain {
  return pickValid<AuthoredToolchain>(raw, authoredToolchainSchema.shape);
}
