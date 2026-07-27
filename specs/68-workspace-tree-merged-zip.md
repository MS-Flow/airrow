# Spec 68 — Projektet i workspacet, och hela projektet i nedladdningen

> **In one sentence:** Foundern ska se sitt importerade projekts struktur i Airrow och få med sina
> egna filer när hen laddar ner — utan att vi lagrar en enda rad av kundens källkod.

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Status**     | ✅ Done                                                                           |
| **Issue**      | #68 — "Se projektet i workspacet och få med egna filer i nedladdningen — utan att lagra kundens kod" |
| **Branch**     | `68-workspace-tree-merged-zip` (from `feature/import-existing-projects`)                  |
| **Feature**    | Import existing projects                                                                 |
| **Depends on** | [`63-import-existing-projects.md`](63-import-existing-projects.md) — bygger direkt på `import_files`, `applyResolutions` och importskärmarna |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
[NEEDS CLARIFICATION: …] markers are resolved by /clarify.
-->

---

## User story

_Who wants this, and what they get out of it._

As a **grundare som importerat ett projekt** I want **att se min egen arkitektur i Airrow och ladda ner
hela projektet med Airrows foundation inbakad** so that **nedladdningen är något jag kan använda direkt,
i stället för en påse lösa filer jag själv måste förstå var de ska ligga.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Idag:** nedladdningen är additions-only —
  [`zip/route.ts:32`](../apps/web/src/app/api/projects/%5Bid%5D/zip/route.ts#L32) kör
  `applyResolutions` och skickar bara nya filer plus de konflikter foundern valt. Ett riktigt fall:
  ett importerat projekt med 114 filer gav en ZIP med 20 Airrow-filer och inget annat, vilket lästes
  som att projektet raderats.
- **Problemet:** ingenting i UI:t säger att det är meningen, och foundern ser inte sitt projekt i
  Airrow över huvud taget.
- **Redan på plats:** `listImportFiles`
  ([`store.ts:529`](../apps/web/src/lib/data/store.ts#L529)) returnerar redan varje sökväg och
  storlek — hela katalogträdet går att rendera utan schemaändring. Verifierat mot en riktig import:
  114 sökvägar, komplett träd.
- **Digesten är rå SHA-256** idag ([`archive.ts:75`](../apps/web/src/features/import/archive.ts#L75)),
  använd på tre ställen: när importen sparas (`actions.ts:69`), och när diffen räknas ut
  (`[id]/import/page.tsx:116`).
- **Ramen:** vi lagrar inte kundens källkod. Se _Security_.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

Tre delar som kan skeppas oberoende:

1. **Strukturvyn** läses ur `import_files`. Ingen ny lagring, ingen ny risk.
2. **Sammanslagen nedladdning sker i webbläsaren.** `applyResolutions` skickar redan exakt de filer
   som är säkra att skriva, så `merged = founderns arkiv ∪ Airrows filer (Airrow vinner vid krock)` är
   korrekt av konstruktion. Arkivet cachas klientsidan vid importen; servern lagrar inget.
3. **Digesten pepras** med en server-side HMAC-nyckel som inte ligger i databasen, så en läcka inte
   kan återskapa innehållet i korta filer.

**Strukturvyn visar struktur — inte innehåll.** Träd, filnamn och storlekar, ingenting mer. Det är
vad som gör att ramen håller: vi lagrar aldrig kod. Visar det sig otillräckligt blir det en egen
issue med egna avvägningar, inte en tyst utvidgning här.

**Tre PR:er mot feature-grenen, i den här ordningen:** peppringen → strukturvyn → sammanslagningen.
Peppringen är en säkerhetsfix som inte ska fastna bakom UI-arbete, och varje del granskas för sig
(konstitutionen §IV, små PR:er).

**Not touched:** konfliktlogiken och `applyResolutions` — de är verifierade i #63 och ska fortsätta
avgöra vad som får skrivas. Sammanslagningen lägger sig ovanpå, den ersätter ingenting.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] Foundern kan se det importerade projektets katalogstruktur i Airrow, med filstorlekar.
- [x] Nedladdningen ger ett arkiv med founderns egna filer **plus** Airrows foundation, med
      konfliktbesluten respekterade: oavgjord konflikt betyder att founderns fil vinner.
- [x] Ingen källkod och inga hemligheter lagras server-side. Filinnehåll passerar servern enbart i
      minnet under analysen, skrivs aldrig och loggas aldrig.
- [x] Digesten kan inte användas för att återskapa innehåll om databasen läcker, och pepper-nyckeln
      kan roteras utan att befintliga importer läser som idel konflikter.
- [x] Strukturvyn visar träd, filnamn och storlekar — aldrig filinnehåll.
- [x] Kan arkivet inte cachas vid importen (kvoten räcker inte) får foundern veta det där och då,
      med beskedet att nedladdningen kommer be om arkivet igen.
- [x] Väljer foundern ett arkiv som inte matchar det importerade vid nedladdning, sägs det till —
      men hen kan fortsätta ändå.
- [x] Integritetspolicyn uppdateras i samma ändring: strukturen (filnamn och storlekar) lagras,
      innehållet gör det inte.
- [x] Om det sammanslagna arkivet inte kan byggas förklaras det, och foundern erbjuds att välja sitt
      arkiv igen — aldrig en tyst additions-only-nedladdning som ser ut som hela projektet.
- [x] Strukturvyn behandlar sökvägar som otrodd text och renderar dem sanerat.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **Nya tester** — [`apps/web/src/features/import/digest.test.ts`](../apps/web/src/features/import/digest.test.ts)
  (10 st): att en peprad digest **inte** är den råa SHA-256 en angripare skulle brute-forca mot, att
  olika nycklar ger olika digest (en rotation är en verklig rotation), att en äldre version
  fortsätter fungera när en nyare läggs till, att version 0 fortfarande verifierar gamla importer,
  och att systemet vägrar köra helt utan pepper i stället för att tyst lagra vändbara digester.
- **Nya tester** — [`packages/engine/src/import.test.ts`](../packages/engine/src/import.test.ts)
  (+12 st): `buildFileTree` (nästling, kataloger före filer, summerade storlekar, och att inget
  nodinnehåll finns), `mergeOverlay` (founderns filer bevaras, Airrows vinner vid krock) och
  `pathOverlap` (1 vid samma projekt, 0 vid fel projekt, tål att filer ändrats sedan importen).
- **Nya tester** — [`apps/web/src/features/import/archive-cache.test.ts`](../apps/web/src/features/import/archive-cache.test.ts)
  (7 st): att cachningen **rapporterar** fel i stället för att kasta när kvoten tar slut, när lagring
  är blockerad (privat läge), och när IndexedDB saknas helt — samt att den lagrar och läser tillbaka
  i normalfallet. IndexedDB stubbas, eftersom slut kvot inte går att framkalla pålitligt i en
  riktig webbläsare. Verifierat rött före fixen: tas felhanteringen bort failar tre av dem.
- **Sammanslagningen bevisad vid ytan**, inte bara i enhetstest — se _Implementation notes_.
- Full svit: se _Implementation notes_.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

### Del 1 — peppra digesten

1. **`supabase/migrations/<ts>_import_digest_version.sql`** (ny) — `alter table public.import_sources
   add column if not exists digest_version int not null default 0`. **0 betyder rå SHA-256**, dvs.
   importer gjorda före den här ändringen. Nya importer får aktuell pepper-version.
2. **`apps/web/src/features/import/digest.ts`** (ny) — nyckelringen. Läser `IMPORT_DIGEST_PEPPERS`
   (`"1:<hex>[,2:<hex>]"`), exponerar `currentDigestVersion()` och `digestFor(version)`. Version 0
   ger rå SHA-256 så gamla importer fortsätter diffa rätt i stället för att läsa som idel konflikter.
   Enbart app-lagret läser env — motorn tar digesten som parameter och förblir ren.
3. **`archive.ts:75`** — `sha256` flyttas till `digest.ts`; `archive.ts` behåller bara läsningen.
4. **`store.ts`** — `createImportSource` tar `digestVersion`, `ImportSourceRecord` bär den, radmappning
   och `select` uppdateras.
5. **`actions.ts:69`** och **`[id]/import/page.tsx:116`** — använder `digestFor(...)` i stället för
   `sha256`.

### Del 2 — strukturvyn

6. **`packages/engine/src/import.ts`** — `buildFileTree(files) → TreeNode[]`, ren och testbar:
   sökvägar in, sorterat träd ut (kataloger före filer, alfabetiskt), med summerade storlekar.
7. **`apps/web/src/features/import/ProjectTree.tsx`** (ny) — serverkomponent som renderar trädet.
   Sökvägar renderas som text (React escapar), aldrig `dangerouslySetInnerHTML`.
8. **`apps/web/src/app/app/projects/[id]/import/page.tsx`** — nytt kort "Ditt projekt" med trädet,
   ovanför evidenstabellen.

### Del 3 — sammanslagen nedladdning

9. **`apps/web/src/features/import/archive-cache.ts`** (ny, klient) — IndexedDB: `cacheArchive`,
   `readCachedArchive`, båda per `projectId`. Kvotfel kastas inte vidare utan rapporteras.
10. **`actions.ts`** — `importProjectAction` returnerar `{ projectId }` i stället för att redirecta,
    så klienten hinner cacha arkivet innan navigeringen.
11. **`ImportForm.tsx`** — cachar arkivet efter lyckad import och navigerar sedan. Misslyckas
    cachningen visas det direkt, med beskedet att nedladdningen kommer be om arkivet igen.
12. **`apps/web/src/features/import/MergedDownload.tsx`** (ny, klient) — hämtar Airrows filer från
    `/api/projects/[id]/zip`, läser det cachade arkivet (eller ber om det), varnar vid låg
    sökvägsöverlappning, slår ihop med JSZip och laddar ner. JSZip lazy-laddas.
13. **`packages/engine/src/import.ts`** — `mergeOverlay(theirs, ours)`: ren funktion som beskriver
    sammanslagningen, så regeln "Airrow vinner vid krock" testas utan webbläsare.
14. **`apps/web/src/app/(legal)/privacy/page.tsx`** — strukturen lagras, innehållet inte.

**No change needed:** `applyResolutions` och konfliktlogiken. Servern skickar redan exakt de filer
som är säkra att skriva; sammanslagningen lägger dem bara ovanpå founderns träd.

---

## Data model

_Any database change. Most specs have none — say so plainly._

**Inga nya tabeller.** Strukturvyn läser `import_files` som den ser ut idag.

**En ny kolumn:** `import_files.digest_version` (eller motsvarande på `import_sources`, om versionen
gäller hela importen — avgörs i `/implement`). Peppringen ändrar vad `digest` innehåller, inte dess
form, men utan en version går nyckeln inte att rotera: varje gammal digest skulle sluta matcha och
hela founderns projekt läsa som konflikter. Billigt nu, smärtsamt att lägga till senare.

Migrationen följer datainvarianterna: replayar rent från noll, RLS gäller redan för tabellen, och
ändringen sker enbart via `supabase/migrations`.

---

## Security

_Two lines at most: what this opens up and who may reach it._

Hela poängen är att **inte** utöka vad vi lagrar: strukturen (sökvägar och storlekar) stannar i
databasen, innehållet lagras aldrig, och sammanslagningen sker hos foundern. Peppringen tar bort den
sista återstående läckagevägen — en rå SHA-256 av en kort, strukturerad fil (t.ex. en `.env`-rad) är
gissningsbar, en HMAC med en nyckel utanför databasen är det inte.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- Cachat arkiv saknas (annan dator, rensad webbläsardata) → foundern ombeds välja sitt arkiv igen;
  samma kodväg bygger den sammanslagna ZIP:en.
- Arkivet får inte plats i IndexedDB vid importen → foundern får veta det direkt, med beskedet att
  nedladdningen kommer be om arkivet igen. Importen avbryts inte.
- Foundern väljer ett *annat* arkiv än det som importerades → **sökvägarna** jämförs mot
  `import_files`; vid dålig överlappning varnar vi men blockerar inte. Founders hinner ändra sina
  filer mellan import och nedladdning, så exakt matchning vore fel krav.

  **Rättelse mot `/clarify`:** beslutet sa "sökvägar och digester". Digestjämförelsen går inte att
  göra — peppringen gör digesten omöjlig att räkna om i webbläsaren, och sammanslagningen sker just
  där. De två besluten är oförenliga, och peppringen väger tyngre. Sökvägsöverlappning räcker
  ändå för det den ska fånga: väljer man fel projekt är överlappningen nära noll.
- Projektet skapades utan import → nedladdningen beter sig precis som idag.

---

## Implementation notes

### Konstitutionskontroll före kod
- **Motorn förblir ren.** `buildFileTree`, `mergeOverlay` och `pathOverlap` är rena funktioner utan
  I/O eller env. Peppret läses enbart i app-lagret (`features/import/digest.ts`) och skickas in som
  parameter, precis som `digestImported` redan tog emot digest-funktionen.
- **Otrodd text renderas sanerat.** Trädet renderar sökvägar som text; React escapar dem, och
  ingenting går via `dangerouslySetInnerHTML`.
- **Ingen ny lagring av innehåll.** Enda schemaändringen är `digest_version`.

### Avvikelse: sökvägar, inte digester, vid fel arkiv
`/clarify` beslutade både att peppra digesten och att klienten skulle jämföra digester när foundern
väljer om sitt arkiv. De två går inte ihop — peppret är en serverhemlighet och sammanslagningen sker
i webbläsaren, så klienten kan inte räkna om digesterna. Peppringen väger tyngre; jämförelsen gör
`pathOverlap` på sökvägar i stället. Rättat i _Edge cases_ innan koden skrevs (konstitutionen §IV:
när kod och spec är oense rättas specen först).

### Avvikelse: en gren, tre commits
Specen säger tre PR:er. En issue-gren ger en PR mot feature-grenen, så delarna ligger som tre
åtskilda commits på samma gren i stället. Vill ni ha tre PR:er på riktigt måste #68 delas i tre
issues — säg till, det är gjort på fem minuter och grenarna kan skäras ur den här.

### Ett städat ställe utöver planen
`stripCommonRoot` var typad mot `ImportedFile` och tvingade den klientsida sammanslagningen att
hitta på ett tomt `content`-fält. Den är nu generisk över `{ path: string }` — samma beteende, och
`ImportedFile` uppfyller fortfarande signaturen.

### Verifiering (kört 2026-07-27, mot lokal Supabase)
- `pnpm -r typecheck` — rent.
- `pnpm -r lint` — rent, noll varningar.
- `pnpm -r test` — **191 gröna, 0 skippade** (engine 71, web 120).
- `pnpm test:scripts` — 13 gröna.
- `pnpm build` — kompilerar; alla rutter byggda.
- Migrationen `20260727090000_import_digest_version.sql` applicerad lokalt med
  `supabase migration up --local`.

### Körd vid ytan (`/verify`, 2026-07-27)
Hela flödet drivet i Chromium mot lokal Supabase — import, generering, nedladdning:

- **Strukturvyn** renderar trädet med kataloger före filer, summerade storlekar och rotfiler sist.
- **Peppringen:** en ny import fick `digest_version = 1`, och den lagrade digesten för
  `package.json` (`d74d80a2…`) är **inte** filens råa SHA-256 (`4d8095db…`) — vilket är exakt vad
  den tidigare, opeppade importen lagrade. Den gamla importen (version 0) hittar fortfarande sina
  2 konflikter, så bakåtkompatibiliteten håller.
- **Sammanslagen nedladdning:** arkivet innehöll **25 filer** — founderns 5 (`package.json`,
  `README.md`, `src/app.ts`, `.github/workflows/ci.yml`, `supabase/migrations/0001_init.sql`) plus
  Airrows 20. `README.md` var founderns (`# Loop CRM`), eftersom konflikten låg oavgjord.
- 🔍 **Projekt utan import** laddar fortfarande ner via vanlig länk
  (`scratch-built-foundation.zip`), ingen sammanslagningsknapp — ingen regression för det vanliga
  fallet.
- 🔍 **Ingen cache** (annan webbläsarprofil) → "Choose your archive" med förklaringen att Airrow
  inte har någon kopia.
- 🔍 **Fel arkiv** → "Only 0% of the files from your import are in this archive — it may be a
  different project. The download still went ahead." Varnar utan att blockera, som beslutat.

**Kvotfallet** går inte att framkalla i en riktig webbläsare, så det täcks i stället av
`archive-cache.test.ts` med stubbad IndexedDB — kvot slut, blockerad lagring och IndexedDB helt
frånvarande. Testerna är verifierade röda utan felhanteringen.

### Två gränsfall en granskare kommer att fråga om
- **`useEffect` i `ImportForm`.** §III förbjuder `useEffect` *för datahämtning*. Den här hämtar
  inget — den skriver founderns arkiv till IndexedDB och navigerar när `state.projectId` dyker upp.
  Inom regeln, men det är den enda `useEffect` i kodbasen.
- **`fetch` från en klientkomponent** i `MergedDownload`. §I förbjuder externa anrop från
  klientkomponenter — Claude API, Supabase, GitHub App. Det här är ett same-origin-anrop till vår
  egen route handler, alltså inte det invarianten skyddar mot.

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- Att lagra kundens källkod server-side, permanent eller med TTL. Samma exponering, bara kortare.
- Att kunna öppna och läsa en fil i Airrow. Det kräver innehåll och bryter hela ramen. Strukturvyn
  är medvetet svaret på produktmålet; visar det sig otillräckligt tas det som en egen issue, med
  integritetspolicy och hemlighetsscanning som en del av den diskussionen.
- Att exkludera `.env` från importen — #32 vill att Airrow genererar en `.env`, och då måste krocken
  fortsätta synas i stället för att tyst skrivas över.
- Varningstexter och villkorsändringar — de ägs av [#70](https://github.com/MS-Flow/airrow/issues/70).
