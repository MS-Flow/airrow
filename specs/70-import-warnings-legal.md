# Spec 70 — Varningar i importflödet + ansvar för uppladdat innehåll

> **In one sentence:** Foundern ska förstå *före* uppladdningen vad hen inte bör lägga i arkivet, och
> villkoren ska säga vem som bär ansvaret för materialet som ändå hamnar där.

|                |                                                                                      |
| -------------- | ------------------------------------------------------------------------------------ |
| **Status**     | ✅ Done                                                                                 |
| **Issue**      | #70 — "Varningar i importflödet + omskrivna villkor och integritetspolicy för uppladdat innehåll" |
| **Branch**     | `70-import-warnings-legal` (from `feature/import-existing-projects`)                   |
| **Feature**    | Import existing projects                                                               |
| **Depends on** | [`63-import-existing-projects.md`](63-import-existing-projects.md) — flödet som tar emot arkivet · [`68-workspace-tree-merged-zip.md`](68-workspace-tree-merged-zip.md) ✅ — äger sakuppgifterna om vad som lagras, och lämnade uttryckligen varningstexterna hit |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
[NEEDS CLARIFICATION: …] markers are resolved by /clarify.
-->

---

## User story

_Who wants this, and what they get out of it._

As a **grundare som ska ladda upp sitt egna projektarkiv** I want **veta innan jag väljer filen vad jag
inte bör skicka med och vad Airrow gör med arkivet** so that **jag inte råkar lämna ifrån mig
`.env`-filer, nycklar eller personuppgifter utan att ha valt det medvetet.**

Och: som den som **driver Airrow** vill jag att villkoren allokerar ansvaret för uppladdat innehåll
uttryckligt, så att ett arkiv med kundens hemligheter inte blir vårt problem utan förvarning.

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Idag:** importskärmen ([`app/app/projects/import/page.tsx`](../apps/web/src/app/app/projects/import/page.tsx))
  och formuläret ([`ImportForm.tsx`](../apps/web/src/features/import/ImportForm.tsx)) säger vad som
  *skippas* (`node_modules`, `.git`, `dist`, `.next`) och vilka gränser som gäller (50 MB, 5 000
  filer) — men ingenting om att inte ladda upp hemligheter eller personuppgifter.
- **Problemet:** ett hand-zippat projekt innehåller regelmässigt `.env`, API-nycklar, `.pem`-filer
  och ibland riktiga personuppgifter i testfixturer. Sedan #63 är detta första gången kundens eget
  material kommer in i Airrow, och valet att skicka det är i praktiken oinformerat.
- **Redan på plats:** integritetssidan
  ([`privacy/page.tsx:29`](../apps/web/src/app/%28legal%29/privacy/page.tsx#L29)) beskriver redan
  importen korrekt efter #68: strukturen (filnamn, storlekar, keyed fingerprint) lagras, innehållet
  läses bara i minnet under analysen och skrivs eller loggas aldrig. **Den delen av issuens
  acceptanskriterier är alltså redan uppfylld** — det som saknas är kvarhållningstiden och en
  kontroll av att formuleringen fortfarande stämmer.
- **Villkoren** ([`terms/page.tsx`](../apps/web/src/app/%28legal%29/terms/page.tsx)) nämner import
  över huvud taget inte: ingen garanti från användaren om rätten att ladda upp materialet, inget
  förbud mot hemligheter och personuppgifter, ingen indemnity.
- **Fakta bor på ett ställe:** [`legal/meta.ts`](../apps/web/src/features/legal/meta.ts) håller
  `serviceName`, `domain`, `contactEmail`, `lastUpdated` och `earlyAccess`-texten. Där står också att
  Airrow saknar juridisk person och lagval fram till general availability.
- **Designsystemet saknar en varningsyta.** [`states.tsx`](../apps/web/src/components/ui/states.tsx)
  har `EmptyState`, `ErrorState`, `InlineError`, `LoadingState` och `ComingSoon` — ingen neutral
  varnings-/notiskomponent. `ImportForm` har redan en handrullad grå `<p>` för cache-varningen
  ([`ImportForm.tsx:59`](../apps/web/src/features/import/ImportForm.tsx#L59)), vilket är precis den
  finstilta gråtext issuen säger att varningen inte får bli.

**Premissen issuen själv rättar:** friskrivningar flyttar inte dataskyddsansvar. Tar vi emot
personuppgifter gäller lagens skyldigheter oavsett vad villkoren säger, och de kan inte avtalas bort
mot en registrerad. Ordningen som faktiskt fungerar är: (1) ta inte emot datan — delvis redan löst i
#68, (2) varna innan uppladdning, (3) allokera risk i avtalet. Den här specen gör (2) och (3).

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

Tre delar:

1. **En riktig varningsyta i designsystemet** — en `Callout`/`Notice`-komponent med `warn`-ton i
   `states.tsx`, byggd på befintliga tokens, placerad **ovanför filväljaren** i importflödet. Inte
   gråtext, inte ett `ErrorState` (ingenting har gått fel).
2. **Villkoren får ett import-avsnitt** — garanti om rätten att ladda upp, förbud mot hemligheter och
   personuppgifter, indemnity för användarens innehåll, vad vi gör om vi upptäcker hemligheter, och
   en ansvarsbegränsning som uttryckligen inte försöker begränsa det som inte får begränsas.
3. **Integritetssidan verifieras och kompletteras** — sakuppgifterna finns redan efter #68; det som
   återstår är kvarhållning för importerad struktur och en genomläsning så att sidan fortfarande
   stämmer ord för ord.

**Varningen är text, ingen kryssruta.** Ingen bekräftelseruta blockerar Analyse-knappen. En kryssruta
hade dokumenterat valet bättre, men den lägger friktion i huvudflödet vid *varje* import — och
konstitutionens "adaptive, never bureaucratic" väger tyngre än ett kvitto vi förmodligen aldrig
behöver åberopa. Varningens jobb är att foundern läser den innan filväljaren, inte att vi kan bevisa
att hen gjorde det.

**Personuppgifter förbjuds rakt av.** Villkoren säger "ladda inte upp personuppgifter", utan
undantag och utan villkorade tillåtelser. Ett villkorat tillstånd ("om du har rättslig grund…") vore
ärligare mot vad grundare faktiskt gör, men det gör oss till personuppgiftsbiträde — med DPA,
underbiträdesförteckning och skyldigheter vi varken har avtalspart eller ork för i early access. Ett
förbud är enklare att stå bakom än ett löfte vi måste leva upp till.

**Juridisk person och lagval lämnas osatta.** `meta.ts` fortsätter säga att Airrow saknar publicerad
operativ enhet fram till general availability. Det betyder att ansvarsbegränsningen är **svag** —
den saknar avtalspart och lagval — och det ska specen säga rakt ut i stället för att låtsas annat.
Att registrera enheten och välja lagval är en GA-förutsättning, inte en del av den här specen.
Klausulerna skrivs så att de börjar bära vikt den dag enheten fylls i, utan att texten måste skrivas om.

**Not touched:** teknisk detektering av hemligheter i arkivet (avvisa uppladdningen, peka ut filen).
Den hör hemma i en egen issue — den här handlar om text och ansvar. Se _Out of scope_.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] Importskärmen visar, **före** filväljaren, en tydlig uppmaning att inte ladda upp hemligheter
      (`.env`, nycklar, certifikat) eller personuppgifter, med en mening om varför.
- [x] Varningen är ett riktigt läge i UI:t enligt designsystemet (tokens, delad komponent), inte
      finstilt gråtext och inte ett felläge.
- [x] Varningskomponenten ligger i `components/ui` och återanvänds — cache-varningen i `ImportForm`
      slutar vara en handrullad `<p>`.
- [x] Integritetssidan beskriver import korrekt: att strukturen (filnamn och storlekar) lagras, att
      filinnehåll passerar servern enbart i minnet under analysen och aldrig skrivs eller loggas, och
      **hur länge** något sparas.
- [x] Villkoren innehåller användarens garanti att hen har rätt att ladda upp materialet.
- [x] Villkoren förbjuder uppladdning av hemligheter och personuppgifter — personuppgifter rakt av,
      utan villkorat undantag.
- [x] Villkoren innehåller en indemnity för användarens innehåll.
- [x] Villkoren innehåller en ansvarsbegränsning som uttryckligen **inte** försöker begränsa det som
      inte får begränsas.
- [x] Villkoren säger vad vi gör om vi upptäcker hemligheter i en uppladdning.
- [x] Löftet att materiella ändringar "announced in the application before they take effect" ersätts
      med det som faktiskt gäller. **Låg på integritetssidan, inte i villkoren** — se
      _Implementation notes_.
- [x] `LEGAL.lastUpdated` stämmer, och båda sidorna hålls konsekventa via `meta.ts` — en fakta bor
      på ett ställe. Ingen ändring behövdes; se _Implementation notes_.
- [x] Texten är läsbar för en grundare, inte bara för en jurist — samma ton som sidorna har idag.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).
- [x] Genomläst i webbläsaren, ljust och mörkt läge (den manuella kontrollen nedan).

### Verification

_How each criterion above is proven._

- **Nya tester** — [`apps/web/src/components/ui/states.test.tsx`](../apps/web/src/components/ui/states.test.tsx)
  (4 st): `Notice` renderar titel och brödtext, är **tyst** som stående upplysning (varken `alert`
  eller `status`), blir en artig live-region när den rapporterar något som just hänt — och även då
  aldrig `role="alert"`, eftersom importen lyckades och bara cachningen inte gjorde det — samt
  renderar utan titel.
- **Nya tester** — [`apps/web/src/app/app/projects/import/page.test.tsx`](../apps/web/src/app/app/projects/import/page.test.tsx)
  (2 st): varningen står **före** filväljaren i dokumentordning (`compareDocumentPosition`, inte
  bara närvaro), och sidan säger både varför (`has to be rotated`) och att Airrow *inte* letar åt
  foundern (`scan for secrets`). Serveråtgärden och IndexedDB-cachen mockas — ingen av dem finns
  utanför en request, och ingen av dem är vad testet handlar om.
- **Legal-sidorna: inga tester.** Beslutat — de är statiska serverkomponenter utan logik, och
  assertions på juridisk prosa blir sköra så fort en mening skrivs om. De verifieras genom
  granskning av diffen och en genomläsning av båda sidorna i webbläsaren. Att `lastUpdated` bor i
  `meta.ts` är det som håller dem konsekventa, inte ett test.
- **Manuell kontroll** — importskärmen i webbläsaren, ljus och mörk, att varningen läses som ett läge
  och inte som brödtext; båda legal-sidorna lästa i sin helhet så tonen fortfarande är grundarens.
- Full svit + typecheck/lint-status — se _Implementation notes_.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

0. **`apps/web/src/app/globals.css`** — ny token `--color-warn` / `--a-warn` i båda teman. Det fanns
   ingen varningston: paletten hade `info`, `success` och `danger` men inget däremellan. Se
   _Implementation notes_.
1. **`apps/web/src/components/ui/states.tsx`** — `Notice`: en upplysning som medvetet *inte* är ett
   fel — aldrig `role="alert"`, aldrig danger-tonen. Valfri `role="status"` för det som dyker upp
   som svar på något foundern just gjort.
2. **`apps/web/src/app/app/projects/import/page.tsx`** — varningen renderas på sidan, ovanför kortet
   med formuläret. Sidan, inte formuläret: den är statisk text som ska synas direkt i serverns HTML
   utan att vänta på hydrering, och `ImportForm` är den enda konsumenten ändå — flyttar den någon
   gång, flyttar varningen med i samma ändring.
3. **`apps/web/src/features/import/ImportForm.tsx:59`** — cache-varningens handrullade `<p>` ersätts
   med den nya komponenten.
4. **`apps/web/src/app/(legal)/terms/page.tsx`** — nytt avsnitt om uppladdat innehåll: garanti,
   förbud (personuppgifter rakt av), indemnity, vad vi gör vid upptäckta hemligheter;
   `Liability`-avsnittet skärps; `Changes`-avsnittet tappar löftet om in-app-avisering.
5. **`apps/web/src/app/(legal)/privacy/page.tsx`** — kvarhållning för importerad struktur, och
   `Changes`-avsnittet tappar löftet om in-app-avisering (det låg här, inte i villkoren).

**No change needed:** integritetssidans importstycke i sak — #68 skrev redan att strukturen lagras och
innehållet inte; genomläst ord för ord och det stämmer fortfarande. Och
`apps/web/src/features/legal/meta.ts`: `lastUpdated` stod redan på dagens datum, entitet och lagval
förblir medvetet osatta.

---

## Data model

_Any database change. Most specs have none — say so plainly._

**No schema changes.** Specen ändrar text och en UI-komponent. Ingenting nytt lagras, och ingenting
befintligt lagras annorlunda.

---

## Security

_Two lines at most: what this opens up and who may reach it — or "nothing security-relevant, because …"._

Öppnar ingenting: inga nya ytor, inga nya data, ingen ny åtkomstväg. Effekten går åt andra hållet —
färre hemligheter når servern om varningen fungerar, och villkoren gör det uttryckligt att uppladdade
hemligheter är användarens ansvar. Varningen är statisk text vi själva författar, inte användardata,
så inget saneringsproblem tillkommer.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- Foundern laddar ändå upp ett arkiv med `.env` → importen går igenom som idag; vi upptäcker det inte
  tekniskt i den här specen, och varningen får inte antyda att vi gör det.
- Varningen och cache-varningen visas samtidigt (import gick igenom men arkivet fick inte plats) →
  **förhandsvarningen står kvar.** Den hör till handlingen "ladda upp ett arkiv", inte till ett
  tillstånd som passerat, och att dölja den skulle kräva att sidan vet om formuläret körts — precis
  den sortens spridda villkorslogik §III förbjuder. De två ytorna bär samma neutrala varningston, så
  de läser som två upplysningar och inte som ett fel.
- Foundern har redan importerat och kommer tillbaka till skärmen → varningen visas igen; den är
  knuten till handlingen, inte till användaren.
- Villkoren ändras medan en användare är inloggad → `lastUpdated` ändras och fortsatt användning
  innebär accept. Ingen in-app-avisering: löftet om det tas bort ur villkoren i den här ändringen,
  eftersom mekanismen inte finns. Vill vi ha aviseringen är det en egen issue — men då byggd, inte
  lovad.

---

## Implementation notes

### Konstitutionskontroll före kod
- **Tokens, inte literaler (§III).** Varningen behövde en varningston och paletten hade ingen. Den
  lades därför till i `globals.css`, där råa färgvärden redan är enda tillåtna hemvist — inte som en
  hårdkodad hex i komponenten. Se avvikelsen nedan.
- **Explicita lägen (§III).** `Notice` är en riktig komponent i `components/ui`, inte ett villkor i
  JSX, och den har två användare från dag ett (importvarningen och cache-varningen) — abstraktionen
  är alltså förtjänad enligt §I.
- **Ingen ny data, inget nytt anrop.** Ändringen är text och en presentationskomponent. Inga
  schemaändringar, inga nya externa anrop, ingen ny åtkomstväg.

### Avvikelse: det felaktiga löftet låg på integritetssidan, inte i villkoren
Acceptanskriteriet sa "villkorens löfte" att materiella ändringar aviseras i appen. Vid genomläsning
låg den meningen i integritetspolicyns `Changes`-avsnitt; villkorens motsvarande avsnitt sa redan
bara att datumet ändras och att fortsatt användning innebär accept. Löftet är borttaget där det
faktiskt fanns. Kriteriet är omformulerat i stället för att tyst kryssas av (konstitutionen §IV: när
kod och spec är oense rättas specen först).

### Avvikelse: `lastUpdated` behövde inte ändras
`LEGAL.lastUpdated` stod redan på `27 July 2026`, vilket är dagen den här ändringen skrivs. Att
"uppdatera" den hade betytt att sätta samma värde igen. Datumet är korrekt, och det är vad kriteriet
faktiskt vill åt — men det är värt att veta att raden inte syns i diffen.

### Utöver planen: en ny designtoken
Specen antog att det fanns en varningston att bygga på. Det gjorde det inte — paletten hade `info`,
`success` och `danger`, alltså ingenting mellan "till din information" och "något har gått sönder".
Alternativen var att låna `danger` (fel — inget har misslyckats, och en varning som ser ut som ett
fel lär foundern att avfärda båda) eller `info` (för svag för "en nyckel som lämnat din dator måste
roteras"). Tokenen `--a-warn` är `#e3a94e` i mörkt läge och `#8f6108` i ljust — det ljusa värdet är
medvetet mörkt för att bära kontrast mot vit yta, i samma anda som `danger` går från `#f0564a` till
`#c33025`.

### Formuleringen som var svårast
Varningen får **inte** antyda att Airrow letar efter hemligheter åt foundern, eftersom vi inte gör
det — en varning som låter som ett skyddsnät är värre än ingen varning. Därför står det rakt ut att
Airrow *inte* scannar, och testet `does not claim Airrow checks the archive for you` finns just för
att fånga en framtida omskrivning som mjukar upp det.

### Verifiering (kört 2026-07-27)
- `pnpm -r typecheck` — rent.
- `pnpm -r lint` — rent, noll varningar.
- `pnpm -r test` — **231 gröna, 0 skippade** (web 153, engine 78). Inga kända pre-existerande fel.
- `pnpm test:scripts` — 13 gröna.
- `pnpm --filter web build` — kompilerar, alla rutter byggda.
  ⚠️ Första bygget föll på `PageNotFoundError: /_document` från en inaktuell `.next`-katalog. En
  rensning av `.next` och ett nytt bygge går igenom — felet har inget med den här ändringen att
  göra, men det är värt att känna igen.

### Genomläst i webbläsaren (2026-07-27)
Importskärmen och båda legal-sidorna lästa i ljust och mörkt läge mot den lokala dev-servern.
Varningen läser som ett läge och inte som brödtext, och `#8f6108` bär i ljust läge — värdet var valt
med kontrasträkning (5,2:1 mot `bg`), inte med ögat, så det var den kontrollen som faktiskt behövdes.

**Fallgrop värd att komma ihåg:** `next dev` och `next build` delar `.next`. Ett produktionsbygge
medan dev-servern kör skriver över dess artefakter — sidan fortsätter svara med HTML medan varje
CSS-request ger 500, vilket ser ut som att designen försvunnit. Stoppa dev-servern före `build`, eller
rensa `.next` och starta om efteråt.

### Uppdaterade dokument utöver planen
`docs/architecture/UI_ARCHITECTURE.md` — `warn`-tokenen i färgtabellen och `Notice` i
komponentlistan, plus regeln om varför den aldrig tar `role="alert"`. Konstitutionen §IV kräver att
dokumenten följer med i samma ändring; _Exact changes_ nämnde dem inte, vilket var en lucka i planen
snarare än i koden.

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- **Teknisk detektering av hemligheter i arkivet** (avvisa uppladdningen, peka ut filen). Egen issue —
  den här handlar om text och ansvar.
- **Att exkludera `.env` från importen** — #32 vill att Airrow *genererar* en `.env`, så krocken måste
  fortsätta synas i stället för att tyst skrivas över (samma avgränsning som #68 gjorde).
- **DPA och förteckning över underbiträden** (Supabase, Vercel, Anthropic) — **först vid GA.** Med
  personuppgifter förbjudna rakt av och ingen registrerad juridisk person finns det varken behov
  eller avtalspart för ett DPA idag. Integritetssidan namnger redan de tre leverantörerna och vad de
  gör, vilket är den upplysning en grundare faktiskt letar efter. Ett formellt DPA och en underhållen
  underbiträdesförteckning är GA-förutsättningar tillsammans med entiteten och lagvalet.
- **Att registrera juridisk person och välja lagval.** GA-förutsättning, egen issue. Tills dess är
  ansvarsbegränsningen medvetet svag — se _Design decision_.
- **In-app-avisering vid ändrade villkor.** Löftet tas bort i stället för att byggas; en mekanism är
  en egen issue om vi vill ha den.

---

## Open questions from the issue

_Frågor issuen ställer som specen inte kan besluta själv — `/clarify` tar dem._

- [NEEDS CLARIFICATION: ska villkoren granskas av jurist före GA? Texten här är ett utkast, inte
  juridisk rådgivning, och en ansvarsbegränsning är precis den typ av text som bör läsas av någon som
  kan området. Blockerar inte den här specen — men bör beslutas innan sidorna ska bära verklig vikt.]

**Besvarade:** juridisk person och lagval lämnas osatta till GA (se _Design decision_).
Personuppgifter förbjuds rakt av (se _Design decision_). DPA och underbiträdesförteckning väntar till
GA (se _Out of scope_).
