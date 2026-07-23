# Spec: F-201 — App scaffold & design system

> Milestone: M2 · Epic: E2.1 · Priority: P1 · Owner: CTO

## Problem

No application exists. Every screen needs a consistent premium foundation.

## Business Goal

Design quality is a stated product bar (Constitution §7): Linear/Vercel/Stripe class, dark-first.

## User Story

As a user, I want a fast, elegant, coherent interface, so that Airrow feels like a premium developer tool.

## Functional Requirements

- FR-1: pnpm monorepo: `apps/web` (Next.js App Router, TS strict), `packages/engine`, `packages/schemas`.
- FR-2: Tailwind v4 with semantic design tokens (CSS variables): bg, bg-subtle, surface, border, fg, fg-muted, accent, danger. Dark is the default theme.
- FR-3: Reusable UI kit (shadcn-style, hand-rolled): Button, Card, Input, Textarea, Label, Badge, Progress, Separator — consistent radii/spacing/type scale.
- FR-4: Typography: Inter (UI) + JetBrains Mono (code) via next/font.
- FR-5: Root layout with metadata, favicon (airrow mark), global styles.

## Non-Functional Requirements

- NFR-1: No layout shift on navigation; route transitions feel instant.
- NFR-2: WCAG AA contrast on dark theme.

## Acceptance Criteria

- [ ] AC-1: `pnpm dev` serves the app; all pages share tokens and components.
- [ ] AC-2: No raw hex values in feature code — tokens only.

## Architecture Notes

UI kit lives in `apps/web/src/components/ui` for v1 (deviation from `packages/ui` — recorded in Implementation Notes; extraction is a later refactor when a second app exists).

## UX Notes

One primary action per screen. Whitespace + typography over effects. Subtle 150ms transitions only.

## Dependencies

None.

## Risks

Token sprawl → single globals.css source of truth.

## Edge Cases

Light mode: deferred; `dark` is root default.

## Security

No user input surfaces here. CSP-friendly (no inline scripts).

## Testing

Visual/manual for v1; component unit tests deferred to M6 (recorded debt).

## Definition of Done

- [ ] AC pass · Docs/context updated · Reviewed against spec

## Implementation Notes

`packages/ui` deferred: premature with one app. Turborepo deferred: plain pnpm workspace scripts suffice at this scale (revisit at M6).

## Review Notes

—

## Completion Status

Status: In Review — implementation complete; AC verification pending first local run
