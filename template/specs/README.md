# Specs

Feature specifications for {{PROJECT_NAME}}. Each spec is written before implementation.

One file per issue: `specs/NNN-kort.md`, combining the *what*, the *how* (exact `file:line` changes),
acceptance criteria, verification and edge cases in a single document.

## Automated workflow
Driven by slash commands (in [`.claude/commands/`](../.claude/commands/)), governed by the
constitution + template in [`.claude/spec-kit/`](../.claude/spec-kit/):

| Command | Phase |
|---------|-------|
| `/createspec <issue# \| "desc">` | Scaffold the spec + set up the `NNN-kort` branch off its feature |
| `/clarify` | Resolve `[NEEDS CLARIFICATION]` markers via targeted questions |
| `/implement` | Plan exact `file:line` changes, implement, add tests, run typecheck/lint/tests |
| `/analyze` | Cross-check spec ↔ code ↔ constitution; if all passes, close the spec out |
| `/push` | Commit pending changes + push (never main/develop, never force) |
| `/pr-check` | Pre-PR merge-safety check against the target branch |
| `/security` | Review the whole repository for vulnerabilities, fix the invisible ones, write `SECURITY_AUDIT.md` |

{{CAPABILITY_SPECS_INTRO}}

{{CAPABILITY_SPECS}}
