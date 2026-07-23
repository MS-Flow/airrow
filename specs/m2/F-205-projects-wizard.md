# Spec: F-205 — Dashboard, project CRUD & create wizard

> Milestone: M2 · Epic: E2.4/E2.5 · Priority: P1 · Owner: CTO

## Problem

Users need a home for their projects and a guided way to start one.

## Business Goal

The dashboard is the daily surface; the wizard is the top of the core funnel.

## User Story

As a founder, I want to create a project and be guided straight into the interview, so that I reach a generated foundation without thinking about navigation.

## Functional Requirements

- FR-1: App shell: left sidebar (Dashboard, Settings, sign out; product mark) + content area.
- FR-2: Dashboard lists org projects (name, status badge, updated) + primary "New project" action + empty state that teaches the flow.
- FR-3: Wizard (`/app/projects/new`): step asks name + one-paragraph description; creates project (status `interviewing`) with unique slug; redirects to interview.
- FR-4: Project overview page (`/app/projects/[id]`): status-aware — resume interview / view generation / open preview / download; delete project (confirmation).
- FR-5: Status chain enforced: draft→interviewing→generating→ready (DATABASE_DESIGN).

## Non-Functional Requirements

- NFR-1: Dashboard cold render < 200ms locally.

## Acceptance Criteria

- [ ] AC-1: New user sees empty state; creating a project lands in interview; dashboard then shows it with correct status.
- [ ] AC-2: Overview's primary action always matches status (one clear next step).
- [ ] AC-3: Delete removes project + interview + jobs + artifacts.

## Architecture Notes

Server Components + Server Actions; `projects` feature module (queries.ts/actions.ts). Slug: kebab name + suffix on collision.

## UX Notes

Wizard, not form-dashboard: single centered card, one field pair, one button. Status badges: quiet colors.

## Dependencies

F-201, F-202.

## Risks

Scope creep into PM tool → overview stays a router to the flow, nothing more (Constitution §1).

## Edge Cases

Duplicate names (slug suffix); mid-interview return (resume); generating-state revisit (progress page); empty description (required, validated).

## Security

All queries org-scoped via session; Zod on action inputs; delete requires ownership.

## Testing

Manual now; RLS-equivalent scoping asserted in store tests when vitest lands (debt logged).

## Definition of Done

- [ ] AC pass · context updated · Reviewed against spec

## Implementation Notes

—

## Review Notes

—

## Completion Status

Status: In Review — implementation complete; AC verification pending first local run
