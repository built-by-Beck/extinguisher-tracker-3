/**
 * Firebase params / Secret Manager bindings for Cloud Functions (Gen 2).
 * Deploy secrets: `pnpm run secrets:push` from repo root (reads functions/.env).
 *
 * Author: built_by_Beck
 */

import { defineSecret, defineString } from 'firebase-functions/params';
import type { StripePriceIds } from '../billing/planConfig.js';

export const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
export const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

export const stripePriceIdBasic = defineString('STRIPE_PRICE_ID_BASIC', { default: '' });
export const stripePriceIdPro = defineString('STRIPE_PRICE_ID_PRO', { default: '' });
export const stripePriceIdElite = defineString('STRIPE_PRICE_ID_ELITE', { default: '' });

export type { StripePriceIds };

export function getStripePriceIds(): StripePriceIds {
  return {
    basic: stripePriceIdBasic.value(),
    pro: stripePriceIdPro.value(),
    elite: stripePriceIdElite.value(),
  };
}
