# Release / Milestone Checklist

Run at the end of every milestone, before starting the next.

## Completion

- [ ] All milestone features ✅ in `roadmap/BACKLOG.md`; specs marked Done
- [ ] E2E critical path green; no known Critical/High bugs open
- [ ] Milestone tagged (`mX`); CHANGELOG.md updated

## Self-review (Engineering Constitution §4)

- [ ] Architecture docs still match reality — corrected where not
- [ ] Folder structure reviewed; drift fixed or documented
- [ ] Specs, docs, and `context/` audited for staleness
- [ ] Code quality pass: dead code, TODO audit, dependency updates
- [ ] Prompt library reviewed against actual usage
- [ ] Tech debt inventoried → backlog items with priority
- [ ] Security review: new surfaces, RLS coverage, secrets audit, dependency advisories

## Improve

- [ ] At least one methodology improvement identified and applied to both Airrow and its generated output
- [ ] Roadmap and milestone plan adjusted with what was learned
