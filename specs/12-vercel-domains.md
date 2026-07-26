# Spec 12 — Vercel domains: production and a stable dev URL

> **In one sentence:** Create the Vercel project, bind `airrow.app` to the production build from
> `main`, and give `develop` a stable `dev.airrow.app` that never changes between deploys.

|                |                                                   |
| -------------- | ------------------------------------------------- |
| **Status**     | 🔄 In progress                                    |
| **Issue**      | #12 — "Fix vercel"                                |
| **Branch**     | `12-vercel-domains` (from `feature/infrastructure`) |
| **Feature**    | Infrastructure                                    |
| **Depends on** | [9-vercel-supabase-setup.md](9-vercel-supabase-setup.md) — Supabase half is done; this spec completes the Vercel half |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

_Who wants this, and what they get out of it._

As a **founder shipping Airrow** I want **each branch to map to a known, stable URL** so that **I
always know what is live where, can hand testers a link that doesn't rot, and never accidentally
publish work-in-progress to the public site.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today:** **no Vercel project exists yet.** Supabase is set up (spec 9's Supabase half is done);
  the Vercel half of spec 9 was never completed. `apps/web/vercel.json` sets only
  `framework: nextjs` — no domain or branch config. `.github/workflows/deploy-dev.yml` tries to
  deploy `develop` and `feature/**` via `vercel` CLI, but exits early with a warning because the
  `VERCEL_*` repo secrets are not set — so nothing has ever actually deployed. There is no path that
  deploys `main` at all.
- **The problem:** `airrow.app` is not bound to anything, there is no dev link, and the one workflow
  we have is dead code pointing at a project that does not exist.
- **Already in place:** the domain `airrow.app` is bought and registered on Vercel Domains, so DNS is
  managed by Vercel and no manual A/CNAME records are needed. `docs/guides/INFRASTRUCTURE_SETUP.md`
  already has sections for the Vercel project, git integration and the custom domain (§2–§4) — this
  spec fills them in rather than starting a new runbook. Nothing in `apps/web/src` reads a public
  site URL, so no code depends on these hostnames.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

Let **Vercel's native Git integration own every deploy**: connect the repo, set Root Directory
`apps/web`, Production Branch `main`, and add `dev.airrow.app` as a branch domain bound to `develop`.
Everything else (`feature/**`, issue branches) gets a throwaway preview URL for free. This is
dashboard configuration plus documentation — the repo keeps almost no deploy logic, which is why
`.github/workflows/deploy-dev.yml` is removed rather than extended: with Git integration in place it
would double-deploy every push.

`dev.airrow.app` and any preview URL are marked `noindex` so work-in-progress never surfaces in
search results.

**Not touched:** Supabase provisioning and schema (specs 9 / 14), auth (spec 18), and the application
code itself — this spec changes deploy configuration and docs only.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

Legend: **[code]** delivered by this change · **[manual]** founder dashboard step, guided by the
runbook.

- [ ] **[manual]** A Vercel project exists, connected to this GitHub repo with Root Directory
      `apps/web`, and a build succeeds.
- [ ] **[manual]** Production Branch is set to `main` in Vercel Git settings.
- [ ] **[manual]** `airrow.app` and `www.airrow.app` are attached to the project; `www` redirects to
      the apex.
- [ ] **[manual]** HTTPS certificate is issued and `https://airrow.app` resolves with no redirect loop.
- [ ] **[manual]** `dev.airrow.app` is added as a branch domain bound to `develop`.
- [ ] Pushing to `main` updates `https://airrow.app` — and nothing else does.
- [ ] Pushing to `develop` updates `https://dev.airrow.app` at the same, unchanged hostname every time.
- [ ] `feature/**` and issue branches produce throwaway preview URLs only — never the dev or
      production hostname.
- [x] **[code]** `dev.airrow.app` and preview deployments return `X-Robots-Tag: noindex`. Preview
      (`*.vercel.app`) URLs get this natively from Vercel; `dev.airrow.app` gets it explicitly via
      `apps/web/vercel.json` since it's a custom branch domain.
- [ ] **[manual]** Environment variables are set per Vercel environment (Production + Preview):
      Supabase URL + keys, Claude API key, GitHub App credentials.
- [ ] No secrets appear in the repo, the client bundle, or CI logs.
- [x] **[code]** The branch → URL mapping is documented in `docs/guides/INFRASTRUCTURE_SETUP.md` and
      linked from `docs/architecture/BRANCHING.md`.
- [x] **[code]** Spec 9's Vercel acceptance criteria are checked off or explicitly delegated here, so
      the two specs don't both claim ownership.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- No automated tests — this is dashboard/DNS configuration with no application logic to break, so it
  is verified by explicit manual checks, the same way spec 9's `[manual]` criteria are. (Constitution
  §V: test what breaks the product.)
- Deploy-mapping criteria are proven by an observed push per branch: push `develop` → `dev.airrow.app`
  updates and the hostname is unchanged from the previous deploy; push a `feature/**` branch → only a
  throwaway preview URL appears; push `main` → `airrow.app` updates.
- `www` → apex redirect, certificate status and the `noindex` header verified via `curl -I` plus
  Vercel's domain status check.
- Secret hygiene verified by grepping the built client bundle and reviewing a real deployment's build log.
- Full suite result + typecheck/lint status.

**Run 2026-07-26:** `pnpm -r typecheck` ✓ (after clearing a stale `.next/` cache left over from a
different branch — autogenerated, safe to delete) · `pnpm -r lint` ✓ (no new issues) · `pnpm -r test`
✓ (engine 22/22; web RLS/auth/cutover tests skip without local Supabase, as designed). No new tests
added — nothing here is application logic to unit test (see rationale above).

**Re-run 2026-07-26 after merging `develop`:** branch was 42 commits behind; merged `origin/develop`
in (fast-forward, then resolved two doc conflicts in `docs/architecture/BRANCHING.md` and
`specs/README.md` between this spec's edits and `develop`'s status updates — kept both). Also applied
the `/createspec` fix agreed during `/clarify` (`--branch-name` → `--name`; added a check that warns
if `feature/<name>` is behind `develop` instead of merging `develop` into the issue branch directly).
`pnpm -r typecheck` ✓ · `pnpm -r lint` ✓ · `pnpm -r test` ✓ (engine 36/36; web 60/60, 15 skipped
without local Supabase).

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

1. **`.github/workflows/deploy-dev.yml`** — delete. Vercel's Git integration deploys `develop` and
   `feature/**` natively; keeping this would double-deploy. It has never run successfully anyway
   (early-exits without `VERCEL_TOKEN`, [:31-38](../.github/workflows/deploy-dev.yml#L31-L38)).
2. **`apps/web/vercel.json`** — add the `www` → apex redirect and the `X-Robots-Tag: noindex` header
   for non-production deployments; keep `framework: nextjs` ([:1-4](../apps/web/vercel.json#L1-L4)).
3. **`docs/guides/INFRASTRUCTURE_SETUP.md`** — fill in §2–§4 with the real project-creation steps and
   extend §4 with the branch → URL mapping (`main` → `airrow.app`, `develop` → `dev.airrow.app`,
   everything else → throwaway preview).
4. **`docs/architecture/BRANCHING.md`** — link that mapping so the branch model and the deploy targets
   are each described in exactly one place (constitution §IV).
5. **`specs/9-vercel-supabase-setup.md`** — check off or delegate its Vercel criteria to this spec and
   set its Status accordingly.
6. **`specs/README.md`** — add this spec to the status table. *(done)*

**No change needed:** application code — nothing in `apps/web/src` reads a public site URL, and auth
(spec 18) is email + password with no redirect allow-list to update.

---

## Data model

**No schema changes.** — This spec touches deploy configuration and documentation only.

---

## Security

This exposes a second public entry point (`dev.airrow.app`) serving the `develop` build, which points
at the same Supabase project as production — so dev is publicly readable and must not be treated as a
safe place for test data. All credentials stay in Vercel env vars per environment; nothing
environment-specific enters the repo, the client bundle, or build logs.

**Deviation (2026-07-26):** while getting the first real Vercel deploy working, Vercel flagged
`next@15.1.6` as vulnerable. `pnpm audit` confirmed four CVEs, including a **critical** middleware
authorization bypass ([GHSA-f82v-jwr5-mffw](https://github.com/advisories/GHSA-f82v-jwr5-mffw),
fixed in `>=15.2.3`) — directly relevant since `apps/web/src/middleware.ts` gates auth. Bumped
`next` to `15.5.22` (`apps/web/package.json`), which clears all four advisories. Out of this spec's
original "no application-code changes" scope, but blocking and security-relevant, so fixed here
rather than opening a separate issue. Constitution §VI: "high-severity dependency advisories block a
release" — this was one.

Also found while verifying the fix: `pnpm build` intermittently crashed prerendering `/` with a
masked Server Components error. Root cause: `getSession()` makes a live Supabase network call
during Next's build-time static-generation probe for every page, even ones that end up dynamic —
a transient network hiccup there fails the whole build. Added
`export const dynamic = "force-dynamic"` to `apps/web/src/app/page.tsx`: no runtime behavior change
(the route was already rendered dynamically via `cookies()` usage), it just skips that redundant
network-dependent probe. `pnpm build` ran clean twice after.

---

## Edge cases

- DNS propagation delay after attaching the domain → verify with Vercel's domain status check before
  declaring production done; don't retry-loop the deploy.
- The domain is already claimed by another Vercel project/team → must be released before it can be
  attached.
- Preview env vars missing on a fresh environment → the deploy should fail loudly rather than serve a
  half-configured build.
- A push to `develop` while a `feature/**` preview is building → previews are independent
  deployments; only `develop` may hold the `dev.airrow.app` alias.

---

## Out of scope

- **A separate private/secret test URL.** Considered and dropped — `dev.airrow.app` covers testing,
  and a third URL only adds surface. Revisit if we ever need to share a build with someone who
  shouldn't see dev.
- Supabase provisioning, schema and RLS — specs 9 and 14.
- Auth flows — spec 18.
- Separate Supabase projects per environment so dev never touches production data — a real gap
  (see _Security_), but a follow-up issue.
- Custom monitoring, analytics or alerting on the deployments.
