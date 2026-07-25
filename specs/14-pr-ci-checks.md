# Spec 14 — Blockerande CI-checkar på PR mot `develop`

> **In one sentence:** Varje PR mot `develop` måste passera typecheck, lint, test **och** en riktig
> `pnpm build` plus ett smoke-test som renderar sidan — annars går den inte att merga.

|                |                                                                                    |
| -------------- | ---------------------------------------------------------------------------------- |
| **Status**     | ✅ Done                                                                            |
| **Issue**      | #14 — "Make tests to check new PRs into develope so that the page wont crash"       |
| **Branch**     | `14-pr-ci-checks` (from `feature/ci-cd`)                                            |
| **Feature**    | CI/CD                                                                              |
| **Depends on** | [`13-push-protection.md`](13-push-protection.md) (rulesets + `scripts/setup-branch-protection.sh`), [`29-branch-policy.md`](29-branch-policy.md) (required check-mönstret) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
[NEEDS CLARIFICATION: …] markers are resolved by /clarify.
Obs: `specs/14-supabase-schema-auth.md` refererar också "#14" — det är en inaktuell
issue-referens från en tidigare numrering, inte den här issuen. Rättas separat.
-->

---

## User story

_Who wants this, and what they get out of it._

As a **utvecklare i airrow-teamet** I want **att en PR mot `develop` automatiskt verifieras och
blockeras om bygget eller sidan kraschar** so that **den delade `develop`-grenen alltid går att köra
och ingen blir blockerad av någon annans trasiga merge.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today:** [.github/workflows/ci.yml](.github/workflows/ci.yml) kör `pnpm -r typecheck`, `pnpm -r lint`
  och `pnpm -r test` på `push` och `pull_request` (alla grenar). Jobbet heter `verify`.
- **The problem:** Ingen `pnpm build` körs — ett byggfel (t.ex. en trasig RSC/server-import) upptäcks
  först vid deploy. Det finns heller inget test som faktiskt renderar en sida, och **inget** CI-jobb är
  satt som required check, så en röd CI blockerar inte merge idag.
- **Already in place:**
  - Rulesets sätts via [scripts/setup-branch-protection.sh](scripts/setup-branch-protection.sh) —
    `branch-policy-required-check` listar idag bara kontexten `validate-source-branch`
    ([:31](scripts/setup-branch-protection.sh#L31), [:69](scripts/setup-branch-protection.sh#L69)).
  - `branch-push-protection` kräver redan PR + 1 godkännande mot `main`/`develop`.
  - Vitest är uppsatt per paket; `apps/web` har jsdom för `*.test.tsx`
    ([apps/web/vitest.config.ts:14](apps/web/vitest.config.ts#L14)) och komponenttester finns redan
    (t.ex. [apps/web/src/components/ui/button.test.tsx](apps/web/src/components/ui/button.test.tsx)).
  - [.github/workflows/deploy-dev.yml](.github/workflows/deploy-dev.yml) visar pnpm/Node-setupmönstret
    som CI ska följa.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

Utöka det **befintliga `verify`-jobbet** i `ci.yml` med ett `pnpm build`-steg — ett jobb, en install,
**en** required status check att hålla i synk med rulesetet (konstitutionen §I "simple over clever").
Inget nytt parallellt workflow. Smoke-testet skrivs som ett **Vitest render-test i jsdom**, inte
Playwright: det återanvänder befintlig testsetup, kräver ingen ny toolchain eller browsers i CI, och
fångar renderkrascher. Sedan läggs CI-jobbets kontext till som required status check i
`branch-policy-required-check`-rulesetet i `scripts/setup-branch-protection.sh`, så att röd CI faktiskt
blockerar merge till `develop` och `main`.

**Medveten begränsning:** ett jsdom-render-test fångar inte runtime-fel som bara uppstår i RSC-/server-
miljön — den täckningen kommer från `pnpm build` plus en framtida Playwright-svit (se Out of scope).

**Not touched:** `deploy-dev.yml` (deploy-pipeline ligger utanför scope), `branch-policy.yml` och
`branch-push-protection`-rulesetet.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] En GitHub Actions-workflow triggas på `pull_request` mot `develop`.
- [x] Workflowen kör `pnpm -r typecheck`, `pnpm -r lint` och `pnpm -r test`.
- [x] Workflowen kör `pnpm build` och misslyckas om bygget kraschar.
- [x] Smoke-test finns som renderar de publika sidorna — `/`, `/login`, `/signup` — och verifierar att
      de monterar utan att kasta.
- [x] Om något steg misslyckas kan PR:en inte mergas — checken är required på `develop`.
- [x] `scripts/setup-branch-protection.sh` listar CI-kontexten som required, och skriptet är fortfarande
      idempotent att köra om.
- [x] `docs/architecture/BRANCHING.md` beskriver vilka checkar som är obligatoriska på `develop`/`main`.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — `apps/web/src/app/smoke.test.tsx` (eller co-lokaliserat per route): renderar
  [`/`](apps/web/src/app/page.tsx), [`/login`](apps/web/src/app/login/page.tsx) och
  [`/signup`](apps/web/src/app/signup/page.tsx) i jsdom och assertar att de monterar utan att kasta.
  Valt just dessa för att de renderar utan inloggning och utan datafixtures. Filändelsen `.tsx` gör att
  jsdom-miljön väljs automatiskt ([apps/web/vitest.config.ts:14](apps/web/vitest.config.ts#L14)).
- Workflow-kriterierna → verifieras på den här PR:ens egen Actions-körning (alla steg gröna).
- **Negativ verifiering** → gjord lokalt som ett engångsexperiment, inte som scratch-PR: ett
  `throw` lades tillfälligt in i `Landing()` och smoke-testet gick rött (2 av 6 fall) på exakt den
  raden; ändringen revertades direkt. Testet är alltså inte tomt.
- Required-check-kriteriet → **applicerat 2026-07-25**. `gh api repos/MS-Flow/airrow/rulesets/19735515`
  returnerar `enforcement: active` med
  `required_status_checks: [{"context":"validate-source-branch"},{"context":"verify"}]`.
  Idempotensen är bevisad genom att köra skriptet två gånger i rad — antalet rulesets förblev 2.
- Full suite result + typecheck/lint status.

### Implementation notes

Verifierat lokalt 2026-07-25 på `14-pr-ci-checks` (efter merge av senaste `develop`):

| Steg                          | Resultat                                                          |
| ----------------------------- | ----------------------------------------------------------------- |
| `pnpm -r typecheck`           | ✅ rent — engine, schemas, web                                     |
| `pnpm -r lint`                | ✅ rent — inga nya issues                                          |
| `pnpm -r test`                | ✅ 99 gröna (36 engine + 63 web), 3 skippade                       |
| `pnpm build`                  | ✅ 17 routes byggda utan env-variabler                             |
| Negativ kontroll (temp crash) | ✅ smoke-testet blev rött, revertades                              |
| Ruleset applicerat            | ✅ `branch-policy-required-check` (id 19735515) kräver nu `verify` |

- **Inga pre-existing failures.** De 3 skippade ligger i `auth.trigger.test.ts` (kräver Supabase Auth-
  tjänsten). RLS-sviterna kördes och passerade lokalt eftersom `supabase start` var igång — i CI skippas
  de, vilket är den flaggade avvikelsen under Edge cases.
- **Triggern lämnades avsiktligt ofiltrerad.** `pull_request:` utan `branches:`-filter täcker redan PR
  mot `develop`; att lägga till ett filter skulle *minska* täckningen och släppa igenom
  `<nr>-kort` → `feature/**`. Ett förtydligande kommentarsblock ersätter filtret.
- **Kontextnamnet är `verify`** — jobb-id:t i `ci.yml`. Till skillnad från `validate-source-branch` körs
  jobbet även på `push`, så det kan krävas på `develop`/`main` utan att låsa ref-uppdateringar (samma
  fälla som redan är dokumenterad i skriptets header).
- **`specs/README.md` hade dubbletter** efter auto-mergen av `develop` (samma specar listade med två
  olika statusar). Deduplicerat i samma ändring; develop-sidans ✅-statusar behölls.
- Byggsteget bekräftar Security-notisen: `next build` går igenom helt utan Supabase-nycklar.
- **Fynd i `/analyze`, åtgärdat:** smoke-testets hoistade session använde ett `as`-cast utan motiverande
  kommentar (konstitutionen §I). Ersatt med en `FakeSession`-typ och en returtyp på `vi.hoisted`-fabriken
  — ingen cast kvar. Typecheck, lint och hela sviten kördes om efteråt, allt grönt.

**Kvarstående avvikelse vid stängning:** den flaggade §V-avvikelsen under Edge cases (RLS-sviten skippas
i CI) är medveten och har en egen follow-up. Den gröna `verify`-checken bevisar bygg och rendering —
inte dataisolering.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

1. **[.github/workflows/ci.yml](.github/workflows/ci.yml)** — lägg till ett `pnpm build`-steg i det
   befintliga `verify`-jobbet efter `Test` ([:29](.github/workflows/ci.yml#L29)); inget nytt jobb.
   Se över triggern så att PR mot `develop` täcks explicit.
2. **`apps/web/src/app/smoke.test.tsx`** — nytt render-test för `/`, `/login`, `/signup` (jsdom väljs
   automatiskt via `*.test.tsx`, [vitest.config.ts:14](apps/web/vitest.config.ts#L14)).
3. **[scripts/setup-branch-protection.sh](scripts/setup-branch-protection.sh)** — lägg CI-jobbets
   kontext bredvid `validate-source-branch` i `required_status_checks`
   ([:69](scripts/setup-branch-protection.sh#L69)).
4. **[docs/architecture/BRANCHING.md](docs/architecture/BRANCHING.md)** — dokumentera de obligatoriska
   checkarna (konstitutionen §IV: AI-kontext uppdateras i samma ändring).
5. **[specs/README.md](specs/README.md)** — lägg till raden för den här specen i statusöversikten.

**No change needed:** `branch-policy.yml` — merge-riktning hanteras redan där.

---

## Data model

**No schema changes.**

---

## Security

Ändringen exponerar inget nytt: workflowen kör bara på repots egen kod med default `GITHUB_TOKEN`.
**Inga secrets behövs** — appen är byggd för att köra fullt ut i lokalt läge utan env-variabler
([apps/web/.env.example:1](apps/web/.env.example#L1)), så `pnpm build` klarar sig utan Supabase-nycklar.
Skulle ett byggsteg någon gång kräva en nyckel ska den komma från GitHub Secrets och aldrig ekas i loggen.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- **PR från en fork** — kan inte inträffa idag: repot är privat med `allow_forking: false` (0 forks),
  verifierat via `gh api repos/MS-Flow/airrow`. Skulle forkar öppnas senare är bygget ändå oberoende av
  secrets, så checken fungerar — men `pull_request_target` får aldrig införas utan att secrets-exponering
  omprövas.
- **Integrationstester som kräver lokal Supabase** (`*.rls.test.ts`, `store.cutover.test.ts`) — de
  skippas tyst när databasen är onåbar ([schema.rls.test.ts:33](apps/web/src/lib/data/schema.rls.test.ts#L33)),
  så checken blir grön utan att RLS testats. **Beslut: skip-beteendet accepteras i den här specen** och
  Supabase-i-CI bryts ut till en egen issue.

  > ⚠️ **Avvikelse från konstitutionen §V**, medvetet fattad och därför nedskriven här: "Failing or
  > skipped tests never merge" och kravet att *varje* tabells RLS testas (access **och** denial).
  > Efter den här specen är CI grön trots att RLS-sviten inte körts — den blockerande checken bevisar
  > alltså bygg + rendering, inte dataisolering. Avvikelsen upphör när Supabase-i-CI-issuen är gjord;
  > tills dess måste RLS-sviten köras lokalt mot `supabase start` innan en dataändring mergas.
- **Redan öppna PRs** när rulesetet uppdateras — behöver en ny push/rerun för att få checken.
- **Kända pre-existing failures** — inga. Hela sviten är grön (99 tester); de enda skippade är de 3 i
  `auth.trigger.test.ts`, som kräver Supabase Auth-tjänsten och faller under samma avvikelse som ovan.

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- Deploy-pipeline och tester mot produktion (`deploy-dev.yml` rörs inte).
- E2E-tester för enskilda features — bryts ut till egna issues.
- **Supabase/Postgres-service i CI** så integrationstesterna faktiskt körs — egen issue, se den
  flaggade avvikelsen under Edge cases.
- **Playwright** för det kritiska flödet (signup → interview → generate → preview → deliver) —
  konstitutionen §V kräver det på sikt, men inte i den här specen.
- Ändringar i `branch-push-protection`-rulesetet (PR-krav + force-push-skydd är redan klart i spec 13).
