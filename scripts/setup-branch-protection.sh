#!/usr/bin/env bash
#
# Konfigurerar grenpolicyn som required status check via ett repository ruleset.
#
# Varför ett ruleset och inte klassiskt branch protection: mönstret `feature/*` är en
# wildcard, och klassisk branch protection tar bara exakta grennamn. Ett ruleset kan
# matcha `refs/heads/feature/**`, `refs/heads/develop` och `refs/heads/main` i en regel
# och kräva att checken `validate-source-branch` (från .github/workflows/branch-policy.yml)
# passerar innan merge tillåts.
#
# Körs LOKALT av en repo-admin — kräver ett token med admin-rättigheter på repot.
# Lagra ALDRIG ett admin-PAT i GitHub Actions; därför är detta ett engångsskript, inte ett workflow.
#
# Användning:
#   REPO=MelvinEdlund/airrow ./scripts/setup-branch-protection.sh
# (utan REPO används `gh repo view` för att härleda aktuellt repo)

set -euo pipefail

REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
RULESET_NAME="branch-policy-required-check"
CHECK_CONTEXT="validate-source-branch"

echo "Konfigurerar ruleset '$RULESET_NAME' på '$REPO' (required check: '$CHECK_CONTEXT')…"

payload="$(cat <<JSON
{
  "name": "$RULESET_NAME",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main", "refs/heads/develop", "refs/heads/feature/**"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          { "context": "$CHECK_CONTEXT" }
        ]
      }
    }
  ]
}
JSON
)"

# Idempotent: uppdatera befintligt ruleset med samma namn, annars skapa nytt.
existing_id="$(gh api "repos/$REPO/rulesets" --jq ".[] | select(.name == \"$RULESET_NAME\") | .id" || true)"

if [ -n "$existing_id" ]; then
  echo "Uppdaterar befintligt ruleset (id=$existing_id)."
  echo "$payload" | gh api -X PUT "repos/$REPO/rulesets/$existing_id" --input -
else
  echo "Skapar nytt ruleset."
  echo "$payload" | gh api -X POST "repos/$REPO/rulesets" --input -
fi

echo "Klart."
