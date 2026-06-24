/**
 * Shared launch-promo redemption counter (100-customer pool across all EX3*50 codes).
 * Updated from Stripe checkout webhook when a launch promotion code is used.
 *
 * Author: built_by_Beck
 */

import { FieldValue } from 'firebase-admin/firestore';
import type Stripe from 'stripe';
import { adminDb } from '../utils/admin.js';
import { getStripe } from './stripeClient.js';

export const LAUNCH_PROMO_CODES = new Set([
  'EX3BASIC50',
  'EX3PRO50',
  'EX3ELITE50',
]);

const STATS_DOC_PATH = 'public/launchPromo';

const DEFAULT_MAX_CUSTOMERS = 100;

export function getLaunchPromoMaxCustomers(): number {
  const parsed = Number(process.env.LAUNCH_PROMO_MAX_CUSTOMERS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_CUSTOMERS;
}

function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase();
}

function promoCodeFromDiscount(
  discount: { promotion_code?: string | { code?: string | null } | null },
): string | null {
  const promo = discount.promotion_code;
  if (!promo || typeof promo === 'string') {
    return null;
  }
  const code = promo.code;
  return code ? normalizePromoCode(code) : null;
}

export async function getLaunchPromoCodeFromSession(
  session: Stripe.Checkout.Session,
): Promise<string | null> {
  if (session.discounts?.length) {
    for (const discount of session.discounts) {
      const code = promoCodeFromDiscount(discount);
      if (code && LAUNCH_PROMO_CODES.has(code)) {
        return code;
      }
    }
  }

  const fullSession = await getStripe().checkout.sessions.retrieve(session.id, {
    expand: ['discounts', 'discounts.promotion_code'],
  });

  for (const discount of fullSession.discounts ?? []) {
    const code = promoCodeFromDiscount(discount);
    if (code && LAUNCH_PROMO_CODES.has(code)) {
      return code;
    }
  }

  return null;
}

export async function recordLaunchPromoRedemption(
  orgId: string,
  promoCode: string,
): Promise<void> {
  const maxCustomers = getLaunchPromoMaxCustomers();
  const statsRef = adminDb.doc(STATS_DOC_PATH);
  const redemptionRef = adminDb.doc(`${STATS_DOC_PATH}/redemptions/${orgId}`);

  await adminDb.runTransaction(async (tx) => {
    const existing = await tx.get(redemptionRef);
    if (existing.exists) {
      return;
    }

    const statsSnap = await tx.get(statsRef);
    const redeemedCount = statsSnap.exists
      ? Number(statsSnap.data()?.redeemedCount ?? 0)
      : 0;

    tx.set(redemptionRef, {
      orgId,
      promoCode: normalizePromoCode(promoCode),
      countedAt: FieldValue.serverTimestamp(),
    });
    tx.set(
      statsRef,
      {
        maxCustomers,
        redeemedCount: redeemedCount + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}

export async function handleCheckoutLaunchPromo(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const orgId = session.metadata?.orgId;
  if (!orgId || typeof orgId !== 'string') {
    return;
  }

  const promoCode = await getLaunchPromoCodeFromSession(session);
  if (!promoCode) {
    return;
  }

  await recordLaunchPromoRedemption(orgId, promoCode);
}
