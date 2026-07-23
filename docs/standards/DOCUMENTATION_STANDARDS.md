# Documentation Standards

## System

Four documentation layers, each with one job:

1. **Specs** (`/specs`) — source of truth for features. Written before code.
2. **Docs** (`/docs`) — explain the product, architecture, and standards. Stable, curated.
3. **ADRs** (`/adr`) — immutable decision records. Append-only.
4. **Context** (`/context`, `CLAUDE.md`) — short, current, pointer-rich state for AI and humans. Updated every PR that changes state.

## Rules

- **Single source of truth.** Facts live in exactly one file; everything else links. Duplicated content is a bug.
- **Update-with-change.** Documentation changes ship in the same PR as the code they describe. Definition of Done enforces it.
- **Written for a cold reader.** Assume the reader (human or AI) has zero conversation history. Context must be in the repo.
- **Short beats complete.** A doc nobody reads is worse than a doc that's 80% and current. Cut ruthlessly; link for depth.
- **Every folder is navigable.** Each directory has a README or an obvious entry file.

## Style

Markdown. Sentence-case headings. Prose first; tables for genuinely tabular data; diagrams as fenced ASCII or Mermaid. Absolute clarity over marketing tone — except user-facing generated docs, which may carry Arrow's voice.

## Ownership & review

Docs are reviewed in PRs like code. `context/` accuracy is checked at every milestone self-review. Stale documentation found by anyone becomes an immediate fix, not a backlog item.
