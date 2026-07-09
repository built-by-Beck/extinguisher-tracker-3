import type { MarketingPriceDisplay } from '../../lib/marketingPlanPricing.ts';

type MarketingPlanPriceDisplayProps = {
  price: MarketingPriceDisplay;
  /** Larger headline price (plan detail hero). */
  size?: 'card' | 'hero';
  className?: string;
};

export function MarketingPlanPriceDisplay({
  price,
  size = 'card',
  className = '',
}: MarketingPlanPriceDisplayProps) {
  const priceClass =
    size === 'hero'
      ? 'text-4xl font-bold tracking-tight text-gray-900'
      : 'text-3xl font-bold tracking-tight text-gray-900';

  return (
    <div className={className}>
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        {price.regularPriceLabel ? (
          <span className="text-lg font-semibold text-gray-400 line-through">
            {price.regularPriceLabel}
          </span>
        ) : null}
        <span className={priceClass}>{price.priceLabel}</span>
        {price.priceDetail ? (
          <span className="text-sm text-gray-500">{price.priceDetail}</span>
        ) : null}
      </p>

      {price.footnote ? (
        <p className="mt-2 text-xs leading-relaxed text-gray-500">
          {price.footnote}
        </p>
      ) : null}

      {price.promoCode ? (
        <p className="mt-2 text-xs font-semibold text-amber-800">
          Use code <span className="font-mono">{price.promoCode}</span> at
          checkout
        </p>
      ) : null}

      {price.promoDisclaimer ? (
        <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
          {price.promoDisclaimer}
        </p>
      ) : null}
    </div>
  );
}
