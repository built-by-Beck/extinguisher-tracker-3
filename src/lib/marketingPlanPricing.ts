/**
 * Display helpers for marketing plan prices by billing interval.
 *
 * Author: built_by_Beck
 */

import {
  getLaunchPromoCode,
  getLaunchPromoPriceDisclaimer,
  LAUNCH_PROMO_DISCOUNT_FRACTION,
  LAUNCH_PROMO_ENABLED,
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
  /** Regular price before launch promo — shown struck through when set. */
  regularPriceLabel?: string;
  /** Short promo badge, e.g. "50% off year 1". */
  promoBadge?: string;
  footnote?: string;
  /** Small print: first year only, then regular rate. */
  promoDisclaimer?: string;
  promoCode?: string;
};

function formatUsd(amount: number): string {
  return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
}

function launchPromoYearlyMonthlyEquivLabel(monthlyPrice: number): string {
  const promoYearlyTotal =
    Math.round(
      yearlyTotalFromMonthly(monthlyPrice) *
        LAUNCH_PROMO_DISCOUNT_FRACTION *
        100,
    ) / 100;
  const equiv = promoYearlyTotal / 12;
  return formatUsd(Math.round(equiv * 100) / 100);
}

export function marketingPriceForInterval(
  monthlyPrice: number,
  interval: BillingIntervalPreference,
  planId?: LaunchPromoPlanId,
): MarketingPriceDisplay {
  const discountPct = Math.round(YEARLY_DISCOUNT_FRACTION * 100);
  const promoActive = LAUNCH_PROMO_ENABLED && planId != null;

  if (interval === 'month') {
    if (promoActive) {
      return {
        priceLabel: formatUsd(launchPromoMonthlyPrice(monthlyPrice)),
        priceDetail: 'per month',
        regularPriceLabel: formatUsd(monthlyPrice),
        promoBadge: '50% off year 1',
        promoCode: getLaunchPromoCode(planId) ?? undefined,
        promoDisclaimer:
          getLaunchPromoPriceDisclaimer(monthlyPrice, planId, 'month') ??
          undefined,
      };
    }

    return {
      priceLabel: formatUsd(monthlyPrice),
      priceDetail: 'per month',
    };
  }

  const yearlyTotal = yearlyTotalFromMonthly(monthlyPrice);
  if (promoActive) {
    const promoYearlyTotal =
      Math.round(yearlyTotal * LAUNCH_PROMO_DISCOUNT_FRACTION * 100) / 100;
    return {
      priceLabel: launchPromoYearlyMonthlyEquivLabel(monthlyPrice),
      priceDetail: 'per month',
      regularPriceLabel: yearlyMonthlyEquivDisplay(monthlyPrice),
      promoBadge: '50% off year 1',
      promoCode: getLaunchPromoCode(planId) ?? undefined,
      footnote: `Billed yearly at ${formatUsd(promoYearlyTotal)} for your first year — then ${formatUsd(yearlyTotal)}/yr.`,
      promoDisclaimer:
        getLaunchPromoPriceDisclaimer(monthlyPrice, planId, 'year') ??
        undefined,
    };
  }

  return {
    priceLabel: yearlyMonthlyEquivDisplay(monthlyPrice),
    priceDetail: 'per month',
    footnote: `Billed yearly at ${formatUsd(yearlyTotal)} — save ${discountPct}% vs monthly.`,
  };
}
