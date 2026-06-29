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
  const promoPlanId = LAUNCH_PROMO_ENABLED ? planId : undefined;

  if (interval === 'month') {
    if (promoPlanId) {
      return {
        priceLabel: formatUsd(launchPromoMonthlyPrice(monthlyPrice)),
        priceDetail: 'per month · first year',
        regularPriceLabel: formatUsd(monthlyPrice),
        promoBadge: '50% off year 1',
        promoCode: getLaunchPromoCode(promoPlanId) ?? undefined,
        promoDisclaimer:
          getLaunchPromoPriceDisclaimer(monthlyPrice, promoPlanId, interval) ??
          undefined,
      };
    }

    return {
      priceLabel: formatUsd(monthlyPrice),
      priceDetail: 'per month',
    };
  }

  const yearlyTotal = yearlyTotalFromMonthly(monthlyPrice);
  const displayYearlyTotal = promoPlanId
    ? applyLaunchPromoDiscount(yearlyTotal)
    : yearlyTotal;
  const priceLabel = promoPlanId
    ? formatUsd(Math.round((displayYearlyTotal / 12) * 100) / 100)
    : yearlyMonthlyEquivDisplay(monthlyPrice);

  return {
    priceLabel,
    priceDetail: promoPlanId ? 'per month · first year' : 'per month',
    regularPriceLabel: promoPlanId
      ? yearlyMonthlyEquivDisplay(monthlyPrice)
      : undefined,
    footnote: promoPlanId
      ? `First year billed at ${formatUsd(displayYearlyTotal)} (50% launch promo) — then ${formatUsd(yearlyTotal)}/yr.`
      : `Billed yearly at ${formatUsd(yearlyTotal)} — save ${discountPct}% vs monthly.`,
    promoBadge: promoPlanId ? '50% off year 1' : undefined,
    promoCode: promoPlanId
      ? (getLaunchPromoCode(promoPlanId) ?? undefined)
      : undefined,
    promoDisclaimer: promoPlanId
      ? (getLaunchPromoPriceDisclaimer(monthlyPrice, promoPlanId, interval) ??
        undefined)
      : undefined,
  };
}
