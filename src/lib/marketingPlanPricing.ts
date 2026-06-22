/**
 * Display helpers for marketing plan prices by billing interval.
 *
 * Author: built_by_Beck
 */

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

function formatUsd(amount: number): string {
  return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
}

export function marketingPriceForInterval(
  monthlyPrice: number,
  interval: BillingIntervalPreference,
): MarketingPriceDisplay {
  const discountPct = Math.round(YEARLY_DISCOUNT_FRACTION * 100);

  if (interval === 'month') {
    return {
      priceLabel: formatUsd(monthlyPrice),
      priceDetail: 'per month',
    };
  }

  const yearlyTotal = yearlyTotalFromMonthly(monthlyPrice);
  return {
    priceLabel: yearlyMonthlyEquivDisplay(monthlyPrice),
    priceDetail: 'per month',
    footnote: `Billed yearly at ${formatUsd(yearlyTotal)} — save ${discountPct}% vs monthly.`,
  };
}
