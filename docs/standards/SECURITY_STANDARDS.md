# Security Standards

## Principles

Least privilege, defense in depth, secure by default. Every spec has a Security section; "N/A" requires justification.

## Authentication & tenancy

- Supabase Auth only; no custom auth code. Session handling via official helpers.
- Every table has RLS scoped through organization membership; server code additionally scopes queries. RLS policies have denial tests (see TESTING_STANDARDS).
- Authorization decisions server-side only — never trust client-supplied org/project IDs without RLS + explicit checks.

## Input & output

- Zod validation at every boundary: forms, server actions, route handlers, webhooks, engine I/O, and **LLM output** (authored documents are validated against document contracts before acceptance).
- Prompt-injection posture: interview answers are user input embedded in prompts. Templates isolate user content, and generated output is validated structurally; generated files are treated as untrusted text (rendered, never executed).
- Markdown rendering sanitized; no `dangerouslySetInnerHTML` with user-derived content.

## Secrets & keys

- Secrets only in Vercel/Supabase env; never in code, logs, client bundles, or generated output. Anthropic key server-side only.
- GitHub integration via GitHub App with minimal permissions (repo creation + contents write), tokens short-lived, installation IDs stored — never user PATs.

## Data

- Interview answers and generated artifacts are customer IP: encrypted at rest (Supabase default), access only via RLS-scoped paths, signed URLs with short expiry for Storage.
- Deleting a project deletes its interviews, models, jobs, artifacts, and files (cascade + Storage cleanup).
- Log hygiene: no answer content or generated document bodies in logs; log IDs and metadata.

## Dependencies & ops

- Dependabot/renovate enabled; high-severity advisories block release. Lockfile committed.
- Security review is a release-checklist item for every milestone (see checklists/RELEASE_CHECKLIST.md).
