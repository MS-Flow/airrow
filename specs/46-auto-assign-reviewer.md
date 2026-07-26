# Spec 46 — Automatisk reviewer på PR:er mot `develop` och `main`

> **In one sentence:** En PR mot `develop` eller `main` ska få en reviewer tilldelad automatiskt när
> den öppnas, så att den obligatoriska granskningen faktiskt landar hos någon i stället för att bli
> liggande.

|                |                                                                                        |
| -------------- | -------------------------------------------------------------------------------------- |
| **Status**     | ✅ Done                                                                                 |
| **Issue**      | #46 — "Auto assign reviewer on merge into dev and main"                                  |
| **Branch**     | `46-auto-assign-reviewer` (from `feature/ci-cd`)                                         |
| **Feature**    | CI/CD                                                                                    |
| **Depends on** | [`29-branch-policy.md`](29-branch-policy.md) (workflow som redan kör på `pull_request`), [`14-pr-ci-checks.md`](14-pr-ci-checks.md) (skyddet på `develop`/`main`) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
[NEEDS CLARIFICATION: …] markers are resolved by /clarify.
-->

---

## User story

_Who wants this, and what they get out of it._

As a **utvecklare som öppnar en PR mot `develop` eller `main`** I want **att en reviewer tilldelas
automatiskt** so that **granskningen hamnar hos en människa direkt — utan att jag måste komma ihåg
att lägga till någon, och utan att PR:en blir stående och väntar på ingen.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Idag:** `scripts/setup-branch-protection.sh:102` sätter
  `"required_approving_review_count": 1` på `refs/heads/main` och `refs/heads/develop`. Kravet på en
  godkänd review finns alltså redan (issue #8) — men ingenting pekar ut *vem* som ska granska.
- **Problemet:** reviewern läggs till manuellt, vilket glöms bort. PR:en är då blockerad av ett
  review-krav som ingen fått en notis om, och upptäcks först när någon råkar titta.
- **Redan på plats:** `.github/workflows/branch-policy.yml` kör redan på `pull_request` med
  `pull-requests: write` och gör en `opened`-specifik åtgärd (sätter base). Samma trigger och
  behörighet räcker för att begära en reviewer — det finns alltså ingen ny infrastruktur att bygga.
- **Titeln säger "on merge", men det är fel tillfälle:** en review måste vara klar *innan* merge.
  Specen tolkar därför issuen som "när PR:en öppnas mot `develop`/`main`".

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

Ett nytt steg i det befintliga `validate-source-branch`-jobbet i
`.github/workflows/branch-policy.yml` begär review via `gh pr edit --add-reviewer` när base är
`develop` eller `main`. Workflowen kör redan på `pull_request` med `pull-requests: write` — ingen ny
fil, ingen ny behörighet, och till skillnad från `CODEOWNERS` kan ett steg utesluta PR-författaren.

**Urval:** en lista över teamet står i workflow-filen; alla i listan utom PR-författaren begärs som
reviewers. Med dagens tvåmannateam (`sebastianbreuker`, `MelvinEdlund`) blir det alltid "den andra",
helt deterministiskt — ingen round-robin och inget slumpmoment att hålla state för eller testa.

**Tillfällen:** `opened` (som base-sättningen), `edited` (en PR som byter base till `develop`/`main`
i efterhand ska också få en reviewer) och `ready_for_review` (draft-PR:er pingar ingen förrän de är
klara). `types:`-listan i workflowen utökas med `ready_for_review`.

**Bot-PR:er hoppas över** — Dependabot/Renovate ska inte generera reviewer-notiser.

**Not touched:** själva review-*kravet* (branch protection) — det ägs av
`scripts/setup-branch-protection.sh` och issue #8, och ändras inte här. PR:er mot `feature/*` rörs
inte alls; de har inget review-krav enligt grenhierarkin. Reviewern sätts **inte** som assignee —
assignee på en PR betyder "den som äger arbetet", alltså författaren.

**Viktigt:** `validate-source-branch` är en required status check på `main`/`develop`
(`scripts/setup-branch-protection.sh`). Reviewer-steget får därför aldrig faila jobbet — det ska
varna och fortsätta, annars blir PR:en omergbar av en tilldelning som inte gick igenom.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] En PR som öppnas mot `develop` får automatiskt en reviewer som **inte** är PR-författaren.
      — `gh pr edit --add-reviewer` med `TEAM` minus `AUTHOR`; urvalet torrkört (se Verification).
      **Live-bekräftas av den första PR:en mot `develop` efter merge** — se _Implementation notes_.
- [x] Samma beteende för en PR som öppnas mot `main`. — samma steg, samma `case`-gren (`main|develop`).
- [x] En PR mot `feature/*` (eller någon annan base) får ingen automatisk reviewer.
      — `case "$BASE" in main|develop)` är den enda vägen vidare; allt annat `exit 0`.
- [x] Redan manuellt tillagda reviewers skrivs varken över eller dubbleras.
      — steget avbryter när `reviewRequests` **plus** `reviews` är fler än noll (se _Implementation
      notes_: `reviews` lades till av `/analyze`).
- [x] En PR som byter base till `develop`/`main` i efterhand får en reviewer vid `edited`.
      — `edited` fanns redan i `types:`, och steget har ingen `if: … == 'opened'`-spärr.
- [x] En draft-PR får ingen reviewer förrän den markeras "ready for review".
      — `ready_for_review` tillagd i `types:`, plus en `IS_DRAFT`-spärr.
- [x] PR:er från Dependabot/Renovate hoppas över. — `AUTHOR_TYPE = "Bot"` avbryter steget.
- [x] Hittas ingen kandidat (enda teammedlemmen är författaren) failar inte körningen — den loggar en
      tydlig varning och släpper igenom PR:en. — tom `REVIEWERS` ⇒ `::warning::` + `exit 0`.
- [x] Reviewer-steget kan aldrig faila `validate-source-branch` (required check) — ett misslyckat
      `gh`-anrop varnar och fortsätter. — `continue-on-error: true` på steget.
- [x] Fungerar oavsett hur PR:en öppnas — GitHub-UI:t, `gh pr create` eller `/pr-check`-flödet.
      — logiken hänger på `pull_request`-eventet, inte på hur PR:en skapades.
- [x] Beteendet dokumenteras i `docs/architecture/BRANCHING.md`.
      — nytt avsnitt "The reviewer is requested for you".
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **Torrkörning (2026-07-26)** — steget shell-syntaxkontrollerat med `bash -n`, och urvalslogiken
  körd fristående: `author=sebastianbreuker → MelvinEdlund`, `author=MelvinEdlund →
  sebastianbreuker`. `gh pr view --json reviewRequests --jq '.reviewRequests | length'` verifierad
  mot en riktig PR (#34 → `0`), så fältnamnet stämmer.
- **Live-bekräftelse sker på första PR:en mot `develop` efter merge.** En `pull_request`-workflow kör
  från PR:ens *head*, så steget existerar inte i en `feature/ci-cd → develop`-PR förrän den här
  grenen är mergad. PR:en `46-auto-assign-reviewer → feature/ci-cd` kör visserligen steget men träffar
  `case`-grenen som medvetet hoppar över `feature/*` — det bevisar bara skip-vägen. Inga
  Vitest-tester läggs till — det här är CI/YAML-wiring, inte app-logik, så konstitutionens test-lager
  gäller inte (samma linje som [`29-branch-policy.md`](29-branch-policy.md)).
- **Full svit (2026-07-26):** `pnpm -r lint` ren · `pnpm -r typecheck` ren (den kända
  `.next/types`-failen från spec 29 återkom inte) · `pnpm -r test` 51 passed, 15 skipped
  (Supabase-beroende RLS-tester, hoppas över lokalt), 0 failed. Lint + typecheck omkörda efter
  `/analyze`-fixen (fortsatt rena); testsviten orörd — ändringen är ren YAML.

---

## Implementation notes

**Fynd i `/analyze` (2026-07-26), åtgärdat.** Idempotens-vakten räknade bara `reviewRequests`. GitHub
**tar bort** review-requesten när granskaren skickat in sin review, så vakten gav `0` efteråt och
varje ny push (`synchronize`) hade begärt review på nytt från samma person på en redan godkänd PR —
tvärtemot kriteriet om att inte dubblera granskare, och tvärtemot stegets egen kommentar. Vakten
räknar nu `reviewRequests + reviews` ([branch-policy.yml:189-197](../.github/workflows/branch-policy.yml#L189-L197));
jq-uttrycket verifierat mot en riktig PR (#34 → `0`).

**Avvikelser från planen:** inga i övrigt. Antalet rader i steget växte med fixen — `Exact changes`
uppdaterad därefter.

**Kvarstående risk:** hela kedjan är verifierad genom kodläsning, `bash -n` och torrkörning av
urvalslogiken, men den första *riktiga* tilldelningen sker på nästa `feature/ci-cd → develop`-PR.
Failar den vägen blir konsekvensen bara att en reviewer måste sättas för hand — steget är
`continue-on-error` och kan inte blockera merge.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

1. **`.github/workflows/branch-policy.yml:22`** — `ready_for_review` tillagd i `types:`, så en
   draft-PR fångas när den markeras klar.
2. **`.github/workflows/branch-policy.yml:150-213`** — nytt steg `Request reviewer`, sist i
   `validate-source-branch` och `continue-on-error: true`. Läser basen som
   `${EFFECTIVE_BASE:-$EVENT_BASE}` (samma trick som `Enforce merge rules` — `github.base_ref` är
   inaktuell efter en `gh pr edit`), avbryter på base ≠ `develop`/`main`, på draft, på bot-författare
   och på redan begärda granskare, och kör annars
   `gh pr edit --add-reviewer` med `TEAM` minus författaren.
3. **`.github/workflows/branch-policy.yml:2`** — filens toppkommentar nämner nu även reviewer-steget.
4. **`docs/architecture/BRANCHING.md:67`** — nytt avsnitt "The reviewer is requested for you" med
   beteendetabell, placerat mellan base-sättningen och "Merge Direction Enforcement".

**No change needed:** `scripts/setup-branch-protection.sh` — review-*kravet*
(`required_approving_review_count: 1`) finns redan där sedan issue #8 och rörs inte.

---

## Data model

**No schema changes.**

---

## Security

Körs på `pull_request` (aldrig `pull_request_target`), så en fork får inte skrivtoken — samma regel
som `branch-policy.yml` redan följer. Behörigheten stannar på `pull-requests: write`; inga hemligheter
läses, och reviewer-listan är öppen information i repot.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- PR öppnad av en bot (Dependabot/Renovate) mot `develop` → hoppas över, ingen reviewer.
- Base ändras i efterhand till `develop` (PR:en öppnades mot `feature/*`) → `edited` triggar
  tilldelningen. Notera att base-*sättningen* medvetet bara körs vid `opened` — det är två olika
  regler i samma jobb och det är avsiktligt.
- Draft-PR mot `develop` → ingen reviewer förrän `ready_for_review`.
- Den utvalda reviewern är inte längre collaborator → API:et failar; körningen ska varna och släppa
  igenom, inte blockera PR:en.
- PR:en har redan en reviewer → ingen åtgärd.

---

## Out of scope

- Att tvinga fram godkänd review innan merge — det är branch protection, ägs av issue #8 och
  `scripts/setup-branch-protection.sh`.
- Auto-merge när reviewen är godkänd.
- Reviewer-tilldelning för PR:er mot `feature/*`-grenar.
- Att sätta reviewern som *assignee* — assignee betyder "den som äger arbetet" (författaren), och
  dubbelsignalen gör bara vyerna otydliga.
- Round-robin / lastbalansering mellan granskare — onödigt i ett tvåmannateam; tas upp igen om teamet
  växer.
