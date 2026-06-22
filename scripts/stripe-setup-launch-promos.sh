#!/usr/bin/env bash
# Create product-scoped EX3 launch coupons + promotion codes in Stripe (live or test).
# Usage: STRIPE_API_KEY=sk_... ./scripts/stripe-setup-launch-promos.sh
#
# Note: Stripe coupon names must be <= 40 characters.
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

PRODUCT_BASIC=prod_UAs1TFmyag2GaV
PRODUCT_PRO=prod_UAsFmD7J7S5blx
PRODUCT_ELITE=prod_UAsbfqtk2lf45j

create_coupon() {
  local name="$1"
  local product="$2"
  local plan="$3"
  curl -sS https://api.stripe.com/v1/coupons -u "$STRIPE_API_KEY:" \
    --data-urlencode "name=$name" \
    -d percent_off=50 \
    -d duration=repeating \
    -d duration_in_months=12 \
    -d "applies_to[products][0]=$product" \
    -d "metadata[platform]=ex3" \
    -d "metadata[plan]=$plan" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('id'), d; print(d['id'])"
}

MAX_REDEMPTIONS="${MAX_REDEMPTIONS:-100}"

create_promo() {
  local coupon_id="$1"
  local code="$2"
  local plan="$3"
  curl -sS https://api.stripe.com/v1/promotion_codes -u "$STRIPE_API_KEY:" \
    -d "promotion[type]=coupon" \
    -d "promotion[coupon]=$coupon_id" \
    -d "code=$code" \
    -d active=true \
    -d "max_redemptions=$MAX_REDEMPTIONS" \
    -d "metadata[platform]=ex3" \
    -d "metadata[plan]=$plan" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('code'), d; print(f\"  {d['code']} active={d['active']} max={d.get('max_redemptions')} coupon={d['promotion']['coupon']}\")"
}

create_coupon_and_promo() {
  local name="$1"
  local product="$2"
  local plan="$3"
  local code="$4"
  echo "Creating coupon: $name..."
  local coupon_id
  coupon_id="$(create_coupon "$name" "$product" "$plan")"
  echo "  coupon_id=$coupon_id"
  echo "Creating promotion code: $code..."
  create_promo "$coupon_id" "$code" "$plan"
}

create_coupon_and_promo "EX3 Basic 50% off year 1" "$PRODUCT_BASIC" "basic" "EX3BASIC50"
create_coupon_and_promo "EX3 Pro 50% off year 1" "$PRODUCT_PRO" "pro" "EX3PRO50"
create_coupon_and_promo "EX3 Elite 50% off year 1" "$PRODUCT_ELITE" "elite" "EX3ELITE50"

echo ""
echo "Done. Deactivate old promo codes in Stripe Dashboard before re-running if codes already exist."
