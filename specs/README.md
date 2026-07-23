# Specification System

Specifications are the source of truth. Code implements specs; docs explain specs; reviews review against specs.

## Rules

1. No feature is implemented before its spec exists and is complete.
2. One spec per feature, at `specs/<milestone>/F-<id>-<slug>.md`, from `templates/SPEC_TEMPLATE.md`.
3. If reality diverges during implementation, **update the spec first**, then the code. Divergence notes go in Implementation Notes.
4. A spec is done when its Completion Status is ✅ and Definition of Done is fully checked.
5. Specs are never deleted; superseded specs are marked and linked to their successor.

## Lifecycle

`Draft → Ready → In Progress → In Review → Done` — tracked in the spec's Completion Status section and mirrored in `roadmap/BACKLOG.md` and `context/PROGRESS.md`.

## Required sections

Problem · Business Goal · User Story · Functional Requirements · Non-Functional Requirements · Acceptance Criteria · Architecture Notes · UX Notes · Dependencies · Risks · Edge Cases · Security · Testing · Definition of Done · Implementation Notes · Review Notes · Completion Status.

Every section must be filled or explicitly marked "N/A — <reason>". An empty section is an incomplete spec.
