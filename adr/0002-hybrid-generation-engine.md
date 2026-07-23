# ADR-0002: Hybrid generation engine

> Status: Accepted · Date: 2026-07-23

## Context

Arrow's core is turning interview answers into a repository foundation. The quality bar: output must feel authored by a senior CTO for *this* project (Product Constitution §2), yet be structurally reliable, testable, and affordable.

## Options Considered

1. **Templates only** — variable substitution. Deterministic, cheap, fast; but output is generic, violating Constitution §2.
2. **Fully LLM-generated** — Claude writes every file. Maximal personalization; but structure varies per run, untestable, slow, costly, and hallucination-prone for standards/config files that should be exact.
3. **Hybrid** — deterministic blueprint defines the tree, standards, templates, and config; Claude authors the project-specific documents (vision, architecture, specs, roadmap, context) against strict document contracts, validated before acceptance.

## Decision

Hybrid (option 3). Structure and correctness are deterministic; substance is personalized. Every authored document has a contract (required sections, constraints) and is validated with retry-on-failure. (Founder decision, 2026-07-23.)

## Consequences

Engine splits cleanly into resolve/author/assemble/validate stages (SYSTEM_ARCHITECTURE). Snapshot testing possible via mock authoring provider. Per-file provenance recorded in the manifest, enabling regeneration and future repo sync. Prompt engineering becomes a first-class, versioned asset (`prompt_version` in manifest).
