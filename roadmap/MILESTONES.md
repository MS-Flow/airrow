# Milestones

Working order: top to bottom. A milestone is done when all its features are specified, implemented, tested, reviewed, documented, and context is synchronized — then a self-review runs before the next milestone starts.

---

## M0 — Engineering Foundation ✦ current

**Goal:** Airrow's complete pre-implementation foundation, built with Airrow's own methodology.

| # | Deliverable | Status |
|---|-------------|--------|
| 0.1 | Vision, product & engineering constitutions | ✅ |
| 0.2 | Roadmap, milestones, backlog | ✅ |
| 0.3 | System / database / UI / information architecture | ✅ |
| 0.4 | Specification system + templates | ✅ |
| 0.5 | Standards: coding, testing, security, git, docs | ✅ |
| 0.6 | AI context system (CLAUDE.md + /context) | ✅ |
| 0.7 | Prompt library | ✅ |
| 0.8 | Initial ADRs (stack decisions) | ✅ |
| 0.9 | M0 self-review | ⬜ |

**Exit criteria:** a new engineer (or AI) can read START_HERE.md and productively contribute within one session.

---

## M1 — Generation Engine (headless)

**Goal:** interview answers in → complete repository foundation out. No UI.

**Epics**
- **E1.1 Project Model** — typed schema of everything Airrow knows about a project (answers, stack, features, derived decisions).
- **E1.2 Interview Schema** — declarative question graph with conditions; adaptive by construction. Single source for engine and future UI.
- **E1.3 Template System** — repository blueprint (folder tree, static standards, templates) with per-project variable resolution.
- **E1.4 Content Generation** — Claude API authoring of project-specific documents (vision, architecture, specs, roadmap, context files) from the project model; structured prompts per document type.
- **E1.5 Assembly & Validation** — merge deterministic + generated output, validate completeness (every required doc present, links resolve), emit file tree + manifest.
- **E1.6 Engine CLI + snapshot tests** — run engine locally against fixture interviews; golden-output snapshot testing.

**Exit criteria:** `pnpm engine:generate fixtures/saas-b2b.json` produces a complete, validated foundation that a human CTO would endorse.

---

## M2 — App Skeleton & Auth

**Goal:** deployed Next.js app with auth and project management.

**Epics:** E2.1 App scaffold & design system (dark-first, shadcn/ui) · E2.2 Supabase auth (email + GitHub OAuth) · E2.3 Database schema v1 + RLS · E2.4 Dashboard shell & navigation · E2.5 Project CRUD · E2.6 CI/CD (GitHub Actions → Vercel).

**Exit criteria:** sign up → create project → see it on dashboard, in production.

---

## M3 — Adaptive Interview

**Goal:** the CTO interview as a premium UI experience.

**Epics:** E3.1 Interview runtime (schema-driven renderer, conditional flow) · E3.2 Question components (single/multi/cards/text) · E3.3 Persistence & resume · E3.4 Review & edit answers screen.

**Exit criteria:** completing an interview produces a stored, complete project model; irrelevant questions are never shown.

---

## M4 — Generation, Preview & Delivery

**Goal:** the magic moment — from interview to cloned repo.

**Epics:** E4.1 Generation jobs (async, progress, retry) · E4.2 Repo preview (file tree + markdown rendering) · E4.3 ZIP export · E4.4 GitHub App integration (create repo, push foundation) · E4.5 "Continue Locally" handoff.

**Exit criteria:** interview → preview → GitHub repo, end-to-end, < 5 minutes of generation time.

---

## M5 — Landing & Launch

**Goal:** public launch.

**Epics:** E5.1 Landing page · E5.2 Onboarding polish & empty states · E5.3 Example project showcase · E5.4 Analytics + error tracking · E5.5 Launch checklist (security review, load sanity, legal pages).

---

## M6+ — see ROADMAP.md Phase 3/4
