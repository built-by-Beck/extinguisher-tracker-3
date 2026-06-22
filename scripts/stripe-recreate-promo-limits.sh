#!/usr/bin/env bash
# Recreate EX3 launch promotion codes with max_redemptions (Stripe cannot patch this field).
# Deactivates active codes matching EX3*50, then creates fresh codes via stripe-setup-launch-promos.sh.
# Usage: ./scripts/stripe-recreate-promo-limits.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${STRIPE_API_KEY:-}" ]]; then
  if [[ -f functions/.env.secret ]]; then
    export STRIPE_API_KEY="$(grep '^STRIPE_SECRET_KEY=' functions/.env.secret | head -1 | cut -d= -f2-)"
  fi
fi

if [[ -z "${STRIPE_API_KEY:-}" ]]; then
  echo "Set STRIPE_API_KEY or STRIPE_SECRET_KEY in functions/.env.secret"
  exit 1
fi

for code in EX3BASIC50 EX3PRO50 EX3ELITE50; do
  promo_id="$(curl -sS "https://api.stripe.com/v1/promotion_codes?code=${code}&active=true&limit=1" -u "$STRIPE_API_KEY:" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('data',[]); print(items[0]['id'] if items else '')")"
  if [[ -n "$promo_id" ]]; then
    echo "Deactivating active $code ($promo_id)..."
    curl -sS "https://api.stripe.com/v1/promotion_codes/${promo_id}" -u "$STRIPE_API_KEY:" -d "active=false" >/dev/null
  fi
done

exec bash "$ROOT/scripts/stripe-setup-launch-promos.sh"
