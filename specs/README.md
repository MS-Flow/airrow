# Specs

This folder contains feature specifications for Airrow. Each spec is written before implementation.

One file per issue: `specs/NNN-kort.md`, combining the *what*, the *how* (exact `file:line` changes),
acceptance criteria, verification and edge cases in a single document.

## Automated workflow
The spec lifecycle is driven by slash commands (in [`.claude/commands/`](../.claude/commands/)),
governed by the constitution + template in [`.claude/spec-kit/`](../.claude/spec-kit/):

| Command | Phase |
|---------|-------|
| `/createspec <issue# \| "desc">` | Scaffold the spec + set up the `NNN-kort` branch off its feature |
| `/clarify` | Resolve `[NEEDS CLARIFICATION]` markers via targeted questions |
| `/implement` | Plan exact `file:line` changes, implement, add tests, run typecheck/lint/tests, check off criteria |
| `/analyze` | Cross-check spec ↔ code ↔ constitution; if all passes, close the spec out |
| `/push` | Commit pending changes + push the current branch (never main/develop, never force) |
| `/pr-check` | Pre-PR merge-safety check against the target branch |

## File naming
`specs/NNN-kort.md` — the GitHub issue number plus a short kebab-case name, matching the branch.

## Status overview
| Feature | Spec | Status |
|---------|------|--------|
| Interview-driven project generator | [1-interview-generator.md](1-interview-generator.md) | 🔄 In progress |
| Vercel + Supabase infrastructure setup | [9-vercel-supabase-setup.md](9-vercel-supabase-setup.md) | 🔄 In progress |
| Redesign interview into architecture-first question set | [6-fix-interview-template.md](6-fix-interview-template.md) | ✅ Done |
| Downloaded foundation must fully reflect the interview answers | [10-foundation-reflects-answers.md](10-foundation-reflects-answers.md) | 🔄 In progress |
