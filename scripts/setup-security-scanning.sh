#!/usr/bin/env bash
#
# Slår på GitHubs secret scanning på repot (spec 33):
#
#   secret_scanning                  upptäcker committade nycklar och larmar.
#   secret_scanning_push_protection  blockerar pushen INNAN nyckeln når historiken —
#                                    det är den som gör verklig skillnad, eftersom en
#                                    nyckel som en gång nått ett publikt repo måste
#                                    roteras oavsett hur snabbt commiten tas bort.
#
# Gratis eftersom repot är publikt. På ett privat repo kräver samma inställningar en
# betald plan (GitHub Secret Protection) — görs repot privat igen slutar detta fungera.
#
# Dependabot alerts rörs INTE: de är redan påslagna, och auto-PRs är medvetet avstängda
# (deras grenar bryter mot grenpolicyn — se specs/33-security-scanning.md).
#
# Körs LOKALT av en repo-admin — kräver ett token med admin-rättigheter på repot.
# Lagra ALDRIG ett admin-PAT i GitHub Actions; därför är detta ett engångsskript, inte ett workflow.
#
# Användning:
#   REPO=MS-Flow/airrow ./scripts/setup-security-scanning.sh
# (utan REPO används `gh repo view` för att härleda aktuellt repo)

set -euo pipefail

REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"

echo "Konfigurerar secret scanning på '$REPO'…"

# Idempotent av sig själv: PATCH med samma värde är ett no-op, och GitHub returnerar
# samma tillstånd oavsett hur många gånger det körs.
gh api -X PATCH "repos/$REPO" --input - > /dev/null <<'JSON'
{
  "security_and_analysis": {
    "secret_scanning": { "status": "enabled" },
    "secret_scanning_push_protection": { "status": "enabled" }
  }
}
JSON

echo "Verifierar…"
gh api "repos/$REPO" \
  --jq '.security_and_analysis | "  secret_scanning:                 \(.secret_scanning.status)
  secret_scanning_push_protection: \(.secret_scanning_push_protection.status)"'

echo "Klart."
