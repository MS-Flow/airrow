# ADR-0005: Local-mode data layer and deterministic authoring for v1 build

> Status: Accepted · Date: 2026-07-23

## Context

The first functional build must run on a founder's machine with zero external provisioning. Supabase requires a provisioned project + keys; Claude authoring requires an API key; GitHub push requires a registered GitHub App. Waiting on credentials blocks the entire build.

## Options Considered

1. **Wire directly to Supabase/Anthropic/GitHub** — production-true, but nothing runs until credentials exist.
2. **Local mode behind interfaces** — a `DataStore` interface with a local JSON-file implementation now and a Supabase implementation slot; an `AuthoringProvider` interface with a deterministic local agent now and a Claude implementation slot; `RepoProvider` GitHub stubbed behind a connect screen.

## Decision

Option 2 (founder decision, 2026-07-23). The app is fully functional out of the box: local file-backed store in `.data/`, cookie-session dev auth, deterministic authoring agent that personalizes every document from the interview-derived project model, ZIP delivery always available.

## Consequences

- All persistence flows through `DataStore` — activating Supabase later is an implementation swap plus migrations, not a rewrite. Same for Claude authoring (`AuthoringProvider`) per ADR-0002's contract-validation design.
- Local dev auth is explicitly not production auth; `/login` is replaced by Supabase Auth when Supabase mode activates.
- `.data/` is gitignored; it is a development convenience, not a durability story.
- Engine remains dependency-free and pure, testable with `node --experimental-strip-types`.
