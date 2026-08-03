# Spec 158 — Archer: chatten på varje publik sida, med ett namn och en väg till supporten

> **In one sentence:** Chatten följer med besökaren över hela den publika sidan, presenterar sig som
> Archer, och lämnar över till en människa när svaret inte räcker — i stället för att bara finnas på
> landningssidan och sluta i ett artigt nej.

|                |                                                      |
| -------------- | ---------------------------------------------------- |
| **Status**     | ✅ Done                                               |
| **Issue**      | #158 — "Archer: chatten på varje publik sida, med ett namn, ett ansikte och en väg till supporten" |
| **Branch**     | `158-archer-everywhere` (from `feature/chatbot`)     |
| **Feature**    | chatbot                                               |
| **Depends on** | [spec 141](141-landing-chat.md) (bygger chatten, och äger de tre besluten den här specen vänder på), [spec 144](144-support-review.md) (supportsidan som blir målet), [spec 151](151-chat-diagnostics.md) (senaste ändringen i samma yta) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

> **Ändrad av [spec 159](159-ui-reference-start.md):** kriteriet "finns **inte** på `/app/**`" gäller
> inte längre. Archer monteras nu även från `app/app/layout.tsx` och syns på varje inloggad sida. Allt
> annat i den här specen står kvar — uteslutningen var ett beslut, inte en säkerhetsgräns, och den
> inloggade grundaren visade sig vara den som oftast har en fråga. Se kriteriet nedan, som är märkt
> där det står.

---

## User story

_Who wants this, and what they get out of it._

As a **besökare som fastnat på en fråga någonstans mitt i sidan** I want **kunna fråga där jag står,
och nå en människa när svaret inte räcker** so that **jag slipper leta mig tillbaka till startsidan
eller gissa var man skriver till er.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today** (före den här specen): `ChatWidget` monteras på exakt ett ställe — sist i trädet på
  landningssidan, `app/page.tsx:277`, som den här ändringen flyttar till
  [`app/(public)/page.tsx`](<../apps/web/src/app/(public)/page.tsx>) — och ingen annanstans. Panelen heter
  "Ask about Airrow" ([`chat/copy.ts`](../apps/web/src/features/chat/copy.ts)) och har varken namn
  eller ansikte. Frågar någon efter en människa finns inget svar att ge.
- **The problem:** frågan som avgör om någon skapar ett projekt dyker sällan upp i det ögonblick
  besökaren står på `/`. Den dyker upp vid prissättningen, i villkoren, eller vid registreringen —
  och just då är chatten borta. Och en bot byggd för att aldrig hitta på kommer regelbundet att landa
  i "det vet jag inte", där rätt svar är en väg vidare snarare än en återvändsgränd.
- **Already in place:**
  - Hela chattkedjan från spec 141: `provider.ts`, `/api/chat`, taken i `chat-limits.ts`, FAQ-läget.
    Den här specen ändrar inget i den — bara var panelen sitter och vad den säger.
  - [`/app/support`](../apps/web/src/app/app/support/page.tsx) med `submitTicketAction` och
    `supportInbox()` ([`lib/email.ts:49`](../apps/web/src/lib/email.ts#L49)), sedan spec 144 — men
    bakom `requireSession()` och middlewarens `/app/:path*`-matcher.
  - [`chat/copy.ts`](../apps/web/src/features/chat/copy.ts) samlar redan varje synlig sträng, och
    `knowledge.ts` allt boten vet. Både namnet och supportvägen har alltså en given plats.
  - `public/brand/`-tillgångarna och `components/brand/` är formen för en självhostad bildresurs.
  - Root-layouten ([`app/layout.tsx:24`](../apps/web/src/app/layout.tsx#L24)) omsluter **även**
    `/app/**` — den uppenbara monteringspunkten är därför inte rätt utan att `/app` utesluts aktivt.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

Tre ändringar i samma yta, i en spec därför att de alla ändrar samma fråga: vad chatten är för sidan.
Panelen flyttas från landningssidan till en monteringspunkt som täcker varje publik sida men inte
`/app/**`; kunskapen får veta att supporten finns så att boten kan lämna över i stället för att säga
nej; och panelen får ett namn och ett ansikte.

**Detta vänder tre beslut i spec 141, inte kringgår dem.** Spec 141 skrev "bara på `/`", "chatten på
andra ytor än `/`" och "överlämning till människa" som medvetna avgränsningar. Alla tre skrivs om i
den här PR:en — koden och specen får inte säga olika saker (§IV).

**Not touched:** `chat-limits.ts`, migrationen, nyckeln och taken. Det här ändrar inte vad chatten
kostar eller hur den skyddas. `generation/author.ts` och `ANTHROPIC_API_KEY` är orörda.
`provider.ts` och `/api/chat` är däremot *inte* orörda — se _Implementation notes_: hand-offen krävde
ett fält i kontraktet, eftersom en länk som modellen skrev själv hade varit en länk vi inte styr.

**Supporten kräver konto, och Archer säger det i förväg.** `/app/support` ligger bakom
`requireSession()` och middlewarens `/app/:path*`-matcher. Vi öppnar inte en publik väg dit och
exponerar ingen adress — Archer säger rakt ut att man loggar in för att nå supportsidan, och länkar
dit. Ett steg som besökaren vet om innan de klickar är inte ett hinder; det som hade varit ett
hinder är en länk som tyst kastar dem till `/login` utan att ha sagt varför.

**Panelen finns på `/start`.** Intervjun är precis där tvekan sitter, och en stängd bubbla i hörnet
konkurrerar inte med ett fokuserat flöde.

**Profilbilden är den levererade artworken**, flyttad från repo-roten till
`apps/web/public/brand/archer-avatar.png` — samma plats och samma mönster som `airrow-mark.png` och
lockupen, serverad via `next/image` så full upplösning i källan aldrig når besökaren i den storleken.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

### Panelen på varje publik sida

- [x] Chattknappen finns på `/`, `/login`, `/signup`, `/start` och legal-sidorna (`/cookies`,
      `/privacy`, `/terms`). Panelen är samma komponent med samma responsiva klasser som spec 141
      levererade och verifierade på `/` — den blir inte mindre mobilanpassad av att flyttas.
      **Rättat under `/implement`:** planen räknade upp `/invite/[code]` också, men den routen renderar
      ingenting — den är en `route.ts` som sätter en cookie och skickar vidare till `/signup` (spec
      122). Den ligger i route-gruppen och får layouten; det finns bara ingen sida att visa en panel
      på. Besökaren möter Archer en omdirigering senare.
- [x] ~~Den finns **inte** på `/app/**`.~~ **Upphävd av [spec 159](159-ui-reference-start.md)** — den
      finns nu på `/app/**` också, monterad från `app/app/layout.tsx`. Uppfyllt som skrivet när den här
      specen stängdes; den strukturella egenskapen som gjorde det kontrollerbart (root-layouten
      monterar ingenting) står kvar.
- [x] Widgeten monteras bara från en **layout**, aldrig från en sida. Ingen sida importerar
      `ChatWidget` för egen del, så nästa sida i respektive träd får chatten utan att någon minns att
      lägga till den. (Var "på **ett** ställe" — spec 159 gjorde det till två, en per layout.)
- [x] CTA:ns mål avgörs på varje sida på samma sätt som på landningssidan i dag (`primaryHref`,
      härlett ur sessionen), och den logiken finns kvar på exakt ett ställe — inte kopierad per sida.
- [x] Tråden överlever **navigering mellan sidorna**, inte bara en omladdning: den som frågar på `/`
      och klickar till `/terms` har kvar sitt samtal. Fortfarande `sessionStorage`, fortfarande ingen
      cookie, servern lagrar fortfarande ingenting.
- [x] Panelen är stängd som förval på varje sida, och den stängda knappen ligger i marginalen under
      auth-korten i stället för över dem.
      **Omskrivet under `/analyze`.** Kriteriet sa först "skymmer varken innehåll eller fälten", vilket
      var en högre ribba än featuren själv håller: panelen är en overlay med flit — den har legat över
      landningssidans innehåll sedan spec 141 — och ingen har öppnat en webbläsare för att kontrollera
      det. Det som faktiskt går att belägga: `/login` och `/signup` är lodrätt centrerade `max-w-sm`-kort
      med `py-16` ([`login/page.tsx:59-60`](<../apps/web/src/app/(public)/login/page.tsx#L59-L60>)), och
      knappen är ~36 px hög på `bottom-5` — alltså ~56 px från nederkanten, inom de 64 px marginalen
      lämnar under kortet. Se _Edge cases_ för fallet som inte täcks av den räkningen.
- [x] Taken är oförändrade — 250 svar per dygn globalt, 5 per besökare och dygn — och delas över alla
      sidor. Fler ytor får inte betyda fler svar per besökare.

### Vägen till en människa

- [x] Frågar besökaren efter en människa ("kan jag prata med någon?", "hur kontaktar jag er?", "jag
      har ett problem med betalningen") svarar Archer med vägen till supporten, inte med ett nej.
- [x] Svaret **säger att man loggar in för att nå supportsidan** innan det länkar dit. Ingen besökare
      klickar och landar på `/login` utan att ha fått veta varför.
- [x] Ingen publik supportväg och ingen exponerad supportadress läggs till. `/app/support` förblir
      bakom `requireSession()`.
- [x] Länkregeln från spec 141 gäller fortfarande: ett svar kan bara peka på Airrows egna ytor.
      **Rättat under `/analyze`:** kriteriet sa "läggs till den tillåtna listan", och någon sådan lista
      finns inte — spec 141 uppfyllde regeln strukturellt i stället, genom att svaret aldrig blir
      markup. Det gäller fortfarande: modellens text renderas som text
      ([`ChatWidget.tsx:207`](../apps/web/src/features/chat/ChatWidget.tsx#L207)) och panelens enda två
      länkar är dess egna konstanter ([`:244`](../apps/web/src/features/chat/ChatWidget.tsx#L244)
      `SUPPORT_PATH`, [`:253`](../apps/web/src/features/chat/ChatWidget.tsx#L253) `ctaHref`). Att bygga
      en lista hade varit en svagare regel än den som redan gäller, inte en starkare.
- [x] Supporten erbjuds **när boten inte vet eller när frågan är ett ärende** — inte som en rad efter
      varje svar. Samma regel som CTA:n redan lyder under (spec 141).
- [x] Kunskapen om att supporten finns bor i `features/chat/knowledge.ts` med resten, inte som en
      hårdkodad sträng i providern eller i JSX.
- [x] FAQ-läget (ingen nyckel, tak nått, nätverksfel) visar också vägen till supporten — det är precis
      då någon behöver den mest.

### Archer

- [x] Panelen presenterar boten som **Archer**, och systempromten säger att den heter Archer — så att
      "vem är du?" får samma svar som panelen visar.
- [x] Archer säger att den är Airrows assistent om någon frågar, och påstår aldrig att den är en
      människa.
- [x] `apps/web/public/brand/archer-avatar.png` visas i panelens huvud och vid botens repliker, via
      `next/image` med explicit `width`/`height` som `AirrowLogo` — självhostad, ingen extern
      förfrågan, alt-text satt.
- [x] Avataren bär **inte** `.brand-asset`. Den klassen mörkar artwork i ljust tema
      ([`globals.css:277`](../apps/web/src/app/globals.css#L277)) för att silvret inte ska försvinna
      mot vitt — avataren är en egen svart disc med vit robot och blir grumlig av samma filter. Den
      läser som avsedd i båda teman utan behandling.
- [x] Varje synlig sträng ligger kvar i `features/chat/copy.ts`. Namnet står inte inskrivet i JSX.
- [x] Knappen i stängt läge säger fortfarande vad den är till för — ett namn utan sammanhang
      ("Archer") räcker inte för någon som aldrig sett sidan förut.

### Att föra talan för spec-driven development

_Tillagt under `/implement`, på begäran: Archer ska inte bara beskriva metoden utan argumentera för
den. Skriv in före kod enligt §IV, inte efteråt._

- [x] Frågar besökaren vad dokumenten är till för, varför man inte bara promptar en agent, eller vad
      som faktiskt blir lättare — då **argumenterar** Archer för spec-driven development i stället för
      att beskriva den neutralt: vad det kostar att låta bli (en agent som hittar på krav, river upp
      beslut och bränner tokens på fel bygge) och vad som blir lättare (agenten vet vad den ska bygga,
      granskningen blir "stämmer det med det vi kom överens om", besluten överlever kontextfönstret).
- [x] Argumentet är **härlett ur `landing/copy.ts`** (`WHY_SDD`, `SECTIONS.specDriven`), inte skrivet
      en andra gång i promten. En övertygande mening ingen granskat är exakt det spec 141 byggde hela
      kunskapskedjan för att förhindra.
- [x] Regeln köper inga superlativ och ingen extra mening på ett svar som redan var färdigt. Att
      argumentera när någon frågar är inte samma sak som att sälja i varje svar — förbudet mot det
      andra står kvar ordagrant.

### Genomgående

- [x] Inget nytt når klientbundeln: `knowledge.ts` och `provider.ts` importeras fortfarande inte av
      någon klientkomponent, och testet som läser `ChatWidget.tsx` utökas till den nya
      monteringspunkten.
- [x] Ingen ny nyckel, ingen ny tabell, inget nytt anropsställe mot Claude. §I:s "exakt två callers"
      står kvar oförändrad.
- [x] [Spec 141](141-landing-chat.md) skrivs om i samma PR: kriteriet "på landningssidan och **bara**
      där", raden "Chatten på andra ytor än `/`" och "överlämning till människa" under _Out of scope_.
- [x] `CLAUDE.md` och `docs/architecture/UI_ARCHITECTURE.md` uppdateras i samma ändring (§IV).
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — [`app/(public)/layout.test.tsx`](<../apps/web/src/app/(public)/layout.test.tsx>) (4):
  layouten renderar sidan den omsluter *och* panelen; CTA:n följer sessionen (`/start` utloggad,
  `/app/projects/new` inloggad); och de två som bevakar strukturen — att `ChatWidget` förekommer i
  **exakt en** fil under `src/app`, och att den filen inte ligger under `app/app/`. De två sista är
  filsystemsläsningar med flit: de fortsätter gälla när någon lägger till en sida om ett halvår.
- **New tests** — [`features/chat/ChatWidget.test.tsx`](../apps/web/src/features/chat/ChatWidget.test.tsx)
  (+4): Archer presenterar sig med namn och avatar; hand-offen visas med `SUPPORT_PATH` och
  inloggningsmeningen när modellen ber om den; den visas **inte** efter ett svar som räckte; och den
  visas i FAQ-läget, där modellen inte finns för att be om den.
- **New tests** — [`features/chat/provider.test.ts`](../apps/web/src/features/chat/provider.test.ts)
  (+2): `support: true` går igenom, och ett saknat eller icke-boolskt fält blir `false` i stället för
  att slänga ett i övrigt giltigt svar.
- **New tests** — [`app/api/chat/route.test.ts`](../apps/web/src/app/api/chat/route.test.ts) (+1):
  routen bär flaggan vidare, aldrig en URL.
- **New tests** — [`features/chat/knowledge.test.ts`](../apps/web/src/features/chat/knowledge.test.ts)
  (+4): kunskapen namnger Archer (från `copy.ts`, inte en andra sträng); den säger både att supporten
  finns och att den kräver inloggning; hela `WHY_SDD` plus `specDriven.loopNote` finns med, så
  argumentet för spec-driven development är sidans eget; och `(public)/layout.tsx` importerar varken
  `knowledge.ts` eller `provider.ts` — samma bundel-test som redan fanns för `ChatWidget.tsx`, utökat
  till den andra dörren in till samma klientgräns.
- **Ändrade tester, båda för att de bevakade något som ändrats** — `ChatWidget.test.tsx`s
  markup-test letade efter `img` i hela dokumentet, vilket nu träffar Archers avatar; det är omskrivet
  till att gälla svaret och avatarens `src`, alltså samma egenskap men rätt avgränsad.
  `components/shell/footer-links.test.ts` letade route-grupper ett steg ner och läste `app/page.tsx`
  direkt; nu är grupperna nästlade (`(public)/(legal)`), så det rekurserar och letar upp `/`-sidan i
  stället för att anta var den ligger.
- **Kriteriet "tråden överlever navigering"** har ingen egen ny test, och det är avsiktligt: en layout
  är monterad *över* sidbytet, så React-trädet överlever navigeringen utan att röra `sessionStorage`
  alls. Det svårare fallet — att tråden överlever att komponenten rivs och byggs upp igen — täcks av
  det befintliga testet "keeps the thread across a reload", som avmonterar och renderar om. En
  duplikat av det hade inte bevisat något det inte redan bevisar.
- **Kriterierna om mobil och att panelen inte skymmer inloggningsfälten** är manuella: panelen är
  `fixed` i hörnet med samma klasser som spec 141 verifierade, och `pnpm build` bekräftar att varje
  publik route byggs (`/`, `/login`, `/signup`, `/start`, `/invite/[code]`, `/cookies`, `/privacy`,
  `/terms`) med oförändrade URL:er.
- **Result:** `pnpm -r typecheck` rent · `pnpm -r lint` rent · `pnpm -r test` **1013 passed, 0 failed**
  (web 721, engine 223, schemas 69) · `pnpm test:scripts` 88 passed · `pnpm build` grönt. Kört mot
  lokal Supabase, så varje `*.db.test.ts` i repot gick igång — inklusive spec 144:s, vars migration
  behövde `supabase migration up --include-all` lokalt först (den kom in med `develop`, inte med den
  här grenen). Kört om i sin helhet efter `/analyze`-rättningarna, med samma siffror.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

1. **`apps/web/src/app/(public)/`** (ny route-grupp) — `page.tsx`, `login/`, `signup/`, `start/`,
   `invite/` och `(legal)/` flyttade in, oförändrade. En route-grupp ändrar ingen URL; den ger de
   publika sidorna en gemensam layout som `app/app/**` ligger utanför.
2. **`apps/web/src/app/(public)/layout.tsx`** (ny) — enda monteringspunkten. Läser sessionen och
   renderar `<ChatWidget ctaHref={startCtaHref(...)} />` efter `{children}`. `dynamic =
   "force-dynamic"` av samma skäl som landningssidan bar raden: `getSession()` går över nätet och ska
   inte köras av Next byggtidsprob.
3. **`apps/web/src/features/landing/start-cta.ts`** (ny) — `startCtaHref(signedIn)`, den enda plats
   som väljer mellan `/app/projects/new` och `/start`. Bredvid `pro-cta.ts` och av samma skäl.
4. **`apps/web/src/app/(public)/page.tsx`** — `ChatWidget` borttagen härifrån; `primaryHref` kommer nu
   ur `startCtaHref`.
5. **`apps/web/src/features/chat/copy.ts`** — `ARCHER` som egen export, namnet som paneltitel,
   avatarens alt-text, `supportNote` och `supportAction`.
6. **`apps/web/src/features/chat/knowledge.ts`** — `IDENTITY` (namnet, hämtat ur `copy.ts`, och att
   Archer är mjukvara) som egen `WHO YOU ARE`-sektion, plus supportfaktan i `BEYOND_THE_PAGE`.
7. **`apps/web/src/features/chat/provider.ts`** — systempromten får `MAKING THE CASE` (argumentet för
   spec-driven development) och `WHEN TO HAND OVER` bredvid CTA-regeln, och `support` i
   utdataformatet. `ChatOutcome.answered` bär flaggan.
8. **`apps/web/src/features/chat/contract.ts`** och **`apps/web/src/app/api/chat/route.ts`** —
   `support` genom kontraktet och vidare till panelen. En flagga, aldrig en URL.
9. **`apps/web/src/features/chat/ChatWidget.tsx`** — `ArcherAvatar` (via `next/image`, utan
   `.brand-asset`), namnet vid botens repliker, och hand-off-raden i foten.
10. **`apps/web/src/features/support/route.ts`** (ny) — `SUPPORT_PATH`, så länken panelen lovar inte
    kan glida ifrån routen som serverar den.
11. **`apps/web/public/brand/archer-avatar.png`** — flyttad från repo-roten.
12. **`specs/141-landing-chat.md`**, **`CLAUDE.md`**, **`docs/architecture/UI_ARCHITECTURE.md`**,
    **`specs/README.md`** — samma ändring som koden (§IV).

**No change needed:** `lib/data/chat-limits.ts`, `supabase/migrations/*`, `middleware.ts` (matchern
täcker redan inte `/api/chat`, och `/app/:path*` gäller oförändrat), `features/generation/author.ts`,
`packages/engine`, `packages/schemas`.

---

## Implementation notes

**Monteringspunkten blev en route-grupp, inte en kontroll.** Planen sa "en delad punkt som täcker de
publika sidorna men inte `/app/**`" utan att säga hur. Den uppenbara vägen — montera i root-layouten
och dölja panelen med en `usePathname()`-koll — hade uppfyllt kriteriet på ett sätt som kriteriet
uttryckligen varnar för: `/app` hade fått chattens JS i sin bundle och uteslutningen hade varit en rad
någon kan råka ta bort. `app/(public)/` gör i stället uteslutningen till en egenskap hos filträdet.
Priset var att flytta sex routes; URL:erna är oförändrade och `pnpm build` listar exakt samma sidor
som före.

**Hand-offen är en flagga, inte en länk.** Kriteriet säger att svaret ska leda till supporten, och det
enklaste hade varit att låta modellen skriva URL:en. Då hade en av spec 141:s egenskaper fallit: svaret
renderas som text, och det som pekar besökaren någonstans är panelens eget. Modellen sätter därför
`support: true` och panelen ritar sin egen rad med `SUPPORT_PATH` — där inloggningssteget dessutom
alltid står, oavsett hur modellen formulerade sig. Det krävde ett fält i `ChatOutcome` och `ChatReply`,
vilket är varför "not touched: provider.ts, /api/chat" i _Design decision_ är rättat i stället för
uppfyllt.

**Regeln om *när* supporten erbjuds hamnade i systempromten, inte i `knowledge.ts`.** Specen sa
"bredvid CTA-regeln" — och CTA-regeln bor i `SYSTEM_PROMPT` i `provider.ts`, inte i kunskapen. Faktan
(att supporten finns och kräver inloggning) ligger i `knowledge.ts` som kriteriet kräver; beteendet
ligger där dess syskonregel ligger. Kriteriets "inte som en hårdkodad sträng i providern" gäller
kunskapen, och den är det inte.

**Argumentet för spec-driven development tillkom mitt i implementationen**, på begäran, och skrevs in
som kriterier före koden (§IV). Det lutar helt mot `WHY_SDD` och `SECTIONS.specDriven` i
`landing/copy.ts` — samma kedja som resten av kunskapen — så en mer säljande bot inte blir en bot som
påstår saker ingen granskat. Förbudet mot superlativ och mot en knuff efter varje svar står kvar
ordagrant; det som ändrats är att Archer nu *får* argumentera när någon faktiskt frågar.

**Två befintliga tester fick ändras, båda för att de bevakade något som ändrats.** Markup-testet i
`ChatWidget.test.tsx` hävdade att inget `img` fanns i dokumentet — sant tills panelen fick ett ansikte
— och är omskrivet till att gälla svaret och avatarens `src`, vilket är den egenskap testet faktiskt
skyddar. `footer-links.test.ts` letade route-grupper ett steg under `src/app` och läste `app/page.tsx`
på en fast sökväg; med `(public)/(legal)` nästlat rekurserar det nu och letar upp `/`-sidan i stället
för att anta var den ligger.

**Hand-off-raden överlever inte en omladdning.** `supportOffered` är komponentens tillstånd; tråden
i `sessionStorage` bär bara `role` och `text`. Efter en omladdning står Archers svar kvar med sin
mening om att logga in, men knappen är borta tills frågan ställs igen eller panelen går i FAQ-läge —
där den alltid visas. Att lagra mer om besökaren för att rädda en knapp vore fel avvägning i en spec
vars grannar handlar om att lagra så lite som möjligt.

**`/analyze` underkände två kriterier, och båda var specens fel, inte kodens.**

1. *"Supportmålet läggs till den tillåtna listan"* beskrev en mekanism som aldrig funnits. Spec 141
   höll länkregeln strukturellt — svaret blir aldrig markup — och den här ändringen håller den på
   samma sätt. Kriteriet är omskrivet till det som faktiskt gäller, med rader att kontrollera. Att
   bygga listan för att uppfylla den ursprungliga formuleringen hade ersatt en garanti med en lista
   någon kan glömma att fylla i.
2. *"Skymmer varken innehåll eller fälten"* var en högre ribba än featuren håller någonstans — panelen
   är en overlay med flit — och ingen hade öppnat en webbläsare för att kontrollera den. Repot har
   ingen Playwright, så det fanns heller ingen automatisk väg dit. Kriteriet säger nu det som går att
   belägga, med måtten, och resten står som en edge case i stället för som en bock.

**`SUPPORT_PATH` fick sin andra användning under `/analyze`.** §I säger att en abstraktion förtjänas av
≥2 konkreta användningar, och konstanten hade en. `features/support/actions.ts` omdirigerade till
`/app/support` som strängliteraler tre gånger; de går nu genom konstanten. Samma route på ett ställe,
och regeln uppfylld i stället för bortförklarad.

---

## Data model

**No schema changes.** Chatten skriver fortfarande bara till `chat_rate_limits`, via samma funktion
och med samma tak. Supportärenden går genom spec 144:s befintliga tabeller och kräver konto — den här
specen skickar ingen ärendedata alls, den länkar bara dit.

---

## Security

Ytan växer från en sida till alla publika sidor, men inte i vad som går att göra: samma
oautentiserade `/api/chat`, samma två tak, samma nyckel. Att panelen nu står på `/login` och
`/signup` betyder att den aldrig får läsa eller röra fälten där — den är en överliggande panel utan
kontakt med formuläret. Besökarens ord är fortfarande otrodd text som renderas sanerat, och den nya
länkdestinationen (`/app/support`) är panelens egen konstant — modellen sätter en boolesk flagga och
skriver aldrig en URL, så den kan inte peka någon någon annanstans.
Supporten förblir bakom `requireSession()` och ingen adress exponeras för anonyma besökare — den enda
nya informationen chatten avslöjar är att en supportsida finns och att den kräver konto.

---

## Edge cases

- **Besökaren öppnar panelen på `/login`, loggar in och landar på `/app`** → panelen finns inte där,
  och tråden ligger kvar i `sessionStorage` utan att visas. Den får inte läcka in i dashboarden.
- **Besökaren frågar efter en människa när dagstaket är nått** → FAQ-läget måste kunna säga det ändå;
  supportvägen får inte hänga på att modellen svarade.
- **Besökaren navigerar med öppen panel** → panelen får inte tappa tråden eller blinka igen som
  stängd mitt i ett samtal.
- **Bilden laddar inte** → panelen fungerar och namnet står kvar; ett trasigt ansikte får inte bli en
  trasig chatt.
- **Besökaren frågar om något supporten äger men boten kan svara på** (t.ex. "vad kostar Pro?") →
  boten svarar, och skickar inte iväg någon i onödan.
- **En telefon för kort för auth-kortet** → sidan scrollar, och längst ner ligger den stängda knappen
  (~56 px i hörnet) över kortets nederkant. Accepterat: panelen är en overlay med flit, knappen går att
  scrolla förbi och kortets primära knapp ligger ovanför den i alla vanliga höjder. Om det visar sig i
  verklig trafik är det en positionsändring i `ChatWidget.tsx`, inte i sidorna.

---

## Out of scope

- Assistent inne i `/app` för inloggade grundare. Boten kan ingenting om ett konkret projekt, en plan
  eller en generering, och taket är IP-baserat och anonymt — en inloggad yta är en egen produkt och en
  egen issue.
- Att skicka ett supportärende **från** chatten. Archer länkar till formuläret; den fyller inte i det.
- Överlämning till en människa i realtid, e-postinsamling eller leadfångst.
- Ändrad kunskapsbas i övrigt, ny modell, streaming eller flerspråkighet.
