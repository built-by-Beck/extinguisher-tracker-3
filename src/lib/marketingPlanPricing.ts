/**
 * Display helpers for marketing plan prices by billing interval.
 *
 * Author: built_by_Beck
 */

import {
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
  promoCode?: string;
  promoBadge?: string;
};

function parseUsd(value: string): number {
  return Number(value.replace(/^\$/, ''));
}

export function marketingPriceForInterval(
  monthlyPrice: number,
  interval: BillingIntervalPreference,
  planId?: LaunchPromoPlanId,
): MarketingPriceDisplay {
  const discountPct = Math.round(YEARLY_DISCOUNT_FRACTION * 100);
  const promoActive = LAUNCH_PROMO_ENABLED && planId != null;

  if (interval === 'month') {
    const displayMonthly = promoActive
      ? launchPromoMonthlyPrice(monthlyPrice)
      : monthlyPrice;
    return {
      priceLabel: formatUsd(displayMonthly),
      priceDetail: promoActive ? 'per month · first year' : 'per month',
      regularPriceLabel: promoActive ? formatUsd(monthlyPrice) : undefined,
      promoBadge: promoActive ? '50% off year 1' : undefined,
      promoCode: promoActive ? getLaunchPromoCode(planId) : undefined,
      promoDisclaimer:
        promoActive
          ? getLaunchPromoPriceDisclaimer(monthlyPrice, planId, 'month') ??
            undefined
          : undefined,
    };
  }

  const yearlyTotal = yearlyTotalFromMonthly(monthlyPrice);
  const regularYearlyMonthly = parseUsd(yearlyMonthlyEquivDisplay(monthlyPrice));

  if (!promoActive) {
    return {
      priceLabel: yearlyMonthlyEquivDisplay(monthlyPrice),
      priceDetail: 'per month',
      footnote: `Billed yearly at ${formatUsd(yearlyTotal)} — save ${discountPct}% vs monthly.`,
    };
  }

  const displayYearlyTotal =
    Math.round(yearlyTotal * (1 - 0.5) * 100) / 100;
  const priceLabel =
    Math.round((displayYearlyTotal / 12) * 100) / 100;

  return {
    priceLabel: formatUsd(priceLabel),
    priceDetail: 'per month · first year',
    regularPriceLabel: formatUsd(regularYearlyMonthly),
    promoBadge: '50% off year 1',
    promoCode: getLaunchPromoCode(planId),
    promoDisclaimer:
      getLaunchPromoPriceDisclaimer(monthlyPrice, planId, 'year') ?? undefined,
    footnote: `First year billed at ${formatUsd(displayYearlyTotal)} (50% launch promo) — then ${formatUsd(yearlyTotal)}/yr.`,
  };
}
