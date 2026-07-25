#!/usr/bin/env bash
#
# Konfigurerar grenpolicyn på repot via två repository rulesets:
#
#   branch-policy-required-check  main, develop, feature/**  — kräver att checken
#                                 `validate-source-branch` (från .github/workflows/branch-policy.yml)
#                                 passerar innan merge tillåts.
#   branch-push-protection        main, develop              — kräver pull request (1 godkännande),
#                                 blockerar force-push och radering av grenen.
#
# Varför rulesets och inte klassiskt branch protection: mönstret `feature/*` är en
# wildcard, och klassisk branch protection tar bara exakta grennamn. Ett ruleset kan
# matcha `refs/heads/feature/**`, `refs/heads/develop` och `refs/heads/main` i en regel.
#
# `bypass_actors` är tomt på push-skyddet — även en repo-admin måste gå via PR.
# feature/*- och NNN-kort-grenar lämnas fritt pushbara med flit.
#
# Körs LOKALT av en repo-admin — kräver ett token med admin-rättigheter på repot.
# Lagra ALDRIG ett admin-PAT i GitHub Actions; därför är detta ett engångsskript, inte ett workflow.
#
# Användning:
#   REPO=MS-Flow/airrow ./scripts/setup-branch-protection.sh
# (utan REPO används `gh repo view` för att härleda aktuellt repo)

set -euo pipefail

REPO="${REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
CHECK_CONTEXT="validate-source-branch"

# Idempotent: uppdatera befintligt ruleset med samma namn, annars skapa nytt.
apply_ruleset() {
  local name="$1"
  local payload="$2"
  local existing_id

  existing_id="$(gh api "repos/$REPO/rulesets" --jq ".[] | select(.name == \"$name\") | .id" || true)"

  if [ -n "$existing_id" ]; then
    echo "Uppdaterar befintligt ruleset '$name' (id=$existing_id)."
    printf '%s' "$payload" | gh api -X PUT "repos/$REPO/rulesets/$existing_id" --input -
  else
    echo "Skapar nytt ruleset '$name'."
    printf '%s' "$payload" | gh api -X POST "repos/$REPO/rulesets" --input -
  fi
}

echo "Konfigurerar grenpolicy på '$REPO'…"

apply_ruleset "branch-policy-required-check" "$(cat <<JSON
{
  "name": "branch-policy-required-check",
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

apply_ruleset "branch-push-protection" "$(cat <<'JSON'
{
  "name": "branch-push-protection",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main", "refs/heads/develop"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    { "type": "non_fast_forward" },
    { "type": "deletion" }
  ]
}
JSON
)"

echo "Klart."
