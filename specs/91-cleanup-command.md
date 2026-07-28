# Spec 91 — `/cleanup`: rätt kommando för rätt ursprung

> **In one sentence:** Ett genererat projekt ska veta om det kom från noll eller från en import — nya
> projekt får `/start`, importerade får ett nytt `/cleanup` som skräddarsyr dokumenten efter den kod
> som redan finns, utan att röra koden.

|                |                                                                                      |
| -------------- | ------------------------------------------------------------------------------------ |
| **Status**     | ✅ Done                                                                               |
| **Issue**      | #91 — "Nytt vs. importerat projekt: /start bara på nya, nytt /cleanup bara på importerade" |
| **Branch**     | `91-cleanup-command` (from `feature/import-existing-projects`)                        |
| **Feature**    | Import existing projects                                                               |
| **Depends on** | [63-import-existing-projects.md](63-import-existing-projects.md) — importflödet, den deterministiska analysen och `import_sources` som gör "importerad" känt · [66-start-command.md](66-start-command.md) — `/start`, kommandoformen och den §0-amendering `/cleanup` måste passa in i · [65-authored-documents.md](65-authored-documents.md) — äger `TOOLCHAIN_SLOTS` och prosan som `/cleanup` skriver om |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Canonical single-file spec format for Airrow. One file per issue: specs/NNN-kort.md. It holds the WHAT,
the HOW (exact file:line changes), acceptance criteria, verification and edge cases together — do NOT
split into separate plan.md / tasks.md files.
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
Mark anything undecided inline with [NEEDS CLARIFICATION: …] so /clarify can find it.
Keep the section names as they are — the slash commands and the constitution refer to them by name.
-->

---

## User story

_Who wants this, and what they get out of it._

As a **grundare som importerat en kodbas som redan kör** I want **ett kommando som läser mitt projekt
och skräddarsyr foundationens dokument efter det som faktiskt finns** so that **mina framtida specs
skrivs mot verkligheten i mitt repo — i stället för att jag får ett `/start` som vill scaffolda en
stack ovanpå den jag redan har.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Idag:** två spår har byggts parallellt och möts inte. Intervju + LLM-författande (#65, #10) och
  `/start` ([`template/.claude/commands/start.md`](../template/.claude/commands/start.md), #66) på ena
  sidan; import av existerande projekt (#63) på den andra. Båda går genom samma
  `generate(templateFiles, projectModel)`.
- **Problemet:** motorn kan inte skilja fallen åt. `ProjectModel`
  ([`types.ts:78`](../packages/schemas/src/types.ts#L78)) har inget ursprungsfält, och `validate()`
  kräver `.claude/commands/start.md` i **varje** foundation
  ([`index.ts:75`](../packages/engine/src/index.ts#L75)). En founder som importerar ett projekt som
  redan kör får därför ett kommando vars första steg är `create-next-app` och en toolchain-install
  ovanpå en kodbas som redan har båda.
- **Redan på plats:** "importerad" är känt i appen via `getImportSource()`
  ([`store.ts`](../apps/web/src/lib/data/store.ts), satt i
  [`import/actions.ts:71`](../apps/web/src/features/import/actions.ts#L71)); `shipsPath(model, path)`
  ([`scaffold.ts:382`](../packages/engine/src/scaffold.ts#L382)) är den befintliga kroken för "vilka
  filer ingår för den här modellen" (används redan för `.github/` vs. `azure-pipelines`); och
  kommandoformen finns — sju filer under `template/.claude/commands/`, varav `/start` är den senaste.
- **Inte på plats:** motorn får inte läsa databasen (§I, "the engine stays pure"), så ursprunget måste
  in i modellen — det kan inte härledas i genereringen.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

Ursprunget blir data på projektmodellen, satt där projektet skapas och aldrig gissat i motorn.
`shipsPath()` väljer kommandofil per ursprung, och `validate()` kräver rätt kommando i stället för
`start.md` villkorslöst. `/cleanup` är instruktionstext av samma slag som `/start` — den körs av
foundern, i founderns repo, med founderns assistent, och den skriver bara dokument.

Att `/cleanup` körs hos foundern är hela poängen: importanalysen i #63 är avsiktligt deterministisk
och manifestbaserad, och kundens kod lämnar aldrig requesten som analyserade den. `/cleanup` kan läsa
allt — utan att något av det passerar Airrows servrar.

**Ursprunget är ett fält på `ProjectModel`, härlett vid genereringstillfället.** Server-koden slår upp
`import_sources` när jobbet startar och sätter fältet; motorn läser det och gissar aldrig. Ingen
migration — `import_sources` är redan sanningen om att projektet importerades, och att spegla den i en
kolumn på `projects` vore två källor till samma faktum (§IV, "a fact lives in exactly one file").

**Analysen avgör vilket kommando ett importerat projekt får.** Ett importerat projekt utan
kodsignal — inget manifest, ingen källkod, bara dokument — har ingenting att kartlägga, så det får
`/start` i stället. Det gör kommandovalet beroende av analysen, vilket är avsiktligt: den är
deterministisk och testbar (#63), och alternativet är att skicka ett `/cleanup` till en founder som
inte har något att städa. Fortfarande **exakt ett** kommando per foundation.

Följden för modellen: ursprunget behöver bära både varifrån projektet kom och om analysen såg en
stack. Skrivs som en diskriminerad union enligt §I — `{ kind: "new" } | { kind: "imported";
stackDetected: boolean }` — inte som två lösa booleaner. `analyzeImport()` får motsvarande fält på
`ImportAnalysis` så att predikatet är ett, deterministiskt och testbart på samma ställe som resten av
analysen.

### Tillägg: en oavgjord konflikt levererar båda versionerna

Rapporterat av foundern efter första skarpa körningen: ett importerat projekt laddades ner och
`README.md` var fortfarande deras gamla — Airrows version fanns inte någonstans i arkivet.

Orsaken var `applyResolutions` ([`import.ts`](../packages/engine/src/import.ts)): en konflikt som
foundern inte tagit ställning till **släppte** Airrows fil helt. Följden är värre än en gammal README:
ett importerat projekt kunde få en foundation utan `CLAUDE.md`, utan `README.md` — foundationens egna
dokument saknades i foundationen, och `/cleanup` hade ingenting att stämma av mot.

En oavgjord konflikt levererar nu **båda**: founderns fil behåller sin sökväg, Airrows kommer bredvid
som `README.airrow.md` (suffixet före filändelsen, så filen fortfarande öppnas som det den är).
Ingenting skrivs över, vilket är det spec 63 faktiskt lovade — löftet var aldrig att Airrows version
skulle kastas, utan att founderns aldrig skulle skrivas över tyst.

**Suffixet är `.airrow`, inte `.new`.** Det säger vem filen kommer från i stället för hur gammal den
är, vilket är den upplysning som faktiskt behövs: en founder som ser `README.airrow.md` bredvid sin
egen vet direkt vilken som är vems, och `/cleanup` behöver ingen förklaring för att veta vilken den
äger. Att namnet bär produkten är en bonus, inte skälet.

Ett **uttryckligt** "Keep mine" levererar fortfarande ingenting. Där har foundern bestämt sig, och en
sidecar de sagt nej till är fortfarande en fil de sagt nej till (§0, founder-in-control).

**Bara markdown får en sidecar.** Den första versionen gav alla konflikter en, vilket producerade
`.github/workflows/ci.airrow.yml` i ett projekt som redan hade en egen CI — och GitHub Actions kör varje
`.yml` i den mappen. Foundern hade fått en andra pipeline igång, som failar på kommandon projektet
kanske inte har, i den enda fil `/cleanup` är förbjuden att laga. En sidecar finns för att `/cleanup`
ska kunna jämka två versioner av ett *dokument*, och markdown är precis den mängd den får skriva om.
Övriga konflikter beter sig som förut: oavgjord ⇒ inget levereras, och `/cleanup` rapporterar det.

Det ersätter också `.old`-mekaniken i `/cleanup` steg 4: kommandot behöver inte längre gräva i
git-historiken efter en version som skrevs över — båda filerna ligger på disk, tydligt märkta.

### Tillägg: `/cleanup` sätter också upp branchmodellen

Hela arbetssättet vilar på brancherna — `/createspec` klipper en, `/pr-check` öppnar PR mot den
ovanför, och CI- och deployreglerna känner igen dem på namnet. Ett importerat projekt kommer utan
dem, och dokument som beskriver en struktur som inte finns hjälper ingen.

`/cleanup` skapar därför det som saknas, lokalt: `develop` från trunken, sedan första
`feature/<name>`. Inget `.git` alls ⇒ `git init -b main` och en första commit, som `/start` gör.

**Trunken döps aldrig om.** Heter den `master` får den heta `master`: ett namnbyte slår sönder
branch protection, öppna pull requests och varje CI-trigger som pekar på det gamla namnet, och
ingenting av det kan kommandot laga. I stället skrivs *dokumenten* om — `BRANCHING.md` och
`CLAUDE.md` är skrivna kring `main` — så att de namnger branchen som faktiskt finns. Formen är
regeln (trunk ← `develop` ← `feature/<name>` ← issue-branch); trunkens namn är ett faktum om repot,
och att beskriva verkligheten är precis vad `/cleanup` är till för.

Gränserna är desamma som för resten av kommandot: ingen remote, ingen historik som skrivs om (aldrig
`rebase`, `reset --hard` eller `--force`), ingen branch som döps om eller tas bort, och founderns
oincheckade arbete committas inte — utom den enda första commiten i ett repo som inte hade git alls.

**Not touched:** `/start` självt — dess innehåll och beteende är oförändrat, det ändras bara vem som
får det. Importanalysen (#63), LLM-författandet (#65) och genereringsmotorns kontrakt. Ingen parallell
genereringsväg: samma `generate()`, samma modell, ett fält mer.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] Projektmodellen bär ursprunget som en diskriminerad union (`{ kind: "new" }` /
      `{ kind: "imported"; stackDetected: boolean }`), validerat med Zod, satt av server-koden från
      `import_sources` vid genereringstillfället — och aldrig gissat i motorn.
- [x] `analyzeImport()` avgör deterministiskt om det importerade trädet innehåller en kodsignal
      (manifest eller källkod; dokument och redaktörskonfiguration räknas inte), och exponerar det på
      `ImportAnalysis`.
- [x] En foundation genererad från intervjun innehåller `.claude/commands/start.md` och **inte**
      `cleanup.md`.
- [x] En foundation genererad från en import **med** kodsignal innehåller `.claude/commands/cleanup.md`
      och **inte** `start.md`.
- [x] En foundation genererad från en import **utan** kodsignal innehåller `start.md` och inte
      `cleanup.md` — samma utfall som ett nytt projekt, eftersom det inte finns något att kartlägga.
- [x] Exakt ett av de två kommandona ingår i varje foundation. Aldrig båda, aldrig inget.
- [x] `validate()` kräver rätt kommando per ursprung i stället för `start.md` villkorslöst
      ([`index.ts:75`](../packages/engine/src/index.ts#L75)); en foundation utan sitt kommando
      underkänns.
- [x] `START_HERE.md` beskriver rätt ordning för sitt ursprung, och varje kommando den nämner finns i
      det genererade repot. Inget dokument i en importerad foundation nämner `/start`.
- [x] `/cleanup` kartlägger den faktiska stacken i det importerade projektet — språk, ramverk,
      pakethanterare, testrunner, mappstruktur, konventioner, CI, deploy — och skriver om `CLAUDE.md`,
      `docs/**` och `START_HERE.md` efter den.
- [x] De `CMD_*` som dokumenten nämner efter `/cleanup` motsvarar scripts som faktiskt finns i det
      importerade projektet.
- [x] `/cleanup` hittar gammal AI-slop — föråldrade och motstridiga instruktionsfiler
      (`.cursorrules`, gamla `AGENTS.md`, `.github/copilot-instructions.md` och liknande) — och
      **rapporterar dem för foundern att ta ställning till. Den raderar aldrig en fil.**
- [x] En **oavgjord** konflikt på ett markdown-dokument levererar båda versionerna: founderns fil
      behåller sin sökväg och Airrows kommer bredvid som `<namn>.airrow.md`. Ingenting skrivs över, och
      det gäller varje dokument — inte bara `README.md`.
- [x] Ingen annan filtyp får en sidecar. En `.airrow.yml` i `.github/workflows/` vore en andra pipeline
      GitHub Actions kör; sådana konflikter levererar inget, precis som förut.
- [x] `/cleanup` letar själv upp alla `*.airrow.md`, listar dem i rapporten och arbetar igenom varenda
      en — den väntar inte på att bli tilldelad en.
- [x] `/cleanup` skapar branchmodellen ur [BRANCHING.md](../docs/architecture/BRANCHING.md) lokalt —
      `develop` och första `feature/<name>`, bara det som saknas — och `git init -b main` med en
      första commit i ett repo utan git.
- [x] En befintlig trunk döps aldrig om. Heter den något annat än `main` skrivs dokumenten om att
      namnge den branch som finns, med formen intakt.
- [x] `/cleanup` rör ingen remote, skriver aldrig om historik (`rebase`, `reset --hard`, `--force`),
      döper aldrig om och tar aldrig bort en branch, och committar inte founderns oincheckade arbete.
- [x] Ett **uttryckligt** "Keep mine" levererar fortfarande ingenting — inte heller en `.airrow`-fil.
- [x] `/cleanup` vet vilken av de två som är Airrows, skräddarsyr `.airrow`-filen efter projektet, låter
      founderns fil vara helt orörd, och lämnar bytet till foundern med kommandot utskrivet.
- [x] Importflödets egen text lovar det som faktiskt händer — konfliktraden och sammanfattningen på
      importsidan säger att en oavgjord konflikt ger en `.airrow`-fil.
- [x] `/cleanup` skriver bara om Airrows genererade dokument — `CLAUDE.md`, `docs/**`, `START_HERE.md`,
      `specs/README.md`. Founderns egna dokument läses för kontext men skrivs aldrig om, och
      `.claude/spec-kit/constitution.md` lämnas orörd: den är filen som styr alla andra.
- [x] `/cleanup` ändrar ingen applikationskod, inga beroenden, ingen konfiguration, inga migrationer
      och ingen CI-logik — granskbart i kommandots text och verifierat i en manuell körning.
- [x] `/cleanup` stannar vid maskingränsen: ingen remote, ingen provisionering, inga secrets — samma
      regel som `/start`.
- [x] `/cleanup` kört två gånger klobbar inget: andra körningen hoppar över det som redan är gjort och
      lämnar founderns egna redigeringar orörda.
- [x] `/cleanup` rapporterar vad den ändrade, vad den lämnade och vad den inte kunde härleda — det
      sista som `[NEEDS CLARIFICATION: …]` i dokumentet, aldrig som en gissning.
- [x] `pnpm engine:smoke` täcker båda vägarna: en fixture med importursprung och en utan, med rätt
      kommandofil i respektive.
- [x] Konstitutionen §0 och den genererade motsvarigheten säger vad `/cleanup` får och inte får, i
      samma ändring som koden (§IV).
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — `packages/engine/src/cleanup-command.test.ts`: `cleanup.md` renderas per modell,
  rätt kommando ingår för alla tre fallen (nytt / importerat med kodsignal / importerat utan), aldrig
  båda och aldrig inget, inget `{{SLOT}}` lämnas orenderat, och ingen `/cleanup`-foundation nämner
  `/start` i något dokument.
- **Extended** — `packages/engine/src/import.test.ts`: kodsignal-predikatet — manifest och källkod ger
  `true`, ett träd med bara dokument ger `false`, och resultatet är oberoende av filordningen (samma
  determinismkrav som resten av analysen).
- **`validate()` och `shipsPath()`** → samma nya fil, `cleanup-command.test.ts`, inte en egen. Planen
  sa `index.test.ts` / `scaffold.test.ts`; motorn har ingen `index.test.ts`, och båda beteendena är
  samma påstående som resten av filen testar — vilket kommando ett ursprung ger. Att sprida det över
  tre filer hade gjort regeln svårare att läsa, inte bättre bevisad.
- **Extended** — `scripts/engine-smoke.mjs`: en importfixture utöver de fyra befintliga.
- **Kriterierna om `.old`-omdöpning och filomfång** → granskad egenskap av texten i `cleanup.md`, plus
  den manuella körningen: `git status` efter körningen visar omdöpningar och ändrade dokument, inget
  annat, och `git show` bekräftar att den omdöpta filens innehåll är oförändrat.
- **Kriterierna om vad `/cleanup` gör och inte gör** → manuell körning, i specen: importera ett
  riktigt projekt, generera, kör `/cleanup` i det, och redovisa vad som ändrades och vad som lämnades.
  Samma resonemang som spec 66 — kommandot är instruktionstext, och de fyra buggarna där hittades av
  körningen, inte av 90 gröna enhetstester.
- **Kriteriet "ändrar ingen kod"** → granskad egenskap av texten i `cleanup.md` vid review, plus
  `git status` efter den manuella körningen: inga ändringar utanför dokument.
- Full suite result + typecheck/lint status.

#### Resultat — 2026-07-27

| Kommando | Resultat |
| --- | --- |
| `pnpm -r typecheck` | rent (3 projekt) |
| `pnpm -r lint` | rent, inga nya anmärkningar (3 projekt) |
| `pnpm -r test` | **439 gröna**, 27 skippade — schemas 35, engine 204, web 200 |
| `pnpm test:scripts` | 13 gröna |
| `pnpm engine:smoke` | SMOKE PASSED — 5 fixtures (Ledgerly är den nya importvägen) |
| `pnpm --filter web build` | rent |

De 27 skippade är pre-existerande: `*.db.test.ts`- och RLS-sviterna skippar utan lokal Supabase.
Inga nya fel, inga pre-existerande fel.

Nya tester: `cleanup-command.test.ts` (28) och `import.test.ts` (+13 — kodsignal-predikatet,
`sidecarPath` och de fyra `applyResolutions`-fallen: ny fil, oavgjord konflikt, uttryckligt val,
uttryckligt "Keep mine").

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

**Kontrakt (`packages/schemas/src/`)**

1. **`types.ts`** — `ProjectOrigin` (`{ kind: "new" } | { kind: "imported"; stackDetected: boolean }`)
   och `ProjectModel.origin`. `ImportAnalysis.stackDetected` — analysens svar på "fanns det kod att
   läsa".
2. **`index.ts`** — `projectOriginSchema` (`z.discriminatedUnion`). Ursprunget korsar en gräns:
   det härleds ur `import_sources.analysis`, en jsonb-kolumn som läses tillbaka utan validering idag.

**Motor (`packages/engine/src/`)**

3. **`import.ts`** — `hasCodeSignal(paths)`: manifest eller källkod ⇒ `true`; dokument, licenser och
   redaktörskonfiguration ⇒ `false`. `analyzeImport()` sätter `stackDetected` från den.
4. **`model.ts`** — `ResolveInput.origin`, valfritt och defaultat till `{ kind: "new" }`; ett projekt
   utan importkälla *är* nytt, så defaulten är inte en gissning. `commandFor(model)` och
   `commandPath(model)` — den enda platsen som avgör vilket kommando en foundation får.
5. **`scaffold.ts`** ([:382](../packages/engine/src/scaffold.ts#L382)) — `shipsPath()` filtrerar bort
   det kommando projektet inte ska ha. Nya renderare: `firstStep()` (START_HEREs steg 1 per
   ursprung), `commandRule()` (konstitutionsregeln), `cleanupClaim()` och `cleanupScope()`.
   `ciReadyCheck()` / `ciReadyCheckAzure()` och `setupSteps()` / `repoSetupSteps()` slutar namnge
   `/start` i en importerad foundation.
6. **`index.ts`** ([:75](../packages/engine/src/index.ts#L75)) — `validate(files, model)` kräver
   `commandPath(model)` i stället för `start.md` villkorslöst.

**Genererad output (`template/`)**

7. **`.claude/commands/cleanup.md`** — ny; form och front-matter enligt
   [`start.md`](../template/.claude/commands/start.md).
8. **`START_HERE.md`** — steg 1 blir `{{FIRST_STEP}}`; `/start` i steg 2 blir `{{FIRST_COMMAND}}`;
   meningen i steg 4 som namngav `/start` skrivs om kommandoneutralt.
9. **`.claude/spec-kit/constitution.md`** — §IV-punkten blir `{{COMMAND_RULE}}`.
10. **`.github/workflows/ci.yml`** och **`azure-pipelines.yml`** — grindens rubrik slutar namnge ett
    kommando ("Is there a stack to verify?"); själva texten kommer redan från `CI_READY_CHECK`.
11. **`.airrow-template.json`** — de fem nya tokens.

**App (`apps/web/src/`)**

12. **`features/interview/actions.ts`** ([:46](../apps/web/src/features/interview/actions.ts#L46)) —
    slår upp `getImportSource()` och skickar in ursprunget när modellen resolvas. Det är den enda
    platsen en `ProjectModel` skapas.
13. **`lib/data/store.ts`** — normaliserar två jsonb-kolumner skrivna före den här ändringen:
    `import_sources.analysis` utan `stackDetected` och `project_models.model` utan `origin`.

**Verifiering**

14. **`packages/engine/src/cleanup-command.test.ts`** — ny.
15. **`packages/engine/src/import.test.ts`** — kodsignal-predikatet.
16. **`scripts/engine-smoke.mjs`** — importfixture.

**Airrows egna regler**

17. **`.claude/spec-kit/constitution.md`** §0, **`CLAUDE.md`** och
    **`docs/architecture/SYSTEM_OVERVIEW.md`** — `/cleanup` vid sidan av `/start`, i samma ändring
    som koden (§IV).

**No change needed:** genereringspipelinen i övrigt, LLM-författandet och konfliktflödet. `/cleanup`
är en ny kommandofil och ett fält på modellen — inte en ny väg genom motorn.

---

## Data model

**No schema changes.** Ursprunget härleds från `import_sources` vid genereringstillfället — raden
finns redan (#63) och är den enda sanningen om att projektet importerades. En kolumn på `projects`
hade blivit ett andra ställe som säger samma sak, med risk att de säger olika (§IV).

---

## Security

`/cleanup` är instruktionstext som körs i founderns eget arbetsträd: den skriver inga secrets, når
ingen resurs vi kontrollerar, och skapar inget utanför katalogen. Den läser kundens källkod — men hos
foundern, aldrig på Airrows servrar, vilket är samma gräns som #63 satte när den valde att lagra
digests i stället för innehåll.

Inget av det `/cleanup` härleder rapporteras tillbaka till Airrow. Det följer av §II ("customer IP is
protected", loggar bär ID och metadata — aldrig innehåll) och av valet i #63 att bara lagra digests:
en telemetriväg härifrån vore första gången kundens kodinnehåll lämnade maskinen, och den vägen byggs
inte.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- **Importerat projekt utan någon kodsignal** (bara dokument, tomt repo) → foundationen får `/start`
  i stället, per analysen. Se _Design decision_.
- **Kodsignal finns men analysen kan inte namnge stacken** (t.ex. ett språk vi inte härleder) →
  fortfarande `/cleanup`. Predikatet är "finns det kod att läsa", inte "vet vi vad det är".
- **Importen kunde inte härleda stacken** (#63 tillåter det) → `/cleanup` kartlägger själv i repot;
  det den fortfarande inte kan avgöra skrivs som `[NEEDS CLARIFICATION: …]`.
- **Founderns dokument motsäger koden** → dokumentet vinner aldrig över koden; `/cleanup` skriver om
  dokumentet och säger i rapporten att den gjorde det.
- **`/cleanup` körs i ett repo som inte är det importerade** → ingen identitetskontroll, samma
  precedens som `/start` (#66): kommandot kollar vad som finns och hoppar över det som redan är gjort,
  det verifierar inte vilket repo det står i. Det enda det kräver är att foundationens dokument finns
  där — annars har den inget att skriva om och säger det.
- **Founderns fil och Airrows dokument har samma sökväg** → founderns döps om till `.old`, aldrig
  raderas, och rapporteras. Uppstår när foundern packat upp leveransen ovanpå sitt projekt; valde de
  "Keep mine" i konfliktsteget (#63) levererades Airrows version aldrig och kollisionen finns inte.
- **`README.old.md` finns redan sedan en tidigare körning** → rör den inte, och skapa ingen andra
  omdöpning. Kollisionen är redan löst.
- **Monorepo med flera stackar** → dokumenten måste beskriva flera, inte välja en.
- **Konfliktbeslut från #63 outredda vid nedladdning** → founderns filer levereras inte, så
  foundationen `/cleanup` kör i kan sakna filer den förväntar sig. Får inte krascha kommandot.
- **`/cleanup` körd i ett projekt där foundern redan skrivit egna specs** → rör dem inte.

---

## Implementation notes

### Kollisionen löstes två gånger: först i git, sedan i leveransen

Specen sa att founderns fil skulle döpas om "där founderns fil och Airrows dokument har samma
sökväg". Det tillståndet finns inte — två filer kan inte dela sökväg. Första lösningen var därför att
`/cleanup` skulle **återskapa** founderns version ur git-historiken
(`git show HEAD:README.md > README.old.md`). Den fungerade, verifierad byte för byte i den manuella
körningen, men den lade bördan på ett repo som måste ha rätt historik.

Den skarpa körningen visade att problemet satt tidigare: leveransen skickade aldrig Airrows version
alls. Med `.airrow`-filerna (se _Design decision_) ligger båda på disk redan när foundern packar upp,
och `/cleanup` behöver varken git eller gissningar. `.old`-mekaniken är borta ur kommandot.

### Den manuella körningen hittade ett hål: CI namnger kommandon `/cleanup` inte får röra

Kört mot ett riktigt "existerande projekt" (Vite + React + Stripe, scripts `dev` / `build` / `check` /
`test` — alltså **ingen** `lint` och en typecheck som heter något annat), importanalyserat på riktigt
(`stackDetected = true`, prefill `framework: vite`), foundationen levererad ovanpå, och kommandots
steg följda bokstavligt.

Sju filer namngav `npm run typecheck` och `npm run lint`, som inte finns i projektet. Fem av dem är
dokument `/cleanup` får skriva om. De andra två är `.github/workflows/ci.yml` och
`.claude/spec-kit/constitution.md` — och **båda ligger utanför kommandots gräns**. CI hade alltså gått
röd på första pushen, vilket är exakt den defekt spec 66 skrevs för att få bort, och kommandot hade
enligt sina egna regler inte fått laga den.

Rättat i `cleanup.md` steg 3: en egen punkt som säger att CI namnger samma kommandon, att den är
pipeline-konfiguration och otillåten att ändra, och att avvikelsen därför ska ligga **överst i
rapporten** med de två vägarna ut — lägg till scripten i projektet, eller ändra workflowet — och att
foundern väljer. Varken tyst fix eller tyst tystnad. Ingen enhetstest kunde se det här: det är en
egenskap av vad kommandot är förbjudet att göra, inte av vad renderaren skriver.

### Vad den manuella körningen visade i övrigt

| Steg | Resultat |
| --- | --- |
| Importanalys av det riktiga projektet | ✅ `stackDetected = true`, prefill `{framework: vite, capabilities: [payments]}` |
| Foundation levererad (22 filer), `cleanup.md` med — `start.md` inte | ✅ |
| Founderns `README.md` återskapad som `README.old.md` | ✅ byte för byte identisk med `HEAD` |
| Dokumentens kommandon rättade till projektets riktiga (`npm run check`, ingen linter) | ✅ |
| Saknad linter skriven som `[NEEDS CLARIFICATION]` i stället för uppfunnen | ✅ |
| `.cursorrules` och `AGENTS.md` kvar på disk | ✅ hittade och rapporterade, aldrig raderade |
| `git status` för `src/`, `tests/`, `package.json`, `.gitignore` | ✅ tomt — ingen kod rörd |
| Andra körningen | ✅ `.old` lämnad orörd, kommandofixen idempotent, founderns egen redigering i `CLAUDE.md` kvar |

### `/analyze` — 2026-07-27

Korskontroll spec ↔ kod ↔ konstitution: godkänd. Ett fynd, rättat i specen enligt §IV ("when code and
spec disagree, fix the spec first"): _Verification_ namngav `packages/engine/src/index.test.ts`, som
inte finns i motorn — `validate()`- och `shipsPath()`-fallen ligger i `cleanup-command.test.ts`
tillsammans med resten av samma påstående. Sektionen säger nu det.

Verifieringsbaren kördes om i sin helhet efter de sista ändringarna i `cleanup.md`: typecheck rent,
lint rent, 419 gröna (27 pre-existerande skippade), `test:scripts` 13 gröna, `engine:smoke` PASSED.

Motorn förblir ren: `hasCodeSignal()` och `commandFor()` är rena funktioner över modellen,
databasuppslaget ligger i `apps/web/src/features/import/origin.ts`, och inget i `packages/**` läser
`process.env` eller importerar från `apps/*`. Ingen schemaändring, alltså ingen ny RLS-yta.

### Konfliktknapparna sparade, men ingenting hände på skärmen

Rapporterat vid test: "Keep mine" och "Use Airrow's" såg ut att inte göra någonting.

De gjorde det — `resolveConflictAction` skrev beslutet till `import_conflicts` — men saknade
`revalidatePath`, så server-komponenten renderades aldrig om och sidan visade fortfarande det gamla
läget. Ett beslut som inte syns är ett beslut foundern fattar en gång till. Rättat i
[`import/actions.ts`](../apps/web/src/features/import/actions.ts): både granskningssidan och previewen
revalideras, eftersom previewträdet byggs genom `applyResolutions`. Övriga actions i kodbasen gjorde
redan så ([`preview/actions.ts:34`](../apps/web/src/features/preview/actions.ts#L34),
[`projects/actions.ts:26`](../apps/web/src/features/projects/actions.ts#L26)) — den här hade bara
aldrig fått det.

### Raden säger nu vad som faktiskt hamnar i nedladdningen

Badgen visade bara "Undecided" och försvann så fort man valt något, vilket lämnade de två avgjorda
lägena helt utan text. Nu står utfallet alltid skrivet, i fyra varianter — inte tre:

| Val | Vad raden säger |
| --- | --- |
| Inget val, markdown | Undecided — yours is kept, Airrow's arrives as `README.airrow.md` |
| Inget val, annat | Undecided — yours is kept, Airrow's version is not delivered |
| Keep mine | Yours is kept — Airrow's version is not delivered |
| Use Airrow's | Airrow's version takes this path — yours is not delivered |

Att beskriva de två oavgjorda fallen likadant hade lovat en fil som inte ligger i arkivet, så UI:t
frågar motorn i stället för att gissa: `deliversSidecar(path)` är utbruten ur `applyResolutions` och
används av båda. Regeln finns på ett ställe (§IV), och `ConflictRow.test.tsx` (8 tester) håller texten
mot den.

**Och beslutet går att ångra.** Ett tryck på den redan valda knappen tar bort raden ur
`import_conflicts` och sökvägen är oavgjord igen — vilket är ett eget leveransutfall, inte ett
tomrum: oavgjort ger `.airrow`-filen som varken "Keep mine" eller "Use Airrow's" gör. `resolution: ""`
i `conflictDecisionSchema` bär den avsikten. Knappen postar avsikten i stället för att servern räknar
ut den ur sparat värde — en gammal sida ska aldrig kunna slå av ett beslut som foundern ser som
ovalt. Ingen migration: policyn på `import_conflicts` är `for all` och `delete` fanns redan i grants.

### Följdfynd: vägen tillbaka till svaren fanns bara inne i filbläddraren

"Change answers" låg i previewens header och ingen annanstans. Svaren är indata till allt på
projektsidan, så länken hör hemma där — en founder som vill ändra något går inte djupare in i
utdatan för att hitta vägen tillbaka. Tillagd i "Next step"-kortet för ett projekt som har svar att
ändra (`ready` eller `failed`), med en rad som säger vad som händer: en ändring regenererar
foundationen, redigerade filer ersätts, och det som redan är nedladdat rörs inte.

### `.env.example` finns inte i ett importerat projekt

Följdfynd från samma körning. `SETUP_STEPS` sa "Copy `.env.example` to `.env.local`" — men den filen
skrivs av `/start`, som ett importerat projekt aldrig kör. Samma defektklass som spec 66:s "fyra
dokument bad foundern kopiera en fil som aldrig fanns". `setupSteps()` talar nu om *värden* och "this
project's environment file" för den importerade vägen, och databassteget inleds med "If you do not
already have one".

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- Att `/cleanup` skriver eller ändrar applikationskod, beroenden eller konfiguration. Gränsen är
  poängen — §0 tillåter `/start` att sätta upp det minsta som kör, inte att skriva om något som redan
  finns.
- Ändringar i `/start`:s eget beteende (#66) — bara vem som får kommandot ändras.
- Att radera något i founderns repo. `/cleanup` rapporterar och döper om, aldrig mer än så — §0,
  "nothing destructive or irreversible runs automatically".
- Att skriva om founderns egna dokument eller `.claude/spec-kit/constitution.md`. De läses för
  kontext; omfånget är Airrows genererade dokument.
- Repo-import via GitHub App och PR-leverans — ligger på
  [#67](https://github.com/MS-Flow/airrow/issues/67).
- Ändringar i importanalysen (#63) eller i LLM-författandet (#65). `/cleanup` kompletterar dem.
- Att köra `/cleanup` automatiskt. Kommandot är founder-triggat, precis som `/start` (§0,
  "founder-in-control").
