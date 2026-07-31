# Spec 141 — En chatt på landningssidan som svarar, och leder vidare

> **In one sentence:** En besökare som undrar vad Airrow faktiskt gör kan fråga rakt ut och få ett
> korrekt svar på plats, i stället för att gissa sig igenom sidan eller lämna.

|                |                                                      |
| -------------- | ---------------------------------------------------- |
| **Status**     | ✅ Done                                               |
| **Issue**      | #141 — "Chatt på landningssidan som svarar på frågor om Airrow och leder till första projektet" |
| **Branch**     | `141-landing-chat` (from `feature/chatbot`)          |
| **Feature**    | chatbot                                               |
| **Depends on** | [spec 23](23-landing-copy-footer.md) (landningssidans copy, som blir botens kunskapskälla), [spec 74](74-pro-entitlements.md) (`limits.ts`, gratisnivåns siffror) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

_Who wants this, and what they get out of it._

As a **grundare som precis landat på airrow.app** I want **kunna fråga rakt ut vad Airrow gör för mig
och vad jag får** so that **jag kan bestämma mig direkt i stället för att gissa mig igenom sidan.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today:** landningssidan förklarar Airrow i en riktning — vi säger vad vi vill säga, i den ordning
  vi valt. Det finns ingen väg för en besökare att ställa en fråga.
- **The problem:** den vanligaste frågan vi får — "genererar ni min app eller inte?" — är exakt den
  som avgör om någon skapar ett projekt. Den som fastnar på den lämnar.
- **Already in place:**
  - [`landing/copy.ts`](../apps/web/src/features/landing/copy.ts) är redan enda källan för vad vi
    lovar, och läser gratisnivåns siffror från
    [`generation/limits.ts`](../apps/web/src/features/generation/limits.ts) i stället för att skriva ut
    dem ([copy.ts:9-17](../apps/web/src/features/landing/copy.ts#L9-L17), spec 74).
  - [`generation/limits.ts`](../apps/web/src/features/generation/limits.ts) är formen för "siffror utan
    imports", just för att både marknadsföring och tillämpning ska kunna läsa dem utan att dra in
    Supabase i en klientbundle. Chattens tak får samma form.
  - [`generation/author.ts`](../apps/web/src/features/generation/author.ts) är den befintliga formen för
    ett Claude-anrop som aldrig kastar: canary mot promptläckage
    ([:58](../apps/web/src/features/generation/author.ts#L58)), meta-markörer som fångar ett svar där
    modellen talar till läsaren i stället för att skriva åt den
    ([:240-247](../apps/web/src/features/generation/author.ts#L240-L247)), och en diskriminerad union
    som utfall ([:317-322](../apps/web/src/features/generation/author.ts#L317-L322)).
  - `/api/chat` ligger utanför middleware-matchern
    ([middleware.ts:22](../apps/web/src/middleware.ts#L22), som bara täcker `/app` och
    `/api/projects`) och är därmed publik utan att någon regel ändras.
  - [`lib/data/supabase.ts`](../apps/web/src/lib/data/supabase.ts) ger `db()` med service-role-nyckeln,
    och [`referrals.ts`](../apps/web/src/lib/data/referrals.ts) är prejudikatet för en tabellgrupp som
    bor bredvid store.ts i stället för i den.
  - [`20260730120000_referrals.sql:95-131`](../supabase/migrations/20260730120000_referrals.sql#L95-L131)
    är formen för "bara `service_role` skriver", och dess denial-test är formen för att bevisa det.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

**Kunskapen är handskriven, inte hämtad.** Ingen RAG, ingen vektordatabas — kunskapsytan är ett par
sidor text. Systempromten byggs av `landing/copy.ts` plus en kort `features/chat/knowledge.ts` för det
copyn inte täcker (`/start` vs `/cleanup`, vad vi *inte* gör, vem som äger repot). Då kan chatten
aldrig hamna i konflikt med sidan den sitter på, och en ändrad pristext ändrar botens svar i samma
commit (§IV: en fakta bor i exakt en fil).

**Providern byggs som `generation/author.ts`.** Kastar aldrig, returnerar en diskriminerad union
(`answered | off_topic | unavailable`), canary i systempromten så en läckt prompt slänger svaret.
Modell: `claude-haiku-4-5`, lågt `max_tokens` — samma val och samma skäl som authoring.

**Svaret streamas inte** (ändrar issuens skiss, som sa "streamar"). Hela providerns skydd är
efterhandsvalidering: canary, meta-markörer och off-topic-avgörandet kan alla bara ställas mot ett
*färdigt* svar. Att streama vore att visa besökaren text vi ännu inte vet om vi får visa — en läckt
systemprompt hade stått på skärmen innan kontrollen som skulle fånga den ens kört. Med Haiku och ett
lågt takttal är svaret uppe på ett par sekunder ändå, och panelen har en skrivindikator för dem.

**Allt skyddet behöver saknas ⇒ FAQ-läge.** Nyckel, salt eller migration — saknas något av dem kan
taket inte hållas, och då svarar chatten inte alls i stället för att svara obegränsat. Det är en regel,
inte tre, och den gör att en halvkonfigurerad miljö aldrig blir den dyra miljön.

**Egen nyckel, eget tak.** Chatten är en publik oautentiserad yta; genereringen är det folk betalar
för. `AIRROW_CHAT_API_KEY` i en egen Console-workspace med spend limit, **utan fallback** till
`ANTHROPIC_API_KEY` — en fallback skulle låta en missbruksvåg mot chatten landa på genereringens
budget. Rate limits är däremot organisationsscopade per modell och delas oavsett antal nycklar, vilket
är ett skäl till både modellvalet och dagstaket i appen.

**Två konstitutionella avvikelser, båda medvetna och båda skrivna här:**

1. **§I** säger att Claude-API:t nås "only via the generation engine's authoring provider". Chatten är
   en andra anropsplats. Invarianten ändras till att namnge båda, i samma PR — samma sätt som spec 67
   ändrade repo-access-invarianten.
2. **§II** säger att varje resurs hänger på `organization_id`. Rate-limit-tabellen gör det inte —
   besökaren är anonym och har ingen organisation. Den är därför inte läsbar för någon:
   `authenticated` nekas allt, bara `service_role` skriver, och denial-testet är det som bevisar det.

**Not touched:** `generation/author.ts`, `ANTHROPIC_API_KEY`, engine och schemas. Chatten lägger till
en yta; den ändrar ingenting om hur foundations skrivs.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] En chattknapp finns på landningssidan (`/`) och **bara** där — inte på `/login`, `/signup` eller
      legal-sidorna. Den öppnar en panel med 3–4 föreslagna frågor och ett fritextfält, och panelen
      fungerar på mobil.
- [x] Boten svarar alltid på engelska, oavsett vilket språk besökaren skriver på.
- [x] Tråden överlever en sidomladdning (`sessionStorage`, inte cookie, inte `localStorage`), och
      servern lagrar fortfarande ingenting.
- [x] Ett svar på en vanlig fråga ("vad får jag?", "genererar ni min app?", "vad kostar det?") är
      korrekt enligt landningssidans egen copy — samma källa, ingen andra sanning.
- [x] Botens kunskap om gratisnivån härleds från `features/generation/limits.ts` via
      `landing/copy.ts`, så den aldrig kan lova en gräns produkten inte tillämpar.
- [x] Boten svarar inte på något utanför Airrow, och behandlar instruktioner i ett besökarmeddelande
      som text, inte som order.
- [x] Vet boten inte, säger den det och pekar på rätt sektion eller på att skapa ett projekt — den
      hittar aldrig på pris, funktion eller tidplan.
- [x] Panelen leder vidare utan att sälja: CTA:n ligger i foten och visas när tråden tar slut eller
      går i FAQ-läge, och systempromten säger uttryckligen åt modellen att **inte** avsluta varje svar
      med en knuff. (Omskrivet under `/analyze` — se _Implementation notes_.)
- [x] Utan nyckel, vid nätverksfel eller när dagstaket är nått fungerar panelen ändå: den visar de
      handskrivna FAQ-svaren och CTA:n. Chatten går aldrig sönder på sidan.
- [x] Anropet mot Claude sker enbart server-side; ingen nyckel, ingen systemprompt och ingen
      kunskapsbas når klientbundeln.
- [x] Chatten använder `AIRROW_CHAT_API_KEY` och faller aldrig tillbaka på `ANTHROPIC_API_KEY`.
      `generation/author.ts` är oförändrad.
- [x] Taken hålls: **250 svar per dygn globalt** och **5 svar per dygn och besökare**. Båda avgörs
      server-side och kan inte kringgås från klienten; båda tar panelen till FAQ-läget när de slår i,
      och besökaren får veta vilket av dem det var.
- [x] Rate-limit-tabellen har RLS med **denial-test**: `authenticated` kan varken läsa eller skriva.
- [x] Inget samtalsinnehåll skrivs till loggar eller till databasen. Ingen cookie sätts, så chatten
      kräver inget samtycke.
- [x] Svaret renderas som text (sanerat), aldrig som HTML, och kan bara länka till Airrows egna sidor.
- [x] Konstitutionens §I namnger chattens provider som den andra Claude-anropsplatsen, och §II-avsteget
      för rate-limit-tabellen är skrivet i den här specen — båda i samma PR som koden.
- [x] `CLAUDE.md` och `UI_ARCHITECTURE.md` uppdateras i samma ändring (§IV).
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — [`features/chat/knowledge.test.ts`](../apps/web/src/features/chat/knowledge.test.ts)
  (8): gratisnivån kommer ordagrant ur `copy.ts` och spåras vidare till `limits.ts`; de tre stegen och
  gränsdragningen ("never write your application code", `/start`, `/cleanup`) finns i promten; ingen
  Pro-siffra utlovas; förslagsfrågorna är FAQ:ns; och — den som fångar en riktig bugg — att
  `ChatWidget.tsx` importerar `faq.ts` och aldrig `knowledge.ts` eller `provider.ts`.
- **New tests** — [`features/chat/provider.test.ts`](../apps/web/src/features/chat/provider.test.ts)
  (13): svar, fence-inpackad JSON, off-topic som egen kanal, canary, prompt-läckage, för långt svar,
  tomt/icke-strängsvar, `refusal`, nätverksfel, oparsebar text, turgräns — plus de två som skyddar
  designbesluten: att `ANTHROPIC_API_KEY` **inte** duger som nyckel, och att besökarens ord skickas
  som `<visitor>`-data medan botens replikeras som dess egna.
- **New tests** — [`app/api/chat/route.test.ts`](../apps/web/src/app/api/chat/route.test.ts) (10):
  inget anrop innan ett svar är klämt, rätt mening för rätt tak, återlämning när modellen inte gav
  något, ingen återlämning när den gav något (inklusive ett avböjande), ogiltiga kroppar, en full tråd
  som stängs i stället för att kallas ogiltig, adressen tagen från plattformens header, och en
  anropare utan adress som aldrig serveras.
- **New tests** — [`features/chat/ChatWidget.test.tsx`](../apps/web/src/features/chat/ChatWidget.test.tsx)
  (12): stängd som förval, de fyra frågorna, svar renderat som text — inklusive ett svar med `<img
  onerror>` som blir tecken och inte element — FAQ-läget vid ouppnåelig modell och vid trasig
  uppkoppling, de två taken med var sin mening, off-topic som fortsatt samtal, tråden över en
  omladdning utan cookie, en manipulerad `sessionStorage` som ignoreras, och tråden som stängs vid
  turgränsen.
- **New tests** — [`lib/data/chat-limits.db.test.ts`](../apps/web/src/lib/data/chat-limits.db.test.ts)
  (8, mot riktig Postgres): båda taken,
  att ett avvisat anspråk inte belastar dygnet, att ett dygnsstopp lämnar tillbaka besökarens svar,
  att besökare räknas var för sig, att en återlämning aldrig går under noll, det reserverade
  `global`-namnet, och de två som betyder mest — att `authenticated` varken kan läsa, skriva eller
  köra funktionerna.
- **Result:** `pnpm -r typecheck` rent · `pnpm -r lint` rent · `pnpm -r test` **889 passed, 0 skipped,
  0 failed** (schemas 44, engine 223, web 622) · `pnpm test:scripts` 88 passed. Kört mot lokal
  Supabase, så varje `*.db.test.ts`-svit i repot gick igång — inte bara den här specens.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

1. **`apps/web/src/features/chat/limits.ts`** (ny) — de fyra siffrorna, utan imports, som
   [`generation/limits.ts`](../apps/web/src/features/generation/limits.ts): globalt dygnstak,
   per-besökartak, teckengräns per meddelande, turgräns.
2. **`apps/web/src/features/chat/knowledge.ts`** (ny) — `buildKnowledge()` som sätter ihop
   systempromtens faktadel av `landing/copy.ts` plus det copyn inte säger, samt `FAQ` och
   `SUGGESTED_QUESTIONS`. Ren data, inga imports från servern — samma FAQ används både som
   fallback-svar och som förslagsknappar, vilket är vad som gör fallbacken gratis.
3. **`apps/web/src/features/chat/copy.ts`** (ny) — panelens egna synliga strängar, skilt från
   `knowledge.ts` som är vad boten *vet*.
3b. **`apps/web/src/features/chat/faq.ts`** (ny) — de fyra handskrivna svaren. Egen fil därför att
   panelen importerar dem och panelen är en klientkomponent; se _Implementation notes_.
3c. **`apps/web/src/features/chat/contract.ts`** (ny) — Zod-schemat för requesten, `ChatTurn` och
   `ChatReply`. Egen fil av samma skäl: routen och panelen behöver båda formen, och ingen av dem får
   importera den andra.
4. **`apps/web/src/features/chat/provider.ts`** (ny) — enda stället chatten ringer Claude. Byggd som
   `author.ts`: kastar aldrig, canary, meta-markörer, `ChatOutcome` som diskriminerad union.
   Läser `AIRROW_CHAT_API_KEY` — aldrig `ANTHROPIC_API_KEY`.
5. **`apps/web/src/lib/data/chat-limits.ts`** (ny) — `claimChatAnswer(visitorKey)`, ett enda
   RPC-anrop mot funktionen i migrationen. Bredvid `referrals.ts` av samma skäl som den ligger
   bredvid `store.ts`.
6. **`apps/web/src/app/api/chat/route.ts`** (ny) — publik POST, Zod på request, tak före anrop.
   **Icke-streamande** — se _Design decision_.
7. **`apps/web/src/features/chat/ChatWidget.tsx`** (ny) — klientkomponent, explicita tillstånd,
   `sessionStorage`.
8. **`apps/web/src/app/page.tsx`** — montera widgeten, sist i `<body>`-trädet.
9. **`supabase/migrations/20260801120000_chat_rate_limit.sql`** (ny) — tabell, RLS, och funktionen
   som räknar båda taken atomärt.
10. **`.claude/spec-kit/constitution.md`** — §I-ändringen.
11. **`CLAUDE.md`** och **`docs/architecture/UI_ARCHITECTURE.md`** — samma ändring som koden (§IV).
12. **`apps/web/.env.example`** — nyckeln och saltet, dokumenterade som "utan dem går chatten i
    FAQ-läge", plus `AIRROW_CHAT_MODEL` som override.

**No change needed:** `middleware.ts` (matchern täcker redan inte `/api/chat`), `author.ts`,
`ANTHROPIC_API_KEY`, `packages/engine`, `packages/schemas`.

---

## Implementation notes

**Kunskapen fick delas i två filer, och det var en riktig bugg.** Planen hade `knowledge.ts` som en
fil. Panelen är en klientkomponent och importerade den för FAQ:n och förslagsfrågorna — vilket hade
skickat hela kunskapsbasen, `buildKnowledge()` och allt, till varje besökares webbläsare, tvärtemot
kriteriet som säger att den inte får nå klientbundeln. Tree-shaking hade kanske räddat det och är
ingen garanti att bygga ett kriterium på. Nu ligger de fyra svar som ska *visas* i `faq.ts` och det
dokument som skrivs *åt modellen* i `knowledge.ts`, och ett test läser `ChatWidget.tsx` och hävdar att
importen inte kommer tillbaka.

**Två avvikelser från planen, båda i specen ovan innan de skrevs:**

1. **Svaret streamas inte.** Skissen i issuen sa att det skulle göra det. Varje kontroll providern har
   — canary, prompt-läckage, off-topic, längd — går bara att ställa mot ett färdigt svar, så en
   strömmad text hade stått på skärmen innan kontrollen som skulle stoppa den ens kört.
2. **`release_chat_answer` fanns inte i planen.** Anspråket görs före anropet, eftersom det är anropet
   som kostar pengar. Utan en återlämning hade fem nätverksfel tömt en besökares dygn och gett dem
   noll svar — värsta tänkbara utfall för den vi minst vill straffa.

**Konstitutionen fick två ändringar, inte en.** Kriteriet begärde §I. Men §II säger fortfarande att
varje resurs hänger på `organization_id`, och `chat_rate_limits` gör inte det — hade den meningen
lämnats orörd hade konstitutionen förbjudit det som just byggts, och §IV kallar stale kontext ett
trasigt bygge. §II har därför ett namngivet undantag för den enda tabellen, med hänvisning hit.

**Ett kriterium skrevs om under `/analyze` i stället för att byggas om.** Det stod "varje svar landar i
ett tydligt nästa steg, som en rad". Panelen byggdes i stället med CTA:n i foten, som visas när tråden
tar slut eller går i FAQ-läge, plus en promptregel som säger åt modellen att *inte* avsluta varje svar
med en knuff. Koden och specen sa alltså olika saker, och §IV kräver att specen fixas först — den är
omskriven till att beskriva det som byggts, eftersom en rad efter varenda mening är exakt den säljbot
kriteriet strax ovanför säger att vi inte ska vara. Den som tycker tvärtom ändrar panelen, inte
promten: regeln finns på två ställen och båda måste flyttas.

**Migrationen är körd, inte bara läst.** `supabase migration up` mot en databas som redan hade alla
tidigare migrationer — den väg en riktig deploy tar — och därefter gick sviten igenom. Det är samma bar
som spec 122 satte, och av samma skäl: den specens anteckningar handlar om ett fel som bara syntes när
migrationen faktiskt applicerades. Åtta tester passerade, inklusive de två som betyder mest, att
`authenticated` varken kan läsa tabellen eller köra funktionerna som skriver den.

**CI kommer inte att köra om dem.** `ci.yml` kör `pnpm -r test` utan Postgres-tjänst; enda
Supabase-steget är en läsande drift-kontroll. Varje `*.db.test.ts` i repot hoppas alltså över där, och
det gällde redan före den här specen. Bevisningen för RLS är den lokala körningen ovan — inte något som
en merge upprepar.

**En sak till att veta lokalt:** dev-servern sätter ingen `x-forwarded-for` och webbläsaren skickar
ingen, så `visitorKey` blir null och panelen går i FAQ-läge på localhost hur rätt konfigurerad den än
är. `curl -H "x-forwarded-for: …"` visar att kedjan fungerar. På Vercel sätts headern alltid, så det
är ett lokalt fenomen — men en self-hostad deploy bakom en proxy som inte sätter den skulle ligga tyst
i FAQ-läge, vilket är värt en egen issue snarare än en ändring här.

---

## Data model

_Any database change. Most specs have none — say so plainly._

**En ny tabell**, i en migration med RLS i samma ändring (§II). Den är avsiktligt *inte* keyad på
`organization_id` — se _Design decision_.

- **`chat_rate_limits`** — hashad besökarnyckel (pk-del), dygnet, antal. `service_role` gör varje
  skrivning; `authenticated` får varken `select` eller `insert`. Ingen kolumn bär text besökaren
  skrivit — inte ens den hashade nyckeln går att vända tillbaka till en IP utan salt, och saltet är en
  serverhemlighet.

**Taken: 250 svar per dygn globalt, 5 svar per dygn och besökare.** Det globala taket är
kostnadstaket — 250 svar med Haiku 4.5 landar runt en dollar per dygn — och per-besökartaket är det som
gör att en enskild missbrukare inte kan äta upp det. Båda räknas i samma tabell (en rad per nyckel per
dygn, där det globala taket är en reserverad nyckel), så det är en läsning och en skrivning per svar,
inte två av varje.

---

## Security

Besökarens meddelanden är otrodd text: de går in i promten som data i taggar, och det som kommer ut
valideras och renderas sanerat som text — aldrig HTML, aldrig exekverat. Nyckeln är chattens egen, bor
bara server-side och kan återkallas utan att genereringen påverkas; systempromten bär en canary och ett
svar som innehåller den slängs. Inget samtalsinnehåll loggas eller lagras (§II), och tre oberoende tak
— rate limit, dagstak och workspacens spend limit — begränsar vad en missbrukare kan kosta.

---

## Edge cases

- **Besökaren skriver ett väldigt långt meddelande** → avvisas av Zod före något anrop, med ett svar
  som säger vad gränsen är.
- **Konversationen blir lång** → turgränsen slår in; panelen säger att tråden är slut och erbjuder att
  börja om eller skapa ett projekt.
- **Modellen svarar off-topic trots promten** → providern returnerar `off_topic` och panelen visar den
  handskrivna avvisningen i stället för modellens text.
- **Databasen har inte kört migrationen än** → rate limit kan inte avgöras. Chatten går i FAQ-läge
  hellre än att släppa igenom obegränsat (motsatt val mot spec 122:s tolerans, eftersom det som saknas
  här är ett skydd, inte en funktion).
- **Besökaren laddar om sidan** → tråden överlever, från `sessionStorage`. Den är klientens egen och
  skickas med varje anrop; servern lagrar fortfarande ingenting. `sessionStorage` och inte
  `localStorage`, eftersom en tråd som dyker upp igen veckan därpå är förvirrande snarare än hjälpsam
  — och inte en cookie, så samtyckesfrågan uppstår aldrig.
- **Besökaren har använt sina 5 svar** → panelen säger det rakt ut och erbjuder CTA:n och FAQ-svaren.
  Inte ett fel, utan ett tillstånd panelen har en text för.
- **Flera besökare bakom samma IP** (kontor, café, NAT) → de delar de 5 svaren, och den fjärde
  kollegan möter taket utan att ha frågat något. Ett medvetet pris för att taket ska vara enkelt; om
  det visar sig i verklig trafik är höjningen en siffra, inte en omskrivning.

---

## Out of scope

- Assistent inne i `/app` för inloggade grundare.
- RAG över genererade dokument eller `/docs`.
- Överlämning till människa, e-postinsamling eller leadfångst.
- Chatten på andra ytor än `/`. Den finns inte på `/login`, `/signup` eller legal-sidorna — någon som
  redan är på väg in i produkten behöver inte övertalas, och en chatt på en inloggningssida är i vägen.
- Flerspråkighet. Boten svarar alltid på engelska, samma språk som landningssidan den läser sin
  kunskap ur. En bot som svarar på besökarens språk skulle beskriva produkten i ord ingen granskat.
