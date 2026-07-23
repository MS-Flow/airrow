# Git Standards

## Branching

- Trunk-based: `main` is always deployable and protected (PR + green CI required).
- Short-lived feature branches: `feat/F-XXX-slug`, `fix/BUG-slug`, `chore/slug`. One branch per spec/feature; branches live days, not weeks.
- No long-running develop/release branches in v1.

## Commits

- Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`. Scope by feature where useful: `feat(interview): ...`.
- Commits are atomic and buildable. Reference the spec ID in the body when relevant.

## Pull Requests

- Follow `templates/PR_TEMPLATE.md`; every PR references its spec (or is `docs:`/`chore:` scoped).
- Small PRs: one feature or coherent slice. If a PR needs a novel to explain, split it.
- Docs and context updates ship in the same PR as the change (Engineering Constitution §15).
- Squash-merge with a clean conventional title.

## Releases

- Continuous deployment from `main` via Vercel. Milestone completion tagged `m1`, `m2`, ... CHANGELOG.md updated per milestone.
