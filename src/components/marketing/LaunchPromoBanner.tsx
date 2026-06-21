import { Link } from 'react-router-dom';
import { Tag } from 'lucide-react';
import {
  LAUNCH_PROMO,
  LAUNCH_PROMO_ENABLED,
  LAUNCH_PROMO_MAX_CUSTOMERS,
  TRIAL_DAYS,
} from '../../lib/billingConfig.ts';

type LaunchPromoBannerProps = {
  /** `hero` = full-width image banner; `compact` = slimmer strip for in-page use */
  variant?: 'hero' | 'compact';
};

/**
 * Launch promo banner — hidden when VITE_LAUNCH_PROMO_ENABLED=false at build time.
 */
export function LaunchPromoBanner({ variant = 'hero' }: LaunchPromoBannerProps) {
  if (!LAUNCH_PROMO_ENABLED) return null;

  if (variant === 'compact') {
    return (
      <section aria-label="Launch promotion" className="mx-auto max-w-6xl px-4 sm:px-6">
        <Link to="/signup" className="group block overflow-hidden rounded-2xl shadow-xl ring-2 ring-amber-400/80">
          <img
            src={LAUNCH_PROMO.bannerImage}
            alt={`Limited time: first ${LAUNCH_PROMO_MAX_CUSTOMERS} customers get 50% off their first year`}
            className="w-full object-cover transition group-hover:brightness-105"
          />
        </Link>
      </section>
    );
  }

  return (
    <section
      aria-label={`Launch promotion: first ${LAUNCH_PROMO_MAX_CUSTOMERS} customers get 50% off their first year`}
      className="border-b-4 border-amber-400 bg-gray-950"
    >
      <div className="relative mx-auto max-w-7xl">
        <Link to="/signup" className="group block">
          <img
            src={LAUNCH_PROMO.bannerImage}
            alt={`Limited time for the first ${LAUNCH_PROMO_MAX_CUSTOMERS} customers — 50% off your first year. Start your ${TRIAL_DAYS}-day free trial today.`}
            className="w-full object-cover transition duration-300 group-hover:brightness-110"
          />
        </Link>

        <div className="border-t border-white/10 bg-gradient-to-r from-red-950 via-gray-950 to-red-950 px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 lg:flex-row lg:justify-between">
            <p className="text-center text-sm font-semibold text-amber-100 sm:text-base lg:text-left">
              Limited time — first {LAUNCH_PROMO_MAX_CUSTOMERS} customers · {LAUNCH_PROMO.headline} ·{' '}
              {TRIAL_DAYS}-day free trial first
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {(
                [
                  ['Basic', LAUNCH_PROMO.codes.basic],
                  ['Pro', LAUNCH_PROMO.codes.pro],
                  ['Elite', LAUNCH_PROMO.codes.elite],
                ] as const
              ).map(([plan, code]) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-mono text-xs font-bold text-amber-200 ring-1 ring-amber-400/40 sm:text-sm"
                >
                  <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {plan}: {code}
                </span>
              ))}
            </div>
            <Link
              to="/signup"
              className="shrink-0 rounded-xl bg-red-600 px-6 py-2.5 text-sm font-extrabold text-white shadow-lg hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-gray-950"
            >
              Claim 50% off
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
