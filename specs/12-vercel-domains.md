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

- [x] **[manual]** A Vercel project exists, connected to this GitHub repo with Root Directory
      `apps/web`, and a build succeeds. Verified via `vercel project inspect airrow` + `vercel ls`
      (project `lwstr/airrow`, Root Directory `apps/web`, latest Production build Ready).
- [x] **[manual]** Production Branch is set to `main` in Vercel Git settings. Verified: latest
      Production deployment carries the alias `airrow-git-main-lwstr.vercel.app`.
- [ ] **[manual]** `airrow.app` and `www.airrow.app` are attached to the project; `www` redirects to
      the apex. **Blocked** — the domain was bought under a Vercel team that was later deleted;
      it no longer appears under any team/personal scope reachable by this account (confirmed via
      `vercel domains ls` under the only remaining team, `lwstr`, and via `vercel teams switch`).
      Requires a Vercel Support ticket to reattach; not fixable from code or CLI.
- [ ] **[manual]** HTTPS certificate is issued and `https://airrow.app` resolves with no redirect loop.
      Blocked on the same domain-recovery ticket above.
- [ ] **[manual]** `dev.airrow.app` is added as a branch domain bound to `develop`. Blocked on the
      same ticket — it's a subdomain of the same orphaned zone.
- [ ] Pushing to `main` updates `https://airrow.app` — and nothing else does. Can't verify until the
      domain is reattached.
- [ ] Pushing to `develop` updates `https://dev.airrow.app` at the same, unchanged hostname every time.
      Can't verify until the domain is reattached.
- [x] `feature/**` and issue branches produce throwaway preview URLs only — never the dev or
      production hostname. Verified via `vercel ls` (Preview-target deployments present, each a
      distinct `*.vercel.app` URL).
- [x] **[code]** `dev.airrow.app` and preview deployments return `X-Robots-Tag: noindex`. Preview
      (`*.vercel.app`) URLs get this natively from Vercel; `dev.airrow.app` gets it explicitly via
      `apps/web/vercel.json` since it's a custom branch domain. Config verified present; end-to-end
      `curl` check still pending the domain reattachment above.
- [x] **[manual]** Required environment variables are set per Vercel environment (Production +
      Preview): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      `SUPABASE_SERVICE_ROLE_KEY` — verified via `vercel env ls`. Claude API key and GitHub App
      credentials are **optional** integrations (`apps/web/.env.example`), not required for the base
      deploy — the original criterion's wording overstated this; corrected here.
- [x] No secrets appear in the repo, the client bundle, or CI logs. Verified: `git log --all` for
      `.env.local` returns nothing (never committed), `vercel env ls` only ever shows values as
      `Encrypted`, and no secret strings were echoed in any command output this session.
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

**Run 2026-07-26 (third pass — the three deviations above):**
- **New tests** — `apps/web/src/features/projects/DeleteProjectDialog.test.tsx`: opens a confirmation
  dialog rather than deleting immediately, cancels without calling the action, and calls the delete
  action with the right `projectId` once confirmed (3/3 green).
- The `postcss`/`sharp` override and the preview-route fix have **no** Vitest-level regression test:
  both are runtime/packaging behaviors that only manifest in a real deployment, which Vitest does
  not exercise. The lesson from the failed first attempt is recorded above — a local `node` repro is
  *not* valid evidence here, because local Node supports `require(esm)` and Vercel's runtime does
  not. Verified instead by:
  - `pnpm audit --prod --audit-level=high` → 0 high/critical (was 1).
  - Build-artifact inspection: `.next/server/app/app/projects/[id]/preview/page.js` contains no
    `exodus` string, and its `.nft.json` traces **zero** `jsdom` / `html-encoding-sniffer` /
    `exodus` files (the previous, still-broken build traced 637 jsdom files). The module that threw
    `ERR_REQUIRE_ESM` is no longer shipped at all, so it cannot be required.
  - A real `vercel deploy --force` of the fix: the route returns 302 (redirect to login for an
    unauthenticated request) with **zero** entries in the deployment's error log, where the same
    request previously logged the 500.
  - **Not** verified end-to-end while authenticated — that check is the founder's, since it needs a
    real session against a project with a generated artifact.
- `pnpm -r typecheck` ✓ · `pnpm -r lint` ✓ (no new issues) · `pnpm -r test` ✓ (78 total, 63 passed +
  15 skipped without local Supabase, 0 failed) · `pnpm build` ✓ clean.

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

**Deviation (2026-07-26, second pass):** three more issues surfaced testing the real Vercel
deployment (`https://airrow-one.vercel.app`), reported by the founder:

1. **`pnpm audit --prod` regressed to a new high-severity advisory** after the Next.js bump —
   `next@15.5.22` bundles `postcss@8.4.31` (path-traversal, GHSA-r28c-9q8g-f849) and
   `sharp@0.34.5` (inherited libvips CVEs, GHSA-f88m-g3jw-g9cj), both internal to Next, not our
   own deps. Fixed with `pnpm.overrides` in the root `package.json` pinning
   `postcss >= 8.5.18` and `sharp >= 0.35.0` — safe because `apps/web` already resolves
   `postcss@8.5.22` elsewhere (tailwindcss/vite). `pnpm audit --prod --audit-level=high` is clean
   (0 high/critical) after.
2. **"Browse your foundation" 500'd on every existing project** — same root cause as the reported
   "generation crashes" (Vercel logs show only this one error across the whole session; the
   generation pipeline itself never errors). `ERR_REQUIRE_ESM`: `require() of ES Module
   .../@exodus/bytes/encoding-lite.js` from `html-encoding-sniffer`, a transitive dep of `jsdom`
   pulled in by `isomorphic-dompurify` (used server-side in
   `apps/web/src/features/preview/highlight.ts` to sanitize syntax-highlighted code).

   **First attempt was wrong and shipped broken.** Adding
   `serverExternalPackages: ["isomorphic-dompurify", "jsdom"]` was based on a local repro
   (`node -e "require('isomorphic-dompurify')"`) that *passed* — but only because the local Node
   is v25, which supports `require(esm)`. Vercel's serverless runtime does not, so externalizing
   the package changed nothing: the CJS→ESM boundary still had to be crossed at runtime. The
   deployed `develop` build failed identically.

   **Actual fix:** drop the server-side DOM entirely. `highlight.ts` now returns shiki's markup
   unsanitized and `PreviewBrowser.tsx` sanitizes it with plain `dompurify` immediately before
   injection — exactly the pattern the rendered-markdown path in the same component already used
   (`marked` parses, `DOMPurify.sanitize` runs client-side). Sanitization still happens at the
   point of injection, satisfying constitution §III; it just no longer needs jsdom on the server.
   `isomorphic-dompurify` is removed from `apps/web` dependencies, which removes `jsdom` from the
   production tree altogether (it stays a devDependency for Vitest's test environment, which never
   ships to the serverless runtime). `serverExternalPackages` reverted — no longer needed.
3. **No confirmation before deleting a project** — `apps/web/src/app/app/projects/[id]/page.tsx`
   submitted `deleteProjectAction` straight from a bare button, no undo. Added
   `apps/web/src/features/projects/DeleteProjectDialog.tsx`, a client component wrapping the
   existing `Dialog` primitive (constitution §III: reuse before create) around the same server
   action.

All three are outside this spec's original scope (Vercel domain config only), but were blocking/
breaking the app the founder was testing through this spec's Vercel setup, so fixed here rather
than opening separate issues — same rationale as the Next.js CVE deviation above.

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
