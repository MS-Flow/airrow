# ADR-0004: MVP delivery — ZIP + GitHub App push behind a provider interface

> Status: Accepted · Date: 2026-07-23

## Context

Generated foundations must reach the founder's machine. The magic moment is going from interview to a cloned repo in minutes. Azure DevOps support is committed on the roadmap (M8) but not for MVP.

## Options Considered

1. **ZIP only** — simplest; but leaves the best onboarding moment unbuilt.
2. **ZIP + GitHub push** — one-click repo creation via a GitHub App; ZIP remains the universal fallback.

## Decision

ZIP + GitHub push (option 2), implemented behind a `RepoProvider` interface (`createRepo`, `pushTree`) with GitHub as the sole v1 implementation. GitHub App (installation-based) rather than user PATs — minimal permissions, revocable, org-friendly. (Founder decision, 2026-07-23.)

## Consequences

`repo_connections` table stores installations per organization. Azure DevOps (M8) implements the same interface; no delivery-path redesign later. ZIP path must always work even when no provider is connected — delivery can never hard-depend on an integration.
