# Start here — {{PROJECT_NAME}}

**{{PROJECT_TAGLINE}}**

This foundation is complete but empty: the rules, workflow, and documentation are in place, the
application code is not. That is deliberate — you write the code, with an AI assistant, one spec at a
time. Work through the steps below in order.

---

## 1. Set up your machine

{{SETUP_STEPS}}

## 2. Check that it runs

```bash
{{CMD_DEV}}        # start the dev server
{{CMD_TYPECHECK}}  # type check
{{CMD_LINT}}       # linter
{{CMD_TEST}}       # tests
```

If all four are clean, the foundation is working. This is the **verification bar** — every change you
make from here has to pass it before it merges.

## 3. Read these four files, in this order

| # | File | Why |
|---|------|-----|
| 1 | [CLAUDE.md](CLAUDE.md) | What your AI assistant reads first, every session |
| 2 | [.claude/spec-kit/constitution.md](.claude/spec-kit/constitution.md) | The rules. When anything disagrees with it, it wins |
| 3 | [docs/VISION.md](docs/VISION.md) | What you're building and where it goes |
| 4 | [docs/architecture/SYSTEM_OVERVIEW.md](docs/architecture/SYSTEM_OVERVIEW.md) | How the system is shaped |

Read them yourself — they are short. Your assistant reads them too, which is why keeping them current
matters more than keeping them long.

## 4. Set up the repository

1. Create an empty repository on {{REPO_PROVIDER}} and push this foundation to `main`.
2. Create the long-lived branches: `develop`, then your first `feature/<name>`.
3. Add the CI secrets your workflows need (see `.github/workflows/`), including the credentials for
   the {{DEPLOY_TARGET}} deploy.

Branch direction is strict and never skipped —
[docs/architecture/BRANCHING.md](docs/architecture/BRANCHING.md) has the full model.

## 5. Write your first spec

{{FIRST_SPEC_HINT}}

Open your AI assistant in this repository and run:

```
/createspec "<the first thing you're building>"
```

It scaffolds `specs/NNN-kort.md` and sets up the branch. You answer the questions; it writes the spec.
**No spec, no code** — that rule is what keeps an AI assistant from wandering.

## 6. The loop you repeat from now on

| Step | Command | What happens |
|------|---------|--------------|
| 1 | `/createspec <issue# \| "description">` | Scaffold the spec, create the issue branch |
| 2 | `/clarify` | Resolve every `[NEEDS CLARIFICATION]` marker before code exists |
| 3 | `/implement` | Plan the exact changes, write them, add tests, run the verification bar |
| 4 | `/analyze` | Cross-check spec ↔ code ↔ constitution, then close the spec |
| 5 | `/push` | Commit and push the issue branch |
| 6 | `/pr-check` | Merge-safety check, then open the PR into your `feature/<name>` |

That is the whole workflow. Repeat it per issue and the documentation stays true as the codebase grows.

## 7. When something is unclear

Anything the interview could not answer is marked `[NEEDS CLARIFICATION: …]` in these files. Nothing
was invented to fill a gap. Search for that marker, decide, and replace it — that is your first
five minutes of work.
