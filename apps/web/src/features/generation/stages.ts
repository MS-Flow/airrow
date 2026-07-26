import type { JobStage } from "@airrow/schemas";

/**
 * The stages the engine actually emits (`runner.ts`), with the labels the UI
 * shows. Adding a stage here without the runner emitting it would be fiction —
 * a richer breakdown is an engine change, not a UI one.
 */
export const JOB_STAGES: Array<{ id: JobStage; label: string; detail: string }> = [
  {
    id: "resolve",
    label: "Resolving project model",
    detail: "Turning your answers into engineering decisions"
  },
  {
    id: "author",
    label: "Authoring documents",
    detail: "Architecture, specs, standards, AI context"
  },
  {
    id: "assemble",
    label: "Assembling repository",
    detail: "Folder structure and cross-references"
  },
  {
    id: "validate",
    label: "Validating completeness",
    detail: "Every required document, no gaps"
  },
  {
    id: "manifest",
    label: "Writing manifest",
    detail: "Per-file provenance for future regeneration"
  }
];

export const JOB_STAGE_COUNT = JOB_STAGES.length;
