import type { MarketingPriceDisplay } from '../../lib/marketingPlanPricing.ts';

type PlanHeadlinePriceProps = {
  price: Pick<MarketingPriceDisplay, 'priceLabel' | 'priceDetail' | 'regularPriceLabel'>;
  /** Settings cards use /mo suffix on the headline; marketing uses priceDetail. */
  variant?: 'marketing' | 'settings';
  className?: string;
};

/**
 * Headline plan price with optional struck-through regular price during launch promo.
 */
export function PlanHeadlinePrice({
  price,
  variant = 'marketing',
  className = '',
}: PlanHeadlinePriceProps) {
  const regularPrice = price.regularPriceLabel ? (
    <span className="text-xs font-normal text-gray-500">
      reg. price{' '}
      <span className="line-through">{price.regularPriceLabel}</span>
    </span>
  ) : null;

  if (variant === 'settings') {
    return (
      <div className={className}>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-3xl font-bold text-gray-900">
            {price.priceLabel}
            <span className="text-sm font-normal text-gray-500">/mo</span>
          </span>
          {regularPrice}
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-3xl font-bold tracking-tight text-gray-900">
          {price.priceLabel}
        </span>
        {price.priceDetail ? (
          <span className="text-sm text-gray-500">{price.priceDetail}</span>
        ) : null}
        {regularPrice}
      </p>
    </div>
  );
}
