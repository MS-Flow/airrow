# Spec: F-405 — Continue Locally handoff

> Milestone: M4 · Epic: E4.5 · Priority: P1 · Owner: CTO

## Problem

Airrow's job isn't done at download (Constitution §8) — founders need the bridge into local AI-assisted development.

## Business Goal

Drive the north-star metric: generated projects that become active repositories.

## User Story

As a founder, I want exact next steps after download, so that I go from ZIP to my first AI-implemented feature without guessing.

## Functional Requirements

- FR-1: `/app/projects/[id]/continue`: ordered, personalized checklist — extract ZIP, init git (+ provider-specific remote instructions from repoProvider answer), open in VS Code, install Claude Code, first-session prompt.
- FR-2: Copy-to-clipboard on every command/prompt block.
- FR-3: First prompt references the generated repo's own CLAUDE.md/START_HERE workflow.
- FR-4: Reachable from preview and overview once status is ready.

## Non-Functional Requirements

- NFR-1: Content fits one page; scannable in 30 seconds.

## Acceptance Criteria

- [ ] AC-1: GitHub vs Azure DevOps answers produce different remote instructions.
- [ ] AC-2: Every code block copies correctly.

## Architecture Notes

RSC reading project model; small client CopyButton component.

## UX Notes

Numbered steps, mono blocks, one accent CTA back to download if not yet downloaded.

## Dependencies

F-403.

## Risks

Instructions drift vs generated START_HERE → both derive from the same model facts.

## Edge Cases

Regenerated artifact (page reflects latest); Windows/macOS command variants shown together.

## Security

Static personalized content; no external calls.

## Testing

Manual walkthrough both provider paths.

## Definition of Done

- [ ] AC pass · context updated · Reviewed against spec

## Implementation Notes

—

## Review Notes

—

## Completion Status

Status: In Review — implementation complete; AC verification pending first local run
