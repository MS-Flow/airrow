// Airrow generation engine. Pure: no I/O, no env, no external dependencies.
// Stages: resolve → author → assemble → validate → manifest (SYSTEM_ARCHITECTURE).

import type {
  AuthoringRecord,
  GeneratedFile,
  GenerationResult,
  Manifest,
  ProjectModel
} from "../../schemas/src/types.ts";
import type {
  AuthoredDocuments,
  AuthoredSlots,
  AuthoredToolchain
} from "../../schemas/src/authoring.ts";
import { ENGINE_VERSION, commandPath, resolveProjectModel, slugify } from "./model.ts";
import type { ResolveInput } from "./model.ts";
import { hasUnresolvedToken, renderScaffold } from "./scaffold.ts";
import type { TemplateFile } from "./scaffold.ts";

export { ENGINE_VERSION, resolveProjectModel, slugify };
export { commandFor, commandName, commandPath, shipsCleanup } from "./model.ts";
export type { ResolveInput };

export { renderScaffold, deriveScaffoldValues, shipsPath } from "./scaffold.ts";
export type { TemplateFile, ScaffoldDecision, ScaffoldPlan, RenderedScaffold } from "./scaffold.ts";

export {
  analyzeImport,
  applyResolutions,
  buildPreviewTree,
  checkImportLimits,
  deliversSidecar,
  diffAgainstExisting,
  digestImported,
  hasCodeSignal,
  isIgnoredImportPath,
  mergeOverlay,
  mergePreviewFiles,
  pathOverlap,
  sidecarPath,
  stripCommonRoot,
  IGNORED_IMPORT_DIRECTORIES,
  IMPORT_LIMITS
} from "./import.ts";
export type {
  ImportLimitCheck,
  PreviewFileEntry,
  PreviewFileSource,
  PreviewTreeNode
} from "./import.ts";

export class GenerationError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[]) {
    super(message);
    this.name = "GenerationError";
    this.issues = issues;
  }
}

/** Stage 4: validate completeness. Throws GenerationError on failure. */
function validate(files: GeneratedFile[], model: ProjectModel): void {
  const issues: string[] = [];
  const seen = new Set<string>();
  const required = [
    "README.md",
    "START_HERE.md",
    "CLAUDE.md",
    "docs/VISION.md",
    "docs/architecture/SYSTEM_OVERVIEW.md",
    "docs/architecture/BRANCHING.md",
    "docs/guides/DEVELOPER_GUIDE.md",
    "specs/README.md",
    ".claude/spec-kit/constitution.md",
    ".claude/spec-kit/spec-template.md",
    // The one first-run command this project's origin calls for — `/start` for a project beginning
    // from nothing, `/cleanup` for one that already has code (spec 91). Without it the foundation is
    // documents describing a command that does not exist (spec 66).
    commandPath(model)
  ];

  for (const f of files) {
    if (seen.has(f.path)) issues.push("duplicate path: " + f.path);
    seen.add(f.path);
    if (f.content.trim().length < 40) issues.push("suspiciously short file: " + f.path);
    if (hasUnresolvedToken(f.content) || f.content.includes("undefined\n"))
      issues.push("unresolved content in: " + f.path);
  }
  for (const r of required) {
    if (!seen.has(r)) issues.push("missing required file: " + r);
  }
  if (issues.length > 0) {
    throw new GenerationError("Generation validation failed (" + issues.length + " issues)", issues);
  }
}

/** Stage 5: manifest with per-file provenance. */
function buildManifest(
  model: ProjectModel,
  files: GeneratedFile[],
  authoring: AuthoringRecord | null
): Manifest {
  return {
    engineVersion: ENGINE_VERSION,
    schemaVersion: model.schemaVersion,
    generatedAt: new Date().toISOString(),
    projectSlug: model.slug,
    fileCount: files.length,
    authoring,
    files: files.map((f) => ({
      path: f.path,
      source: f.source,
      templateId: f.templateId,
      templateVersion: ENGINE_VERSION,
      bytes: new TextEncoder().encode(f.content).length
    }))
  };
}

export interface GenerateOptions {
  /** Called after each file is rendered — powers live progress UI. */
  onFile?: (path: string, index: number, total: number) => void;
  /**
   * LLM-written prose for the slots in `PROSE_SLOTS` (spec 65). Authored by the app *before* calling
   * in — the engine takes strings and stays pure, so `generate` remains synchronous and needs no
   * network, no env and no provider of its own. Omit it and generation is fully deterministic, which
   * is what happens when no API key is configured.
   */
  authored?: AuthoredSlots;
  /**
   * Whole narrative documents, written end to end rather than assembled from fixed scaffolding plus
   * fills (spec 65). Only the paths in `AUTHORED_DOCUMENTS` are eligible; every file carrying a
   * command renders from the template regardless of what is passed here.
   */
  authoredDocuments?: AuthoredDocuments;
  /**
   * The five commands the founder runs, for a stack the founder described themselves and nothing
   * here can derive. Ignored for the golden-path frameworks, whose commands are known. Every value
   * has already passed the command contract in `@airrow/schemas`; the engine takes strings.
   */
  authoredToolchain?: AuthoredToolchain;
  /**
   * Which prompt and model produced `authored`/`authoredDocuments`, recorded in the manifest. The
   * engine never learns these on its own — it makes no calls — so a caller that passes prose must
   * pass its provenance too, or the files it lands in are unattributable.
   */
  authoring?: AuthoringRecord;
}

/**
 * Full pipeline from a resolved model. The caller reads the canonical `template/**` from disk and
 * passes it in — the engine itself stays pure (no I/O, no env).
 */
export function generate(
  template: TemplateFile[],
  model: ProjectModel,
  options: GenerateOptions = {}
): GenerationResult {
  const { files } = renderScaffold(
    template,
    model,
    options.authored,
    options.authoredDocuments,
    options.authoredToolchain
  );
  files.forEach((f, i) => options.onFile?.(f.path, i + 1, files.length));
  validate(files, model);
  // No prose landed, so there is nothing to attribute even if a caller passed provenance in.
  const authored = files.some((f) => f.source === "authored");
  return { files, manifest: buildManifest(model, files, authored ? options.authoring ?? null : null) };
}

export interface GeneratedProject {
  model: ProjectModel;
  result: GenerationResult;
}

/** Convenience: resolve + generate from raw input. */
export function generateFromInput(
  template: TemplateFile[],
  input: ResolveInput,
  options?: GenerateOptions
): GeneratedProject {
  const model = resolveProjectModel(input);
  const result = generate(template, model, options);
  return { model, result };
}
