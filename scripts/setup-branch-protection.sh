#!/usr/bin/env bash
#
# Konfigurerar grenpolicyn på repot via två repository rulesets:
#
#   branch-policy-required-check  main, develop  — kräver att två checkar passerar innan
#                                 merge tillåts:
#                                   `validate-source-branch` (.github/workflows/branch-policy.yml)
#                                     — rätt merge-riktning.
#                                   `verify` (.github/workflows/ci.yml)
#                                     — typecheck, lint, test och build; trasig kod når aldrig develop.
#   branch-push-protection        main, develop  — kräver pull request (1 godkännande),
#                                 blockerar force-push och radering av grenen.
#
# Varför INTE `feature/**` i required-check-regeln: ett ruleset utvärderar en required
# status check vid *varje* ref-uppdatering, inte bara vid merge. `validate-source-branch`
# körs bara på `pull_request`, så en commit som pushas direkt till en feature-gren saknar
# checken och kan aldrig få den grön — regeln skulle i praktiken förbjuda all push till
# feature-grenar (även att skapa dem). Fel riktning in i en feature-gren fångas därför av
# den röda checken på PR:en, medan develop/main har den som hård spärr.
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
# Jobb-id:t i .github/workflows/ci.yml — typecheck, lint, test och build i ett jobb,
# alltså EN kontext att hålla i synk här. Till skillnad från `validate-source-branch`
# körs det även på `push`, så en required check finns på varje ref-uppdatering.
CI_CHECK_CONTEXT="verify"

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
      "include": ["refs/heads/main", "refs/heads/develop"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          { "context": "$CHECK_CONTEXT" },
          { "context": "$CI_CHECK_CONTEXT" }
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
