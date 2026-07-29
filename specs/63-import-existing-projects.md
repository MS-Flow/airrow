# Spec 63 — Importera existerande projekt

> **In one sentence:** Airrow ska kunna ta emot ett projekt som redan finns — byggt utan Airrow — och
> lägga till den engineering-foundation som saknas, i stället för att bara kunna generera från noll.

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Status**     | ✅ Done — ZIP-vägen; repo-vägen är utanför scope och ligger på [#67](https://github.com/MS-Flow/airrow/issues/67) |
| **Issue**      | #63 — "Importera existerande projekt till Airrow"                                        |
| **Branch**     | `63-import-existing-projects` (from `feature/import-existing-projects`)                  |
| **Feature**    | Import existing projects                                                                 |
| **Depends on** | [`1-interview-generator.md`](1-interview-generator.md) — importen matar in i samma `generate()` och samma `ProjectModel` |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
[NEEDS CLARIFICATION: …] markers are resolved by /clarify.
-->

---

## User story

_Who wants this, and what they get out of it._

As a **grundare som redan har en kodbas igång** I want **att peka ut mitt befintliga projekt och låta
Airrow fylla i det som saknas** so that **jag får samma foundation som ett Airrow-genererat projekt
utan att börja om från början.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Idag:** flödet är enkelriktat — intervju → `generate(templateFiles, projectModel)` → nytt repo
  eller ZIP. Projektmodellen kommer uteslutande från intervjusvaren.
- **Problemet:** ett team som redan har ett repo kan inte använda Airrow utan att starta ett nytt
  projekt vid sidan av. Det stänger ute det vanligaste utgångsläget.
- **Redan på plats:** ZIP-leveransen finns och fungerar utan integration
  ([`zip/route.ts:19`](../apps/web/src/app/api/projects/%5Bid%5D/zip/route.ts#L19)) — den bygger
  arkivet från `artifact.files` och tar aldrig sökvägar från klienten. Intervjusvaren persisteras via
  `saveInterviewAnswers` ([`store.ts:296`](../apps/web/src/lib/data/store.ts#L296)), så en förifylld
  intervju behöver ingen ny lagringsväg.
- **Inte på plats:** GitHub App-integrationen existerar inte. `repo_connections` är enbart
  ställning — "Created for completeness; populated by the GitHub App issue (not yet)"
  ([`20260725100000_schema.sql:116`](../supabase/migrations/20260725100000_schema.sql#L116)) — och
  det finns ingen installationsflöde, ingen tokenhantering och ingen PR-väg i kodbasen.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

Importen producerar samma Zod-validerade projektmodell som intervjun gör, och matas in i **samma**
headless `generate(templateFiles, projectModel)`. Ingen parallell genereringsväg. Det importen lägger
till är ett analyssteg före intervjun och ett diff-/konfliktsteg före leverans.

**Analysen är deterministisk i v1** — manifest först: `package.json`, `*.csproj`, `tsconfig.json`,
lockfiles och mappstruktur. Ingen LLM. Det gör analyssteget testbart utan mock och förutsägbart per
import; en LLM-komplettering kan läggas till senare utan att kontraktet mot `ProjectModel` ändras.

**Båda källorna ingår i v1:** repo via GitHub App-installation *och* uppladdad ZIP.

**Not touched:** genereringsmotorn själv, intervjuns frågelogik, och löftet att Airrow bara levererar
foundations — aldrig applikationskod.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] En användare kan starta ett "importera existerande projekt"-flöde och ladda upp en ZIP.
- [x] Importflödet är nåbart från app-chromet: en **Import**-knapp bredvid "+ New project" i topbaren
      och på både dashboarden och projektlistan, plus tomt-läge och kommandopalett.
- [x] Importen analyserar projektet och producerar en projektmodell som validerats med Zod — samma
      kontrakt som modellen från intervjun.
- [x] Analysen är deterministisk: den läser manifest- och konfigfiler samt mappstruktur, anropar ingen
      LLM, och ger samma modell för samma indata.
- [x] Import över gränsen (50 MB eller 5 000 filer, efter att ignorerade mappar räknats bort)
      avvisas med ett tydligt fel *innan* analysen startar.
- [x] Intervjun förifylls med det som kunde härledas; användaren bekräftar eller korrigerar innan
      generering.
- [x] Genereringen kör mot samma `generate(templateFiles, projectModel)` — ingen parallell kodväg.
- [x] Resultatet presenteras som en diff mot det befintliga projektet: nya filer, redan identiska
      filer och konflikter redovisas separat innan något skrivs.
- [x] Befintliga filer skrivs aldrig över tyst — en konflikt kräver ett explicit val av användaren.
- [x] ZIP-leverans fungerar utan någon integration ansluten och respekterar konfliktbesluten.
- [x] Importerat innehåll behandlas som otrodd text: parsas totalt (kastar aldrig), exekveras aldrig,
      och sökvägar som försöker ta sig ur trädet avvisas.
- [x] Allt importerat material hänger på `organization_id` (via projektet) och täcks av RLS med både
      access- och denial-tester.
- [x] Flödet dokumenteras i `docs/architecture/SYSTEM_OVERVIEW.md` i samma ändring som koden.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **Nya tester** — [`packages/engine/src/import.test.ts`](../packages/engine/src/import.test.ts)
  (23 tester): härledning per signal med evidens, att obevisbara frågor lämnas obesvarade, att
  ordningen på indata inte påverkar resultatet (determinism), gränskontrollerna, diff-bucketarna och
  att `applyResolutions` aldrig skriver en fil utan explicit val.
- **Nya tester** — [`apps/web/src/features/import/archive.test.ts`](../apps/web/src/features/import/archive.test.ts)
  (9 tester): ZIP-läsning, att GitHub-arkivets rotmapp skalas av, att ignorerade mappar räknas och
  hoppas över, att en icke-ZIP avvisas, att en zip-bomb stoppas på dekomprimerad storlek, och att
  `../`-sökvägar avvisas.
- **RLS** — de tre nya tabellerna är tillagda i
  [`schema.rls.test.ts`](../apps/web/src/lib/data/schema.rls.test.ts) som access/denial-fall, med
  samma mönster som övriga tabeller.
- **Konfliktbeslut → leverans, körd skarpt i webbläsare** mot lokal Supabase. Ett importerat projekt
  med `README.md` och `.github/workflows/ci.yml` genererades (21 filer), varefter ZIP:en laddades ned
  i tre lägen:

  | Läge | Filer i ZIP | `README.md` | `ci.yml` |
  | --- | --- | --- | --- |
  | Båda konflikterna oavgjorda | 19 | levereras inte | levereras inte |
  | `README.md` → "Use Airrow's" | 20 | levereras (`# Recovered CRM`) | levereras inte |
  | `README.md` → "Keep mine" | 19 | levereras inte | levereras inte |

  Ett beslut flyttar exakt en fil; en oavgjord konflikt rör aldrig founderns version. Det är specens
  centrala löfte, bevisat vid ytan och inte bara i enhetstest.
- Full svit: se _Implementation notes_.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

1. **`packages/schemas/src/types.ts`** — importtyperna (`ImportedFile`, `ImportedFileDigest`,
   `ImportAnalysis`, `ImportEvidence`, `ImportDiff`, `ConflictResolution`). Rena typer; konstanterna
   ligger i motorn så filens "no runtime dependencies"-kontrakt håller.
2. **`packages/schemas/src/index.ts`** — `importedFileSchema`, `importCreateSchema`,
   `conflictDecisionSchema`. `source` tillåter bara `"zip"` så länge repo-vägen inte finns.
3. **`packages/engine/src/import.ts`** (ny) — hela den rena kärnan: `checkImportLimits`,
   `stripCommonRoot`, `analyzeImport`, `digestImported`, `diffAgainstExisting`, `applyResolutions`.
   Ingen I/O, ingen env, ingen krypto — digest-funktionen injiceras av anroparen.
4. **`packages/engine/src/index.ts`** — exportera det nya.
5. **`supabase/migrations/20260726120000_import.sql`** (ny) — `import_sources`, `import_files`,
   `import_conflicts` med RLS via `is_project_member()` och grants.
6. **`apps/web/src/lib/data/store.ts`** — `createImportSource`, `getImportSource`, `listImportFiles`,
   `saveConflictResolution`, `listConflictResolutions`.
7. **`apps/web/src/features/import/archive.ts`** (ny) — serverside ZIP-läsning med
   storlekskontroll före *och* under dekomprimering, sökvägsnormalisering och `sha256`.
8. **`apps/web/src/features/import/actions.ts`** (ny) — `importProjectAction` (upload → analys →
   projekt → förifylld intervju) och `resolveConflictAction`.
9. **`apps/web/src/features/import/ImportForm.tsx` / `ConflictRow.tsx`** (nya) — formuläret och
   konfliktraden.
10. **`apps/web/src/app/app/projects/import/page.tsx`** (ny) — ingången.
11. **`apps/web/src/app/app/projects/[id]/import/page.tsx`** (ny) — evidens + diff + konfliktbeslut.
12. **`apps/web/src/app/api/projects/[id]/zip/route.ts`** — filtrera genom `applyResolutions` när
    projektet är importerat.
13. **`apps/web/src/features/projects/ProjectActions.tsx`** (ny) — paret **Import** + **New project**
    som en komponent. "New project" fanns på tre ställen; att klistra in knappparet tre gånger hade
    varit den duplicering konstitutionen förbjuder.
14. **`apps/web/src/components/shell/top-bar.tsx`** — använder `ProjectActions` (labeln kollapsar
    under `lg` så brödsmulorna inte trycks ihop); `import` tillagd i `SEGMENT_LABELS`.
15. **`apps/web/src/app/app/page.tsx`** och **`apps/web/src/app/app/projects/page.tsx`** — använder
    `ProjectActions` i sidhuvudet, och erbjuder import även i tomt-läget.
16. **`apps/web/src/app/app/layout.tsx`** — "Import an existing project" i kommandopaletten.
17. **`apps/web/src/app/app/projects/new/page.tsx`** — länk till importflödet.
18. **`docs/architecture/SYSTEM_OVERVIEW.md`** — flödet dokumenterat.

**No change needed:** genereringsmotorn och intervjun. Importen lämnar av en förifylld `interviews`-rad
och går sedan exakt samma väg som ett projekt skapat från noll.

---

## Data model

_Any database change. Most specs have none — say so plainly._

**Tre nya tabeller**, i `supabase/migrations/20260726120000_import.sql`:

- `import_sources` — källa (`zip` \| `repo`), arkivets namn, antal analyserade/ignorerade filer och
  hela `ImportAnalysis` som jsonb.
- `import_files` — **path, storlek och digest, aldrig innehållet.** Det räcker för att skilja "finns
  redan" från "skiljer sig", utan att kundens källkod någonsin hamnar i Airrows databas.
- `import_conflicts` — en rad per explicit beslut, unik per `(generation_job_id, path)`.

**Två avvikelser från specen som skriven** (båda medvetna):
1. Tabellerna hänger på `project_id`, inte direkt på `organization_id`. Tenancy löser fortfarande ut
   till organisationen via `projects`, precis som `interviews` och `generation_jobs`, och de återanvänder
   `is_project_member()` i stället för att införa ett andra mönster.
2. Det blev tre tabeller i stället för två: `import_files` behövs för att kunna diffa utan att lagra
   innehållet, vilket var hela poängen med digest-designen.

RLS med både access- och denial-tester ligger i samma ändring. Migrationen **replayar rent från noll**,
vilket är kravet i konstitutionen. Tabeller och index använder `if not exists`; `create policy` gör det
inte (PostgreSQL saknar den formen), så en andra körning mot en databas som redan har tabellerna
failar på policyn — samma beteende som `20260725100000_schema.sql`, och skälet till att migrationer
körs framåt en gång, aldrig om.

---

## Security

_Two lines at most: what this opens up and who may reach it — or "nothing security-relevant, because …"._

Detta är den första vägen där **kundens egen kod** kommer in i Airrow: allt importerat innehåll är
otrodd text, renderas sanerat och exekveras aldrig, och repoåtkomst sker enbart via GitHub
App-installationer — aldrig user PATs. Importerat material är åtkomligt enbart via RLS-scopade vägar
inom sin organisation.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- Projektet innehåller redan en fil som Airrow skulle generera → redovisas som konflikt, skrivs inte över.
- Analysen kan inte härleda stacken → användaren får svara i intervjun som vanligt, importen blockeras inte.
- ZIP över 50 MB, eller fler än 5 000 filer efter att ignorerade mappar (`node_modules`, `.git`,
  `dist`, `.next`) räknats bort → avvisas före analys, med gränsen utskriven i felet.
- Zip-bomb: liten på disken, enorm uppackad → totalen kontrolleras *under* uppackningen och avbryts
  vid gränsen, inte efteråt.
- Arkiventry med `..` i sökvägen → avvisas; övriga filer importeras.
- Filen är inte en ZIP → tydligt fel i formuläret, inget projekt skapas.
- Arkivet har en enda toppmapp (som GitHubs exportarkiv) → mappen skalas av så sökvägarna matchar
  motorns.
- Trasig `package.json` → parsas totalt, inget kastas, inget härleds därifrån.
- Repot är tomt eller GitHub App-installationen saknar åtkomst → **utanför nuvarande leverans**;
  repo-vägen är inte byggd, och ingången visar det som "Coming soon" i stället för att erbjuda något
  som inte finns.

---

## Implementation notes

### Blockerat: repo-vägen och PR-leveransen
Specen (efter `/clarify`) sa "båda källorna i v1". Vid implementationen visade det sig att
**GitHub App-integrationen inte existerar** — inte som halvfärdig kod, utan alls. `repo_connections`
är en tom ställningstabell märkt "populated by the GitHub App issue (not yet)"
([`20260725100000_schema.sql:116`](../supabase/migrations/20260725100000_schema.sql#L116)), och det
finns varken installationsflöde, tokenmintning, repo-läsning eller PR-skapande någonstans i kodbasen.

Att bygga det inuti den här specen hade betytt att leverera en hel egen feature (App-registrering,
installation callback, short-lived tokens, tree-läsning, branch + PR) på köpet — långt bortom
"one coherent slice". Därför är följande **inte byggt**:

- import av repo via GitHub App-installation
- leverans som PR tillbaka till det importerade repot

Allt annat i specen är byggt. Ingången visar repo-alternativet som "Coming soon" i stället för att
erbjuda en knapp som inte leder någonstans, och `importCreateSchema` accepterar bara `"zip"` så att
schemat inte lovar mer än koden håller. **Uppföljning:** GitHub App-integrationen är utbruten till
[#67](https://github.com/MS-Flow/airrow/issues/67); repo-import och PR-leverans blir varsin egen
issue när den är klar.

### Digest i stället för innehåll
Specen sa inget om hur det importerade materialet skulle lagras. Valet blev att lagra **path, storlek
och SHA-256 — aldrig innehållet**. Diffen behöver bara kunna svara "finns den redan?" och "skiljer den
sig?", och båda går att svara på med en digest. Det gör att kundens källkod aldrig överlever den
request som analyserade den, vilket är den starkaste tolkningen av §II "Customer IP is protected".
Konsekvensen är att `diffAgainstExisting` tar en injicerad digest-funktion — motorn får inte importera
krypto och förblir ren.

### Två buggar som bara körning hittade
`/verify` drev flödet i en riktig webbläsare och hittade två fel som hela testsviten missade:

1. **Katalogposter lagrades som filer.** Windows `Compress-Archive` skriver poster med backslash, så
   JSZips `dir`-flagga är `false` för varje mapp — och filtret låg *före* sökvägsnormaliseringen.
   Följden: nollbyte-rader i `import_files` och uppblåst filräkning (7 i stället för 5). Rättat i
   [`archive.ts:45`](../apps/web/src/features/import/archive.ts#L45) genom att avgöra katalog på den
   normaliserade sökvägen. Regressionstest finns och är verifierat rött före fixen. Enhetstesterna
   missade det för att JSZips *skrivare* normaliserar till forward slash — bara ett äkta
   Windows-arkiv exponerar buggen.
2. **Formuläret tömdes vid fel.** React 19 återställer ett okontrollerat formulär när en action
   returnerat, så namn och beskrivning nollställdes vid ett avvisat arkiv — och eftersom de är
   `required` vägrade webbläsaren tyst att skicka igen. Det såg ut som en trasig knapp. Rättat genom
   att göra fälten kontrollerade i [`ImportForm.tsx`](../apps/web/src/features/import/ImportForm.tsx),
   plus en rad som säger att filfältet töms (filinputs kan inte vara kontrollerade).

**Accepterad testlucka:** fix 2 har ingen regression. jsdom kan inte fästa en fil på inputen —
`user.upload` respekterar `accept` och validiteten förblir `false` — så testet jag skrev passerade
lika glatt mot den trasiga koden och togs bort hellre än att ge falsk trygghet. Fixen är i stället
verifierad i webbläsare (fel → fälten kvar → välj rätt fil → importen går igenom utan omskrivning).
Ett riktigt skydd kräver Playwright, som repot inte har uppsatt — värt en egen issue.

### Sidofynd: ett test som aldrig kunde köra
`auth.trigger.test.ts:14` defaultade `SUPABASE_DB_URL` till
`postgresql://postgres:postgres@90.235.63.115/postgres` — en hårdkodad publik IP i stället för
`127.0.0.1:54322` som alla andra datalagertester. Testet kunde alltså aldrig nå lokal Supabase och
skippade tyst, vilket betyder att signup-triggertesterna från #18 sannolikt inte körts sedan de
skrevs. Kom in med `5483bb3`, orört av den här specen.

Rättat här på uttrycklig begäran (defaulten pekar nu på lokal Supabase) trots att det hör till en
annan spec — det var enda sättet att kunna säga att sviten faktiskt är grön. **Kvarstår för er:**
avgöra om den publika värden är nåbar och i så fall rotera `postgres`-lösenordet; att ta bort raden
härifrån tar inte bort den ur git-historiken.

### Verifiering (kört 2026-07-26, mot lokal Supabase)
- `pnpm -r typecheck` — rent (engine, schemas, web).
- `pnpm -r lint` — rent, inga nya anmärkningar.
- `pnpm -r test` — **163 gröna, 0 skippade** (engine 59, web 104).
- `pnpm test:scripts` — 13 gröna.
- `pnpm build` — båda nya rutterna kompilerar (`/app/projects/import`,
  `/app/projects/[id]/import`).
- Migrationen applicerad med `supabase migration up --local`; de tre nya RLS-fallen
  (`import_sources`, `import_files`, `import_conflicts`) kördes namngivet och gav access + denial
  som väntat.
- **Flödet kört skarpt i webbläsare**, inte bara i test: inloggning → import av ett riktigt
  projektarkiv → förifylld intervju (kontrollerad mot databasen) → generering → konfliktbeslut →
  ZIP som följer besluten. Se tabellen under _Verification_.

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- Att generera applikationskod åt det existerande projektet — Airrow levererar fortsatt endast
  engineering-foundations (produktinvariant i konstitutionen).
- Refaktorering eller migrering av befintlig kod.
- **Import av repo via GitHub App-installation.** Stod som acceptanskriterium efter `/clarify`, men
  GitHub App-integrationen finns inte i kodbasen alls — utbruten till
  [#67](https://github.com/MS-Flow/airrow/issues/67) och blir en egen issue när den är klar. Se
  _Implementation notes_.
- **Leverans som PR tillbaka till det importerade repot.** Samma blockering, samma uppföljning.
  ZIP-vägen täcker importflödet fullt ut idag.
- Andra repo-värdar än GitHub (GitLab, Bitbucket) — hanteras separat om det behövs.
- Att lagra det importerade projektets innehåll. Endast digests sparas, medvetet.
