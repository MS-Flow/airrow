# Spec 130 — The migration check answers the question a push can actually ask

> **In one sentence:** `verify` is required and runs on both `push` and `pull_request`, but the
> migration check only had the information to answer on one of them — so every branch that adds a
> migration went red and could not be merged.

|                |                                                      |
| -------------- | ---------------------------------------------------- |
| **Status**     | 🔄 In progress                                        |
| **Issue**      | #130 — "verify blir röd på push när en gren lägger till en migration" |
| **Branch**     | `130-migration-check-on-push` (from `feature/pro`)    |
| **Feature**    | ci-cd                                                 |
| **Depends on** | amends [spec 77](77-auto-apply-migrations.md)         |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

As a **developer merging a change that adds a migration** I want **the required check to pass when
nothing is actually wrong** so that **I can merge my work, and a red `verify` still means something.**

---

## Background

- **Today:** `migrationsAddedInPullRequest()` reads `GITHUB_BASE_REF` to tell "this change adds the
  migration" from "somebody merged one that never reached the database"
  ([supabase-migration-drift.mjs:280-282](../scripts/supabase-migration-drift.mjs#L280-L282)). That
  variable exists only on `pull_request` events.
- **The problem:** `verify` is a single required context produced by **both** triggers
  ([setup-branch-protection.sh:38](../scripts/setup-branch-protection.sh#L38)). On push the function
  returns an empty list, every unapplied migration counts as already merged, and the job fails. Seen on
  PR #129: CI #292 (`pull_request`) green with `Migration 20260730120000 läggs till av den här
  ändringen`, CI #289 (`push`) red — same commit, same workflow, same script. The merge was blocked by a
  check that was wrong.
- **Already in place:** the branch that adds a migration is by definition ahead of `develop`, and a push
  payload carries `before`. Both are enough to derive a base; neither was being used.

---

## Design decision

**Derive the base instead of giving up.** Three situations, and they are genuinely different questions:

| Event | Range | Why |
| --- | --- | --- |
| `pull_request` | `origin/<base>...HEAD` | Unchanged — the base is stated. |
| push to a branch that is not `develop`/`main` | `origin/develop...HEAD` | What the branch adds on top of develop has not merged yet, whichever push introduced it. |
| push to `develop`/`main` | `<before>..HEAD` | What *this* push brought in is applied by `supabase-migrate.yml` seconds later. Anything else unapplied is the drift the check exists for. |

The last row is the one that keeps this honest: on `develop`, a migration that merged days ago and never
applied is still not in `before..HEAD`, so it still fails — which is the 2026-07-27 incident and the
whole reason spec 77 was written.

**Still fail-closed.** If the base cannot be derived, or the diff fails, the warning and the blocking
verdict stay exactly as they are. Not being able to answer must never read as "nothing is wrong".

**Not touched:** what the check does with its answer, the apply workflow, and the required contexts.

---

## Acceptance criteria

- [x] A push to a branch that adds a migration passes, naming it as added by this change.
- [x] A push to `develop`/`main` that brings a migration in with it passes.
- [x] A push to `develop` whose unapplied migration arrived in an *earlier* push still fails.
- [x] A pull request behaves exactly as before.
- [x] A base that cannot be derived, or a diff that fails, still fails closed with the existing warning.
- [x] `origin/develop` is fetched on push runs too, so the range can be computed.
- [x] Typecheck passes; lint adds no new issues; tests green.

### Verification

- **New tests** — [`scripts/supabase-migration-drift.test.mjs`](../scripts/supabase-migration-drift.test.mjs)
  (8 for `addedMigrationsRange`): the stated base on a PR, a PR into a feature branch, a pushed branch
  measured against develop, pushes to `develop` and `main` measured against `before`, and the three
  fail-closed cases — no ref, no `before`, the zero sha. Plus the one that guards the point of spec 77:
  a push to develop is measured against `before..HEAD` and therefore still fails for a migration an
  earlier push merged.
- **Result:** `pnpm test:scripts` **88 passed** · `pnpm -r typecheck` clean · `pnpm -r lint` clean ·
  `pnpm -r test` 469 passed, 53 skipped (the `*.db.test.ts` suites — local Supabase not running).
- The proof that matters is CI itself: this branch adds no migration, but the branch it merges into
  carries `20260730120000`, so the push run on `feature/pro` after the merge is the real test.

---

## Exact changes (file:line)

1. **`scripts/supabase-migration-drift.mjs`** — export a pure `addedMigrationsRange({ baseRef, refName,
   before })` returning the git range or null, and have the existing caller
   ([:280](../scripts/supabase-migration-drift.mjs#L280)) use it. The warning and empty-list fallback
   ([:299-304](../scripts/supabase-migration-drift.mjs#L299-L304)) stay.
2. **`.github/workflows/ci.yml`** — fetch `origin/develop` on push as well as the base ref on PRs.

---

## Data model

**No schema changes.**

---

## Security

Nothing new is exposed: the check reads the schema with credentials already scoped to that one step, and
this change only alters which git range is diffed locally on the runner.

---

## Edge cases

- **Push with a zero `before`** (a branch's first push) → no range, fails closed with the warning.
- **`origin/develop` not fetched** → the diff throws, the existing warning fires, verdict unchanged.
- **A branch cut from `main`** → still compared against `origin/develop`; a migration it adds is not on
  develop either, so the answer is the same.

---

## Out of scope

- Splitting `verify` into separate contexts per event, or dropping the push trigger. The push run is
  what makes a required check exist on direct ref updates (`ci.yml:6-7`), and removing it would leave
  merges into `develop` waiting forever.
