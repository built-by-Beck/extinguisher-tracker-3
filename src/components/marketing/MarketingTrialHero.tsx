import { Link } from 'react-router-dom';
import { CreditCard, Sparkles } from 'lucide-react';
import { MarketingSignupLink } from './MarketingSignupLink.tsx';
import { TRIAL_CTA_LABEL } from '../../lib/marketingCtaCopy.ts';

type MarketingTrialHeroProps = {
  size?: 'hero' | 'band';
  /** Scroll target for "Compare yearly plans" */
  compareHref?: string;
  onTrialClick?: () => void;
};

export function MarketingTrialHero({
  size = 'hero',
  compareHref = '#plans-preview',
  onTrialClick,
}: MarketingTrialHeroProps) {
  const isBand = size === 'band';

  return (
    <div
      className={
        isBand
          ? 'rounded-2xl border border-red-200 bg-gradient-to-br from-red-600 to-red-700 px-6 py-8 text-white shadow-lg sm:px-10 sm:py-10'
          : 'rounded-2xl border border-red-200 bg-gradient-to-br from-red-600 to-red-700 px-6 py-10 text-white shadow-xl sm:px-10 sm:py-12'
      }
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-50">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            7-day Pro trial
          </p>
          <h2
            className={
              isBand
                ? 'mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl'
                : 'mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl'
            }
          >
            Start your 7-day Pro trial
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-red-50 sm:text-base">
            <li className="flex items-start gap-2">
              <CreditCard className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
              <span>
                <strong className="font-semibold text-white">
                  No credit card
                </strong>{' '}
                at Stripe Checkout
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-200" />
              <span>
                <strong className="font-semibold text-white">Monthly Pro</strong>{' '}
                only — add a payment method before the trial ends to keep access
              </span>
            </li>
          </ul>
          <p className="mt-3 text-xs text-red-100 sm:text-sm">
            See{' '}
            <Link
              to="/terms"
              className="font-medium text-white underline decoration-red-300 underline-offset-2 hover:text-red-50"
            >
              Terms
            </Link>{' '}
            for trial eligibility and limits.
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col lg:items-stretch">
          <MarketingSignupLink
            proTrial
            onClick={onTrialClick}
            className="inline-flex items-center justify-center rounded-lg bg-white px-8 py-4 text-center text-base font-bold text-red-700 shadow-md transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-red-600"
          >
            {TRIAL_CTA_LABEL}
          </MarketingSignupLink>
          <a
            href={compareHref}
            className="inline-flex items-center justify-center rounded-lg border-2 border-white/40 px-8 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Compare yearly plans
          </a>
        </div>
      </div>
    </div>
  );
}
