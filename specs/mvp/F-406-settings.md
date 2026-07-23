# Spec: F-406 — Settings & connections

> Milestone: M4/M6 · Priority: P2 · Owner: CTO

## Problem

Users need identity visibility and the GitHub connection surface (stubbed per ADR-0005).

## User Story

As a user, I want to see my account and connect integrations, so that I control my workspace.

## Business Goal

Establish the surface future billing/team/integrations plug into.

## Functional Requirements

- FR-1: `/app/settings`: profile (name editable, email shown), organization name, sign out.
- FR-2: Connections section: GitHub card with status "Not connected" + setup explanation (GitHub App required; env vars listed); connect button disabled with tooltip until credentials configured.
- FR-3: Local-mode notice: where data lives (`.data/`), how Supabase mode activates (.env keys).

## Non-Functional Requirements

- NFR-1: Single page, no tabs at this scale.

## Acceptance Criteria

- [ ] AC-1: Name edit persists and reflects in sidebar immediately.
- [ ] AC-2: GitHub card communicates exactly what's needed to enable push (no dead button mystery).

## Architecture Notes

`settings` feature module; update via server action; connection status read from env presence (server).

## UX Notes

Quiet page; cards per section; danger zone absent until account deletion ships (logged debt).

## Dependencies

F-202.

## Risks / Edge Cases

None significant. Empty name rejected.

## Security

Session-scoped mutations; email immutable in local mode.

## Testing

Manual.

## Definition of Done

- [ ] AC pass · context updated · Reviewed against spec

## Implementation Notes

—

## Review Notes

—

## Completion Status

Status: In Review — implementation complete; AC verification pending first local run
