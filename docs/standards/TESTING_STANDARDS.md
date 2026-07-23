# Testing Standards

## Philosophy

Test what breaks the product: the generation engine, data integrity, and critical user flows. Coverage is a byproduct, not a target.

## Layers

| Layer | Tool | Scope | Bar |
|---|---|---|---|
| Unit | Vitest | engine stages, schema validation, condition logic, utils | Required for all engine + business logic |
| Snapshot | Vitest | engine output vs golden fixtures | Required: every fixture interview has a golden repo tree |
| Integration | Vitest + Supabase local | data layer, RLS policies, server actions | Required for every table's RLS and every mutation |
| E2E | Playwright | signup → interview → generate → preview → deliver | Required for the critical path, run in CI on PRs to main |

## Engine testing (highest bar)

- The authoring provider is an interface; tests use a deterministic mock. LLM-dependent behavior is tested via contract validation (does real output pass document contracts) in a separate, non-blocking nightly job.
- Fixture interviews (`fixtures/*.json`) cover the product-type × feature matrix; adding an interview question requires updating fixtures.
- Golden snapshots reviewed like code: a snapshot diff in a PR is a product decision, not noise to be regenerated blindly.

## Rules

- A spec's Testing section defines what's tested; the PR checklist enforces it. Failing or skipped tests never merge.
- Bug fixes ship with a regression test that fails before the fix.
- RLS tests assert both access *and denial* (member sees, non-member gets zero rows).
- Test names read as behavior: `denies artifact access to non-members`, not `test rls 3`.
