/**
 * Public billing/savings copy — driven by Vite env vars at build time.
 * Set VITE_LAUNCH_PROMO_ENABLED=false and redeploy to remove launch promo from the site.
 */

export type LaunchPromoPlanId = 'basic' | 'pro' | 'elite';

export const TRIAL_DAYS = Number(import.meta.env.VITE_TRIAL_DAYS) || 14;

export const LAUNCH_PROMO_ENABLED =
  String(import.meta.env.VITE_LAUNCH_PROMO_ENABLED ?? 'true').toLowerCase() !==
  'false';

export const LAUNCH_PROMO_MAX_CUSTOMERS =
  Number(import.meta.env.VITE_LAUNCH_PROMO_MAX_CUSTOMERS) || 100;

/** Matches Stripe launch coupons (50% off, repeating 12 months). */
export const LAUNCH_PROMO_DISCOUNT_FRACTION = 0.5;

export const LAUNCH_PROMO = {
  headline: '50% off your first year',
  description: `50% off your first year — limited to the first ${LAUNCH_PROMO_MAX_CUSTOMERS} customers`,
  codes: {
    basic: 'EX3BASIC50',
    pro: 'EX3PRO50',
    elite: 'EX3ELITE50',
  },
  bannerImage: '/launch-promo-banner.png',
} as const;

export function applyLaunchPromoDiscount(amount: number): number {
  return Math.round(amount * (1 - LAUNCH_PROMO_DISCOUNT_FRACTION) * 100) / 100;
}

export function formatUsd(amount: number): string {
  return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
}

/** Headline monthly price shown on pricing/settings when launch promo is active. */
export function launchPromoMonthlyDisplay(monthlyPrice: number): string {
  return formatUsd(applyLaunchPromoDiscount(monthlyPrice));
}

export function getPermanentSavingsLine(): string {
  return `${TRIAL_DAYS}-day free trial · 10% off annual prepay`;
}

export function getLaunchPromoBannerCopy(): string | null {
  if (!LAUNCH_PROMO_ENABLED) return null;
  return `Limited time for the first ${LAUNCH_PROMO_MAX_CUSTOMERS} customers: ${LAUNCH_PROMO.headline}. Use EX3PRO50 (Pro), EX3BASIC50 (Basic), or EX3ELITE50 (Elite) at checkout — applies after your ${TRIAL_DAYS}-day free trial.`;
}

export function getLaunchPromoPlanNote(
  planId: LaunchPromoPlanId,
): string | null {
  if (!LAUNCH_PROMO_ENABLED) return null;
  const code = LAUNCH_PROMO.codes[planId];
  return `Limited time — first ${LAUNCH_PROMO_MAX_CUSTOMERS} customers: ${LAUNCH_PROMO.headline} with code ${code}.`;
}

export function getLaunchPromoFaqItem(): { q: string; a: string } | null {
  if (!LAUNCH_PROMO_ENABLED) return null;
  return {
    q: 'Is there a launch discount?',
    a: `Yes — for a limited time, the first ${LAUNCH_PROMO_MAX_CUSTOMERS} customers can use EX3BASIC50, EX3PRO50, or EX3ELITE50 at checkout for 50% off the first year on the matching plan. The discount applies after your ${TRIAL_DAYS}-day free trial. When the limit is reached, codes stop working automatically.`,
  };
}

export function getLaunchPromoCheckoutHint(): string | null {
  if (!LAUNCH_PROMO_ENABLED) return null;
  return `First ${LAUNCH_PROMO_MAX_CUSTOMERS} customers: EX3BASIC50 · EX3PRO50 · EX3ELITE50 (${LAUNCH_PROMO.headline}, after trial)`;
}
