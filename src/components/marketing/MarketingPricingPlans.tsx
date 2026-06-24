import { Check } from 'lucide-react';
import { PLANS, YEARLY_DISCOUNT_FRACTION } from '../../lib/planConfig.ts';
import { marketingPriceForInterval } from '../../lib/marketingPlanPricing.ts';
import type { BillingIntervalPreference } from '../../lib/billingIntervalPreference.ts';
import {
  CONTACT_SALES_MAILTO,
  marketingPlans,
  type MarketingPlanId,
} from '../../pages/marketing/marketingPricingCopy.ts';
import { BillingIntervalToggle } from '../billing/BillingIntervalToggle.tsx';
import { useBillingIntervalPreference } from '../../hooks/useBillingIntervalPreference.ts';
import { MarketingSignupLink } from './MarketingSignupLink.tsx';
import { MarketingTrialHero } from './MarketingTrialHero.tsx';
import { MarketingSavingsCallout } from './MarketingSavingsCallout.tsx';
import { MarketingPlanPriceDisplay } from './MarketingPlanPriceDisplay.tsx';
import { PLAN_CTA_LABEL, TRIAL_CTA_LABEL } from '../../lib/marketingCtaCopy.ts';

const monthlyPriceById: Record<MarketingPlanId, number | null> = {
  basic: PLANS.find((p) => p.name === 'basic')!.monthlyPrice,
  pro: PLANS.find((p) => p.name === 'pro')!.monthlyPrice,
  elite: PLANS.find((p) => p.name === 'elite')!.monthlyPrice,
  enterprise: null,
};

type MarketingPricingPlansProps = {
  /** Show intro copy above the toggle (pricing page). */
  showIntro?: boolean;
  /** Compact toggle without outer card padding. */
  compactToggle?: boolean;
  /** Optional controlled interval (e.g. homepage shares toggle with hero CTAs). */
  interval?: BillingIntervalPreference;
  onIntervalChange?: (interval: BillingIntervalPreference) => void;
};

export function MarketingPricingPlans({
  showIntro = false,
  compactToggle = false,
  interval: controlledInterval,
  onIntervalChange,
}: MarketingPricingPlansProps) {
  const internal = useBillingIntervalPreference();
  const interval = controlledInterval ?? internal.interval;
  const setInterval = onIntervalChange ?? internal.setInterval;
  const discountPct = Math.round(YEARLY_DISCOUNT_FRACTION * 100);

  return (
    <>
      {showIntro ? (
        <div className="border-b border-gray-200 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900">
              Pricing
            </h1>
            <p className="mt-4 max-w-3xl text-lg text-gray-600">
              Compare <strong>Basic</strong>, <strong>Pro</strong>,{' '}
              <strong>Elite</strong>, and <strong>Enterprise</strong>. Yearly
              billing saves {discountPct}% — or start a no-card Pro trial on
              monthly.
            </p>
            <div className="mt-8">
              <MarketingTrialHero
                size="band"
                compareHref="#pricing-plans"
                onTrialClick={() => setInterval('month')}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div
        id={showIntro ? 'pricing-plans' : undefined}
        className={
          showIntro
            ? 'mx-auto max-w-6xl px-4 pt-10 sm:px-6'
            : 'mx-auto max-w-6xl px-4 sm:px-6'
        }
      >
        {!showIntro && !compactToggle ? (
          <div className="mb-6">
            <MarketingSavingsCallout interval={interval} prominent />
          </div>
        ) : null}
        <BillingIntervalToggle
          value={interval}
          onChange={setInterval}
          prominent={!compactToggle && !showIntro}
          variant={showIntro || compactToggle ? 'marketing' : 'settings'}
        />
      </div>

      <div
        className={
          showIntro
            ? 'mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12'
            : 'mx-auto max-w-6xl px-4 py-8 sm:px-6'
        }
      >
        <div className="grid gap-6 lg:grid-cols-4">
          {marketingPlans.map((plan) => {
            const monthlyPrice = monthlyPriceById[plan.id];
            const price =
              monthlyPrice !== null
                ? marketingPriceForInterval(
                    monthlyPrice,
                    interval,
                    plan.id === 'enterprise' ? undefined : plan.id,
                  )
                : {
                    priceLabel: plan.priceLabel,
                    priceDetail: plan.priceDetail,
                  };

            const showTrialBullet =
              plan.id === 'pro' && interval === 'month';
            const offerProTrialCta = plan.id === 'pro' && interval === 'month';

            return (
              <div
                key={plan.id}
                className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                  plan.recommended
                    ? 'border-red-300 ring-2 ring-red-100 lg:scale-[1.02]'
                    : 'border-gray-200'
                }`}
              >
                {plan.recommended ? (
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                    Recommended
                  </p>
                ) : null}
                <h2 className="mt-1 text-xl font-bold text-gray-900">
                  {plan.name}
                </h2>
                <div className="mt-3">
                  <MarketingPlanPriceDisplay price={price} />
                </div>
                {plan.id === 'pro' && interval === 'year' ? (
                  <p className="mt-2 text-xs text-blue-800">
                    Switch to <strong>Monthly</strong> above for the 7-day Pro
                    trial (no card at checkout).
                  </p>
                ) : null}
                <p className="mt-3 text-sm text-gray-600">{plan.blurb}</p>
                <ul className="mt-6 flex-1 space-y-3 text-sm text-gray-700">
                  {plan.bullets
                    .filter(
                      (b) =>
                        showTrialBullet ||
                        !b.toLowerCase().includes('7-day free trial'),
                    )
                    .map((b) => (
                      <li key={b} className="flex gap-2">
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
                          aria-hidden
                        />
                        <span>{b}</span>
                      </li>
                    ))}
                </ul>
                {plan.ctaHref === 'mailto' ? (
                  <a
                    href={CONTACT_SALES_MAILTO}
                    className="mt-8 block w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50"
                  >
                    {plan.ctaLabel}
                  </a>
                ) : (
                  <>
                    <MarketingSignupLink
                      interval={interval}
                      planId={plan.id}
                      proTrial={offerProTrialCta}
                      className={`mt-8 block w-full rounded-md px-4 py-2.5 text-center text-sm font-semibold text-white shadow ${
                        plan.recommended
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-gray-900 hover:bg-gray-800'
                      }`}
                    >
                      {offerProTrialCta ? TRIAL_CTA_LABEL : PLAN_CTA_LABEL}
                    </MarketingSignupLink>
                    {plan.id === 'pro' && interval === 'year' ? (
                      <MarketingSignupLink
                        proTrial
                        onClick={() => setInterval('month')}
                        className="mt-3 block w-full text-center text-sm font-medium text-red-600 hover:text-red-500"
                      >
                        {TRIAL_CTA_LABEL} instead (monthly, no card)
                      </MarketingSignupLink>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <p
          className={`mt-10 text-center text-sm ${
            interval === 'year'
              ? 'font-semibold text-green-700'
              : 'text-gray-500'
          }`}
        >
          {interval === 'year'
            ? `Yearly plans save ${discountPct}% — billed as a single annual charge at checkout.`
            : 'Monthly plans renew each month unless cancelled.'}
        </p>
      </div>
    </>
  );
}
