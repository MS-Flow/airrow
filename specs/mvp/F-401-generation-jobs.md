# Spec: F-401 — Generation jobs & progress

> Milestone: M4 · Epic: E4.1 · Priority: P1 · Owner: CTO

## Problem

Generation must feel like Arrow working for you — visible, staged, reliable — not a spinner.

## Business Goal

The "watching your foundation being built" moment is the product's emotional peak (UI_ARCHITECTURE).

## User Story

As a founder, I want to watch my foundation being generated document by document, so that I trust and value the output.

## Functional Requirements

- FR-1: Job record: status queued|running|completed|failed, stage, per-stage progress, file counter, error. Created at interview submit.
- FR-2: Runner executes engine stages (resolve → author → assemble → validate → manifest), updating progress as each document authors; artifact (file map + manifest) stored via DataStore.
- FR-3: `/app/projects/[id]/generating` polls job status (1s), renders stage list with live check-offs and a file counter; auto-redirects to preview on completion.
- FR-4: Failure shows the error with a retry action (new job, same model version).
- FR-5: Project status transitions generating → ready on success.

## Non-Functional Requirements

- NFR-1: End-to-end < 10s in local mode (staged pacing included deliberately).

## Acceptance Criteria

- [ ] AC-1: Submitting an interview lands on progress; stages check off in order; redirect to preview on completion.
- [ ] AC-2: Killing the artifact mid-run marks the job failed with visible retry that succeeds.
- [ ] AC-3: Refresh during generation resumes live progress (state from store, not memory).

## Architecture Notes

Local mode: unawaited async runner in a route-handler kickoff writing progress to store (poll-based; Realtime replaces polling in Supabase mode). Artifacts: `.data/artifacts/<jobId>.json` (file map) — Storage replaces later.

## UX Notes

Vertical stage checklist, current stage pulsing subtly, mono-font file paths ticking by; no spinners, no percentage theater.

## Dependencies

F-101, F-301.

## Risks

Dev-server process restarts mid-job → job marked stale on next poll (>60s no heartbeat ⇒ failed, retry offered).

## Edge Cases

Double kickoff (idempotent per model version); job for deleted project (404s gracefully); very fast run (still shows staged sequence).

## Security

Job/artifact access org-scoped through session; artifact paths never taken from client input.

## Testing

Smoke: runner over fixture model asserts stage sequence + artifact completeness. Manual flow verification.

## Definition of Done

- [ ] AC pass · context updated · Reviewed against spec

## Implementation Notes

—

## Review Notes

—

## Completion Status

Status: In Review — implementation complete; AC verification pending first local run
