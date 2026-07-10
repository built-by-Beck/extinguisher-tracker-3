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
  LAUNCH_PROMO_DISCOUNT_FRACTION,
  launchPromoMonthlyPrice,
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
  const promoCode = planId ? getLaunchPromoCode(planId) : null;
  const promoActive = LAUNCH_PROMO_ENABLED && Boolean(promoCode);
  const monthlyRegularPriceLabel = promoActive
    ? formatUsd(monthlyPrice)
    : undefined;

  if (interval === 'month') {
    const displayMonthly = promoActive
      ? launchPromoMonthlyPrice(monthlyPrice)
      : monthlyPrice;
    return {
      priceLabel: formatUsd(displayMonthly),
      priceDetail: promoActive ? 'per month · first year' : 'per month',
      regularPriceLabel: monthlyRegularPriceLabel,
      promoBadge: promoActive ? '50% off year 1' : undefined,
      promoCode: promoCode ?? undefined,
      promoDisclaimer:
        promoActive && planId
          ? (getLaunchPromoPriceDisclaimer(monthlyPrice, planId) ?? undefined)
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
  const yearlyRegularPriceLabel = promoActive
    ? yearlyMonthlyEquivDisplay(monthlyPrice)
    : undefined;

  return {
    priceLabel,
    priceDetail: promoActive ? 'per month · first year' : 'per month',
    regularPriceLabel: yearlyRegularPriceLabel,
    promoBadge: promoActive ? '50% off year 1' : undefined,
    promoCode: promoCode ?? undefined,
    promoDisclaimer:
      promoActive && planId
        ? (getLaunchPromoPriceDisclaimer(monthlyPrice, planId) ?? undefined)
        : undefined,
    footnote: promoActive
      ? `First year billed at ${formatUsd(displayYearlyTotal)} (${Math.round(LAUNCH_PROMO_DISCOUNT_FRACTION * 100)}% launch promo) — then ${formatUsd(yearlyTotal)}/yr.`
      : `Billed yearly at ${formatUsd(yearlyTotal)} — save ${discountPct}% vs monthly.`,
  };
}
