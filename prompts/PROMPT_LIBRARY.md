# Prompt Library — Building Arrow

## Session start

**Orient**
> Read CLAUDE.md, context/PROGRESS.md, and context/CONSTRAINTS.md. Summarize the current state and tell me the single highest-priority next action per the backlog. Don't start it yet.

## Specification

**Write a spec**
> We're starting F-<id> (<name>) from roadmap/BACKLOG.md. Read context/, the relevant docs/architecture files, and neighboring specs in specs/. Then write a complete spec at specs/<milestone>/F-<id>-<slug>.md using templates/SPEC_TEMPLATE.md. Every section filled — mark N/A only with justification. Flag any open questions for me before finalizing.

**Challenge a spec**
> Review specs/<path> as a skeptical staff engineer. Find: ambiguous requirements, untestable acceptance criteria, missing edge cases, security gaps, and conflicts with docs/architecture or existing ADRs. Output a numbered list of issues with proposed fixes; don't edit the spec yet.

## Implementation

**Implement against spec**
> Implement F-<id> exactly per specs/<path>. Follow docs/standards/CODING_STANDARDS.md and context/CONSTRAINTS.md. Work through checklists/FEATURE_CHECKLIST.md. If the spec is wrong or incomplete, stop and tell me before deviating. Include tests per the spec's Testing section.

**Resume mid-feature**
> Read context/PROGRESS.md and specs/<path>, then run git diff main to see what's done. List remaining work against the spec's Definition of Done and continue from there.

## Review & quality

**Review against spec**
> Review this branch against specs/<path>, section by section: each FR and AC (met? where?), Security section (implemented?), Testing section (covered?), standards compliance. Verdict: mergeable or a fix list.

**RLS audit**
> Read docs/architecture/DATABASE_DESIGN.md and all migrations. For each table: state the RLS policy, verify it scopes through organization membership, and confirm denial tests exist. Report any gaps as a table.

## Synchronization

**Close out a feature**
> F-<id> is merged. Update: spec Completion Status and Implementation/Review Notes; roadmap/BACKLOG.md status; context/PROGRESS.md; any affected docs. List every file you changed.

**Context freshness check**
> Compare context/ and CLAUDE.md against the actual repo state. List every stale or missing statement, then fix them.

## Decisions

**Draft an ADR**
> We need to decide: <question>. Research constraints in existing ADRs and docs/architecture. Draft adr/XXXX using templates/ADR_TEMPLATE.md with at least two real options and a recommendation. I decide; you record.

## Milestone

**Self-review**
> Milestone <MX> is complete. Run checklists/RELEASE_CHECKLIST.md: audit architecture docs vs reality, folder drift, spec/doc/context staleness, code quality, prompt library, tech debt. Output findings as a prioritized list with proposed backlog items.
