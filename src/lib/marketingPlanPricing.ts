/**
 * Display helpers for marketing plan prices by billing interval.
 *
 * Author: built_by_Beck
 */

import {
  applyLaunchPromoDiscount,
  formatUsd,
  LAUNCH_PROMO_ENABLED,
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
  footnote?: string;
};

export function marketingPriceForInterval(
  monthlyPrice: number,
  interval: BillingIntervalPreference,
): MarketingPriceDisplay {
  const discountPct = Math.round(YEARLY_DISCOUNT_FRACTION * 100);
  const promoActive = LAUNCH_PROMO_ENABLED;

  if (interval === 'month') {
    const displayMonthly = promoActive
      ? applyLaunchPromoDiscount(monthlyPrice)
      : monthlyPrice;
    return {
      priceLabel: formatUsd(displayMonthly),
      priceDetail: promoActive ? 'per month · first year' : 'per month',
    };
  }

  const yearlyTotal = yearlyTotalFromMonthly(monthlyPrice);
  const displayYearlyTotal = promoActive
    ? applyLaunchPromoDiscount(yearlyTotal)
    : yearlyTotal;
  const priceLabel = promoActive
    ? formatUsd(Math.round((displayYearlyTotal / 12) * 100) / 100)
    : yearlyMonthlyEquivDisplay(monthlyPrice);

  return {
    priceLabel,
    priceDetail: promoActive ? 'per month · first year' : 'per month',
    footnote: promoActive
      ? `First year billed at ${formatUsd(displayYearlyTotal)} (50% launch promo) — then ${formatUsd(yearlyTotal)}/yr.`
      : `Billed yearly at ${formatUsd(yearlyTotal)} — save ${discountPct}% vs monthly.`,
  };
}
