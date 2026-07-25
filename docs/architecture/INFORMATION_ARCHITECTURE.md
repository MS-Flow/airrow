# Information Architecture

Two information spaces: **Airrow the product** (what users navigate) and **the generated repository** (what Airrow outputs). Both defined here.

## 1. Product IA

```
Airrow
├── Landing (public)
├── Auth
└── App
    ├── Dashboard          — recent projects, resume interview, quick create
    ├── Projects           — the core object
    │   └── Project
    │       ├── Overview   — status, latest artifact, deliveries
    │       ├── Interview  — answers (editable until generation)
    │       ├── Preview    — generated repository browser
    │       └── Delivery   — ZIP / GitHub / Continue Locally
    ├── Templates (M6)
    ├── Prompt Library (M6)
    └── Settings
        ├── Profile
        ├── Organization & Team (M7)
        ├── Connections (GitHub)
        └── Billing (M7)
```

Object model: **Organization → Project → Interview → Project Model → Generation Job → Artifact → Delivery.** The project is the hub; everything on a project page derives from this chain. Statuses on `projects` mirror the chain (draft → interviewing → generating → ready → delivered).

## 2. Generated repository IA (the product's output)

Every Airrow project receives the same minimal, strict skeleton — the invariant structure is fixed; only the *content* of the tailored files varies with the interview. Canonical source: [`../../template/`](../../template/) (`.airrow-template.json` catalogs fixed-workflow vs. tailored paths).

```
<project>/
├── README.md                     entry point: what, stack, how to start
├── START_HERE.md                 the guided first hour: setup → first spec → the loop
├── CLAUDE.md                     AI assistant entry context
├── .claude/
│   ├── spec-kit/
│   │   ├── constitution.md       THE single source of truth for rules
│   │   └── spec-template.md      canonical one-file-per-issue spec format
│   └── commands/                 createspec · clarify · implement · analyze · push · pr-check
├── specs/
│   └── README.md                 how the spec system works + a brief per chosen capability
├── docs/
│   ├── README.md                 doc index
│   ├── VISION.md                 what this becomes, MVP focus, v1 scope
│   ├── architecture/
│   │   ├── SYSTEM_OVERVIEW.md     purpose, data flow, sign-in, tenancy, entities, security posture
│   │   └── BRANCHING.md           branch + PR model
│   └── guides/DEVELOPER_GUIDE.md  setup, patterns, verification bar
└── .github/workflows/            ci · branch-policy · close-issue-on-merge · deploy-dev
```

Rules for generated IA: root holds only `README.md`, `START_HERE.md`, and `CLAUDE.md`; rules live once in the constitution and everything links to it; every folder has an entry file; nothing exists twice. No ADRs — a decision is recorded in the spec that introduces it, so there is exactly one place to look. Founder-in-control — the full tree is previewed and approved before anything is written.

## 3. Airrow's own repo

Airrow itself follows the same IA (see repo root, plus `apps/` and `packages/` for the application) — deviations between what we generate and what we use are treated as bugs of the methodology.
