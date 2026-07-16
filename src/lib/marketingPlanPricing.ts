/**
 * Display helpers for marketing plan prices by billing interval.
 *
 * Author: built_by_Beck
 */

import {
  applyLaunchPromoDiscount,
  formatUsd,
  getLaunchPromoCode,
  getLaunchPromoPriceDisclaimer,
  LAUNCH_PROMO_ENABLED,
  launchPromoMonthlyPrice,
  type LaunchPromoPlanId,
} from './billingConfig.ts';
import {
  YEARLY_DISCOUNT_FRACTION,
  yearlyMonthlyEquivDisplay,
  yearlyTotalFromMonthly,
} from './planConfig.ts';
import type { BillingIntervalPreference } from './billingIntervalPreference.ts';

export type MarketingPriceDisplay = {
  priceLabel: string;
  priceDetail: string;
  /** Full price before launch promo (shown struck-through when promo active). */
  regularPriceLabel?: string;
  footnote?: string;
  /** Short badge shown near the price while the launch promo is active. */
  promoBadge?: string;
  /** Small print: first year only, then regular rate. */
  promoDisclaimer?: string;
  promoCode?: string;
};

export function marketingPriceForInterval(
  monthlyPrice: number,
  interval: BillingIntervalPreference,
  planId?: LaunchPromoPlanId,
): MarketingPriceDisplay {
  const discountPct = Math.round(YEARLY_DISCOUNT_FRACTION * 100);
  const promoActive = LAUNCH_PROMO_ENABLED && planId !== undefined;

  if (interval === 'month') {
    if (!promoActive) {
      return {
        priceLabel: formatUsd(monthlyPrice),
        priceDetail: 'per month',
      };
    }
    return {
      priceLabel: formatUsd(launchPromoMonthlyPrice(monthlyPrice)),
      priceDetail: 'per month · first year',
      regularPriceLabel: formatUsd(monthlyPrice),
      promoBadge: '50% off year 1',
      promoCode: getLaunchPromoCode(planId) ?? undefined,
      promoDisclaimer:
        getLaunchPromoPriceDisclaimer(monthlyPrice, planId, 'month') ??
        undefined,
    };
  }

  const yearlyTotal = yearlyTotalFromMonthly(monthlyPrice);
  if (!promoActive) {
    return {
      priceLabel: yearlyMonthlyEquivDisplay(monthlyPrice),
      priceDetail: 'per month',
      footnote: `Billed yearly at ${formatUsd(yearlyTotal)} — save ${discountPct}% vs monthly.`,
    };
  }

  const displayYearlyTotal = applyLaunchPromoDiscount(yearlyTotal);
  const priceLabel = formatUsd(
    Math.round((displayYearlyTotal / 12) * 100) / 100,
  );

  return {
    priceLabel,
    priceDetail: 'per month · first year',
    regularPriceLabel: yearlyMonthlyEquivDisplay(monthlyPrice),
    footnote: `${formatUsd(displayYearlyTotal)} for your first year (50% launch promo) — then ${formatUsd(yearlyTotal)}/yr.`,
    promoBadge: '50% off year 1',
    promoCode: getLaunchPromoCode(planId) ?? undefined,
    promoDisclaimer:
      getLaunchPromoPriceDisclaimer(monthlyPrice, planId, 'year') ??
      undefined,
  };
}
