import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { Check, Loader2, Sparkles, X as XIcon } from 'lucide-react';
import { functions } from '../../lib/firebase.ts';
import { PLANS, type PlanName, YEARLY_DISCOUNT_FRACTION } from '../../lib/planConfig.ts';
import { useOrg } from '../../hooks/useOrg.ts';
import { useAuth } from '../../hooks/useAuth.ts';

type BillingIntervalUi = 'month' | 'year';

function formatUsd(amount: number): string {
  return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
}

export function PlanSelector() {
  const { org } = useOrg();
  const { userProfile } = useAuth();
  const [billingInterval, setBillingInterval] = useState<BillingIntervalUi>('month');
  const [loading, setLoading] = useState<PlanName | null>(null);
  const [error, setError] = useState('');

  const orgId = userProfile?.activeOrgId;
  const currentPlan = org?.plan;

  async function handleSelectPlan(plan: PlanName) {
    if (!orgId || plan === currentPlan) return;
    setLoading(plan);
    setError('');

    try {
      const createCheckoutSession = httpsCallable<
        { orgId: string; plan: string; billingInterval?: BillingIntervalUi },
        { url: string }
      >(functions, 'createCheckoutSession');

      const result = await createCheckoutSession({
        orgId,
        plan,
        ...(billingInterval === 'year' ? { billingInterval: 'year' as const } : {}),
      });
      if (result.data.url) {
        window.location.href = result.data.url;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start checkout.';
      setError(message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-gray-900">Billing</p>
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
          <button
            type="button"
            onClick={() => setBillingInterval('month')}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              billingInterval === 'month'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingInterval('year')}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              billingInterval === 'year'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Yearly (save {Math.round(YEARLY_DISCOUNT_FRACTION * 100)}%)
          </button>
        </div>
      </div>

      {/* AI feature showcase */}
      <div className="mb-6 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-red-50 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-500" />
          <h3 className="text-sm font-bold text-gray-900">
            AI Compliance Assistant - included with Pro, Elite, and Enterprise
          </h3>
        </div>
        <p className="mb-3 text-sm text-gray-600">
          How to use AI: open the dashboard assistant and ask about overdue inspections, due
          dates, or a quick compliance summary. It works in Pro, Elite, and Enterprise plans.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {[
            '"Which extinguishers are overdue?"',
            '"Explain the 6-year maintenance rule"',
            '"Summarize my compliance status"',
            '"What does NFPA 10 require monthly?"',
          ].map((q) => (
            <div key={q} className="flex items-center gap-2 rounded-md bg-white/70 px-3 py-1.5 text-xs text-gray-700">
              <Sparkles className="h-3 w-3 shrink-0 text-blue-500" />
              {q}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLANS.filter((p) => p.name !== 'enterprise').map((plan) => {
          const isCurrent = currentPlan === plan.name;
          const isLoading = loading === plan.name;

          return (
            <div
              key={plan.name}
              className={`rounded-lg border-2 p-6 ${
                isCurrent
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <h3 className="text-lg font-bold text-gray-900">{plan.displayName}</h3>
              {billingInterval === 'month' ? (
                <p className="mt-1 text-3xl font-bold text-gray-900">
                  {formatUsd(plan.monthlyPrice!)}
                  <span className="text-sm font-normal text-gray-500">/mo</span>
                </p>
              ) : (
                <>
                  <p className="mt-1 text-3xl font-bold text-gray-900">
                    {formatUsd(plan.yearlyTotalPrice!)}
                    <span className="text-sm font-normal text-gray-500">/yr</span>
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatUsd(plan.monthlyPrice! * 12)} if paid monthly — you save{' '}
                    {formatUsd(plan.monthlyPrice! * 12 - plan.yearlyTotalPrice!)} per year
                  </p>
                </>
              )}
              <p className="mt-2 text-sm text-gray-500">
                {plan.name === 'basic'
                  ? 'Best for small businesses replacing paper logs with easier inspections, reminders, and compliance reports.'
                  : plan.name === 'pro'
                    ? 'Adds camera barcode scanning, GPS capture, inspection photos, and the AI assistant.'
                    : 'Everything in Pro, plus team members & invites, higher scale, and priority support.'}
              </p>

              <ul className="mt-4 space-y-2">
                {plan.features.map((feature) => {
                  const isAiFeature = feature.toLowerCase().includes('ai');
                  const isExcluded = feature.toLowerCase().includes('not included');
                  return (
                    <li key={feature} className={`flex items-start gap-2 text-sm ${isExcluded ? 'text-gray-400' : 'text-gray-600'}`}>
                      {isExcluded ? (
                        <XIcon className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
                      ) : (
                        <Check className={`mt-0.5 h-4 w-4 shrink-0 ${isAiFeature ? 'text-blue-500' : 'text-green-500'}`} />
                      )}
                      <span className={isAiFeature && !isExcluded ? 'font-medium text-blue-700' : ''}>
                        {feature}
                        {isAiFeature && !isExcluded && (
                          <Sparkles className="ml-1 inline h-3 w-3 text-blue-500" />
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan.name)}
                disabled={isCurrent || isLoading || loading !== null}
                className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  isCurrent
                    ? 'bg-red-100 text-red-700 cursor-default'
                    : 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50'
                }`}
              >
                {isLoading ? (
                  <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                ) : isCurrent ? (
                  'Current Plan'
                ) : currentPlan ? (
                  'Switch Plan'
                ) : (
                  'Get Started'
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Enterprise section */}
      {currentPlan === 'enterprise' ? (
        <div className="mt-4 rounded-lg border-2 border-red-500 bg-red-50 p-4 text-center">
          <p className="text-sm font-semibold text-gray-900">Enterprise Plan</p>
          <p className="mt-1 text-sm text-gray-600">
            Unlimited assets, all features, custom pricing, and priority support.
          </p>
          <span className="mt-2 inline-block rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
            Current Plan
          </span>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
          <p className="text-sm text-gray-600">
            Need more than {PLANS.find((p) => p.name === 'elite')?.assetLimit ?? 500} extinguishers?{' '}
            <span className="font-semibold text-gray-900">Enterprise</span> plans with unlimited
            assets, AI access, and custom pricing are available.
          </p>
          <p className="mt-1 text-sm text-gray-500">Contact us at help@extinguishertracker.com</p>
        </div>
      )}
    </div>
  );
}
