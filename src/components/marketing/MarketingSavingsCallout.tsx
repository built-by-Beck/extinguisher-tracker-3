import { PLANS, YEARLY_DISCOUNT_FRACTION } from '../../lib/planConfig.ts';
import { marketingPriceForInterval } from '../../lib/marketingPlanPricing.ts';
import type { BillingIntervalPreference } from '../../lib/billingIntervalPreference.ts';

type MarketingSavingsCalloutProps = {
  interval: BillingIntervalPreference;
  /** Larger typography for hero / pricing headers */
  prominent?: boolean;
};

export function MarketingSavingsCallout({
  interval,
  prominent = false,
}: MarketingSavingsCalloutProps) {
  const discountPct = Math.round(YEARLY_DISCOUNT_FRACTION * 100);
  const proMonthly = PLANS.find((p) => p.name === 'pro')!.monthlyPrice!;
  const proYearlyDisplay = marketingPriceForInterval(proMonthly, 'year');

  if (interval === 'year') {
    return (
      <div className={prominent ? 'space-y-1' : undefined}>
        <p
          className={
            prominent
              ? 'text-2xl font-extrabold tracking-tight text-green-700 sm:text-3xl'
              : 'text-lg font-bold text-green-700'
          }
        >
          Save {discountPct}% with yearly billing
        </p>
        <p
          className={
            prominent
              ? 'text-base font-semibold text-gray-700 sm:text-lg'
              : 'text-sm font-medium text-gray-600'
          }
        >
          Pro as low as {proYearlyDisplay.priceLabel}
          {proYearlyDisplay.priceDetail ? ` ${proYearlyDisplay.priceDetail}` : ''}{' '}
          billed yearly
        </p>
      </div>
    );
  }

  return (
    <p
      className={
        prominent
          ? 'text-lg font-semibold text-gray-700'
          : 'text-sm font-medium text-gray-600'
      }
    >
      Switch to <strong className="text-green-700">yearly</strong> to save{' '}
      {discountPct}%
    </p>
  );
}
