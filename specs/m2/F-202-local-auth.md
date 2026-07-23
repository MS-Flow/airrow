# Spec: F-202 — Authentication (local mode)

> Milestone: M2 · Epic: E2.2 · Priority: P1 · Owner: CTO

## Problem

The app needs identity and protected routes; Supabase Auth requires provisioning we don't have yet (ADR-0005).

## Business Goal

Unblock the full product flow today while keeping the Supabase swap clean.

## User Story

As a user, I want to sign in and have my projects persist under my identity, so that my work is mine across sessions.

## Functional Requirements

- FR-1: `/login`: name + email form → creates (or finds by email) user + personal organization, issues session cookie (httpOnly, sameSite=lax, 30d).
- FR-2: Middleware redirects unauthenticated `/app/*` → `/login`; authenticated `/login` → `/app`.
- FR-3: `getSession()` server helper resolves user + org for RSC/actions; invalid cookie clears and redirects.
- FR-4: Sign out action destroys session.
- FR-5: All auth flows go through the `DataStore` interface (users, organizations, members, sessions).

## Non-Functional Requirements

- NFR-1: Clearly labeled "local development auth" in UI; no password stored, no security theater.

## Acceptance Criteria

- [ ] AC-1: Given no session, visiting /app redirects to /login; after login, /app renders with the user's name.
- [ ] AC-2: Sign out returns to landing; /app redirects to /login again.
- [ ] AC-3: Same email logs into the same account and sees existing projects.

## Architecture Notes

Session = random 128-bit token → `sessions` collection. Personal org auto-created (`kind: personal`) per DATABASE_DESIGN. Supabase Auth replaces this file-for-file behind the same `getSession()` contract.

## UX Notes

Minimal centered card; one primary button; explains local mode in one quiet line.

## Dependencies

F-201 scaffold; DataStore (F-205 shares it).

## Risks

Local auth mistaken for production auth → explicit labeling + ADR-0005.

## Edge Cases

Concurrent first-login same email (last-write-wins acceptable locally); deleted user with live cookie → session invalidated.

## Security

httpOnly cookie; token random UUID×2; no credentials stored; local mode documented as non-production. Input validated with Zod.

## Testing

Manual flows now; Playwright critical-path when CI lands (debt logged).

## Definition of Done

- [ ] AC pass · context/PROGRESS updated · Reviewed against spec

## Implementation Notes

—

## Review Notes

—

## Completion Status

Status: In Review — implementation complete; AC verification pending first local run
