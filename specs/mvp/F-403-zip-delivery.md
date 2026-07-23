# Spec: F-403 — ZIP delivery

> Milestone: M4 · Epic: E4.3 · Priority: P1 · Owner: CTO

## Problem

The foundation must reach the founder's machine; ZIP is the universal, integration-free path (Constraint 15).

## Business Goal

Complete the core funnel: interview → generation → in hand.

## User Story

As a founder, I want to download my foundation as a ZIP, so that I can start working immediately regardless of integrations.

## Functional Requirements

- FR-1: `GET /api/projects/[id]/zip` streams a ZIP of the latest ready artifact, root folder = project slug.
- FR-2: Correct headers (`Content-Disposition: attachment; filename="<slug>-foundation.zip"`).
- FR-3: Delivery recorded (method `zip`) per DATABASE_DESIGN.
- FR-4: 404 for missing/foreign project; 409 if no ready artifact.

## Non-Functional Requirements

- NFR-1: < 2s for typical artifact (~30 files).

## Acceptance Criteria

- [ ] AC-1: Downloaded ZIP extracts to `<slug>/` with every artifact file, byte-identical to preview content.
- [ ] AC-2: Unauthenticated or foreign-project request → 404/redirect, never data.

## Architecture Notes

Route handler (node runtime) + `jszip`; reads artifact via DataStore; org-scoped session check first.

## UX Notes

Primary button on preview + overview; browser-native download, no modal.

## Dependencies

F-401.

## Risks

None significant.

## Edge Cases

Regenerated project (always latest ready artifact); concurrent downloads (stateless, fine).

## Security

Session + org scoping before read; no client-supplied paths; ZIP built only from manifest entries.

## Testing

Manual download + extract verification; delivery row asserted.

## Definition of Done

- [ ] AC pass · context updated · Reviewed against spec

## Implementation Notes

—

## Review Notes

—

## Completion Status

Status: In Review — implementation complete; AC verification pending first local run
