# Prompt Library — Building Airrow

The spec lifecycle itself is now the slash commands `/createspec → /clarify → /implement → /analyze`
(+ `/push`, `/pr-check`) — use those instead of hand-written spec/implement/review prompts. What
remains here are the audit/decision prompts the commands don't cover.

## RLS audit
> Read `docs/architecture/DATABASE_DESIGN.md` and all migrations. For each table: state the RLS
> policy, verify it scopes through organization membership, and confirm denial tests exist. Report
> any gaps as a table. (Enforces constitution §II.)

## Context freshness check
> Compare `CLAUDE.md`, `context/`, and the `docs/` living docs against the actual repo state. List
> every stale or missing statement, then fix them in place. (Enforces constitution §IV — AI context
> stays synchronized.)

## Draft an ADR
> We need to decide: <question>. Research constraints in existing ADRs and `docs/architecture/`.
> Draft `adr/NNNN-<slug>.md` from `templates/ADR_TEMPLATE.md` with at least two real options and a
> recommendation. I decide; you record.
