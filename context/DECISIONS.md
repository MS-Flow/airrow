# Decisions (summaries)

Full records in `/adr`. Never contradict these without a superseding ADR.

- **ADR-0001** — Airrow runs on Next.js App Router (dogfoods the golden path; one codebase for marketing/app/server).
- **ADR-0002** — Hybrid generation: deterministic blueprint for structure + Claude-authored, contract-validated documents for substance. Prompts are versioned assets.
- **ADR-0003** — Supabase backend (Postgres+RLS, Auth, Storage, Realtime); pnpm/Turborepo monorepo; engine is a pure headless package.
- **ADR-0004** — Delivery = ZIP (always works) + GitHub App push behind a `RepoProvider` interface; Azure DevOps later via same interface.

Product-level: Airrow generates foundations, never applications (Product Constitution §1). Specs are the source of truth everywhere (§3). Dark mode first (§7).
