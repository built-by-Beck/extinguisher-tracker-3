import { Link } from 'react-router-dom';
import { Flame, Sparkles, Zap } from 'lucide-react';
import {
  LAUNCH_PROMO_ENABLED,
  LAUNCH_PROMO_MAX_CUSTOMERS,
  LAUNCH_PROMO,
} from '../../lib/billingConfig.ts';

type LimitedTimeOfferBannerProps = {
  /** `hero` = full-width site header strip; `inline` = in-page block above trial banner */
  variant?: 'hero' | 'inline';
};

/**
 * Eye-catching 50% off launch offer — sits above the free-trial promo banner.
 * Hidden when VITE_LAUNCH_PROMO_ENABLED=false at build time.
 */
export function LimitedTimeOfferBanner({ variant = 'hero' }: LimitedTimeOfferBannerProps) {
  if (!LAUNCH_PROMO_ENABLED) return null;

  const isHero = variant === 'hero';

  const shellClass = isHero
    ? 'relative overflow-hidden border-b-4 border-amber-400 bg-gray-950'
    : 'relative overflow-hidden rounded-3xl bg-gray-950 shadow-2xl ring-2 ring-amber-400/70';

  return (
    <section
      aria-label={`Limited time offer: first ${LAUNCH_PROMO_MAX_CUSTOMERS} customers get 50% off their first year`}
      className={shellClass}
    >
      {/* Solid dark base so gradient overlays never wash out on light page backgrounds */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-black" />

      {/* Animated background layers */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(220,38,38,0.35),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_100%_50%,rgba(245,158,11,0.15),transparent)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_0%_80%,rgba(220,38,38,0.2),transparent)]" />
      <div className="offer-shimmer pointer-events-none absolute inset-0 opacity-20" />

      {/* Diagonal accent streaks */}
      <div className="pointer-events-none absolute -right-20 top-0 h-full w-40 skew-x-[-20deg] bg-gradient-to-b from-amber-400/20 via-red-500/10 to-transparent" />
      <div className="pointer-events-none absolute -left-16 top-0 h-full w-32 skew-x-[-20deg] bg-gradient-to-b from-red-500/15 to-transparent" />

      <div
        className={
          isHero
            ? 'relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:py-12'
            : 'relative z-10 px-6 py-10 sm:px-10 sm:py-12 lg:py-14'
        }
      >
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 text-center lg:flex-row lg:items-center lg:gap-10 lg:text-left">
          {/* Left: badge + headline */}
          <div className="flex-1 space-y-4">
            <div className="offer-pulse inline-flex items-center gap-2 rounded-full border border-amber-400 bg-amber-400/20 px-4 py-1.5 text-xs font-extrabold uppercase tracking-[0.2em] text-amber-200 sm:text-sm">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-300" aria-hidden />
              Limited time only
              <Flame className="h-4 w-4 shrink-0 text-red-300" aria-hidden />
            </div>

            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-amber-300 sm:text-base">
                First {LAUNCH_PROMO_MAX_CUSTOMERS} customers
              </p>
              <h2 className="mt-1 text-4xl font-black leading-none tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl">
                <span className="text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                  50% OFF
                </span>
                <span className="mt-1 block text-2xl font-extrabold text-amber-300 sm:text-3xl lg:text-4xl">
                  for the first year
                </span>
              </h2>
            </div>

            <p className="max-w-xl text-base font-medium text-gray-100 sm:text-lg lg:text-xl">
              {LAUNCH_PROMO.description}. Lock in half-price year one before spots run out.
            </p>
          </div>

          {/* Right: CTA + urgency */}
          <div className="flex shrink-0 flex-col items-center gap-4 lg:items-end">
            <div className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-black/40 px-4 py-3">
              <Zap className="h-5 w-5 text-amber-300" aria-hidden />
              <span className="text-sm font-semibold text-white sm:text-base">
                Only{' '}
                <span className="text-amber-200">{LAUNCH_PROMO_MAX_CUSTOMERS} spots</span>{' '}
                available
              </span>
            </div>

            <Link
              to="/signup"
              className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-amber-500 px-8 py-4 text-base font-extrabold text-white shadow-[0_0_40px_rgba(220,38,38,0.5)] transition hover:scale-[1.02] hover:shadow-[0_0_50px_rgba(245,158,11,0.4)] focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-gray-950 sm:px-10 sm:text-lg"
            >
              Claim 50% off now
              <Sparkles className="h-5 w-5 transition group-hover:rotate-12" aria-hidden />
            </Link>

            <Link
              to="/pricing"
              className="text-sm font-semibold text-amber-200 underline-offset-4 hover:text-white hover:underline"
            >
              See plans & promo codes →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
