#!/usr/bin/env bash
# Set max_redemptions on EX3 launch promotion codes.
# Stripe does NOT allow updating max_redemptions on existing codes — use stripe-recreate-promo-limits.sh instead.
# Usage: STRIPE_API_KEY=sk_... ./scripts/stripe-patch-promo-limits.sh
set -euo pipefail

echo "error: Stripe API rejects max_redemptions updates on existing promotion codes." >&2
echo "Run: ./scripts/stripe-recreate-promo-limits.sh" >&2
exit 1
