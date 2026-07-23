# Spec: F-402 — Repository preview

> Milestone: M4 · Epic: E4.2 · Priority: P1 · Owner: CTO

## Problem

Users must see and trust the generated foundation before taking it.

## Business Goal

The preview screen sells the product on sight (UI_ARCHITECTURE quality bar).

## User Story

As a founder, I want to browse my generated repository like a code host, so that I can verify its quality before downloading.

## Functional Requirements

- FR-1: Two-pane layout: collapsible file tree (folders first, alphabetical) + content pane.
- FR-2: Markdown files render styled (headings, tables, code, lists); non-markdown renders as mono plaintext.
- FR-3: Deep-linkable file selection (`?file=path`); default file README.md.
- FR-4: Header: project name, file count, Download ZIP (primary), Continue locally (secondary).
- FR-5: Tree reflects the artifact manifest exactly — no client-side reconstruction drift.

## Non-Functional Requirements

- NFR-1: File switch < 100ms perceived (content client-side from single artifact fetch).

## Acceptance Criteria

- [ ] AC-1: Every generated file is reachable in the tree and renders non-empty.
- [ ] AC-2: Refresh with ?file= restores selection.
- [ ] AC-3: Markdown tables/code blocks render correctly in dark theme.

## Architecture Notes

RSC loads artifact JSON server-side, passes to client `PreviewBrowser` (tree + `marked` rendering, DOMPurify-sanitized). Single artifact payload (< 1MB) — no per-file fetching in v1.

## UX Notes

Tree in mono 13px, subtle indentation guides; content pane generous line-height; active file accent-tinted.

## Dependencies

F-401.

## Risks

Payload growth with future artifacts → per-file fetch noted for Supabase mode.

## Edge Cases

Artifact missing (regenerate CTA); unknown ?file (falls back to README); deeply nested paths.

## Security

Sanitize rendered HTML (DOMPurify) even though content is engine-generated (Constraint 12); path lookups only against manifest keys.

## Testing

Manual render pass across all generated docs; smoke asserts manifest/tree parity.

## Definition of Done

- [ ] AC pass · context updated · Reviewed against spec

## Implementation Notes

—

## Review Notes

—

## Completion Status

Status: In Review — implementation complete; AC verification pending first local run
