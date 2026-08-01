# Spec 151 — Chatten säger varför den är tyst, och svarar utan proxy

> **In one sentence:** När landningschatten inte kan svara ska loggen säga varför, och en deploy utan
> `x-forwarded-for` ska kunna svara alls — två luckor som tillsammans kostade en kväll att felsöka.

|                |                                                      |
| -------------- | ---------------------------------------------------- |
| **Status**     | ✅ Done                                               |
| **Issue**      | #151 — "Chatten säger inte varför den är tyst, och kan inte svara alls utan x-forwarded-for" |
| **Branch**     | `151-chat-diagnostics` (från `feature/chatbot`)      |
| **Feature**    | chatbot                                               |
| **Depends on** | [spec 141](141-landing-chat.md) (chatten själv — den här ändrar en av dess regler) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

_Who wants this, and what they get out of it._

As a **den som driftsätter Airrow** I want **se i loggen varför chatten inte svarar** so that **en
felkonfigurerad deploy tar en minut att rätta i stället för en kväll.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today:** `ChatReply.unavailable` (spec 141) är ett enda svar för fem olika orsaker, och routen
  loggar ingenting. Utan adress vägrar `visitorKey` att bilda en nyckel, vilket tar hela chatten till
  FAQ-läge.
- **The problem:** en felkonfigurerad deploy blev felsökt utifrån genom att mäta svarstider — 0,29s
  baseline mot 1,0s för ett riktigt anrop — för att härleda hur långt in i kedjan det föll. Samtidigt
  gick webbläsaren på localhost aldrig att testa i, så "fungerar det ens?" fick besvaras med curl.
- **Already in place:** repot har redan en loggkonvention — `console.error("[area] vad:", error)`, se
  [`features/import/actions.ts:155`](../apps/web/src/features/import/actions.ts#L155) och
  [`lib/auth.ts:262`](../apps/web/src/lib/auth.ts#L262) — och ingen loggmodul att gå via, så den här
  specen inför ingen heller.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

**Orsaken loggas där den är känd, inte där den syns.** `chat-limits.ts` vet att databasen inte
svarade; `provider.ts` vet att nyckeln saknas eller att anropet föll. Routen ser bara `unavailable`
och skulle behöva gissa — precis som vi fick göra. En gemensam liten hjälpare så att prefixet är
detsamma överallt och går att söka på.

**Besökaren får veta exakt lika lite som förut.** `unavailable` är fortfarande ett svar utan innehåll.
Det är loggen som ändras, inte svaret.

**Adress som saknas blir en delad hink i stället för ett nej.** Det är strikt säkert — okända
anropare delar per-besökartaket och det globala dygnstaket gäller oförändrat — och på Vercel, där
headern alltid sätts, används den aldrig. Det gör också loggvolymen självbegränsande: den delade
hinken tar slut efter fem anrop per dygn, så en varning per anrop kan aldrig svämma över.

**Detta ändrar spec 141.** Regeln där lyder "allt skyddet behöver saknas ⇒ FAQ-läge". Efter den här
specen gäller den fortfarande för nyckel och databas, men **inte** för adressen. Den ändringen skrivs
in i spec 141 i samma PR, annars står två specar och säger emot varandra (§IV).

**Orsaken returneras också som svarsheader, men aldrig i produktion.** `x-airrow-chat-reason` sätts
när `VERCEL_ENV` är något annat än `"production"` — alltså på preview och lokalt, aldrig på
airrow.app. Det var exakt det som saknades ikväll: felsökningen skedde utifrån, och en header hade
avslutat den på första anropet i stället för att orsaken fick härledas ur svarstider.

**Gaten är `VERCEL_ENV`, inte `NODE_ENV`** — och det är hela poängen med att skriva ner det. Vercel
bygger *preview* med `NODE_ENV === "production"`, så en `NODE_ENV`-gate hade tigit på exakt den
deploy där felet satt, och sett helt rimlig ut i koden under tiden.

**Not touched:** taken och deras siffror, `chat_rate_limits`, migrationen, systempromten och panelen.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] När chatten inte kan svara loggas orsaken server-side med `[chat]`-prefix och en av ett fåtal
      kända orsaker: ingen nyckel, ingen adress, taket onåbart, Claude-anropet misslyckades.
- [x] Loggen bär **aldrig** besökarens meddelande, botens svar, nyckeln eller den hashade
      besökarnyckeln — metadata och inget annat (§II).
- [x] Svaret till besökaren är oförändrat: `unavailable` säger fortfarande ingenting om vår
      uppsättning, och panelens beteende ändras inte.
- [x] Ett anrop utan adress rate-limitas i en delad hink i stället för att vägras, så att panelen
      fungerar i webbläsaren på localhost och bakom en proxy som inte sätter `x-forwarded-for`.
- [x] Att den delade hinken används loggas, så att en proxy-deploy inte tyst hamnar där.
- [x] Orsaken returneras som `x-airrow-chat-reason` när `VERCEL_ENV` inte är `"production"`, och
      **aldrig** när den är det. Gaten är `VERCEL_ENV` — `NODE_ENV` är `"production"` även på preview
      och hade därför tigit på precis den deploy felet satt i.
- [x] Den delade hinken sänker inte skyddet: okända anropare delar per-besökartaket, och det globala
      dygnstaket gäller oförändrat.
- [x] Spec 141:s regel om FAQ-läge skrivs om i samma ändring, så att de två specarna inte säger emot
      varandra.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — [`features/chat/diagnostics.test.ts`](../apps/web/src/features/chat/diagnostics.test.ts)
  (7): prefixet som går att greppa, varningen om den delade hinken, headern på preview, i
  development och lokalt (`VERCEL_ENV` osatt), **tystnaden i produktion**, och den som är hela
  poängen — att gaten är `VERCEL_ENV` och inte `NODE_ENV`. Plus att `UNAVAILABLE_REPLY` är en konstant
  utan plats för en orsak, vilket är vad som gör "besökaren får aldrig veta" strukturellt.
- **New tests** — [`lib/data/chat-limits.test.ts`](../apps/web/src/lib/data/chat-limits.test.ts)
  (7): adressen hashas och lagras aldrig, samma besökare ger samma nyckel, ett ändrat salt ändrar
  varje nyckel, en anropare utan adress hamnar i den delade hinken i stället för att vägras, hinken
  kan inte förväxlas med en riktig hash eller med `global`, den loggas, och — den som bevarar spec
  141:s regel där den fortfarande gäller — utan salt vägras allt, adress eller inte.
- **Extended** — [`route.test.ts`](../apps/web/src/app/api/chat/route.test.ts): headern på preview,
  ingen header i produktion, och att orsaken bärs igenom oavsett var den upptäcktes (modellen eller
  taket). Kroppen assertas fortfarande vara exakt `{"status":"unavailable"}` i alla tre.
- **Extended** — [`provider.test.ts`](../apps/web/src/features/chat/provider.test.ts): varje utfall
  bär nu sin orsak, ett kontraktsbrott skiljs från ett avbrott, och loggen innehåller inte besökarens
  fråga.
- **Oförändrade** — [`ChatWidget.test.tsx`](../apps/web/src/features/chat/ChatWidget.test.tsx) (12)
  och [`knowledge.test.ts`](../apps/web/src/features/chat/knowledge.test.ts) (8) rördes inte. Det är
  självt ett bevis: hade svaret till besökaren ändrats hade panelens tester behövt ändras.
- **Manuell kontroll** — ett anrop mot den lokala servern **utan** `x-forwarded-for`, alltså precis
  det webbläsaren skickar, svarade med riktig text i stället för FAQ-läge. Det var omöjligt före den
  här ändringen.
- **Result:** `pnpm -r typecheck` rent · `pnpm -r lint` rent · `pnpm -r test` **961 passed, 0 skipped,
  0 failed** (schemas 69, engine 223, web 669) · `pnpm test:scripts` 88 passed. Kört mot lokal
  Supabase, så varje `*.db.test.ts` gick igång.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

1. **`apps/web/src/features/chat/diagnostics.ts`** (ny) — `ChatUnavailableReason` som union,
   `reportChatUnavailable`, `reportSharedBucket`, `diagnosticHeaders` och `UNAVAILABLE_REPLY`. En fil
   så att prefixet finns på ett ställe, orsakslistan är uttömmande i typsystemet, och kroppen
   besökaren får är en konstant utan plats för en orsak.
2. **`apps/web/src/features/chat/provider.ts`** — `ChatOutcome.unavailable` bär nu sin orsak, och en
   lokal `unavailable(reason)` rapporterar och returnerar i ett steg, så att ingen gren kan falla
   tyst så som spec 141:s gjorde. Nio returpunkter, var och en med sin orsak.
3. **`apps/web/src/lib/data/chat-limits.ts`** — samma mönster för taket, plus den delade hinken i
   `visitorKey`.
4. **`apps/web/src/app/api/chat/route.ts`** — `unavailableReply(reason)`, som sätter headern via
   `diagnosticHeaders`. Kroppen är oförändrad.
5. **`specs/141-landing-chat.md`** — FAQ-läge-regeln omskriven med en not om vad som ändrats och varför.

---

## Implementation notes

**Rapportera och returnera i ett steg.** Både `provider.ts` och `chat-limits.ts` fick en lokal
`unavailable(reason)` som loggar och bygger returvärdet tillsammans. Alternativet — logga på ett
ställe och returnera på ett annat — är exakt hur spec 141 hamnade i att ha nio grenar som alla ledde
till samma tysta konstant. Nu finns det ingen väg till `unavailable` som inte går genom en rad i
loggen.

**`VERCEL_ENV`, inte `NODE_ENV`, och det är inte en detalj.** Vercel bygger preview-deployer med
`NODE_ENV === "production"`. En `NODE_ENV`-gate hade alltså tigit på precis den deploy där kvällens
bugg satt, sett fullständigt rimlig ut i en granskning, och lämnat oss lika blinda som förut. Det
finns ett test vars enda uppgift är att den gaten inte råkar bytas tillbaka.

**Panelens tester rördes inte, med flit.** Specen lovar att svaret till besökaren är oförändrat. Hade
det inte stämt hade `ChatWidget.test.tsx` behövt ändras — att den står orörd är billigare bevis än
någon ny assertion.

**En sak den här ändringen inte gör:** den lagar inte dev-deployen. Den gör att nästa anrop dit säger
`x-airrow-chat-reason: …` i klartext i stället för att orsaken måste härledas ur svarstider.

---

## Data model

**No schema changes.** Den delade hinken är ett reserverat `bucket`-värde i `chat_rate_limits`, som
redan finns — inget nytt fält, ingen migration.

---

## Security

Loggen bär orsakskod och ingenting annat; besökarens text, botens svar, nyckeln och den hashade
besökarnyckeln är alla uteslutna (§II: loggar bär id och metadata, aldrig innehåll). Adressfallbacken
gör skyddet trubbigare men inte svagare — den byter "vägra allt utan adress" mot "räkna allt utan
adress i samma hink", bevarat av samma två tak som redan finns.

---

## Edge cases

- **Alla besökare bakom en proxy utan header** → de delar per-besökartaket, vilket i praktiken
  stänger chatten efter fem svar per dygn. Säkert, men fel — och därför loggas det, så att den som
  driftsatt kan rätta proxyn i stället för att undra.
- **Databasen är onåbar** → oförändrat FAQ-läge, men nu med en rad som säger varför.
- **Loggen i en miljö utan nyckel** → en rad per anrop, begränsad av samma tak som allt annat.

- **Adress saknas i produktion** → samma delade hink som överallt annars. Fallbacken är inte
  miljöberoende: en proxy-deploy som tyst ligger i FAQ-läge för alltid är precis felet den här specen
  finns för, och dev-only hade lämnat det olöst för alla utom oss. Skyddet bärs av de två taken, inte
  av vilken miljö koden råkar köra i.

---

## Out of scope

- Mätvärden, dashboards eller larm. Det här är en loggrad, inte observability.
- Att visa besökaren varför chatten är tyst.
- Att ändra taken, promten eller panelen.
