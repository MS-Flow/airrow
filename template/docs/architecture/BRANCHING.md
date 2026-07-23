# Branch- och arbetsflöde

Vi jobbar via GitHub. En **feature** är ett GitHub Project, och **issues** kopplas till den featuren.
Varje issue får en spec i [`../../specs/`](../../specs/) och en egen gren.

## Grenhierarki
```
main               -> produktion
develop            -> integration; testas mot DEV-miljön
feature/<namn>     -> en feature (= ett GitHub Project); grenas från develop, deployar löpande till DEV
<nr>-<kort>        -> ett issue; grenas från SIN feature, PR:as tillbaka in i featuren
```

Issue-grenar heter `<nr>-<kort>` (issue-nummer + kort namn), **utan** `issue/`-prefix.

## Arbetsflöde
1. **Starta en feature** (en gång per GitHub Project):
   git checkout develop && git pull
   git checkout -b feature/<namn>
   git push -u origin feature/<namn>
2. **Ta ett issue** ur featuren:
   git checkout feature/<namn> && git pull
   git checkout -b <nr>-<kort>
3. **PR** `<nr>-<kort>` → `feature/<namn>`.
4. När featuren är klar: **PR** `feature/<namn>` → `develop`.
5. Release: **PR** `develop` → `main`.

> Riktningen är strikt och hoppas aldrig över: `<nr>-<kort>` → `feature/<namn>` → `develop` → `main`.
> Ett issue PR:as **aldrig** direkt till `develop` eller `main`.

## CI / DEV-deploy
- Varje push till `feature/<namn>` **och** `develop` kör DEV-deploy (se `.github/workflows/deploy-dev.yml`).
- `<nr>-<kort>`-grenar deployar inte — de testas via sin feature.

## Håll grenar i synk
- Uppdatera ditt issue mot featuren ofta: `git merge feature/<namn>`.
- Uppdatera featuren mot develop: `git merge develop`.
