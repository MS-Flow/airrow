# Spec 16 — Rätt base-gren automatiskt när en PR skapas

> **In one sentence:** En PR från en issue-gren ska föreslå sin egen `feature/<name>` som base,
> i stället för `main` — så att grenhierarkin blir det enkla valet, inte något man måste minnas.

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Status**     | 🔄 In progress                                                                          |
| **Issue**      | #16 — "Auto-set PR base branch according to branch hierarchy (issue → feature → develop → main)" |
| **Branch**     | `16-pr-base-branch` (from `feature/ci-cd`), följdfix i `16-pr-base-feature` (from `feature/ci-cd`) |
| **Feature**    | CI/CD                                                                                    |
| **Depends on** | [`29-branch-policy.md`](29-branch-policy.md) (validate-source-branch), [`14-pr-ci-checks.md`](14-pr-ci-checks.md) (required checks på `develop`/`main`) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
[NEEDS CLARIFICATION: …] markers are resolved by /clarify.
-->

---

## User story

_Who wants this, and what they get out of it._

As a **utvecklare som just blivit klar med en issue** I want **att PR:en föreslår rätt
`feature/<name>` som base direkt** so that **jag inte behöver komma ihåg att byta base varje gång —
och inte råkar öppna en PR som bryter mot grenhierarkin.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today:** repots default-gren är `main` (`gh repo view --json defaultBranchRef` → `main`). Både
  GitHub-UI:t och `gh pr create` utan `--base` utgår från default-grenen, alltså `main` — precis det
  issuen beskriver.
- **The problem:** rätt riktning är helt manuell vid själva skapandet. Missas den öppnas PR:en mot
  `main`, tvärtemot hierarkin i [`docs/architecture/BRANCHING.md`](docs/architecture/BRANCHING.md).
- **Already in place — men först *efteråt*:**
  - [`.github/workflows/branch-policy.yml`](.github/workflows/branch-policy.yml) kör
    `validate-source-branch` på varje PR och failar vid fel riktning.
  - Sedan spec 14 är både `validate-source-branch` och `verify` **required** på `main`/`develop`, så en
    felriktad PR går inte att merga.
  - [`.claude/commands/pr-check.md`](.claude/commands/pr-check.md) härleder redan föräldern ur
    hierarkin och skriver ut ett färdigt `gh pr create --base <target> --head <branch>`.
  - Detta är alltså ett **ergonomi-problem, inte ett säkerhetshål**: fel riktning fångas redan, men
    först efter att PR:en öppnats. Spec 16 flyttar rättningen till skapandeögonblicket.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

En **GitHub Actions-workflow på `pull_request.opened`** rättar basen. Det är det enda alternativet som
täcker båda vägarna en PR kan skapas på — `gh` och GitHub-UI:t — och därmed det enda som faktiskt
uppfyller acceptanskriteriet. Skript och gh-alias valdes bort eftersom de bara hjälper den som råkar
använda dem, och `/pr-check` skriver redan ut rätt `--base`.

Hela hierarkin täcks **av workflowen**, inte av repo-inställningar:

| Head-gren        | Base          | Hur                                                    |
| ---------------- | ------------- | ------------------------------------------------------ |
| `feature/<name>` | `develop`     | fast värde — aldrig direkt till `main`                 |
| `<nr>-kort`      | dess `feature/<name>` | härledd ur specens Branch-rad                  |
| `develop`        | `main`        | fast värde — `develop` är enda grenen som får in i `main` |

Den första raden hanterades ursprungligen genom att repots default-gren sattes till `develop`. **Det var
fel**, och rättades i följdfixen — se Implementation notes.

**Parent härleds ur spec-headern.** Workflowen läser `specs/<nr>-*.md` och plockar
`` (from `feature/<name>`) `` ur Branch-raden. Alla 14 specar följer mönstret idag och det är versionerat
i repot, så härledningen blir en `grep` — ingen API-slagning, inget nätverk.

**Logiken skrivs som inline-bash i workflowen**, samma mönster som `branch-policy.yml` och
`close-issue-on-merge.yml`. Inget nytt paket: `scripts/` ligger utanför pnpm-workspacet och en egen
workspace-modul för en strängmatchning är mer ceremoni än värdet motiverar. Konsekvensen för
testbarheten är utskriven under Verification.

**Följdfix 2026-07-26 — `feature/*` täcktes inte (gren `16-pr-base-feature`).**

Rapporterat av användaren: en PR från `feature/infrastructure` fick `main` som base och rättades inte.
Bekräftat i körningen på PR #41:

```
HEAD: feature/infrastructure
'feature/infrastructure' är varken 'develop' eller en issue-gren — rör inte basen.
```

**Rotorsaken var ett designfel, inte en bugg i koden.** Att låta `feature/*` → `develop` vila på att
repots default-gren är `develop` fungerar inte: default-grenen styr bara vad PR-*formuläret* föreslår.
Väljer någon `main` aktivt i dropdownen finns ingen rättning. Dessutom är default-grenen tillbaka på
`main` (verifierat 2026-07-26) för att passa Vercel-produktionsdeployen — så antagandet gäller inte ens
längre. Vercels Production Branch är en Vercel-inställning och oberoende av GitHubs default, men att ha
`main` som default är ett rimligt val, och lösningen ska inte vara känslig för det.

**Åtgärd:** `feature/*` → `develop` är nu ett eget fall i workflowen. Alla tre grentyperna hanteras i
kod; ingen del av hierarkin vilar på en repo-inställning.

**Verifierat lokalt mot verkliga specfiler, med `main` som base i samtliga fall:**

| Head-gren                | Utfall                          |
| ------------------------ | ------------------------------- |
| `feature/infrastructure` | → `develop` ✅ (fallet som brast) |
| `feature/ci-cd`          | → `develop` ✅                   |
| `feature/ci-cd` (base redan `develop`) | no-op ✅           |
| `develop`                | base redan `main`, no-op ✅       |
| `33-security-scanning`   | → `feature/ci-cd` ✅             |
| `11-ui-design-flaws`     | → `feature/ui` ✅                |
| `hotfix-foo`             | rörs inte ✅                     |
| `999-nope`               | kommentar, base orörd ✅         |

Testet avslöjade dessutom att **den här fixens egen gren** (`16-pr-base-feature`) inte matchade någon
spec, eftersom härledningen kräver att grennamnet står i specens Branch-rad. Raden listar nu båda
grenarna — annars hade den här PR:en fått en "kunde inte härleda"-kommentar av sin egen fix.

**Efterjusteringar efter första skarpa användningen (2026-07-25).** Den ursprungliga leveransen
hanterade bara issue-grenar och missade därmed issuens kriterium att *icke*-issue-grenar ska ha sitt
korrekta default. Det syntes direkt: en `feature/ci-cd`-PR föreslogs mot `main`. Två tillägg:

1. **Repots default-gren är nu `develop`** (verifierad via `gh repo view --json defaultBranchRef`).
   Default-grenen är vad GitHub-UI:t föreslår, så det gör `feature/*` → `develop` rätt utan kod.
   Rulesetsen påverkas inte — de matchar `refs/heads/main` och `refs/heads/develop` vid namn, inte
   "default".
2. **Workflowen hanterar även `develop` → `main`.** Med default-grenen satt till `develop` fick
   release-PR:en inget vettigt förslag alls, eftersom head och base blev samma gren. Målet är entydigt
   (`develop` är enda grenen som får in i `main`) och kräver ingen härledning.

**Rättningen sker bara vid `opened`** — aldrig på `synchronize` eller `edited`. En base som ändras i
efterhand rörs alltså aldrig, och automatiken kan inte hamna i en dragkamp med en människa.

> **Konsekvens att vara medveten om:** vid `opened` sätts den härledda basen oavsett vad base står på.
> Öppnar någon medvetet en issue-gren mot en *annan* `feature/*`-gren än sin parent skrivs det valet
> över, tyst. I praktiken är effekten liten — det härledda värdet är samma som `/pr-check` redan
> föreslår — men undantaget måste göras genom att ändra base **efter** att PR:en öppnats.

**Not touched:** `branch-policy.yml` och rulesetsen — de fortsätter vara skyddsnätet. Den här specen
gör rätt väg till den bekväma vägen, den ändrar inte vad som är tillåtet.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [ ] En PR som skapas från en issue-gren (`<nr>-kort`) får automatiskt sin parent
      `feature/<name>` som base — oavsett om den skapades via `gh` eller GitHub-UI:t.
      **Bevisas först av den här specens egen PR** — workflowen finns inte på GitHub förrän den mergats.
- [x] Parent härleds ur `specs/<nr>-*.md` Branch-rad och är deterministisk.
- [x] Hittas ingen parent lämnas base orörd och en PR-kommentar förklarar varför — aldrig tyst `main`.
- [x] Workflowen kör **bara** på `pull_request.opened`; en base som ändras senare rörs aldrig.
- [x] Grenar som inte är issue-grenar får också rätt base, båda via workflowen: `feature/*` → `develop`
      och `develop` → `main`. Oberoende av vilken gren som är repots default.
- [x] Beteendet dokumenteras i [`docs/architecture/BRANCHING.md`](docs/architecture/BRANCHING.md).
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

**Inga nya enhetstester** — logiken ligger i inline-bash i workflowen, precis som `branch-policy.yml`
och `close-issue-on-merge.yml` redan gör. `scripts/` ligger utanför pnpm-workspacet (`apps/*` +
`packages/*`), så inget där fångas av `pnpm -r test`, och ett eget paket för en enda strängmatchning
är mer ceremoni än värdet motiverar (konstitutionen §0: är en praktik för tung för oss, genererar vi
den inte åt kunder).

> **Avvikelse från §V**, medveten och därför nedskriven: varje spec ska namnge de tester den lägger
> till, och den här lägger inga. Motivet är att det rör **repo-verktyg, inte produktkod** — §V:s
> "testa det som går sönder i produkten" träffar inte en base-gren i en PR, och felutfallet fångas
> ändå av `validate-source-branch`. Skulle härledningen växa bortom en `grep` ur spec-headern ska den
> flyttas till ett testbart paket.

Varje kriterium bevisas i stället med en namngiven manuell check:

- Huvudfallet → **den här specens egen PR** (`16-pr-base-branch` → `feature/ci-cd`) är första skarpa
  körningen; base ska sättas utan handpåläggning.
- Fallback → en gren utan härledbar parent: base ska vara orörd och kommentaren synas.
- Icke-issue-grenar → `feature/*` och `develop`: workflowen ska inte göra någonting alls.
- `opened`-avgränsningen → ändra base manuellt efter öppnandet och pusha en commit; base ska ligga kvar.
- Full suite result + typecheck/lint status (oförändrade — ingen produktkod rörs).

### Implementation notes

Verifierat lokalt 2026-07-25 på `16-pr-base-branch`:

| Steg                     | Resultat                                                              |
| ------------------------ | --------------------------------------------------------------------- |
| Härledning mot verkliga specar | ✅ 11/11 fall korrekta (se tabell nedan)                          |
| YAML-parsning            | ✅ `on = {pull_request: {types: [opened]}}`, `permissions` som specat   |
| `pnpm -r typecheck`      | ✅ rent                                                                |
| `pnpm -r lint`           | ✅ rent                                                                |
| `pnpm -r test`           | ✅ 99 gröna, 3 skippade — oförändrat, ingen produktkod rörd            |

Härledningsstegen kördes som fristående bash mot repots faktiska `specs/`-filer:

| Head-gren                 | Härledd base              |
| ------------------------- | ------------------------- |
| `16-pr-base-branch`       | `feature/ci-cd`           |
| `14-pr-ci-checks`         | `feature/ci-cd`           |
| `14-supabase-schema-auth` | `feature/infrastructure`  |
| `13-push-protection`      | `feature/ci-cd`           |
| `9-vercel-supabase-setup` | `feature/infrastructure`  |
| `11-ui-design-flaws`      | `feature/ui`              |
| `1-interview-generator`   | `feature/interview-generator` |
| `hotfix-foo`              | ingen issue-gren → rör inget |
| `feature/ci-cd`           | ingen issue-gren → rör inget |
| `develop`                 | ingen issue-gren → rör inget |
| `999-nonexistent`         | ingen spec → kommentar    |

- **Numret ensamt räcker inte.** `specs/14-*.md` matchar två specar från *olika* features
  (`14-pr-ci-checks` → ci-cd, `14-supabase-schema-auth` → infrastructure). Workflowen väljer därför den
  spec vars Branch-rad nämner just den aktuella grenen, inte den första filen som matchar numret. Utan
  den detaljen hade var femte PR fått fel base.
- **Båda header-formaten fungerar.** Äldre specar har `**Branch:** \`x\` (from \`feature/y\`)`, nyare har
  det i tabellform — samma `grep` täcker båda.
- **Checkout sker på `head.sha`**, inte merge-ref:en, eftersom specen normalt bara finns på head-grenen
  när PR:en öppnas.
- **Självverifieras i den här PR:en.** För `pull_request`-events kör GitHub workflow-filerna från PR:ens
  merge-commit, så en ny workflow som läggs till i en PR körs på den PR:en. (Det är hela skälet till att
  `pull_request_target` finns som den bas-baserade varianten.) Konsekvens för hur kriteriet bevisas:
  öppnas PR:en med `--base feature/ci-cd` blir körningen ett no-op ("Basen är redan …") — vilket bevisar
  att workflowen kör, men inte att den *rättar*. För att se rättningen måste PR:en öppnas **utan**
  `--base`, så GitHub defaultar till `main` och workflowen får något att göra.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

1. **`.github/workflows/pr-base-branch.yml`** — ny workflow på `pull_request: types: [opened]` med
   `permissions: pull-requests: write`. Plockar issue-numret ur head-ref:en, letar upp `specs/<nr>-*.md`
   på **head**-ref:en, grep:ar fram `feature/<name>` och kör `gh pr edit --base` — annars en kommentar.
2. **[docs/architecture/BRANCHING.md](docs/architecture/BRANCHING.md)** — dokumentera beteendet, inklusive
   att undantag görs genom att ändra base *efter* öppnandet.
3. **[specs/README.md](specs/README.md)** — statusraden för den här specen.

**No change needed:** `branch-policy.yml` — merge-riktningen valideras redan där, och den valideringen
ska vara kvar oavsett vilken lösning som väljs.

---

## Data model

**No schema changes.**

---

## Security

Workflowen behöver `permissions: pull-requests: write` — den första skrivrättigheten på PRs i det här
repot (jämför `issues: write` i `close-issue-on-merge.yml`). Räckvidden är avgränsad: den ändrar base
och skriver en kommentar, inget mer, och den ändrar inte vad som får mergas — `validate-source-branch`
och `verify` är fortfarande required på `main`/`develop`. Kör på `pull_request` (inte
`pull_request_target`), så en eventuell fork-PR aldrig kan köra kod med skrivtoken.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- **Grennamn utan ledande siffror** (t.ex. `hotfix-foo`) → workflowen gör ingenting; base lämnas orörd.
- **Ingen spec för numret**, eller en spec utan `(from \`feature/…\`)` i Branch-raden → ingen parent
  kan härledas: base lämnas orörd + förklarande PR-kommentar. Detta ersätter frågan om issue-kopplingar
  helt — härledningen läser specen, inte GitHubs Development-sektion, så "flera länkade grenar" kan
  inte uppstå.
- **Specen finns bara på head-grenen** (normalfallet — den skapas i samma PR) → workflowen måste läsa
  specen från head-ref:en, inte från base.
- **Parent-featuren är redan mergad och raderad** när PR:en öppnas → basen finns inte längre; base
  lämnas orörd + kommentar, samma väg som "ingen parent".
- **Base ändras avsiktligt efter öppnandet** → rörs aldrig, eftersom workflowen bara kör på `opened`.
  Det är också den sanktionerade vägen för ett medvetet undantag.
- **PR skapad i GitHub-UI:t** → täcks, till skillnad från ett skript. Det var hela skälet till valet.

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- Att tvinga fram PR-riktningen på GitHub-sidan — redan gjort i spec 29 + 14 (branch protection).
- Ändringar i hur feature-grenar skapas.
- Automatisk merge eller auto-approve av PRs.
