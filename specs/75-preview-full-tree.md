# Spec 75 — Preview visar hela strukturen

> **In one sentence:** Preview ska visa hela projektet i ett träd — founderns egna filer *och* Airrows
> genererade — så att man ser slutresultatet, utan att vi lagrar en rad av founderns innehåll.

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Status**     | ✅ Done                                                                                 |
| **Issue**      | #75 — "Preview ska visa hela strukturen — founderns filer och Airrows i ett träd"       |
| **Branch**     | `75-preview-full-tree` (from `feature/import-existing-projects`)                        |
| **Feature**    | Import existing projects                                                               |
| **Depends on** | [`68-workspace-tree-merged-zip.md`](68-workspace-tree-merged-zip.md) — `buildFileTree`, `ProjectTree` och den klientsida sammanslagningen finns redan; [`63-import-existing-projects.md`](63-import-existing-projects.md) — `import_files` och konfliktlogiken |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
[NEEDS CLARIFICATION: …] markers are resolved by /clarify.
-->

---

## User story

_Who wants this, and what they get out of it._

As a **grundare som importerat ett projekt** I want **se mina egna filer och Airrows i ett enda träd i
preview** so that **jag förstår hur projektet faktiskt kommer att se ut när det är nedladdat, i stället
för att bara se Airrows halva av det.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Idag:** [`preview/page.tsx:35`](../apps/web/src/app/app/projects/%5Bid%5D/preview/page.tsx#L35)
  skickar in `artifact.files` och ingenting annat, så preview-trädet i
  [`PreviewBrowser.tsx:26`](../apps/web/src/features/preview/PreviewBrowser.tsx#L26) innehåller enbart
  de ~21 filer Airrow genererat.
- **Problemet:** en founder som importerat ett projekt med 114 filer ser inga av dem i preview, och
  kan inte se hur delarna ligger i förhållande till varandra — trots att ZIP:en innehåller båda.
- **Redan på plats:** spec 68 byggde `buildFileTree` och `ProjectTree`, men placerade trädet på
  importsidan (`/app/projects/[id]/import`) — en granskningsvy man besöker en gång. `import_files`
  innehåller redan sökväg, storlek och en peprad digest, alltså allt trädet behöver.
- **Ramen:** vi lagrar inte founderns filinnehåll. Se _Security_.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

Preview-trädet byggs ur founderns `import_files` **union** artifaktens filer, med tydlig märkning av
vem varje fil kommer från. Airrows filer öppnas och redigeras precis som idag; founderns visas som
struktur och kan inte öppnas, eftersom innehållet inte finns server-side.

**Founderns filer är dämpade och inte klickbara**, med en rad i railen som förklarar varför (Airrow
har inte innehållet — det följer med i nedladdningen från founderns eget arkiv). Utöver det finns en
toggle **"Visa mitt projekt"** som filtrerar bort dem, så railen kan kokas ner till Airrows filer när
man arbetar i dem. Alltså (a) + (c) ur issuens tre kandidater: ett klick som inte ger något (b) är
sämre än en rad som aldrig ser klickbar ut.

**Trädet på importsidan från #68 tas bort.** Ett träd, ett ställe — importsidan behåller diff,
evidens och konfliktbesluten, som är vad man går dit för. `ProjectTree`-komponenten ersätts av
preview-varianten.

**Rättelse mot `/clarify`:** beslutet sa att `buildFileTree` "lever kvar och används" av
preview-trädet. Det går inte ihop med två andra beslut: storlekar visas inte längre någonstans, och
preview-trädet behöver i stället veta *källa* per nod. `buildFileTree` (storleksrullning, ingen källa)
ersätts därför av `buildPreviewTree` (källa, ingen storlek) — samma nästling och sortering, och
`PreviewBrowser`s egen tredje trädbyggare försvinner samtidigt. Ett trädbygge i kodbasen i stället för
tre, ingen död kod. Rättat i specen före koden (konstitutionen §IV).

**Konflikter visas som en rad**, märkt som konflikt, och den raden öppnar **Airrows** version — den vi
faktiskt har innehållet för. Importsidans beslut står som text på raden och i läsaren ("din version
behålls i nedladdningen" när konflikten är oavgjord), med en väg tillbaka till importsidan för att
ändra beslutet. Två syskonrader på samma sökväg vore tydligare om krocken men skulle ljuga om
filsystemet.

**Not touched:** konfliktlogiken, `applyResolutions` och själva sammanslagningen i `MergedDownload`
— dess *presentation* är däremot omgjord (en knapp, toast i stället för ett stycke i headern), se
_Implementation notes_. Redigeringsflödet för Airrows filer är orört.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] Preview-trädet innehåller både founderns importerade filer och Airrows genererade, i samma
      hierarki, sorterat som ett riktigt filträd.
- [x] Varje rad visar vem filen kommer från: founderns filer är dämpade (fg-muted/faint-tokens) och
      märkta `yours`, Airrows renderas som idag. Ingen hårdkodad färg — designsystemets tokens.
- [x] Founderns filer går inte att klicka på, och railen förklarar varför — de ser aldrig ut som en
      trasig länk.
- [x] En toggle "Visa mitt projekt" filtrerar bort founderns filer ur trädet; Airrows filer påverkas
      inte, och valet gäller bara trädet (inget nytt lagrat tillstånd krävs).
- [x] Founderns filer visar **namn, inte storlek** — railen är smal och namnen är det trädet handlar om.
- [x] Airrows filer öppnas, redigeras och deep-linkas precis som idag; inget i den befintliga
      preview-funktionen försämras.
- [x] En konflikt visas som **en** rad, märkt som konflikt, som öppnar Airrows version. Raden och
      läsaren återger importsidans beslut (oavgjord = founderns version vinner i nedladdningen) och
      länkar till importsidan för att ändra det.
- [x] Headern visar antalen uppdelat — founderns respektive Airrows filer, t.ex.
      "114 yours · 21 from Airrow · engine v3" — i stället för bara `artifact.manifest.fileCount`.
- [x] Founderns kataloger renderas kollapsade som default, så ett projekt med tusentals filer inte
      lägger tusentals noder i DOM:en. Ingen virtualisering, inget nytt beroende.
- [x] Ett projekt som inte importerats ser exakt likadant ut som idag — samma träd, samma header.
- [x] Ingenting av founderns filinnehåll lagras eller passerar server-side för den här vyn; trädet
      byggs ur `import_files` (sökväg, storlek, peprad digest).
- [x] Sökvägar behandlas som otrodd text och renderas sanerat.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **Nya tester** — [`packages/engine/src/import.test.ts`](../packages/engine/src/import.test.ts)
  (+13, ersätter #68:s 6 `buildFileTree`-test): `mergePreviewFiles` (union en gång per sökväg,
  källa per fil, identiskt innehåll är Airrows fil och inte en konflikt, båda konfliktbesluten,
  och att ett oimporterat projekt ger enbart `"airrow"`) och `buildPreviewTree` (nästling,
  kataloger före filer, `yoursOnly` bara när ingenting under går att öppna, källa hela vägen ner,
  full sökväg per nod, inga `content`/`bytes`-fält, tomt projekt).
- **Nya tester** — [`apps/web/src/features/preview/PreviewBrowser.test.tsx`](../apps/web/src/features/preview/PreviewBrowser.test.tsx)
  (8): båda filkällorna i ett träd, founderns rader är inte knappar och railen säger varför, varje
  sådan rad bär märkningen `yours`, Airrows filer deep-linkas som förut, toggeln tar bort founderns
  filer *och* katalogerna som bara innehöll dem, ingen toggle utan import, och konfliktnoten säger
  rätt sak för båda besluten.
- **Kollapsade kataloger** — inget nytt behövdes: `openSet` startar med enbart den aktiva filens
  föräldrar öppna, så en katalog med tusen filer renderar noll noder tills den öppnas.
- **Ingen ny lagring** — inga schemaändringar; `loadPreviewFiles` läser `listImportFiles` (sökväg,
  storlek, digest) och skickar bara sökväg + källa till klienten.
- Full svit + typecheck/lint/build: se _Implementation notes_.
- **Ännu inte kört vid ytan** (webbläsare mot lokal Supabase) — se _Implementation notes_.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

### Motorn (ren, testbar utan webbläsare)

1. **`packages/engine/src/import.ts`** — `buildFileTree` + `FileTreeNode`
   ([:308–371](../packages/engine/src/import.ts#L308-L371)) ersätts av:
   - `PreviewFileSource = "yours" | "airrow" | "conflict_keeps_yours" | "conflict_takes_airrow"` —
     fyra lägen i stället för tre plus en boolean, så UI:t har en enda switch och konfliktbeslutet
     ligger i typen.
   - `mergePreviewFiles(yours, airrow, conflicts, resolutions) → PreviewFileEntry[]` — union av
     sökvägar, källa per fil, sorterat. Konflikterna kommer från `diffAgainstExisting`
     ([:275](../packages/engine/src/import.ts#L275)), som redan är enda stället som avgör vad en
     konflikt *är*; identiskt innehåll är alltså inte en konflikt utan bara Airrows fil.
   - `buildPreviewTree(entries) → PreviewTreeNode[]` — diskriminerad union (`kind: "file" | "directory"`),
     kataloger före filer och alfabetiskt som förut. Katalognoder bär `yoursOnly`, sant när ingenting
     under dem går att öppna, vilket är precis vad railen behöver för att dämpa dem.
2. **`packages/engine/src/index.ts:24,35`** — exporten byts från `buildFileTree`/`FileTreeNode` till
   de nya namnen.

### Appen

3. **`apps/web/src/features/preview/project-files.ts`** (ny, server) — `loadPreviewFiles(projectId,
   jobId, generated)`: `getImportSource` → `listImportFiles` + `listConflictResolutions` →
   `diffAgainstExisting` med `digestFor(source.digestVersion)` → `mergePreviewFiles`. Returnerar
   `{ entries, yoursCount }`. Utan import görs inga extra frågor och varje fil blir `"airrow"`.
   Logiken hamnar i feature-lagret, inte i routen (§I).
4. **`apps/web/src/app/app/projects/[id]/preview/page.tsx:35`** — hämtar `entries` via (3) och skickar
   dem till `PreviewBrowser` jämte dagens `files`. Headern
   ([:52–54](../apps/web/src/app/app/projects/%5Bid%5D/preview/page.tsx#L52-L54)) visar
   `"N yours · M from Airrow"` när `yoursCount > 0`, annars dagens `"M files"`.
5. **`apps/web/src/features/preview/PreviewBrowser.tsx`** — den lokala `buildTree`/`TreeDir`
   ([:19–105](../apps/web/src/features/preview/PreviewBrowser.tsx#L19-L105)) ersätts av
   `buildPreviewTree` över de filtrerade `entries`:
   - founderns rader är `<span>`, inte `<button>`, i `text-fg-faint` — aldrig klickbara;
   - en rad i railens huvud förklarar varför, plus en toggle **"Show my project"**
     (`aria-pressed`, klientstate, inget lagrat);
   - konfliktrader får `FileWarning`-ikonen (samma som `ConflictRow`) och beslutet i klartext
     (`yours kept` / `Airrow's`), och öppnar Airrows innehåll;
   - läsaren visar en not för en konfliktfil med beslutet och en länk till importgranskningen.
6. **`apps/web/src/app/app/projects/[id]/import/page.tsx:47–54`** — kortet "Your project" och
   `buildFileTree`-importen tas bort; `listImportFiles` används fortfarande av diff-sektionen.
7. **`apps/web/src/features/import/ProjectTree.tsx`** — tas bort (ersatt av railen).
8. **`docs/architecture/SYSTEM_OVERVIEW.md:64`** — steg 5 "Show" beskriver preview-trädet i stället
   för importsidans strukturvy (§IV: docs i samma ändring).

**No change needed:** `applyResolutions`, `diffAgainstExisting`, `MergedDownload`, `saveGeneratedFileAction`
och konfliktbesluten på importsidan. Kollaps av kataloger finns redan — `openSet`
([:128](../apps/web/src/features/preview/PreviewBrowser.tsx#L128)) startar med bara den aktiva filens
föräldrar öppna, så tusentals filer ger inte tusentals DOM-noder.

### Constitution check (före kod)

- **§I motorn ren:** `mergePreviewFiles`/`buildPreviewTree` är rena funktioner utan I/O eller env;
  digest och Supabase stannar i app-lagret. Klienten får importera dem — `MergedDownload` gör redan så.
- **§I typer:** diskriminerad union för trädnoder, fyra namngivna källor i stället för
  boolean-flaggor, inga `any`.
- **§II data:** inga nya tabeller, inga nya kolumner; `import_files` läses via `listImportFiles`, som
  redan är org-scopad genom RLS. Founderns filinnehåll finns aldrig i vyn.
- **§III design:** bara befintliga tokens (`text-fg-faint`, `text-info`, `bg-info/10`), inga hex/px;
  ikoner från `lucide-react` som i dag.
- **§V test:** ren logik i motorn får enhetstester; railens beteende får ett komponenttest.

---

## Data model

_Any database change. Most specs have none — say so plainly._

**Inga schemaändringar.** Trädet läser `import_files` som den ser ut idag (spec 63/68).

---

## Security

_Two lines at most: what this opens up and who may reach it — or "nothing security-relevant, because …"._

Vyn utökar inte vad vi lagrar: founderns sökvägar och storlekar finns redan i `import_files` bakom
RLS, och innehållet lagras aldrig. Sökvägar kommer från founderns arkiv och är otrodd text — de
renderas som text, aldrig via `dangerouslySetInnerHTML`.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- Projekt utan import → trädet är exakt dagens, ingen tom "ditt projekt"-sektion.
- Importen innehöll noll filer → samma som ovan.
- Founderns fil och Airrows fil har samma sökväg (konflikt) → en rad, märkt som konflikt, som öppnar
  **Airrows** version; importsidans beslut står som text (oavgjord = founderns version vinner i
  nedladdningen).
- Toggeln "Visa mitt projekt" stängs av medan founderns fil är "aktiv" i URL:en → aktiv fil faller
  tillbaka på `README.md` precis som när en okänd `?file=` anges idag.
- Ignorerade kataloger (`node_modules` m.fl.) → utelämnas helt och tyst. De ligger inte i
  `import_files`, så trädet nämner dem inte alls — ingen "(ignorerad)"-rad. Trädet visar vad som
  hamnar i nedladdningen, och `node_modules` gör inte det.
- Väldigt stort träd (tusentals filer) → founderns kataloger är kollapsade som default, så DOM:en
  hålls liten. Ingen virtualisering; blir det ändå tungt tas det som en egen issue.

---

## Implementation notes

### Verifiering (kört 2026-07-27, om efter `/analyze`-fixen)
- `corepack pnpm -r typecheck` — rent.
- `corepack pnpm -r lint` — rent, noll varningar.
- `corepack pnpm -r test` — **213 gröna, 0 skippade** (engine 78, web 135). Inga kända
  pre-existerande fel.
- `corepack pnpm test:scripts` — 13 gröna.
- `corepack pnpm --filter web build` — kompilerar, alla 15 rutter byggda. Första försöket dog i
  `/_not-found`-prerendret på en gammal `.next`-cache; rent efter `rm -rf apps/web/.next`. Inte
  relaterat till ändringen.
- Kvar: en körning vid ytan i webbläsaren mot lokal Supabase (import → generering → preview), som
  #68 gjorde. Kriterierna ovan är täckta av tester, men konfliktnoten och toggeln är inte sedda
  i verkligt UI ännu.

### Ett trädbygge i stället för tre
Innan den här ändringen fanns tre: motorns `buildFileTree` (storlekar), `PreviewBrowser`s lokala
`buildTree`, och `ProjectTree`s rendering av den första. Nu finns `buildPreviewTree` i motorn och
en `Node`-komponent som renderar den. Den lokala trädbyggaren rättade samtidigt en dubbelräknad
indentering: rotkataloger låg tidigare på 16 px och deras filer på 32 px, nu 4 px respektive 20 px —
samma stege, men utan hoppet i första steget.

### Konflikter ligger i typen, inte i en sidokarta
`PreviewFileSource` har fyra lägen (`yours`, `airrow`, `conflict_keeps_yours`,
`conflict_takes_airrow`) i stället för tre plus en separat beslutskarta till klienten. Ett fält att
hålla i synk i stället för två, och UI:t har en switch. Vad som *är* en konflikt avgörs fortfarande
bara av `diffAgainstExisting` — identiskt innehåll på samma sökväg är alltså Airrows fil, öppningsbar
och utan varning.

### Toggeln gäller founderns filer, inte konflikterna
"Show my project" filtrerar `source === "yours"`. En konfliktrad är Airrows fil (den vi har innehåll
för) och stannar därför kvar — annars skulle den enda vägen till Airrows förslag försvinna med
toggeln. Kataloger som bara innehöll founderns filer försvinner med dem, eftersom trädet byggs om ur
den filtrerade listan.

### Rättat av `/analyze`: märkningen per rad
Första implementationen lät dämpningen, ikonen och den förklarande raden i railens huvud bära hela
budskapet — ingen rad sa *vems* filen var. Det höll inte mot kriteriet ("märkta som hens") och inte
mot skissen som valdes i `/clarify`, och det var inkonsekvent: konfliktrader hade redan en
högerställd etikett. Founderns rader bär nu `yours`
([`PreviewBrowser.tsx:51`](../apps/web/src/features/preview/PreviewBrowser.tsx#L51)), och ett test
låser fast det så det inte kan försvinna tyst igen.

**Airrows rader är medvetet omärkta.** Skissen visade `Airrow` på dem också, men i en 288 px rail blir
en etikett på varje rad brus — och varje klickbar, odämpad rad *är* Airrows. Distinktionen bärs alltså
av `yours` plus dämpningen; behövs symmetrin senare är det en rad kod.

### Nedladdningsknappen: en kontroll, inga stycken i headern
Sett i verkligheten (och det var vad ytkörningen skulle ha fångat): `MergedDownload` renderade sitt
förklarande stycke **inne i** preview-headerns flexrad, så texten la sig mellan "Change answers" och
"Continue locally" och headern blev tre rader hög. Värre: första klicket på "Download project" gjorde
ingenting synligt utom att föda en andra knapp — så knappen läste som trasig, precis som den
rapporterades.

Åtgärdat genom att göra knappen självförsörjande:

- **Ett** kontrollelement. Allt tillfälligt (varning, fel, "välj ditt arkiv") går via `useToast`, som
  redan finns i `app/layout.tsx` — inget stycke som en headerrad inte kan bära.
- Om arkivet saknas **öppnar första klicket filväljaren direkt**, med en toast som säger varför. Det
  kräver att svaret finns *före* klicket, eftersom en filväljare bara får öppnas i ett äkta
  användargest — därav `hasCachedArchive` (ny, `store.count`), som svarar utan att läsa tillbaka en
  50 MB-blob. Knappen är disabled den lilla stund kontrollen tar.
- Skulle cachen försvinna mellan mount och klick är gesten förbrukad; då säger toasten "click
  Download again to choose it" i stället för att en blockerad dialog tiger.

Regressionstest: [`MergedDownload.test.tsx`](../apps/web/src/features/import/MergedDownload.test.tsx)
(4) — filväljaren öppnas på första klicket när cachen är tom, den öppnas *inte* när arkivet finns,
knappen är fortfarande ett enda element, och den är disabled tills lagringskollen svarat. Plus 3 nya
i `archive-cache.test.ts` för `hasCachedArchive`.

### Disclaimern skriven om, på två ställen
"Airrow doesn't keep a copy of your code, and this browser no longer has the archive you imported"
läste som en undanflykt: den ledde med vad vi *inte* gör, i en mening som inte tog slut. Den och
railens motsvarighet är omskrivna så att de leder med saken själv — att koden aldrig lämnade
maskinen — och båda låter nu som samma produkt:

- `MergedDownload` (arkiv saknas): "Your code never left your machine, so the download needs the
  archive you imported — and this browser doesn't have it. Choose it again and you'll get your whole
  project."
- Railen (founderns filer): "Your files show as names only — Airrow stored the structure, never the
  contents. The download takes them from your own archive."

`MergedDownload` stod som "Not touched" i planen; det gäller fortfarande dess logik, men texten är
alltså ändrad. Rättat i _Design decision_ i stället för att låta specen ljuga (konstitutionen §IV).
Railtestet låser den nya formuleringen.

### Två gränsfall en granskare kommer att fråga om
- **`@airrow/engine` importerad i en klientkomponent.** `buildPreviewTree` är ren (ingen I/O, ingen
  env), och `MergedDownload` gör redan samma sak sedan #68. Invarianten som förbjuder externa anrop
  från klienten gäller Claude/Supabase/GitHub, inte rena funktioner.
- **`if (!job || !artifact)` i preview-routen.** `artifact` fanns bara om `job` var klart, men TS kan
  inte se sambandet när `job.id` används efteråt. Guarden säger nu samma sak explicit i stället för
  att en `as`-cast skulle behövas.
- **`paddingLeft` i px på trädraderna.** §III förbjuder hårdkodade px, men indenteringen är
  `depth * 12` och kan inte uttryckas som en token-klass utan en klass per djup. Beteendet är
  oförändrat från före ändringen; färger och typografi använder tokens genomgående.

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- Att kunna öppna och läsa founderns filer. Det kräver att vi lagrar innehållet — hela ramen vi valt
  bort (#68).
- Att lagra founderns källkod i någon form.
- Export till GitHub — väntar på GitHub App-integrationen (#67).
