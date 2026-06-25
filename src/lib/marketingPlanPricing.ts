/**
 * Display helpers for marketing plan prices by billing interval.
 *
 * Author: built_by_Beck
 */

import {
  applyLaunchPromoDiscount,
  formatUsd,
  LAUNCH_PROMO,
  LAUNCH_PROMO_ENABLED,
} from './billingConfig.ts';
import type { LaunchPromoPlanId } from './billingConfig.ts';
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
  const promoCode =
    LAUNCH_PROMO_ENABLED && planId ? LAUNCH_PROMO.codes[planId] : undefined;
  const promoActive = promoCode !== undefined;

  if (interval === 'month') {
    const displayMonthly = promoActive
      ? applyLaunchPromoDiscount(monthlyPrice)
      : monthlyPrice;
    return {
      priceLabel: formatUsd(displayMonthly),
      priceDetail: promoActive ? 'per month · first year' : 'per month',
      regularPriceLabel: promoActive ? formatUsd(monthlyPrice) : undefined,
      promoBadge: promoActive ? '50% off year 1' : undefined,
      promoCode,
      promoDisclaimer: promoActive
        ? `First-year launch promo applies with code ${promoCode} at checkout. After 12 months, billing returns to ${formatUsd(monthlyPrice)}/mo.`
        : undefined,
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
    regularPriceLabel: promoActive
      ? yearlyMonthlyEquivDisplay(monthlyPrice)
      : undefined,
    footnote: promoActive
      ? `First year billed at ${formatUsd(displayYearlyTotal)} (50% launch promo) — then ${formatUsd(yearlyTotal)}/yr.`
      : `Billed yearly at ${formatUsd(yearlyTotal)} — save ${discountPct}% vs monthly.`,
  };
}
