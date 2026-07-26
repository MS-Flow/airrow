# Spec 53 — Automatisk PR-beskrivning

> **In one sentence:** En PR ska komma med sin beskrivning ifylld från specen, commit-meddelandena och
> den länkade issuen — så att granskaren får sammanhanget utan att först läsa hela diffen.

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Status**     | ✅ Done                                                                                 |
| **Issue**      | #53 — "Auto-generate the PR description when a PR is created"                            |
| **Branch**     | `53-pr-description` (from `feature/ci-cd`)                                               |
| **Feature**    | CI/CD                                                                                    |
| **Depends on** | [`46-auto-assign-reviewer.md`](46-auto-assign-reviewer.md) (granskaren som ska läsa beskrivningen), [`29-branch-policy.md`](29-branch-policy.md) (workflowen som redan läser specfilen) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
[NEEDS CLARIFICATION: …] markers are resolved by /clarify.
-->

---

## User story

_Who wants this, and what they get out of it._

As a **granskare som just blivit tilldelad en PR** I want **att beskrivningen redan säger vad
ändringen gör och varför** so that **jag kan börja i rätt ände i stället för att rekonstruera syftet
ur diffen — och som författare slipper jag skriva om det som redan står i specen.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Idag:** PR-beskrivningen skrivs för hand, om alls. Repot har ingen
  `.github/pull_request_template.md`.
- **Problemet:** en tom beskrivning flyttar hela kontextbördan till granskaren, trots att svaret
  redan finns skrivet i `specs/<nr>-*.md`. Sedan [`46`](46-auto-assign-reviewer.md) tilldelas dessutom
  en granskare automatiskt — då blir en oförklarad PR någon annans problem direkt.
- **Redan på plats:** `.github/workflows/branch-policy.yml` kör på `pull_request` med
  `pull-requests: write`, checkar ut PR:ens head och letar redan upp rätt `specs/<nr>-*.md` via
  Branch-raden (för att härleda base-grenen). Samma uppslagning är det som behövs här.
- Commit-meddelandena följer Conventional Commits, och issuen är länkad till grenen via
  `gh issue develop` — båda är alltså strukturerat underlag, inte fritext.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

Ett nytt steg i `validate-source-branch`-jobbet i `.github/workflows/branch-policy.yml` sätter
beskrivningen via `gh pr edit --body` när PR:en **öppnas** och beskrivningen är tom. Jobbet checkar
redan ut PR:ens head och slår redan upp rätt `specs/<nr>-*.md` via Branch-raden — samma uppslagning
som behövs här. Steget måste vara non-fatal (jobbet är en required check), precis som reviewer-steget
i [`46`](46-auto-assign-reviewer.md).

**Ren mall, ingen LLM.** Texten klipps ur specen och `git log`. Deterministiskt, gratis och testbart —
och underlaget är redan skrivet. Ingen API-nyckel införs i CI; ett Claude-anrop per PR vore det första
i repot och tillför inget som specen inte redan säger bättre.

**Innehåll**, i den ordningen:
1. Specens **In one sentence** — vad ändringen gör och varför.
2. Specens **Acceptance criteria** — checklistan granskaren läser diffen mot.
3. **Commit-listan** mellan base och head (Conventional Commits gör dem läsbara som de är).
4. Länkar till issuen och specfilen.
5. En avslutande fotnot som säger att texten är genererad och fritt får redigeras — annars är det
   inte uppenbart för läsaren att den inte är handskriven.

*User story* utelämnas medvetet — den överlappar enradaren och gör beskrivningen längre utan att säga
något nytt.

**Release-PR:en (`develop → main`) får en egen form.** En release samlar många specar, så en enradare
ur en enda spec passar inte. I stället listas de specar som ingår: `git diff --name-only
main...develop -- 'specs/*.md'` (minus `README.md`), och för varje fil dess *In one sentence*. Samma
mall-mekanik, annan ingång — prototypen mot verklig data ger t.ex.:

```
- **#12** — Create the Vercel project, bind `airrow.app` to the production build from `main`, …
- **#16** — En PR från en issue-gren ska föreslå sin egen `feature/<name>` som base, …
- **#46** — En PR mot `develop` eller `main` ska få en reviewer tilldelad automatiskt när den öppnas, …
```

Två fallgropar som mätts upp i repot, inte gissats:
- **9 av 17 specar saknar enradaren** — de skrevs före mallen och har rubriken `# Spec: <titel>` i
  stället för `# Spec NNN — <titel>`. Fallback är H1-rubriken, som *alla* specar har (`^# Spec`
  matchar båda formerna). Raden blir kortare, aldrig tom.
- **Enradaren är ett blockcitat över flera rader.** En `grep` på första raden klipper meningen mitt
  itu — hela det inledande `>`-blocket måste läsas och fogas ihop.

Att specarna är dels svenska, dels engelska accepteras: release-listan blir språkblandad. Bara en LLM
kunde normalisera det, och det motiverar inte en API-nyckel.

**Bara vid `opened`.** Beskrivningen skrivs en gång och rörs sedan aldrig, så automatiken kan aldrig
slåss med text du själv redigerat — samma linje som base-sättningen redan håller.

**Ingen `.github/pull_request_template.md`.** En template förifyller varje ny PR, och då är
beskrivningen aldrig "tom" — de två lösningarna skulle motverka varandra.

**Not touched:** PR-*titeln* — den kommer från commit-meddelandet och följer redan Conventional
Commits.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] En PR som öppnas med tom beskrivning får en ifylld beskrivning automatiskt.
      — hela kedjan torrkörd mot riktig PR-data (#34). **Live-bekräftas av första PR:en som öppnas
      efter merge** — steget kör från PR:ens head och kan inte köras tidigare.
- [x] Beskrivningen innehåller specens *In one sentence*, dess *Acceptance criteria*, commit-listan
      mellan base och head, samt länkar till issuen och specfilen. — `buildBody`, testad.
- [x] Beskrivningen sätts bara vid `opened` — senare events rör den inte.
      — `if: github.event.action == 'opened'` på steget.
- [x] En release-PR (`develop → main`) får i stället en lista över de specar som ingår, en rad per
      spec med dess *In one sentence*. — formen väljs på antal specar, se _Implementation notes_.
- [x] En spec utan *In one sentence* faller tillbaka på sin H1-rubrik — raden blir aldrig tom.
      — `summarize()`, testad mot både `# Spec NNN — …` och den äldre `# Spec: …`.
- [x] En PR där författaren själv skrivit en beskrivning lämnas orörd — inget skrivs över.
      — steget avbryter när `gh pr view --json body` inte är tom.
- [x] Saknas spec eller länkad issue failar det inte — den faller tillbaka på commit-meddelandena och
      säger tydligt vad som saknades. — `_Ingen spec hittades…_` + commit-listan, testad.
- [x] Genereringen kan aldrig blockera en merge (jfr `validate-source-branch`, som är en required
      check — samma non-fatal-krav som i [`46`](46-auto-assign-reviewer.md)). — `continue-on-error: true`.
- [x] Ingen `.github/pull_request_template.md` läggs till — en förifylld mall skulle göra att
      beskrivningen aldrig är tom och därmed aldrig genereras. — ingen sådan fil skapad.
- [x] Beteendet dokumenteras i `docs/architecture/BRANCHING.md`.
      — nytt avsnitt "The description is written for you".
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **Nya tester** — `scripts/pr-description.test.mjs`, **13 tester**: flerradigt `>`-blockcitat ger hela
  meningen; H1-fallback för både `# Spec NNN — …` och äldre `# Spec: …`; kriterier med radbrytning
  fogas ihop och stannar vid `### Verification`; en spec → utförlig form med kriterier som *obockade*
  rutor; flera specar → en rad per spec; ingen spec → commit-lista + issuelänk; inga commits → ingen
  commit-rubrik; spec-länk med och utan blob-URL.
- **Torrkörning mot riktig data (2026-07-26)** — hela kedjan körd lokalt mot PR #34:
  `gh pr view --json files` → spec-argument → `gh pr view --json commits` → `node
  scripts/pr-description.mjs`. Gav en korrekt tvåspecs-lista (#14, #33) med commit-rad och länkar.
  Även enkelspecs-formen körd mot `specs/46-auto-assign-reviewer.md`. Steget shell-syntaxkontrollerat
  med `bash -n`; `gh`-fälten `files`, `commits` och `body` verifierade mot ett riktigt repo.
- **Kvar: live-bekräftelse.** Steget kör från PR:ens head, så första riktiga körningen sker på nästa
  PR som öppnas efter att den här grenen mergats.
- **Manuellt efter merge** — öppna en PR utan beskrivning och verifiera innehållet; öppna en med egen
  text och verifiera att den lämnas orörd.
- **Full svit (2026-07-26):** `pnpm -r lint` ren · `pnpm -r typecheck` ren · `pnpm -r test` 51 passed,
  15 skipped (Supabase-beroende RLS-tester), 0 failed · `pnpm test:scripts` 13 passed.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

1. **`scripts/pr-description.mjs`** (ny) — rena funktioner (`extractOneLiner`, `extractTitle`,
   `summarize`, `extractCriteria`, `specNumber`, `buildBody`) plus en CLI som läser specfiler från
   argv, commit-rubriker från stdin och skriver markdown till stdout.
2. **`scripts/pr-description.test.mjs`** (ny) — 13 Vitest-tester för parsning och form.
3. **`.github/workflows/branch-policy.yml:150-195`** (steget börjar på 161) — nytt steg `Write PR description`, sist i
   `validate-source-branch`, `if: github.event.action == 'opened'` och `continue-on-error: true`.
   Avbryter på befintlig beskrivning, hämtar spec-filer via `gh pr view --json files`, commits via
   `--json commits`, och pipar resultatet till `gh pr edit --body-file -`.
4. **`package.json:16`** — `"test:scripts": "vitest run scripts"` (root-vitest fanns redan som
   devDependency).
5. **`.github/workflows/ci.yml:34-37`** — nytt steg `Test CI scripts` som kör `pnpm test:scripts`;
   `pnpm -r test` når inte utanför workspace-projekten.
6. **`docs/architecture/BRANCHING.md:88`** — nytt avsnitt "The description is written for you".
7. **`CLAUDE.md:45`** och **`docs/guides/DEVELOPER_GUIDE.md`** — `pnpm test:scripts` tillagd i
   kommandolistan och i verifieringsbaren, så den dokumenterade vägen täcker allt CI kör.

**No change needed:** `.github/pull_request_template.md` — läggs medvetet inte till.

---

## Implementation notes

**Formen väljs på antal specar, inte på grennamn.** Specen sa "release-PR:en (`develop → main`) får en
lista". Implementationen generaliserar: PR:en frågar `gh pr view --json files` vilka specar den rör —
en spec ger den utförliga formen, flera ger listan. Det täcker release-PR:en *och*
`feature/* → develop`, som har exakt samma problem (flera specar, ingen enskild enradare som passar),
utan en separat kodväg per grennamn.

**Ny test-wiring, godkänd under `/implement`.** Specens *Verification* förutsatte Vitest-täckning för
ett skript i `scripts/` — men `pnpm -r test` når bara workspace-projekten (`apps/*`, `packages/*`), och
[`ci.yml`](../.github/workflows/ci.yml) körde exakt det kommandot. Ett test där hade aldrig körts.
Löst med `pnpm test:scripts` i root och ett eget CI-steg; `CLAUDE.md` och `DEVELOPER_GUIDE.md`
uppdaterade så den dokumenterade verifieringsbaren täcker det CI faktiskt kör.

**Kriterierna renderas obockade** i PR-beskrivningen, även när specen bockat av dem. De är
granskarens checklista, inte författarens statusrapport.

**Ingen konflikt med [`46`](46-auto-assign-reviewer.md)** — den mergades till `feature/ci-cd` (PR #51)
innan den här grenen togs ut, så `Request reviewer` fanns redan i basen. Ordningen blev
`Write PR description` före `Request reviewer`, vilket är rätt håll: granskaren får sin notis om en PR
som redan förklarar sig.

**Fynd i `/analyze` (2026-07-26), åtgärdade.**
1. **Konstitutionen blev osann.** `VI. Verification bar` sa att baren är `pnpm -r test`, men den här
   ändringen införde tester som det kommandot inte når. `CLAUDE.md` och `DEVELOPER_GUIDE.md` var
   uppdaterade — inte källan. [`constitution.md:132-134`](../.claude/spec-kit/constitution.md#L132-L134)
   nämner nu `pnpm test:scripts`, med hänvisning hit enligt amendment-regeln.
2. **Fotnoten var odokumenterad.** Den genererade texten avslutas med "Genererad från specen …";
   innehållslistan i _Design decision_ nämnde bara fyra delar. Nu fem.
3. Radhänvisningen till workflow-steget justerad (steget börjar på 161).

**Kontrollerat, inte antaget:** `gh pr view --json body` ger tom sträng (inte `"null"`) för en PR utan
beskrivning — annars hade vakten stängt av hela steget. `gh pr edit --body-file -` läser stdin.
`pnpm install --frozen-lockfile` går fortfarande igenom (ett nytt `scripts`-fält rör inte lockfilen).

---

## Data model

**No schema changes.**

---

## Security

Specfiler och commit-meddelanden är repo-innehåll och blir PR-text — ingen hemlighet passerar. Körs på
`pull_request` (aldrig `pull_request_target`), så en fork får inte skrivtoken. Text från grenen får
aldrig interpoleras rakt in i shell — läs den via `env:`, som resten av `branch-policy.yml` gör.
Ingen API-nyckel införs (mallvägen vald), så CI:s hemlighetsyta är oförändrad.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- Ingen spec matchar grenen → faller tillbaka på commit-meddelanden + issuelänk, och säger det.
- Grenen är inte länkad till någon issue → hoppar över issue-raden, failar inte.
- PR:en har redan en beskrivning → rör den inte.
- PR från en fork → skrivtoken saknas; varna och fortsätt.
- `develop → main` (release-PR) → lista över ingående specar i stället för en enda enradare.
- En spec i release-intervallet saknar *In one sentence* → fallback på H1-rubriken.
- Release-intervallet innehåller bara `specs/README.md` (eller inga specar alls) → faller tillbaka på
  commit-listan, failar inte.

---

## Out of scope

- PR-titeln — ägs av commit-meddelandet.
- Att generera *spec*-innehåll — det ägs av `/createspec` och `/implement`.
- Release notes / changelog som egen artefakt — release-PR:ens beskrivning täcker behovet tills vidare.
- Att efterhandsfylla enradaren i de 9 äldre specarna — fallbacken gör det onödigt, och nya specar får
  den automatiskt via `/createspec`.
