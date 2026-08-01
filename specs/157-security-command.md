# Spec 157 — `/security`: hitta sårbarheterna, laga det osynliga, skriv ner resten

> **In one sentence:** Ett nytt `/security`-kommando — i varje genererad foundation och i vårt eget
> repo — som går igenom hela projektet, letar efter sårbarheter, fixar det som går att fixa utan att
> ändra hur sidan ser ut eller fungerar, och skriver en gitignorerad `SECURITY_AUDIT.md` med exakt
> vad som lagades, vad som hittades och vad som återstår.

|                |                                                                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**     | 🔄 In progress                                                                                                                                                          |
| **Issue**      | #157 — "/security: ett kommando som letar sårbarheter, fixar det osynliga och skriver en gitignorerad SECURITY_AUDIT.md"                                                 |
| **Branch**     | `157-security-command` (from `feature/interview-generator`)                                                                                                              |
| **Feature**    | Interview & generation                                                                                                                                                   |
| **Depends on** | [`66-start-command.md`](66-start-command.md) och [`91-cleanup-command.md`](91-cleanup-command.md) (mönstret för ett kommando som körs hos foundern), [`33-security-scanning.md`](33-security-scanning.md) (våra CI-säkerhetskrav) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
[NEEDS CLARIFICATION: …] markers are resolved by /clarify.
-->

---

## User story

_Who wants this, and what they get out of it._

As a **founder som byggt sitt projekt med en AI-assistent** I want **ett kommando som går igenom hela
kodbasen, lagar de säkerhetshål som kan lagas utan att något syns utåt, och lämnar en ärlig lista över
resten** so that **jag vet vad som faktiskt är säkert och vad jag måste ta tag i — innan någon annan
hittar det åt mig.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today:** En foundation levererar `/createspec → /clarify → /implement → /analyze`, `/push`,
  `/pr-check` och exakt ett förstagångskommando — `/start` eller `/cleanup`
  (`packages/engine/src/scaffold.ts:468`, spec 91). Vårt eget `.claude/commands/` har samma sex
  kommandon minus förstagångskommandot.
- **The problem:** Inget av dem tittar på säkerhet, och det som faller mellan stolarna är precis det
  som inte syns i UI:t — en nyckel i klientbundlen, en route utan auth, en query utan
  organisationsfilter, en webhook utan signaturverifiering. Sidan ser perfekt ut ända tills någon
  tittar efter.
- **Already in place:** Konstitutionen kräver redan säkerhetsnoteringar per spec och att
  high-severity advisories blockerar en release (§VI), och spec 33 gav oss `pnpm audit` + secret
  scanning i CI. Det gäller vårt repo, i CI, efter att koden är skriven — det säger ingenting om
  founderns projekt.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

Ett nytt kommando `template/.claude/commands/security.md` som skeppas villkorslöst i **varje**
foundation (till skillnad från `/start`/`/cleanup`, som är ett alternativ-par), plus en variant i vårt
eget `.claude/commands/security.md` anpassad efter vår arkitektur. Prompten är lång och faslagd —
kartlägg, leta enligt namngiven checklista, klassificera med bevis, fixa bara det beteendebevarande,
verifiera bygget, skriv rapporten — och rapporten `SECURITY_AUDIT.md` gitignoreras eftersom den är en
karta över olagade hål.

Fyra avgränsningar som gör kommandot förutsägbart:

- **Inga argument.** `/security` granskar alltid hela repot. En delvis körning skulle läsas som en
  fullständig, och det är den farligaste sortens felaktig trygghet.
- **Godkännande sker i chatten.** De fixar som skulle ändra utseende eller beteende samlas och
  presenteras en och en, med exakt vad ändringen innebär; bara de foundern säger ja till görs. Det
  som får nej — eller inte hinner besvaras — hamnar som förslag i rapporten.
- **Bara verktyg som redan finns.** `pnpm audit`/`npm audit` och liknande körs när projektet redan
  har dem; kommandot installerar aldrig något och hämtar aldrig en scanner. Saknas verktyget härleds
  fyndet ur koden och rapporten säger vad som inte gick att kontrollera.
- **Historiken söks, men bara efter secrets.** Arbetsträdet granskas fullständigt; commit-historiken
  genomsöks enbart efter nycklar och tokens — det är där en läckt nyckel överlever att den städats
  bort ur koden.

**Not touched:** `/start` och `/cleanup` och deras ursprungslogik; CI-säkerheten från spec 33;
Airrows serversida — `/security` kör hos foundern, aldrig hos oss.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] `template/.claude/commands/security.md` finns, med frontmatter (`description`, `allowed-tools`)
      i samma form som de befintliga kommandona — **ingen `argument-hint`, kommandot tar inga
      argument** — och använder `{{CMD_TYPECHECK}}`, `{{CMD_LINT}}`, `{{CMD_TEST}}`, `{{CMD_BUILD}}`
      i stället för hårdkodade kommandon.
- [x] Prompten driver assistenten genom faserna kartlägg → leta → klassificera → fixa → verifiera →
      rapportera, och namnger checklistans kategorier: secrets, auth/behörighet/tenancy/RLS,
      injection (inkl. prompt injection), output/rendering, requests (CSRF/CORS/cookies/headers),
      validering, missbruk/rate limiting, krypto och signaturverifiering, läckage, beroenden och CI.
- [x] Varje fynd får severity (kritisk/hög/medel/låg), en konkret exploateringsväg och bevis som
      `fil:rad`; det som inte kan pekas ut i koden skrivs som misstanke, inte som sårbarhet.
- [x] Gränsen står uttryckligen i kommandot: vad som får fixas direkt (beteendebevarande), vad som
      kräver founderns godkännande först (allt som ändrar utseende, texter, flöden, routes, CSP,
      rate limits, majoruppgraderingar, migrationer, CI-behörigheter) och vad som aldrig görs.
- [x] De godkännandekrävande fixarna presenteras i chatten, en och en, med exakt vad ändringen
      innebär — och görs bara vid ja. Det som får nej eller lämnas obesvarat hamnar som förslag i
      rapporten, aldrig i koden.
- [x] Kommandot kör bara verktyg projektet redan har (`pnpm audit`/`npm audit` och liknande),
      installerar aldrig något och hämtar aldrig en scanner; saknas verktyget skriver rapporten vad
      som inte gick att kontrollera.
- [x] Commit-historiken genomsöks efter secrets (bara secrets), utöver den fullständiga granskningen
      av arbetsträdet — och ett fynd i historiken redovisas med kravet att nyckeln roteras, inte bara
      tas bort.
- [x] Kommandot verifierar med typecheck, lint, test och build efter fixarna och rullar tillbaka en
      fix som bryter något — repot lämnas aldrig i sämre skick än det hittades.
- [x] `SECURITY_AUDIT.md` skrivs i repo-roten med alla sju avsnitten: huvud, sammanfattning per
      severity, fixat, hittat-men-inte-fixat (med skäl), kräver-din-åtgärd-utanför-koden,
      kontrollerat-och-rent, prioriterade nästa steg.
- [x] `/security` säkerställer att `SECURITY_AUDIT.md` står i `.gitignore` (skapar filen om projektet
      saknar en) och committar aldrig rapporten; skälet står i kommandots text.
- [x] **En andra körning börjar med att kontrollera den gamla rapporten** (sektion 1 i kommandot):
      varje tidigare post — fixad som öppen — verifieras mot koden och får en av fem domar (kvarstår
      fixad / **regression** / fortfarande öppen / löst på annat sätt / försvunnen). Där förra
      körningen bevisade något genom att köra det, körs det igen. Rapporten är påståenden att
      kontrollera, aldrig fakta att föra vidare.
- [x] Rapporten **skrivs om helt varje körning** men förlorar ingen historik: en körlogg med **datum
      och klockslag inklusive offset** (hämtat från maskinen, inte gissat) där ingen rad någonsin tas
      bort, varje fynd som någonsin rapporterats — lösta markerade med tid och vilken körning som
      stängde dem, aldrig raderade — och allt en människa skrivit, ordagrant.
- [x] Varje genererad foundation innehåller `.claude/commands/security.md` — både nytt och importerat
      ursprung — och `validate()` (`packages/engine/src/index.ts:75`) underkänner en foundation utan
      den. `/security` läggs **inte** i `FIRST_RUN_COMMANDS`.
- [x] `.claude/commands/security.md` finns i det här repot, anpassat efter vår arkitektur (lagren,
      DataStore som enda väg till Supabase, RLS med denial-tester, de två Claude-nycklarna,
      Stripe-webhooken, GitHub App-installationer, `checkAllowance` och `applySubscriptionState`),
      och `SECURITY_AUDIT.md` ligger i vår `.gitignore`. Den läser `audit.json` när den redan finns
      (skriven av audit-steget i `ci.yml`, spec 33) i stället för att duplicera severity-gränsen, och
      kör annars `pnpm audit` som i vilket projekt som helst.
- [x] Dokumenten som räknar upp kommandon nämner `/security`: `template/START_HERE.md` (tabellen),
      `template/specs/README.md`, `template/README.md`, `template/CLAUDE.md`,
      `template/docs/guides/DEVELOPER_GUIDE.md`, samt våra `specs/README.md` och `CLAUDE.md`.
- [x] Båda konstitutionerna (`.claude/spec-kit/constitution.md` §0 och
      `template/.claude/spec-kit/constitution.md`) säger vad `/security` får och inte får, i samma
      andetag som `/start` och `/cleanup`. Samma ändring som koden, per §IV.
- [x] `pnpm engine:smoke` och engine-testerna täcker att kommandot skeppas i båda ursprungen.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — `packages/engine/src/security-command.test.ts`: kommandot skeppas oavsett ursprung,
  ligger inte i `FIRST_RUN_COMMANDS`, krävs av `validate()`, och alla `{{…}}`-tokens är upplösta i
  output.
- Existerande `packages/engine/src/scaffold.test.ts` och `pnpm engine:smoke` bevisar att filen finns i
  en genererad foundation för både nytt och importerat ursprung.
- Kommandots innehåll (checklista, fixgräns, rapportstruktur, gitignore-regeln) granskas som text —
  det är en prompt, inte kod, och verifieras av **en manuell körning i det här repot** som redovisas
  i specen: vad rapporten innehöll, vad som fixades, vad som lämnades.
- Full suite result + typecheck/lint status.

#### Resultat (implementation)

Kört på `157-security-command`:

| Steg | Resultat |
| --- | --- |
| `pnpm -r typecheck` | rent (engine, schemas, web) |
| `pnpm -r lint` | rent, inga nya anmärkningar |
| `pnpm -r test` | 1005 gröna — engine 243 (varav 20 nya i `security-command.test.ts`), web 693 (varav 6 nya denial-tester), schemas 69, 0 röda |
| `pnpm test:scripts` | 88 gröna |
| `pnpm engine:smoke` | PASSED — alla fem fixtures, båda ursprungen |

Inga pre-existerande fel att notera; hela baren var grön före och efter.

#### Manuell körning (2026-08-01)

`/security` kört skarpt i det här repot, på `157-security-command` (`f5162a9`). Kommandot höll sina
gränser: det kartlade ytan, gick igenom alla tio kategorierna, sökte commit-historiken efter secrets,
körde `pnpm audit` (befintligt verktyg, inget installerat), och lämnade allt som skulle synas utåt som
förslag.

**Fyra fynd, ett fixat.**

| Sev | Fynd | Utfall |
| --- | --- | --- |
| Hög | `authenticated` har `delete`/`update` på `generation_usage` och `generation_jobs` — en founder kan nolla sin egen allowance direkt mot PostgREST och generera gratis hur många foundations som helst | Förslag: migration som revokar. Ej gjord — migrationer kräver godkännande |
| Medel | `dompurify` pinnad på 3.2.3 med 19 öppna advisories, alla under CI:s high/critical-gate — och den är XSS-skyddet i previewn | Förslag: bump till ≥3.4.12. Ej gjord — kräver install |
| Låg | `admin_emails` saknade denial-test, enda tabellen i schemat utan | **Fixad** — två tester i `schema.rls.test.ts:280`, gröna mot lokal Supabase |
| Låg | Inga säkerhetsheaders alls i `next.config.ts` | Förslag |
| Låg | Workflow-actions pinnade på rörliga taggar | Förslag |

**Alla tre förslagen godkändes och applicerades i samma session** — vilket är den andra halvan av
kriteriet: kommandot frågade, fick ja, och gjorde bara det som fått ja. `20260801140000_lock_generation_ledger.sql`
(revoke + fyra denial-tester), DOMPurify 3.2.3 → 3.4.12 (`pnpm audit` nu 0 advisories), `nosniff` +
`Referrer-Policy` i `next.config.ts` — men **inte** CSP, som kommandot självt sa hör hemma i en egen
spec — och alla åtta action-usages pinnade till SHA. H1-fixen verifierades med samma probe som visade
hålet: raden syns fortfarande, men `delete` ger `permission denied`.

Höga fyndet **demonstrerades** mot lokal Supabase i en rollback:ad transaktion (raden försvann, 1 → 0)
— inte bara utläst ur migrationen. Rapporten skrevs till `SECURITY_AUDIT.md` med alla sju avsnitten
och `git check-ignore` bekräftar att den är ignorerad. Baren efter alla fixar: **1003 tester gröna**
(web 693, engine 241, schemas 69), `test:scripts` 88, typecheck rent, lint rent, `pnpm build` grön,
`pnpm audit --prod` 0 advisories.

Det kommandot inte kunde avgöra lämnade det som **misstanke** (`.vercel.app`-suffixet i
`isAllowedHost` vs. `x-forwarded-host`) i stället för som sårbarhet, och la platsfrågan under
"kräver din åtgärd utanför koden" — vilket är precis det beteende kriterierna beskriver.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

1. **`template/.claude/commands/security.md`** — ny. Åtta faser: kontrollera förra rapporten →
   kartlägg → checklistan → bedöm → fixa → verifiera → `SECURITY_AUDIT.md` → rapportera. De tre
   gränserna står överst, före allt annat.
   Tokens: `{{PROJECT_NAME}}`, `{{CI_FILE}}`, `{{CMD_TYPECHECK}}`, `{{CMD_LINT}}`, `{{CMD_TEST}}`,
   `{{CMD_BUILD}}`. Nämner varken `/start` eller `/cleanup` — texten skeppas till båda ursprungen, och
   en foundation får aldrig namnge kommandot den inte har (spec 91).
2. **`.claude/commands/security.md`** — ny. Samma sju faser, men kartan är vår: lagren, de publika
   ytorna, `chat_rate_limits` som enda tenancy-undantaget, de två Claude-nycklarna, `checkAllowance` /
   `claimAllowance` / `applySubscriptionState` / `plan_grants`, GitHub App-nycklarna. Läser
   `audit.json` mot `.security/audit-baseline.json` i stället för att återuppfinna severity-gränsen
   från spec 33, och kör hela vår bar inklusive `pnpm test:scripts`.
3. **`packages/engine/src/index.ts:84`** — `.claude/commands/security.md` in i `required`, ovanför
   `commandPath(model)`, med skälet i en kommentar: det finns inget alternativ att para ihop den med.
4. **`packages/engine/src/scaffold.ts:468`** — oförändrad. `FIRST_RUN_COMMANDS` är paret `/start` ↔
   `/cleanup`; `shipsPath()` returnerar `true` för allt annat, så `/security` skeppas villkorslöst
   utan en rad kod.
5. **`packages/engine/src/security-command.test.ts`** — ny, 18 tester.
6. **`scripts/engine-smoke.mjs:200`** — smoke-testet underkänner en fixture utan kommandot.
7. **`template/START_HERE.md:13`** (kommandolistan) och **`:120`** (ett stycke efter loopen: vad
   `/security` gör och varför rapporten är gitignorerad), **`template/specs/README.md:20`**,
   **`template/README.md:29`**, **`template/CLAUDE.md:41`**,
   **`template/docs/guides/DEVELOPER_GUIDE.md:30`**.
8. **`specs/README.md:20`**, **`CLAUDE.md:27`**, **`.gitignore:13`** — vår sida.
9. **`.claude/spec-kit/constitution.md:37`** — §0: `/security` är det **tredje** kommandot som får
   röra kod, med sin gräns utskriven, och amendment-noten pekar på den här specen.
   **`template/.claude/spec-kit/constitution.md:31`** — samma regel i den genererade konstitutionen,
   direkt efter `{{COMMAND_RULE}}`.

**No change needed:** `commandPath()`/`FIRST_RUN_COMMANDS` — `/security` är inget alternativ till
`/start` eller `/cleanup`, så paret rörs inte.

---

## Data model

_Any database change. Most specs have none — say so plainly._

**No schema changes.**

---

## Security

_Two lines at most: what this opens up and who may reach it — or "nothing security-relevant, because …"._

Kommandot körs hos foundern och når ingenting av vårt — men rapporten det skriver är en lista över
olagade sårbarheter, och därför gitignorerad så den aldrig hamnar i ett publikt repo. Kommandot får
aldrig skicka kod, fynd eller secrets någonstans, och aldrig skanna eller anfalla ett körande system.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- Projektet saknar `.gitignore` → kommandot skapar en med `SECURITY_AUDIT.md`.
- `SECURITY_AUDIT.md` är redan committad sedan tidigare → kommandot säger till och föreslår att den
  tas ur historiken, men gör det inte själv.
- En fix bryter typecheck/test/build → rullas tillbaka och redovisas som fynd i stället.
- Inga fynd alls → rapporten skrivs ändå, med vad som granskades och var rent. Aldrig "allt är säkert".
- Kodbasen är för stor för en körning → kommandot prioriterar efter trust boundaries (publika
  endpoints, auth, betalningar, allt som tar emot indata utifrån) och skriver i rapporten vad som
  inte hanns med. Scopet snävas aldrig av ett argument — `/security` tar inga.
- Foundern får ett argument med på köpet (`/security auth`) → det ignoreras, och kommandot säger att
  granskningen alltid omfattar hela repot.
- En godkännandefråga lämnas obesvarad, eller sessionen avbryts → ingenting av det görs; fixen ligger
  kvar som förslag i rapporten till nästa körning.
- Ett secret hittas i commit-historiken men inte i arbetsträdet → redovisas som fynd med kravet att
  nyckeln **roteras** (historiken skrivs aldrig om av kommandot).
- Projektet saknar `pnpm audit`/`npm audit` eller lockfil → beroendekontrollen hoppas över och
  rapporten säger att den inte kunde göras, i stället för att tiga om den.
- Ett verktyg finns men kräver nätverk och nätverket är nere → samma sak: noteras som "inte
  kontrollerat", aldrig som "rent".

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- Pentest, DAST eller skanning mot ett körande system — `/security` läser kod, den anfaller ingenting.
- En skanning som körs på Airrows servrar; kommandot körs hos foundern, som `/start` och `/cleanup`.
- Betalda säkerhetstjänster eller externa scanners som beroende.
- Automatiska beroendeuppgraderingar över major — föreslås i rapporten, görs inte.
- Ändringar i UI, texter eller flöden — får bara föreslås.
- Att köra `/security` automatiskt i CI eller i genereringen.
- Ett scope-argument (`/security auth`) — hela repot varje gång, av samma skäl som gör en delvis
  granskning farlig: den läses som en fullständig.
- Att skriva om commit-historiken. Ett läckt secret rapporteras med krav på rotation; städningen är
  founderns beslut.
