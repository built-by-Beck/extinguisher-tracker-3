import { LAUNCH_PROMO_MAX_CUSTOMERS } from '../../lib/billingConfig.ts';
import { useLaunchPromoSpots } from '../../hooks/useLaunchPromoSpots.ts';

type LaunchPromoSpotsCounterProps = {
  /** Large numeric display for hero banners */
  variant?: 'badge' | 'hero';
  className?: string;
};

/**
 * Live counter for remaining launch-promo spots (public Firestore doc).
 */
export function LaunchPromoSpotsCounter({
  variant = 'badge',
  className = '',
}: LaunchPromoSpotsCounterProps) {
  const spots = useLaunchPromoSpots();

  if (!spots) {
    return null;
  }

  const max = spots.maxCustomers || LAUNCH_PROMO_MAX_CUSTOMERS;
  const remaining = spots.loading ? max : spots.spotsRemaining;

  if (variant === 'hero') {
    if (spots.soldOut && !spots.loading) {
      return (
        <p className={`text-2xl font-black text-red-300 sm:text-3xl ${className}`}>
          Promo sold out
        </p>
      );
    }

    return (
      <div className={`text-center ${className}`}>
        <p
          className="text-5xl font-black tabular-nums tracking-tight text-amber-300 sm:text-6xl"
          aria-live="polite"
          aria-atomic="true"
        >
          {spots.loading ? '—' : remaining}
        </p>
        <p className="mt-1 text-sm font-semibold uppercase tracking-widest text-amber-200/90 sm:text-base">
          spots left
        </p>
        <p className="mt-0.5 text-xs text-gray-300">
          of {max} launch promo seats
        </p>
      </div>
    );
  }

  if (spots.soldOut && !spots.loading) {
    return (
      <span className={`font-semibold text-red-300 ${className}`}>
        Promo sold out — all {max} spots claimed
      </span>
    );
  }

  return (
    <span className={className} aria-live="polite" aria-atomic="true">
      Only{' '}
      <span className="font-black tabular-nums text-amber-100">
        {spots.loading ? max : remaining}
      </span>{' '}
      of{' '}
      <span className="text-amber-200">{max}</span> spots left
    </span>
  );
}
