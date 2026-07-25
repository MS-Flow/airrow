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
| Auto-assign issue on `/createspec` | [27-auto-assign-createspec.md](27-auto-assign-createspec.md) | ✅ Done |
| Auto-delete issue branch on feature merge | [28-delete-issue-branch.md](28-delete-issue-branch.md) | ✅ Done |
| Enforce PR merge-direction at the PR level | [29-branch-policy.md](29-branch-policy.md) | ✅ Done |
| Push protection on `develop` and `main` | [13-push-protection.md](13-push-protection.md) | ✅ Done |
| Vercel + Supabase infrastructure setup | [9-vercel-supabase-setup.md](9-vercel-supabase-setup.md) | 🔄 In progress |
| Supabase full schema migration + DataStore cutover | [14-supabase-schema-auth.md](14-supabase-schema-auth.md) | 🔄 In progress |
| Supabase Auth — email + password login | [18-supabase-auth.md](18-supabase-auth.md) | 🔄 In progress |
| Premium Airrow UI (v1) — design system + all screens | [19-premium-ui-system.md](19-premium-ui-system.md) | 🔄 In progress |
| Redesign interview into architecture-first question set | [6-fix-interview-template.md](6-fix-interview-template.md) | ✅ Done |
| Downloaded foundation must fully reflect the interview answers | [10-foundation-reflects-answers.md](10-foundation-reflects-answers.md) | ✅ Done |
