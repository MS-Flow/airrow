# Feature Checklist

Run top to bottom for every feature. No skipping (Engineering Constitution §2).

## Before implementation

- [ ] Read `context/PROGRESS.md`, relevant architecture docs, and neighboring specs
- [ ] Spec exists at `specs/<milestone>/F-XXX-<slug>.md`, all sections filled, status Ready
- [ ] Dependencies (specs, ADRs, migrations) resolved or scheduled
- [ ] New significant decisions captured as ADRs

## During

- [ ] Branch `feat/F-XXX-slug`; conventional commits
- [ ] Spec updated first whenever reality diverges
- [ ] Tests written per spec's Testing section

## Before merge

- [ ] All acceptance criteria pass; DoD checklist in spec complete
- [ ] Security section implemented; inputs validated
- [ ] Docs updated; `context/PROGRESS.md` updated in same PR
- [ ] PR follows template, references spec, reviewed against spec
- [ ] `roadmap/BACKLOG.md` status updated

## After merge

- [ ] Deployed and verified on production/preview
- [ ] Follow-ups from Implementation Notes filed to backlog
