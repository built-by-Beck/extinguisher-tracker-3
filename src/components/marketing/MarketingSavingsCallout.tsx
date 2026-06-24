import { PLANS, YEARLY_DISCOUNT_FRACTION } from '../../lib/planConfig.ts';
import { marketingPriceForInterval } from '../../lib/marketingPlanPricing.ts';
import type { BillingIntervalPreference } from '../../lib/billingIntervalPreference.ts';
import { LAUNCH_PROMO_ENABLED } from '../../lib/billingConfig.ts';

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
  const proDisplay = marketingPriceForInterval(proMonthly, interval, 'pro');

  if (LAUNCH_PROMO_ENABLED) {
    return (
      <div className={prominent ? 'space-y-1' : undefined}>
        <p
          className={
            prominent
              ? 'text-2xl font-extrabold tracking-tight text-amber-700 sm:text-3xl'
              : 'text-lg font-bold text-amber-700'
          }
        >
          50% off your first year — Pro from {proDisplay.priceLabel}
          {proDisplay.priceDetail ? ` ${proDisplay.priceDetail}` : ''}
        </p>
        <p
          className={
            prominent
              ? 'text-base font-semibold text-gray-700 sm:text-lg'
              : 'text-sm font-medium text-gray-600'
          }
        >
          Use code EX3PRO50 at checkout. After 12 months, billing returns to the
          regular rate.
        </p>
      </div>
    );
  }

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
          Pro as low as {proDisplay.priceLabel}
          {proDisplay.priceDetail ? ` ${proDisplay.priceDetail}` : ''}{' '}
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
