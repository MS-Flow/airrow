# Spec: F-101 — Generation Engine v1 (consolidates F-101…F-106)

> Milestone: M1 · Epic: E1.1–E1.6 · Priority: P1 · Owner: CTO

## Problem

Airrow's core capability — turning interview answers into a complete repository foundation — does not exist.

## Business Goal

The engine is the product's core asset (Vision). Everything else is UI around it.

## User Story

As a founder, I want my interview answers turned into a complete, personalized engineering foundation, so that I can start AI-assisted development immediately.

## Functional Requirements

- FR-1: `resolveProjectModel(input)` converts wizard + interview answers into a validated, immutable `ProjectModel` with derived flags (multiTenant, hasPayments, hasAi, …).
- FR-2: `generate(model)` returns `{ files: GeneratedFile[], manifest: Manifest }` — a complete repo tree per the generated-repository IA (INFORMATION_ARCHITECTURE §2).
- FR-3: Output includes at minimum: README, START_HERE, CLAUDE.md, 5 context files, vision/roadmap/getting-started docs, architecture + tech-stack + database docs, 5 standards docs, specs/README + one generated spec per selected feature, ADR-0001 (stack), spec/ADR templates, prompt library, feature checklist.
- FR-4: Every document is personalized from the model (name, product type, audience, features, stack, team, security level, MVP focus). No unresolved placeholders.
- FR-5: Authoring goes through an `AuthoringProvider` interface; v1 ships `localAuthoringProvider` (deterministic). Claude provider slots in later (ADR-0002, ADR-0005).
- FR-6: Manifest records per file: path, source, templateId, templateVersion, bytes. Engine version + model hash recorded.
- FR-7: Engine is pure: no I/O, no env access, no external dependencies; type-only imports from `@airrow/schemas`.

## Non-Functional Requirements

- NFR-1: Full generation < 1s for any model (deterministic path).
- NFR-2: Runs under `node --experimental-strip-types` (no TS runtime-only features).

## Acceptance Criteria

- [ ] AC-1: Given a SaaS/B2B model with orgs+payments+ai, generate() returns ≥ 25 files, all non-empty, zero `{{` placeholder residue.
- [ ] AC-2: Feature specs are generated exactly for selected features.
- [ ] AC-3: Different models produce meaningfully different documents (product-type-specific architecture and roadmap content).
- [ ] AC-4: Smoke script runs the engine on 3 fixture models and validates completeness.

## Architecture Notes

`packages/engine`: `model.ts` (resolution + derivation), `types.ts`, `blueprint.ts` (file list), `documents/*.ts` (per-document authors), `manifest.ts`, `index.ts` (generate). See SYSTEM_ARCHITECTURE stages resolve→author→assemble→validate→manifest.

## UX Notes

N/A — headless. Output tone: senior-CTO, specific, no filler.

## Dependencies

`packages/schemas` (types). ADR-0002, ADR-0005.

## Risks

Generic-feeling output (Constitution §2 violation) → mitigation: every doc interpolates ≥ 5 model-specific facts; product-type branches in architecture/roadmap.

## Edge Cases

Empty feature selection (still valid foundation); long names (slug truncation); internal_tool (audience skipped → internal); api/mobile product types (framework defaults).

## Security

No secrets in output; no code execution; output is plain markdown/config text. Model input validated by schemas at the app boundary before reaching engine.

## Testing

`scripts/engine-smoke.mjs` runs fixtures (saas-b2b, marketplace-b2c, internal-tool) asserting file count, non-empty content, no placeholders, feature-spec mapping. Runs in CI later via vitest port.

## Definition of Done

- [ ] All AC pass via smoke script
- [ ] Docs updated (context/PROGRESS)
- [ ] Reviewed against this spec

## Implementation Notes

Local authoring provider implements document contracts directly; contract validation formalizes when Claude provider lands.

## Review Notes

—

## Completion Status

Status: In Review — implementation complete; AC verification pending first local run
