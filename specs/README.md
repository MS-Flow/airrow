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
| Interview-driven project generator | [1-interview-generator.md](1-interview-generator.md) | ✅ Done |
| Vercel + Supabase infrastructure setup | [9-vercel-supabase-setup.md](9-vercel-supabase-setup.md) | ✅ Done |
| Vercel domains: production + stable dev URL | [12-vercel-domains.md](12-vercel-domains.md) | 🔄 In progress |
| Supabase full schema migration + DataStore cutover | [14-supabase-schema-auth.md](14-supabase-schema-auth.md) | ✅ Done |
| Supabase Auth — email + password login | [18-supabase-auth.md](18-supabase-auth.md) | ✅ Done |
| Premium Airrow UI (v1) — design system + all screens | [19-premium-ui-system.md](19-premium-ui-system.md) | ✅ Done |
| Auto-assign issue on `/createspec` | [27-auto-assign-createspec.md](27-auto-assign-createspec.md) | ✅ Done |
| Auto-delete issue branch on feature merge | [28-delete-issue-branch.md](28-delete-issue-branch.md) | ✅ Done |
| Enforce PR merge-direction at the PR level | [29-branch-policy.md](29-branch-policy.md) | ✅ Done |
| Push protection on `develop` and `main` | [13-push-protection.md](13-push-protection.md) | ✅ Done |
| Blocking CI checks on PRs into `develop` | [14-pr-ci-checks.md](14-pr-ci-checks.md) | ✅ Done |
| Auto-set PR base branch per the hierarchy | [16-pr-base-branch.md](16-pr-base-branch.md) | 🔄 In progress |
| Blocking advisories + secret scanning | [33-security-scanning.md](33-security-scanning.md) | ✅ Done |
| Auto-request a reviewer on PRs into `develop` / `main` | [46-auto-assign-reviewer.md](46-auto-assign-reviewer.md) | ✅ Done |
| Import an existing project into Airrow | [63-import-existing-projects.md](63-import-existing-projects.md) | ✅ Done |
| Auto-generate the PR description when a PR is opened | [53-pr-description.md](53-pr-description.md) | ✅ Done |
| Redesign interview into architecture-first question set | [6-fix-interview-template.md](6-fix-interview-template.md) | ✅ Done |
| Fix UI design flaws — shell corrections + anonymous interview | [11-ui-design-flaws.md](11-ui-design-flaws.md) | ✅ Done |
| Downloaded foundation must fully reflect the interview answers | [10-foundation-reflects-answers.md](10-foundation-reflects-answers.md) | ✅ Done |
| Landing copy, the spec-driven story, smooth scroll and a real footer | [23-landing-copy-footer.md](23-landing-copy-footer.md) | 🔄 In progress |
