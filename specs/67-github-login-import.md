# Spec 67 — Logga in med GitHub, och importera ett publikt repo utan ZIP

> **In one sentence:** En founder ska kunna logga in med sitt GitHub-konto, se sina publika repon och
> importera ett av dem direkt — i stället för att skapa ett konto till och packa en ZIP.

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Status**     | ✅ Done                                                                                 |
| **Issue**      | #67 — "GitHub App-integration: installation, tokens, repo-läsning och PR" (titeln matchar inte längre innehållet — se _Implementation notes_) |
| **Branch**     | `67-github-login-import` (from `feature/import-existing-projects`)                       |
| **Feature**    | Import existing projects                                                                 |
| **Depends on** | [63-import-existing-projects.md](63-import-existing-projects.md) — importflödet, analysen och diffen som repo-vägen matar in i · [18-supabase-auth.md](18-supabase-auth.md) — inloggningen som får en provider till |

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

As a **grundare vars kod redan ligger publikt på GitHub** I want **att logga in med mitt GitHub-konto
och välja ett av mina repon i en lista** so that **Airrow kan läsa projektet direkt — jag slipper både
skapa ett konto till och ladda upp en ZIP av något som redan finns online.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Idag:** import sker uteslutande via uppladdad ZIP (#63). Inloggning sker uteslutande med e-post
  och lösenord (#18) — `ProviderButtons.tsx` visar Google, GitHub, e-post och magic link, alla
  `disabled` med etiketten "Soon" (spec 19).
- **Problemet:** en founder vars projekt redan ligger på GitHub får göra två onödiga saker — skapa ett
  konto till, och packa ihop en kopia av något som redan är publikt.
- **Redan på plats:** hela importkedjan efter filerna. `analyzeImport`, `checkImportLimits`,
  `digestImported` och `diffAgainstExisting` tar en lista `ImportedFile` och bryr sig inte om varifrån
  den kom ([`import.ts`](../packages/engine/src/import.ts)); `readArchive` är det enda som är
  ZIP-specifikt ([`archive.ts`](../apps/web/src/features/import/archive.ts)). Repo-vägen behöver
  alltså bara producera samma lista.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

**Inloggning med GitHub** kopplas som en Supabase Auth-provider, och begär **inga repo-scopes**.
Knappen finns redan, inaktiv, i
[`ProviderButtons.tsx`](../apps/web/src/features/auth/ProviderButtons.tsx).

**Listan och läsningen sker med samma OAuth-token, och når bara publika repon.** Utan scopes
returnerar GitHub bara det som är publikt — samma sak vem som helst ser på github.com. Det är också
gränsen produkten sätter utåt: en disclaimer i flödet säger rakt ut att bara publika repon syns, och
att ett privat projekt går in via ZIP.

**Repo-vägen matar in i samma import som ZIP-vägen.** Den hämtar filerna, bygger listan
`ImportedFile` och lämnar över till `checkImportLimits` → `analyzeImport` → `digestImported`. Allt
efter det — gränserna, den förifyllda intervjun, diffen, konfliktbesluten, `.airrow`-filerna,
leveransen — är oförändrat. Ingen andra importväg, bara en andra källa.

### Konstitutionell amendering (§II — repo-åtkomst)

Den här specen ändrar en invariant, så ändringen registreras här som konstitutionen kräver.

**Tidigare löd §II:** *"**Repo access via GitHub App installations only** (minimal permissions,
short-lived tokens) — never user PATs."*

**Den blir:** *"**Repo access is least-privilege, and never a user PAT.** Reading **public** content
may use the signed-in user's OAuth identity with **no scopes** — that reaches nothing an anonymous
visitor could not already fetch. Everything beyond it — private content, and every write — goes
through a **GitHub App installation** with minimal permissions and short-lived tokens. User PATs are
never accepted, and no repo credential is ever persisted."*

**Varför gränsen flyttas men inte försvinner:** den gamla ordalydelsen beskrev ett *hur* — App
installations — och läste därför in ett krav på en App även där det inte skyddar någonting. Det den
faktiskt värnar är tre saker: aldrig breda användarreferenser, minsta möjliga behörighet, och att
privat innehåll och skrivningar kräver ett uttryckligt, återkallbart samtycke. Alla tre står kvar,
och den sista är nu utskriven i stället för underförstådd.

Vad som inte ändras: ett token med scopes är fortfarande otillåtet, en PAT är fortfarande otillåten,
och ingenting persisteras. Ett scope-löst OAuth-token når exakt det github.com visar utan inloggning
— att kräva en App-installation för att läsa det hade varit ceremoni utan skydd, och hade gjort
founderns första steg till ett samtycke de inte fått något skäl till.

`CLAUDE.md` bär samma nya formulering, i samma ändring (§IV).

**Not touched:** ZIP-vägen, som fortsätter vara den kompletta vägen in och den enda för privata
projekt. Genereringsmotorn och intervjun. `repo_connections`, som förblir den tomma
ställningstabellen den varit sedan #14 — den fylls när en App faktiskt byggs.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] En användare kan skapa konto och logga in med GitHub — knappen i `ProviderButtons.tsx` är inte
      längre inaktiv — och landar i samma app-läge som en e-postinloggning ger, med sin personliga
      organisation på plats. _(Verifierat manuellt 2026-07-29.)_
- [x] Inloggningen begär **inga repo-scopes**, och det syns i samtyckesskärmen GitHub visar.
      _(`scopes: ""`, låst av test.)_
- [x] Loggar någon in med GitHub på en e-postadress som redan finns som e-postkonto **länkas
      identiteterna till samma konto och samma organisation** — samma projekt möter dem oavsett väg in.
      _(`auth.link.db.test.ts`, kört grönt mot lokal Supabase 2026-07-29.)_
- [x] Är GitHub-adressen **inte verifierad** stoppas inloggningen med en förklaring om att den måste
      verifieras hos GitHub först. Inget konto skapas, ingenting länkas.
- [x] En inloggad GitHub-användare ser sina **publika** repon i importflödet, sökbara eller
      paginerade, utan att ha installerat någonting. _(Verifierat manuellt 2026-07-29; listning,
      paginering och privat-filtret är dessutom låsta av tester mot mocken.)_
- [x] Flödet säger rakt ut att bara publika repon syns, och pekar på ZIP-vägen för privata projekt.
      Ingen founder ska behöva gissa varför ett repo saknas i listan.
- [x] En founder kan välja ett repo i listan och importera det: filerna hämtas server-side och matas
      genom **samma** `checkImportLimits` → `analyzeImport` → `digestImported` som ZIP-vägen, med
      samma gränser, samma förifyllda intervju och samma diff.
- [x] Ingenting av repots innehåll persisteras — bara path, storlek och digest, precis som #63 (§II).
- [x] Alla GitHub-anrop sker server-side via DataStore eller server actions — aldrig från
      klientkomponenter, aldrig från `packages/engine` eller `packages/schemas` (§I).
- [x] Fel från GitHub — utgången session, borttaget repo, rate limit — ger ett tydligt läge i UI:t i
      stället för en krasch, och ZIP-vägen fungerar alltid.
- [x] ZIP-import fungerar oförändrat, inklusive för den som loggat in med e-post.
- [x] **Settings visar om GitHub-kontot är anslutet, och vilket** — och erbjuder inloggningen på
      plats när det inte är det. Kontot (inloggningen) och GitHub-appen (leveransen) är två skilda
      kort, för de är två skilda anslutningar. _(Tillagt efter den manuella körningen — se
      Implementation notes.)_
- [x] Flödet dokumenteras i `docs/architecture/SYSTEM_OVERVIEW.md` i samma ändring som koden (§IV).
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — GitHub-klienten är ett **interface med en deterministisk mock**, samma mönster som
  authoring provider (§V). Det är inte ett val: §V förbjuder nätverksberoende tester. Mocken täcker
  listningen, filhämtningen, det tomma repot och felsvaren.
- **Kriteriet "samma import som ZIP-vägen"** → ett test som kör samma filuppsättning genom båda
  källorna och jämför den resulterande `ImportAnalysis`. Det är garantin mot att en andra
  importsanning uppstår.
- **Identitetslänkningen** → integrationstest mot lokal Supabase: samma verifierade e-post via båda
  vägarna ger ett konto och en organisation.
- **De riktiga anropen och OAuth-flödet** → manuell körning mot en skarp GitHub OAuth-app, redovisad
  här innan `/analyze` stänger specen. Samma resonemang som spec 66: det som bara tredjepartsbeteende
  kan visa måste köras för hand.
- Full suite result + typecheck/lint status.

#### Utfall (`/implement`, 2026-07-29)

**Nya tester — 30 stycken, alla gröna.**

| Fil | Vad det låser |
| --- | --- |
| `apps/web/src/lib/github.test.ts` (10) | Mappningen av ett repo, att ett privat repo aldrig listas oavsett vad frågan bad om, pagineringssignalen, och att 401 / 403+rate-limit / 404 / trasig JSON / kastat anrop blir fem skilda lägen. Fejkad `fetch`, inget nät. |
| `apps/web/src/features/import/repo.test.ts` (6) | **Paritetstestet**: samma projekt som zipball och som uppladdad ZIP ger identisk fillista *och* identisk `ImportAnalysis`. Plus wrapper-mappen, `node_modules`, det tomma repot och att ett för stort repo får höra ordet "repository". |
| `apps/web/src/features/import/RepoPicker.test.tsx` (6) | Att disclaimern om publika repon står i varje läge, och att tomt läge, felläge och disconnected-läge alla pekar vidare i stället för att bli en återvändsgränd. |
| `apps/web/src/app/auth/callback/route.test.ts` (5) | Verifierad adress släpps in; **overifierad stoppas, loggas ut och kontot rivs**; ett konto som redan fanns rivs aldrig; avbrutet samtycke är inget fel. |
| `apps/web/src/lib/auth.test.ts` (+5) | `scopes: ""`, och att ett uttryckligt `email_verified: false` aldrig övertalas av något annat. |
| `apps/web/src/app/app/settings/page.test.tsx` (3) | Att Settings namnger det anslutna kontot, erbjuder inloggningen när inget är anslutet, och håller appens `Connect` skild från kontots märke. |
| `apps/web/src/lib/data/auth.link.db.test.ts` (1) | Att en tillagd GitHub-identitet inte ger ett andra konto, en andra organisation eller ett andra medlemskap — `on_auth_user_created` triggar bara på `auth.users`, och länkning rör inte den tabellen. Kört mot lokal Supabase. |

**Ändrade tester:** `ProviderButtons.test.tsx` (GitHub är nu en riktig knapp, övriga tre kvar som
`disabled`), `app/projects/import/page.test.tsx` (sidan är async och mockar repo-plockaren).

**Kommandon:**
- `pnpm -r typecheck` → clean (3/3 paket).
- `pnpm -r lint` → clean, inga nya issues.
- `pnpm -r test` → **227 passed, 28 skipped** i `apps/web` (samtliga överhoppade är `.db`-tester som
  kräver lokal Supabase — oförändrat mot före ändringen), 35 passed i `schemas`, 7 filer i `engine`.
  Inga misslyckanden, inga kända sedan tidigare.
- `pnpm test:scripts` → 13 passed.
- `pnpm --filter web build` → grönt; `/auth/callback` byggs som route.

**Slutlig körning 2026-07-29, med lokal Supabase igång:**

- `pnpm -r typecheck` → clean · `pnpm -r lint` → clean, inga nya issues.
- `pnpm -r test` → `apps/web` **264 passed, 43 filer, 0 skipped**; `engine` 204; `schemas` 35.
  Ingenting hoppas över längre: de sju `.db`-filerna — inklusive RLS-testerna med sina
  nekandefall — kördes och är gröna.
- `pnpm test:scripts` → 13 passed. `pnpm --filter web build` → grönt.
- Manuell körning mot skarp GitHub OAuth-app: inloggning och listning av publika repon verifierade.

Inget kriterium står kvar utan bevis.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

**Bärande beslut:** repo-vägen hämtar repots **zipball** och kör den genom `readArchive` — samma
funktion som ZIP-vägen. Det är inte en genväg, det är hela poängen: "samma import som ZIP-vägen" blir
sant för att det *är* samma kod, inte för att två vägar råkar hålla sig i takt.

### Schema
- `packages/schemas/src/index.ts:99` — `importCreateSchema.source` går från `z.literal("zip")` till
  `z.enum(["zip", "repo"])`; kommentaren ovanför uppdateras. `ImportSourceKind`
  ([`types.ts:228`](../packages/schemas/src/types.ts)) och databasen tillåter redan `repo`.
- `packages/schemas/src/index.ts` — ny `repoSelectionSchema` (`owner`, `repo`) med GitHubs
  namnregler, så en vald rad valideras som varje annan gräns.

### GitHub-läsaren
- **Ny** `apps/web/src/lib/github.ts` — `GitHubReader` som **interface**, plus `githubReader()` som
  bygger den över `fetch`. `listPublicRepos(token, page)` och `downloadZipball(token, owner, repo)`.
  Fel returneras som `GitHubFailure` (`unauthorized` · `not_found` · `rate_limited` · `too_large` ·
  `unavailable`), aldrig kastade — samma `Result`-mönster som motorn (§I). Server-only.
- `apps/web/src/lib/auth.ts` — `signInWithGitHub(redirectTo)` (`scopes: ""`, dvs. inga repo-scopes)
  och `githubToken()` som läser `provider_token` ur sessionen server-side.

### Inloggningen
- **Ny** `apps/web/src/app/auth/callback/route.ts` — byter `code` mot en session, och **grinden för
  overifierad adress**: är GitHub-identitetens `email_verified` inte sann loggas användaren ut, det
  nyss skapade kontot rivs, och founder landar på `/login?error=github_unverified`.
- **Ny** `apps/web/src/features/auth/actions.ts` — server action som startar OAuth-flödet.
- `apps/web/src/features/auth/ProviderButtons.tsx:9-14` — GitHub blir en riktig knapp i en `<form>`;
  Google, e-post och magic link står kvar som `disabled` (out of scope).
- `apps/web/src/app/login/page.tsx:29` — felmeddelandena för overifierad adress och avbrutet flöde.
  Bara `/login`: callbacken skickar alltid dit, så `signup/page.tsx` behöver ingen text.
- `apps/web/src/lib/data/store.ts` — `purgeUnverifiedSignup(userId)`, den enda vägen att riva ett
  konto som aldrig borde ha skapats. Snävt grindad (se _Edge cases_).

### Repo-importen
- `apps/web/src/features/import/archive.ts:18,35,54` — meddelandena tar ett `noun`, så repo-vägen
  säger "repository" där ZIP-vägen säger "archive". Läsningen i övrigt oförändrad.
- **Ny** `apps/web/src/features/import/repo.ts` — `readRepository(reader, token, owner, repo)` →
  samma `ArchiveRead` som `readArchive` ger.
- **Ny** `apps/web/src/features/import/queries.ts` — `listRepos(page)`; hämtar token + läsare och
  returnerar ett läge UI:t kan rendera rakt av: `disconnected` · `ready` · `error`. Tomt är `ready`
  utan repon, inte ett eget läge — plockaren avgör det, för det är samma svar med annan text.
- `apps/web/src/features/import/actions.ts:40-84` — svansen efter `ArchiveRead` bryts ut till
  `completeImport()`, och `importRepoAction` läggs till bredvid `importProjectAction`. Ingen rad av
  analys, prefill, digest eller persistering dupliceras.

### UI
- **Ny** `apps/web/src/features/import/RepoPicker.tsx` (server) — listan, paginering, disclaimern om
  publika repon, tomt läge och felläge.
- **Ny** `apps/web/src/features/import/RepoImportForm.tsx` (client) — namn och beskrivning förifyllda
  från repot.
- `apps/web/src/app/app/projects/import/page.tsx:48-52` — `ComingSoon` ersätts av `RepoPicker`;
  valet av repo sker i klientkomponenten, inte via URL:en, eftersom raden redan bär namn och
  beskrivning och ett andra GitHub-anrop vore onödigt.
- `apps/web/src/app/app/settings/page.tsx` — **GitHub account** (anslutet konto, eller inloggningen
  på plats) som eget kort, skilt från **GitHub App — repository delivery**. `githubIdentity()` i
  `lib/auth.ts` ger kontot. Tillkom efter den manuella körningen; se _Implementation notes_.

### Dokumentation & konfiguration
- `docs/architecture/SYSTEM_OVERVIEW.md:53-84` — repo som andra källa in i samma kedja, och stycket
  som säger att repo-import väntar på GitHub App-integrationen.
- `supabase/config.toml` — `[auth.external.github]` aktiveras.
- `.claude/spec-kit/constitution.md:84-89` och `CLAUDE.md` — amenderingen av §II (redan gjord i den
  här branchen).

### Constitution check

| Invariant | Utfall |
| --- | --- |
| §I one-way data flow | Håller — `page.tsx` → `queries.ts`/`actions.ts` → `lib/github.ts`. Inga GitHub-anrop i klientkomponenter. |
| §I motorn är ren | Håller — `packages/engine` rörs inte; zipball-läsningen ligger i `apps/web`. |
| §I inga `any` | Håller — GitHubs JSON valideras med Zod innan den blir en `GitHubRepo`. |
| §II tenancy | Håller — `requireSession()` ger org:en; repo-valet är klientdata och avgör ingen behörighet. |
| §II inget innehåll persisteras | Håller — samma `digestImported` som ZIP-vägen; zipballen dör med requesten. |
| §II aldrig PAT, inga scopes | Håller — `scopes: ""`. **Att notera:** Supabase lägger `provider_token` i sessionscookien, som inte är `httpOnly`. Ingen persistering i Airrows databas, men det är inte heller ett hemligt tokenkassaskåp — se _Security_. |
| §III explicita lägen | Håller — tomt/fel/laddning som riktiga komponenter. |
| §V deterministiska tester | Håller — `GitHubReader` är ett interface, testerna använder en mock. Inga nätverksanrop. |

---

## Data model

**No schema changes.** Inloggningen hanteras av Supabase Auth, och den importerade filuppsättningen
går genom `import_sources` / `import_files` / `import_conflicts` som redan finns (#63).

`import_sources.kind` accepterar redan `'repo'` vid sidan av `'zip'`
([`types.ts`](../packages/schemas/src/types.ts), `ImportSourceKind`), men `importCreateSchema` tillåter
bara `"zip"` — så schemat, inte databasen, är det som öppnas här.

`repo_connections` rörs inte. Den förblir tom tills en App byggs.

---

## Security

Airrow får **ingen** skrivrättighet någonstans, och läser bara innehåll som redan är publikt. Tokenet
från inloggningen begär inga scopes, lever server-side och når aldrig en klientbundle. Allt hämtat
material behandlas som otrodd text och persisteras aldrig — bara path, storlek och digest, som i #63.

Detta är inom den amenderade §II (se _Design decision_): läsning av publikt innehåll med en scope-lös
identitet. Privat innehåll och varje skrivning kräver fortfarande en App-installation, och ingen
sådan byggs här.

**Rättelse efter implementationen:** "når aldrig en klientbundle" stämmer om Airrows egen kod — inget
`provider_token` passerar en klientkomponent — men inte om webbläsaren. Supabase lägger tokenet i
sessionscookien, som inte är `httpOnly` eftersom browser-klienten läser den. Se _Implementation
notes → Var GitHub-tokenet faktiskt bor_.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- Foundern har inga publika repon → tom lista med ett tydligt läge, och ZIP-vägen erbjuden i samma
  andetag.
- Ett konto med hundratals publika repon → listan är sökbar eller paginerad; en oändlig lista är inte
  ett val.
- Repot är tomt (inga commits) → tom fillista, vilket importanalysen redan hanterar: den härleder
  ingenting och intervjun frågar allt.
- Repot är större än importgränserna (50 MB / 5 000 filer) → avvisas av `checkImportLimits` före
  analysen, precis som en för stor ZIP.
- Repot görs privat eller tas bort mellan listningen och importen → tydligt fel, inget halvskapat
  projekt.
- GitHubs rate limit slår till → tydligt läge som säger att det går att försöka igen, inte en krasch.
- Någon loggar in med GitHub utan verifierad e-postadress hos GitHub → inloggningen går inte igenom,
  och foundern möts av en tydlig förklaring: verifiera adressen hos GitHub och kom tillbaka. Inget
  konto skapas och ingenting länkas. En overifierad adress är inget bevis på vem någon är, och att
  länka på den vore att låta vem som helst ta över ett konto genom att registrera adressen på GitHub.

---

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- **GitHub App: installation, tokens, privata repon och PR-leverans.** Skjutet på framtiden — det
  behövs inte nu. Allt det står kvar i issuens ursprungliga text och bör bli en egen issue när det
  blir aktuellt; `repo_connections` väntar där tills dess. Den amenderade §II kräver fortfarande en
  App för allt det, så gränsen finns kvar den dagen någon bygger den.
- **Privata repon.** De kräver antingen App-installation eller `repo`-scope på användarens token —
  alltså läsrätt till allt de kommer åt. Ingetdera görs här; privata projekt går in via ZIP.
- Google, magic link och e-postlänkarna i `ProviderButtons.tsx` — de förblir inaktiva. Bara
  GitHub-knappen kopplas.
- Andra värdar än GitHub (GitLab, Bitbucket).

---

## Implementation notes

### Manuell körning (2026-07-29) — genomförd

Mot en skarp GitHub OAuth-app och Supabase-molnprojektet: inloggning med GitHub fungerar, och de
publika repona listas i importflödet. Två saker kom ut av körningen.

**1. `supabase/config.toml` styr ingenting i molnet.** Providern måste slås på i Supabase-dashboarden
(Authentication → Providers), och GitHub-appens callback är *Supabases* URL
(`https://<ref>.supabase.co/auth/v1/callback`), inte vår `/auth/callback` — vår är det andra hoppet
och måste ligga i redirect-listan. Config-filen gäller bara lokal utveckling. Innan det var gjort
svarade Supabase `validation_failed: Unsupported provider: provider is not enabled`, som **rå JSON**:
`signInWithOAuth` lämnar tillbaka en URL utan att validera den, så webbläsaren har lämnat appen innan
vår felhantering finns i bilden. De tre founder-nära felen specen räknar upp (utgången session,
borttaget repo, rate limit) hanteras korrekt — det här är ett driftfel, inte ett av dem.

**2. Settings sa fel sak om anslutningen.** Kortet läste `GITHUB_APP_ID` ur miljön, alltså om en
GitHub *App* fanns — och visade "Not connected" för någon som just loggat in med GitHub. Det var
sant om appen och falskt om foundern, i den enda ruta de går till för att få svar. Före den här
specen kunde ingen ansluta GitHub, så texten var alltid sann; det är den inte längre, och därför
rättas det här och inte i en egen issue.

Nu två kort ([`settings/page.tsx`](../apps/web/src/app/app/settings/page.tsx)):
**GitHub account** — ansluten (`@login` från `identity_data.user_name`, via `githubIdentity()`) eller
inte, med inloggningen som knapp på plats; och **GitHub App — repository delivery**, fortfarande
osatt, med sin `Connect` inaktiv. Att hålla dem isär är själva poängen: det ena läser publikt utan
scopes, det andra skriver och kräver en installation. Ett märke som stod för båda kunde bara ljuga om
det ena. Texten säger också rakt ut vad som händer om GitHub-adressen är en annan än kontots — då
loggas man in på det kontot, inte det här.

### Var GitHub-tokenet faktiskt bor

Tokenet kommer från Supabase som `session.provider_token` och läses server-side i `githubToken()`
([`lib/auth.ts`](../apps/web/src/lib/auth.ts)). Airrow skriver det ingenstans — §II:s "no repo
credential is ever persisted" håller.

Men det ligger i sessionscookien, och `@supabase/ssr` sätter den utan `httpOnly` för att
browser-klienten ska kunna läsa sessionen. Alltså: tokenet är åtkomligt för JavaScript i foundernos
egen webbläsare. Det är deras eget scope-lösa token, som når exakt det de själva ser utloggade på
github.com — men specens ursprungliga formulering lovade mer än vad som byggdes, och det är värt att
veta innan någon en dag begär ett scope.

Tokenet överlever inte en token-refresh. Det är därför "utgången session" är ett normalt läge i UI:t
och inte ett fel: foundern loggar in med GitHub igen, och ZIP-vägen har aldrig varit beroende av det.

### Två saker som krävs innan det fungerar skarpt

1. En GitHub OAuth-app, med callback `https://<host>/auth/callback`, och dess id/secret som
   `SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID` / `SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET`. Providern är
   påslagen i `supabase/config.toml` och måste också slås på i molnprojektet.
2. Ingen migration. Databasen tog redan `kind = 'repo'`.

### Den sammanslagna nedladdningen har ingen arkivkopia för ett repo-importerat projekt

`MergedDownload` bygger nedladdningen i webbläsaren ovanpå founderns egen ZIP, cachead i IndexedDB
vid importen (spec 68). En repo-import laddar aldrig upp någon ZIP, så den cachen är tom och knappen
går till sin andra väg: den ber foundern välja arkivet. För ett repo betyder det att hämta ZIP:en
från GitHub först — den fungerar, men texten säger "the archive you imported", vilket är ett arkiv
som aldrig funnits.

Rörde det inte: specen säger uttryckligen att leveransen är oförändrad, och att bygga om
nedladdningskedjan är en egen ändring. Formuläret säger däremot rakt ut att filerna läses en gång och
aldrig sparas, så ingen blir överrumplad. **Kvarstår:** antingen en egen issue för repo-medveten
text i `MergedDownload`, eller — bättre — att hämta zipballen igen server-side vid leverans.

### Issuens titel och text matchar inte längre specen

#67 heter "GitHub App-integration: installation, tokens, repo-läsning och PR" och dess
acceptanskriterier handlar nästan uteslutande om App-integrationen. Efter `/clarify` innehåller den
här specen ingen App alls: den levererar inloggning med GitHub och import av publika repon, och
skjuter App-arbetet på framtiden.

Specen är sanningen om vad som byggs (§IV, "the spec is the source of truth"), men issuen bör
uppdateras så att de två inte säger olika saker — och App-arbetet brytas ut till en egen issue så det
inte tappas bort. **Kvarstår för er:** redigera #67:s titel och beskrivning, eller stäng den och öppna
två.

### Nummerkrock att städa: `67-azure-devops-parity.md`

`specs/67-azure-devops-parity.md` bär nummer 67 utan att äga issue #67 — den är `#TBD` och skrevs
vid sidan av spec 66. Konstitutionen binder spec-numret till issuenumret (`specs/NNN-kort.md`, en fil
per issue), så den filen behöver en egen issue och en omnumrering. Den ligger redan i `develop`, och
att döpa om den här hade dragit in en orelaterad ändring i den här branchens PR — därför flaggad i
stället för åtgärdad.
