# Spec 33 — Advisories som blockerar, och secret scanning påslaget

> **In one sentence:** Konstitutionens två säkerhetskrav — att high-severity advisories blockerar en
> release och att secrets aldrig hamnar i kod — får äntligen en mekanism, inte bara en mening.

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Status**     | ✅ Done                                                                                 |
| **Issue**      | #33 — "Enforce dependency advisories and enable secret scanning"                         |
| **Branch**     | `33-security-scanning` (from `feature/ci-cd`)                                            |
| **Feature**    | CI/CD                                                                                    |
| **Depends on** | [`14-pr-ci-checks.md`](14-pr-ci-checks.md) (`verify`-jobbet + required checks), [`13-push-protection.md`](13-push-protection.md) (`setup-branch-protection.sh`, mönstret för repo-inställningar via skript) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
[NEEDS CLARIFICATION: …] markers are resolved by /clarify.
-->

---

## User story

_Who wants this, and what they get out of it._

As a **utvecklare i airrow-teamet** I want **att en känd sårbarhet eller en läckt nyckel stoppar mig
automatiskt** so that **konstitutionens säkerhetskrav gäller i praktiken och inte bara på pappret —
och så att jag inte behöver komma ihåg att titta i Security-fliken.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today** (verifierat via `gh api repos/MS-Flow/airrow` 2026-07-26):

  | Inställning | Läge |
  | ----------- | ---- |
  | Dependabot alerts | ✅ på |
  | Dependabot security updates (auto-PRs) | av — medvetet, se nedan |
  | Secret scanning | av |
  | Secret scanning push protection | av |

- **The problem:** två krav utan mekanism.
  1. Konstitutionen §VI: *"high-severity dependency advisories block a release"*. Alerts finns, men
     inget CI-steg och ingen utpekad rutin gör att en advisory faktiskt stoppar något.
  2. Konstitutionen §Security: secrets får aldrig hamna i kod, loggar eller genererad output. Inget
     skannar för det.
- **Already in place:**
  - `verify`-jobbet i [.github/workflows/ci.yml](.github/workflows/ci.yml) är required på
    `main`/`develop` sedan spec 14 — den naturliga platsen för en blockerande check.
  - [scripts/setup-branch-protection.sh](scripts/setup-branch-protection.sh) är ett etablerat mönster
    för repo-inställningar som sätts idempotent av en admin.
  - Historiken är ren i dag: bara `apps/web/.env.example` är spårad, och `.env` / `.env.local` är
    gitignorerade.
- **Nytt sedan repot blev publikt** (`visibility: public`, 2026-07-26): secret scanning och push
  protection är gratis. På ett privat repo hade de krävt en betald plan.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

**Källan är `pnpm audit --prod`, inte Dependabot-alerts-API:t.** Det går emot issuens skrivna
kriterium, och skälet är mätt, inte antaget (se Background): Dependabot ser **0** advisories medan
`pnpm audit` ser 21 allvarliga. Dessutom kan `GITHUB_TOKEN` inte läsa Dependabot-alerts — Actions
`permissions` har ingen nyckel för det, och API:t kräver en fine-grained token med "Dependabot alerts
(read)". Att lägga ett PAT i Actions är uttryckligen förbjudet av
[setup-branch-protection.sh:22](scripts/setup-branch-protection.sh#L22) och konstitutionen §II.
`pnpm audit` behöver ingen token alls.

**Bara produktionsberoenden** (`--prod`). En sårbarhet i ESLint når aldrig en användare; gatet hålls
meningsfullt och bruset nere (14 high + 2 critical i stället för 17 + 4).

**Ett baseline-läge gör gatet införbart.** Dagens advisory-ID:n skrivs till en versionerad fil
(`.security/audit-baseline.json` e.d.). Checken failar bara på advisories som *inte* står där — så den
blockerar allt nytt från dag ett, medan den befintliga skulden blir explicit och granskningsbar i stället
för osynlig. Filen är samtidigt undantagsmekanismen: att acceptera en advisory är en rad i en diff som
någon godkänner, inte en avstängd check.

**Checken körs som ett steg i det befintliga `verify`-jobbet**, som redan är required på
`main`/`develop` sedan spec 14 — blockerande utan att rulesetet behöver ändras, och en kontext att hålla
i synk. Logiken skrivs inline i workflowen, samma mönster som repots övriga workflows — men med **Node
i stället för `jq`**: `jq` finns inte i utvecklingsmiljön på Windows, så en jq-lösning hade varit
omöjlig att verifiera lokalt, medan Node redan är garanterat av `setup-node`.
**Secret scanning och push protection sätts av ett nytt `scripts/setup-security-scanning.sh`** — inte
genom att utöka `setup-branch-protection.sh`, vars namn och header handlar om grenpolicy.

> ⚠️ **Avvikelse från §VI**, medveten och därför nedskriven: konstitutionen säger att high-severity
> advisories blockerar en release. Med baseline gör de 16 befintliga prod-advisories det **inte** — de
> är accepterad skuld. Gatet uppfyller kravet framåt, inte bakåt. Alternativet var att blockera specen
> på att åtgärda 21 advisories i transitiva beroenden, varav flera kanske saknar fix. Baseline-filen ska
> krympa över tid, och varje rad i den är en post som går att ifrågasätta i en review.

> ⚠️ **Avvikelse från §V:** ingen enhetstestning, av samma skäl som i
> [spec 16](16-pr-base-branch.md) — inline-bash i ett workflow har ingen Vitest-yta, och `scripts/`
> ligger utanför pnpm-workspacet. Växer baseline-jämförelsen bortom ett `jq`-uttryck ska den flyttas
> till ett testbart paket. Kriterierna bevisas i stället med namngivna manuella checkar under
> Verification.

**Varför inte Dependabot auto-PRs:** deras grenar heter `dependabot/...` och riktas mot default-grenen
(`develop`). [branch-policy.yml](.github/workflows/branch-policy.yml) tillåter bara `feature/*` in i
`develop`, och `validate-source-branch` är required där — varje Dependabot-PR blir därför röd och
omöjlig att merga. Varningar-bara är ett medvetet val, inte en glömska.

**Not touched:** grenpolicyn och de befintliga rulesetsen. Den här specen lägger till skydd, den
ändrar inte merge-riktning eller push-skydd.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] Ett steg i `verify` failar när `pnpm audit --prod` rapporterar en advisory med severity **high**
      eller allvarligare som inte finns i baseline-filen.
- [x] Baseline-filen är versionerad och innehåller dagens 16 prod-advisories med severity high+.
- [x] En *ny* high-severity advisory gör checken röd — bevisat, inte antaget.
- [x] Dev-beroenden räknas inte (`--prod`), och det är dokumenterat varför.
- [x] Baseline-rader som inte längre matchar någon advisory ger en varning, men failar inte.
- [x] Secret scanning är påslaget på repot.
- [x] Push protection är påslaget, så en nyckel blockeras vid push och inte först vid granskning.
- [x] Rutinen är dokumenterad: vem tittar var, hur baseline-filen krymps, och vad som gäller när en
      advisory inte går att åtgärda direkt.
- [x] Ett medvetet undantag är en rad i baseline-filen — granskningsbar i en diff, **aldrig** en
      avstängd check.
- [x] Inställningarna sätts idempotent av `scripts/setup-security-scanning.sh` — bevisat med två
      körningar i rad med identiskt utfall.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

**Inga enhetstester** — se §V-avvikelsen under Design decision. Varje kriterium bevisas med en namngiven
manuell check:

- **Positivt fall** → med baseline på plats ska steget bli grönt trots de 16 befintliga advisories.
- **Negativt fall** → ta bort en rad ur baseline-filen (eller injicera ett påhittat ID) och kör steget:
  det ska bli rött och namnge exakt den advisoryn. Utan detta är checken oskiljbar från en som alltid
  passerar.
- **Dev-avgränsningen** → `pnpm audit` utan `--prod` ger fler träffar än med; skillnaden ska inte
  påverka utfallet.
- **Secret scanning + push protection** → `gh api repos/MS-Flow/airrow --jq .security_and_analysis` ska
  visa `enabled` för `secret_scanning` och `secret_scanning_push_protection` (båda står som `disabled`
  i dag).
- **Överflödig baseline-rad** → lägg in ett påhittat ID i baseline och kör: en `::warning::` ska synas,
  men steget ska vara **grönt**. Det skiljer varningen från en blockering.
- **Idempotens** → kör `setup-security-scanning.sh` två gånger; andra körningen ska inte ändra något.
- Full suite result + typecheck/lint status (oförändrade — ingen produktkod rörs).

### Implementation notes

Verifierat lokalt 2026-07-26 på `33-security-scanning`:

| Kontroll | Resultat |
| -------- | -------- |
| YAML + `bash -n` på audit-steget | ✅ |
| **Positivt fall** — baseline på plats | ✅ grönt, exit 0, "16 accepterade i baseline" |
| **Negativt fall** — `GHSA-9qr9-h5gf-34mp` borttagen ur baseline | ✅ **rött**, exit 1, namngav exakt den advisoryn |
| **Överflödig rad** — påhittat `GHSA-fake-0000-0000` | ✅ `::warning::` **och grönt**, exit 0 |
| `bash -n` på `setup-security-scanning.sh` | ✅ |
| `pnpm -r typecheck` / `lint` | ✅ rent |
| `pnpm -r test` | ✅ 87 gröna, 15 skippade, 0 fel |

- **Baseline genererades ur verkligt utfall**, inte kopierad ur specen: 16 unika `github_advisory_id`
  med severity high/critical i produktionsberoenden. `github_advisory_id` (GHSA) valdes som nyckel
  framför pnpms numeriska `id`, som inte är stabil över registeruppdateringar.
- **12 av 16 rader är `next`.** En enda Next.js-uppgradering skulle krympa baseline till fyra rader.
  Ligger utanför den här specen, men det är den mest värdefulla uppföljningen.
- **`audit.json` gitignorerad.** Steget skriver den i repo-roten, så den dyker upp för alla som kör
  steget lokalt. Upptäcktes genom att den låg som otrackad fil efter första provkörningen.
- **Skippade tester ökade från 3 till 15** eftersom lokal Supabase inte kördes vid den här mätningen.
  Inga fel, men färre tester faktiskt exekverade — precis den §V-avvikelse spec 14 skrev ned, synlig i
  praktiken.
- **Node i stället för `jq`** i workflowen; skälet står under Design decision.

**Repo-inställningarna applicerade 2026-07-26** av en admin, efter `/analyze`:

| Kontroll | Resultat |
| -------- | -------- |
| `secret_scanning` | `disabled` → **`enabled`** |
| `secret_scanning_push_protection` | `disabled` → **`enabled`** |
| Idempotens | ✅ två körningar i rad, identiskt utfall |
| Oberoende verifiering | ✅ `gh api repos/MS-Flow/airrow --jq .security_and_analysis` |
| Secret scanning-alerts på befintlig historik | **0** — historiken var ren även enligt GitHubs scanning |

`dependabot_security_updates` står kvar som `disabled` — avsiktligt, se Design decision.

**Kvarstående avvikelser vid stängning:**
- §VI: de 16 baseline-advisories blockerar inte en release. Gatet gäller framåt, inte bakåt.
- §V: inga enhetstester; kriterierna bevisades med namngivna manuella checkar, inklusive ett negativt
  fall.

**Rekommenderad uppföljning:** uppgradera Next.js. Tolv av sexton baseline-rader är `next`, så en
uppgradering krymper filen till fyra och tar bort båda kritiska posterna.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

1. **[.github/workflows/ci.yml](.github/workflows/ci.yml)** — nytt `Audit`-steg i `verify`-jobbet efter
   `Build`: `pnpm audit --prod --json`, jämför mot baseline med `jq`, faila på nya high+.
2. **`.security/audit-baseline.json`** (ny) — dagens accepterade advisory-ID:n, en post per advisory med
   severity och en kort motivering.
3. **`scripts/setup-security-scanning.sh`** (ny) — slår på `secret_scanning` och
   `secret_scanning_push_protection` idempotent via `gh api -X PATCH`, med samma header-mönster och
   admin-varning som [setup-branch-protection.sh](scripts/setup-branch-protection.sh).
4. **`docs/guides/SECURITY.md`** (ny) — rutinen: vem tittar var, hur baseline krymps, vad som gäller vid
   en advisory utan fix, och vad man gör när push protection blockerar en falsk positiv. Egen guide
   eftersom [BRANCHING.md](docs/architecture/BRANCHING.md) redan är 121 rader om grenar.
5. **[docs/architecture/BRANCHING.md](docs/architecture/BRANCHING.md)** — en rad i required-checks-tabellen
   för audit-steget, med länk till SECURITY.md. Enligt §IV bor en fakta på ett ställe; tabellen pekar,
   guiden förklarar.
6. **[specs/README.md](specs/README.md)** — statusraden för den här specen.

**No change needed:** Dependabot alerts — redan påslaget, ingen `dependabot.yml` behövs för
varningar-bara.

---

## Data model

**No schema changes.**

---

## Security

Hela specen är säkerhetsarbete: den lägger till två spärrar och tar inte bort någon. Det som ändras är
repo-inställningar (secret scanning, push protection) och en CI-check som läser advisories — inga nya
secrets, ingen ny extern åtkomst. Skriptet som sätter inställningarna kräver admin-rättigheter och körs
lokalt av en admin, aldrig med ett PAT i Actions (samma regel som
[setup-branch-protection.sh](scripts/setup-branch-protection.sh)).

---

## Edge cases

_Unusual inputs or states, and what should happen._

- **Advisory utan tillgänglig fix** → läggs i baseline-filen med en kommentar om varför. Det är
  undantagsvägen, och den är granskningsbar.
- **Advisory bara i en devDependency** → blockerar inte (`--prod`). Medvetet: den når aldrig en
  användare. Risken som kvarstår är att dev-verktyg kör i CI med tillgång till repot — accepterad här,
  och skälet står i Design decision.
- **Fork-PR** → `pnpm audit` behöver ingen token, så checken fungerar även där `GITHUB_TOKEN` är
  skrivskyddat. Det var en av fördelarna med att välja bort Dependabot-API:t.
- **Baseline-filen blir inaktuell** när ett beroende uppgraderas och advisoryn försvinner → checken
  skriver de överflödiga ID:na som `::warning::` i jobbsammanfattningen men **failar inte**. Att låta en
  lyckad uppgradering göra bygget rött vore bakvänt — det skulle straffa precis det beteende vi vill ha.
  Filen krymper när någon röjer, och varningen gör synligt vad som går att ta bort.
- **Push protection blockerar en falsk positiv** → utvecklaren behöver en dokumenterad väg framåt.
- **Alerts hinner inte uppdateras** innan en PR öppnas → checken kan vara grön för en sårbarhet som
  upptäcks minuter senare. Blockeringen är ett nät, inte en garanti.

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- **Dependabot auto-PRs** — blockeras av grenpolicyn; egen issue om de ska öppnas.
- Åtgärdande av enskilda befintliga advisories.
- Secret scanning för custom patterns.
- Övriga luckor i CI/CD som hittades samtidigt (migrationer i CI, RLS-tester i CI, produktionsdeploy) —
  egna issues.
