# Documentation
Where each kind of doc lives. Root keeps only `README.md` and `CLAUDE.md`; everything else is here.
**Rules and workflow are not here — they live in the single source of truth,
[`../.claude/spec-kit/constitution.md`](../.claude/spec-kit/constitution.md).** These docs explain and
elaborate; the constitution decides.

## Product
| Doc | What |
|-----|------|
| [VISION.md](VISION.md) | Product vision: problem, insight, what Airrow is/isn't, direction |

## `architecture/`
| Doc | What |
|-----|------|
| [SYSTEM_OVERVIEW.md](architecture/SYSTEM_OVERVIEW.md) | Living high-level map: app + product core, roles, data flow |
| [SYSTEM_ARCHITECTURE.md](architecture/SYSTEM_ARCHITECTURE.md) | Deeper architecture: platform diagram, engine pipeline, jobs, delivery |
| [DATABASE_DESIGN.md](architecture/DATABASE_DESIGN.md) | Full v1 schema + RLS pattern + rationale |
| [INFORMATION_ARCHITECTURE.md](architecture/INFORMATION_ARCHITECTURE.md) | Product object model + the canonical generated-repo structure |
| [UI_ARCHITECTURE.md](architecture/UI_ARCHITECTURE.md) | Design identity, tokens, route map, quality bars |
| [BRANCHING.md](architecture/BRANCHING.md) | Branch + PR workflow (issue → feature → develop → main) |

## `guides/`
| Doc | What |
|-----|------|
| [DEVELOPER_GUIDE.md](guides/DEVELOPER_GUIDE.md) | Setup, code organization, patterns, testing, troubleshooting |

## Related
- [`../.claude/spec-kit/constitution.md`](../.claude/spec-kit/constitution.md) — **the single source of truth for rules.**
- [`../specs/`](../specs/) — one spec per issue.
- [`../.claude/spec-kit/`](../.claude/spec-kit/) — the spec constitution + template.
- [`../.claude/commands/`](../.claude/commands/) — the spec-workflow slash commands.
- [`../template/`](../template/) — the canonical scaffold Airrow generates for customers.
- [`adr/`](adr/) — architecture decision records.
- [`../CLAUDE.md`](../CLAUDE.md) — instructions for Claude Code.
