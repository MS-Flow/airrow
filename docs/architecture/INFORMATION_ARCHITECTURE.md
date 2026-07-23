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

Canonical structure every Airrow project receives (feature-dependent files vary):

```
<project>/
├── README.md                  entry point: what, stack, how to start
├── START_HERE.md              guided first hour for founder + AI
├── CLAUDE.md                  AI assistant entry context
├── context/                   AI context system
│   ├── PROJECT.md             business, vision, goals, constraints
│   ├── ARCHITECTURE.md        condensed architecture for AI
│   ├── PROGRESS.md            current state, open/completed work
│   ├── DECISIONS.md           decision summaries → /adr
│   └── CONSTRAINTS.md         hard rules the AI must never break
├── specs/                     feature specifications (source of truth)
│   ├── README.md              how the spec system works
│   └── <milestone>/<feature>.md
├── docs/
│   ├── VISION.md · ROADMAP.md · GETTING_STARTED.md
│   ├── architecture/          ARCHITECTURE, TECH_STACK, DATABASE, SUPABASE, VERCEL
│   ├── standards/             CODING, TESTING, SECURITY, GIT, DOCUMENTATION
│   ├── guides/                AI_GUIDE, CLAUDE, CURSOR, COPILOT, DEVELOPMENT_GUIDE
│   └── workflows/             feature workflow, release workflow
├── adr/                       architecture decision records
├── prompts/                   prompt library for this project
├── templates/                 SPEC, ADR, PR, BUG, FEATURE templates
├── checklists/                feature, review, release checklists
└── .github/                   PR template, CI stub (provider-dependent)
```

Rules for generated IA: every folder has a README or an obvious entry file; every document links to its sources of truth; nothing exists twice (single-source, cross-linked); AI context files are short and pointer-rich rather than duplicating docs.

## 3. Airrow's own repo

Airrow itself follows the same IA (see repo root) — deviations between what we generate and what we use are treated as bugs of the methodology.
