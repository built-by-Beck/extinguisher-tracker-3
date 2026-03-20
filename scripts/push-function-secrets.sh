#!/usr/bin/env bash
# Upload Stripe secrets from functions/.env to Google Cloud Secret Manager (Firebase Functions Gen 2).
# Requires: Firebase CLI logged in (`firebase login`) and access to the project in .firebaserc.
#
# Author: built_by_Beck

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SECRET_FILE="${ROOT}/functions/.env.secret"
LEGACY_ENV="${ROOT}/functions/.env"

if [[ -f "$SECRET_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$SECRET_FILE"
  set +a
elif [[ -f "$LEGACY_ENV" ]]; then
  echo "warn: using functions/.env for secrets — move STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to functions/.env.secret or deploy will fail (secret vs plain env overlap)." >&2
  set -a
  # shellcheck disable=SC1090
  source "$LEGACY_ENV"
  set +a
else
  echo "error: missing ${SECRET_FILE} (copy from functions/.env.secret.example)" >&2
  exit 1
fi

for name in STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET; do
  val="${!name:-}"
  if [[ -z "$val" ]]; then
    echo "error: ${name} is empty in functions/.env" >&2
    exit 1
  fi
  printf '%s' "$val" | firebase functions:secrets:set "$name" --data-file=-
  echo "set secret: ${name}"
done

echo ""
echo "Next: deploy functions so new revisions mount these secrets:"
echo "  firebase deploy --only functions"
echo "Price IDs (STRIPE_PRICE_ID_*) are read from functions/.env at deploy time as parameters."
