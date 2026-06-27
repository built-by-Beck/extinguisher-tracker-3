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
  /** Small print: first year only, then regular rate. */
  promoDisclaimer?: string;
  promoBadge?: string;
  promoCode?: string;
};

export function marketingPriceForInterval(
  monthlyPrice: number,
  interval: BillingIntervalPreference,
  planId?: LaunchPromoPlanId,
): MarketingPriceDisplay {
  const discountPct = Math.round(YEARLY_DISCOUNT_FRACTION * 100);
  const promoActive = LAUNCH_PROMO_ENABLED && Boolean(planId);
  const promoCode = promoActive && planId ? getLaunchPromoCode(planId) : null;

  if (interval === 'month') {
    const displayMonthly = promoActive
      ? launchPromoMonthlyPrice(monthlyPrice)
      : monthlyPrice;
    return {
      priceLabel: formatUsd(displayMonthly),
      priceDetail: promoActive ? 'per month · first year' : 'per month',
      regularPriceLabel: promoActive ? formatUsd(monthlyPrice) : undefined,
      promoBadge: promoActive ? '50% off year 1' : undefined,
      promoCode: promoCode ?? undefined,
      promoDisclaimer:
        promoActive && planId
          ? (getLaunchPromoPriceDisclaimer(monthlyPrice, planId, interval) ??
            undefined)
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
    promoBadge: promoActive ? '50% off year 1' : undefined,
    promoCode: promoCode ?? undefined,
    promoDisclaimer:
      promoActive && planId
        ? (getLaunchPromoPriceDisclaimer(monthlyPrice, planId, interval) ??
          undefined)
        : undefined,
    footnote: promoActive
      ? `First year billed at ${formatUsd(displayYearlyTotal)} (50% launch promo) — then ${formatUsd(yearlyTotal)}/yr.`
      : `Billed yearly at ${formatUsd(yearlyTotal)} — save ${discountPct}% vs monthly.`,
  };
}
