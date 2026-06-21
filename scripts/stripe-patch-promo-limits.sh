#!/usr/bin/env bash
# Set max_redemptions=100 on existing EX3 launch promotion codes in Stripe.
# Usage: STRIPE_API_KEY=sk_... ./scripts/stripe-patch-promo-limits.sh
set -euo pipefail

if [[ -z "${STRIPE_API_KEY:-}" ]]; then
  if [[ -f functions/.env.secret ]]; then
    export STRIPE_API_KEY="$(grep '^STRIPE_SECRET_KEY=' functions/.env.secret | head -1 | cut -d= -f2-)"
  fi
fi

if [[ -z "${STRIPE_API_KEY:-}" ]]; then
  echo "Set STRIPE_API_KEY or STRIPE_SECRET_KEY in functions/.env.secret"
  exit 1
fi

MAX="${MAX_REDEMPTIONS:-100}"
CODES=(EX3BASIC50 EX3PRO50 EX3ELITE50)

for code in "${CODES[@]}"; do
  echo "Patching $code → max_redemptions=$MAX ..."
  promo_id="$(curl -sS "https://api.stripe.com/v1/promotion_codes?code=${code}&limit=1" -u "$STRIPE_API_KEY:" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('data',[]); print(items[0]['id'] if items else '')")"
  if [[ -z "$promo_id" ]]; then
    echo "  skip: promotion code not found (run stripe-setup-launch-promos.sh first)"
    continue
  fi
  curl -sS "https://api.stripe.com/v1/promotion_codes/${promo_id}" -u "$STRIPE_API_KEY:" \
    -d "max_redemptions=$MAX" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(f\"  {d.get('code')} max_redemptions={d.get('max_redemptions')} active={d.get('active')}\")"
done

echo "Done."
