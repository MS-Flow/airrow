// Arrow generation engine. Pure: no I/O, no env, no external dependencies.
// Stages: resolve → author → assemble → validate → manifest (SYSTEM_ARCHITECTURE).

import type {
  GeneratedFile,
  GenerationResult,
  Manifest,
  ProjectModel
} from "../../schemas/src/types.ts";
import { ENGINE_VERSION, resolveProjectModel, slugify } from "./model.ts";
import type { ResolveInput } from "./model.ts";
import { claudeMd, contextFiles, readme, startHere } from "./documents/core.ts";
import {
  architectureDoc,
  databaseDoc,
  gettingStarted,
  roadmap,
  techStack,
  vision
} from "./documents/docs.ts";
import {
  adr0001,
  checklist,
  promptLibrary,
  standards,
  templates,
  workflow
} from "./documents/standards.ts";
import { featureSpecs, specsReadme } from "./documents/specs.ts";

export { ENGINE_VERSION, resolveProjectModel, slugify };
export type { ResolveInput };

/** Ordered list of document authors — the repository blueprint. */
function author(model: ProjectModel): GeneratedFile[] {
  return [
    readme(model),
    startHere(model),
    claudeMd(model),
    ...contextFiles(model),
    vision(model),
    roadmap(model),
    gettingStarted(model),
    architectureDoc(model),
    techStack(model),
    databaseDoc(model),
    ...standards(model),
    workflow(model),
    checklist(),
    ...templates(),
    adr0001(model),
    promptLibrary(model),
    specsReadme(model),
    ...featureSpecs(model),
    {
      path: "adr/README.md",
      templateId: "adr/readme",
      source: "static",
      content:
        "# Architecture Decision Records\n\nAppend-only. New ADRs from `templates/ADR_TEMPLATE.md`, numbered sequentially. A decision is significant if reversing it later costs more than a day.\n\n| # | Decision | Status |\n|---|----------|--------|\n| 0001 | Technology stack | Accepted |\n"
    }
  ];
}

export class GenerationError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[]) {
    super(message);
    this.name = "GenerationError";
    this.issues = issues;
  }
}

/** Stage 4: validate completeness. Throws GenerationError on failure. */
function validate(files: GeneratedFile[]): void {
  const issues: string[] = [];
  const seen = new Set<string>();
  const required = [
    "README.md",
    "START_HERE.md",
    "CLAUDE.md",
    "context/PROJECT.md",
    "context/PROGRESS.md",
    "context/CONSTRAINTS.md",
    "docs/VISION.md",
    "docs/ROADMAP.md",
    "specs/README.md",
    "prompts/PROMPT_LIBRARY.md",
    "templates/SPEC_TEMPLATE.md"
  ];

  for (const f of files) {
    if (seen.has(f.path)) issues.push("duplicate path: " + f.path);
    seen.add(f.path);
    if (f.content.trim().length < 40) issues.push("suspiciously short file: " + f.path);
    if (f.content.includes("{{") || f.content.includes("undefined\n"))
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
function buildManifest(model: ProjectModel, files: GeneratedFile[]): Manifest {
  return {
    engineVersion: ENGINE_VERSION,
    schemaVersion: model.schemaVersion,
    generatedAt: new Date().toISOString(),
    projectSlug: model.slug,
    fileCount: files.length,
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
  /** Called after each document is authored — powers live progress UI. */
  onFile?: (path: string, index: number, total: number) => void;
}

/** Full pipeline from a resolved model. */
export function generate(model: ProjectModel, options: GenerateOptions = {}): GenerationResult {
  const files = author(model);
  files.forEach((f, i) => options.onFile?.(f.path, i + 1, files.length));
  files.sort((a, b) => a.path.localeCompare(b.path));
  validate(files);
  return { files, manifest: buildManifest(model, files) };
}

export interface GeneratedProject {
  model: ProjectModel;
  result: GenerationResult;
}

/** Convenience: resolve + generate from raw input. */
export function generateFromInput(input: ResolveInput, options?: GenerateOptions): GeneratedProject {
  const model = resolveProjectModel(input);
  const result = generate(model, options);
  return { model, result };
}
